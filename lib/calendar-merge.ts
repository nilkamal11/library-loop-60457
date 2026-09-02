import type { EventsResponse, LiveEvent } from './live-event';
import { CALENDAR_STALE_HOURS } from './calendar-config.ts';

export type CalendarHealth = 'current' | 'partial' | 'stale' | 'overnight-only' | 'unavailable';

export type CalendarPayload = EventsResponse & {
  health: CalendarHealth;
  message: string;
  requestedWindow: { start: string; end: string; days: number };
  structuredSnapshot: null | { start: string; end: string; updatedAt: string };
  futureCoverage: {
    latestEventDate: string;
    activeDates: number;
    eventsAfter30Days: number;
    sourcesAfter30Days: number;
  };
};

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().toLowerCase();
  } catch {
    return '';
  }
}

function eventKey(event: LiveEvent) {
  const officialUrl = canonicalUrl(event.url || event.registrationUrl);
  const identity = `${normalized(event.title)}|${event.startLocal}|${normalized(event.venue)}`;
  if (officialUrl) return `url:${officialUrl}|${identity}`;
  return `text:${identity}|${normalized(event.source)}`;
}

function withinWindow(event: LiveEvent, start: string, endExclusive: string) {
  return event.dateKey >= start && event.dateKey < endExclusive;
}

function hasTrustedAudience(event: LiveEvent) {
  const audience = normalized(event.ages);
  if (!audience || audience.includes('age not specified') || audience.includes('unknown')) return false;
  const range = audience.match(/ages?\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
  if (range) return Number(range[1]) <= 16 && Number(range[2]) >= 7;
  const plus = audience.match(/ages?\s*(\d{1,2})\s*\+/);
  if (plus) return Number(plus[1]) <= 16;
  const exact = audience.match(/^age\s*(\d{1,2})$/);
  if (exact) return Number(exact[1]) >= 7 && Number(exact[1]) <= 16;
  const grades = audience.match(/grades?\s*([k\d]{1,2})\s*[-–—]\s*([k\d]{1,2})/);
  if (grades) {
    const grade = (value: string) => value === 'k' ? 0 : Number(value);
    return grade(grades[1]) + 5 <= 16 && grade(grades[2]) + 6 >= 7;
  }
  return /family|all ages|children|childrens|kids?|youth|tweens?|teens?|middle school|high school/.test(audience);
}

export function mergeCalendarSnapshots(
  daily: EventsResponse | null,
  overnight: EventsResponse,
  start: string,
  days: number,
  now = new Date(),
): CalendarPayload {
  const endExclusive = addDays(start, days);
  const requestedEnd = addDays(endExclusive, -1);
  const deduped = new Map<string, LiveEvent>();
  for (const event of [...(daily?.events ?? []), ...overnight.events]) {
    if (!withinWindow(event, start, endExclusive) || !hasTrustedAudience(event)) continue;
    const key = eventKey(event);
    if (!deduped.has(key)) deduped.set(key, event);
  }

  const events = [...deduped.values()].sort((a, b) =>
    a.startLocal.localeCompare(b.startLocal) || a.distance - b.distance || a.title.localeCompare(b.title));
  const futureStart = addDays(start, 30);
  const eventsAfter30Days = events.filter((event) => event.dateKey >= futureStart);
  const futureCoverage = {
    latestEventDate: events.reduce((latest, event) => event.dateKey > latest ? event.dateKey : latest, ''),
    activeDates: unique(events.map((event) => event.dateKey)).length,
    eventsAfter30Days: eventsAfter30Days.length,
    sourcesAfter30Days: unique(eventsAfter30Days.map((event) => event.source)).length,
  };

  const dailyStatus = daily?.sourceStatus;
  const sourceStatus = {
    attempted: (dailyStatus?.attempted ?? 0) + overnight.sourceStatus.attempted,
    connected: (dailyStatus?.connected ?? 0) + overnight.sourceStatus.connected,
    empty: (dailyStatus?.empty ?? 0) + overnight.sourceStatus.empty,
    failed: (dailyStatus?.failed ?? 0) + overnight.sourceStatus.failed,
    failedSources: unique([...(dailyStatus?.failedSources ?? []), ...overnight.sourceStatus.failedSources]),
    retained: (dailyStatus?.retained ?? 0) + (overnight.sourceStatus.retained ?? 0),
    retainedSources: unique([...(dailyStatus?.retainedSources ?? []), ...(overnight.sourceStatus.retainedSources ?? [])]),
  };

  let health: CalendarHealth = 'overnight-only';
  let message = 'Only the overnight library snapshot is available. The full daily calendar is being repaired.';
  const ageHours = (value: string) => value ? Math.max(0, (now.getTime() - Date.parse(value)) / 3_600_000) : Number.POSITIVE_INFINITY;
  const overnightAgeHours = ageHours(overnight.updatedAt);
  if (daily) {
    const snapshotAgeHours = ageHours(daily.updatedAt);
    const coversRequest = daily.window.start <= start && daily.window.end >= requestedEnd;
    const hasSourceProblems = sourceStatus.failed > 0 || sourceStatus.retained > 0;
    if (snapshotAgeHours > CALENDAR_STALE_HOURS || (overnight.sourceStatus.attempted > 0 && overnightAgeHours > CALENDAR_STALE_HOURS)) {
      health = 'stale';
      message = 'Showing the newest last-known-good calendar while one of the saved data lanes catches up.';
    } else if (!coversRequest || hasSourceProblems) {
      health = 'partial';
      message = !coversRequest
        ? `The structured collection window currently runs through ${daily.window.end}; overnight events are merged for the remaining dates.`
        : `${sourceStatus.connected}/${sourceStatus.attempted} sources responded; last-known-good events are retained where needed.`;
    } else {
      health = 'current';
      message = 'Updated daily from saved official calendar data.';
    }
  } else if (overnightAgeHours > CALENDAR_STALE_HOURS) {
    health = 'stale';
    message = 'Only an older last-known-good overnight calendar is available.';
  }

  const savedTimes = [daily?.updatedAt, overnight.updatedAt].filter((value): value is string => Boolean(value)).sort();

  return {
    events,
    updatedAt: savedTimes[savedTimes.length - 1] ?? '',
    window: { start, end: requestedEnd, days },
    requestedWindow: { start, end: requestedEnd, days },
    structuredSnapshot: daily
      ? { start: daily.window.start, end: daily.window.end, updatedAt: daily.updatedAt }
      : null,
    futureCoverage,
    sourceStatus,
    health,
    message,
  };
}

export function unavailableCalendar(start: string, days: number): CalendarPayload {
  const end = addDays(start, days - 1);
  return {
    events: [],
    updatedAt: '',
    window: { start, end, days },
    requestedWindow: { start, end, days },
    structuredSnapshot: null,
    futureCoverage: { latestEventDate: '', activeDates: 0, eventsAfter30Days: 0, sourcesAfter30Days: 0 },
    sourceStatus: { attempted: 0, connected: 0, empty: 0, failed: 0, failedSources: [], retained: 0, retainedSources: [] },
    health: 'unavailable',
    message: 'The saved calendar could not be loaded. Please retry in a moment.',
  };
}
