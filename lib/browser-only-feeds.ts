import { addDays, type EventsResponse, type LiveEvent, type SourceKind } from '@/lib/live-event';

type UnknownRecord = Record<string, unknown>;

type BrowserFeed = {
  id: string;
  name: string;
  endpoint: string;
  sourceKind: SourceKind;
  distance: number;
  address: string;
};

const browserFeeds: BrowserFeed[] = [
  { id: 'worth-browser', name: 'Worth Public Library District', endpoint: 'https://www.worthlibrary.com/wp-json/tribe/events/v1/events', sourceKind: 'Library', distance: 3.02, address: '6917 W 111th St, Worth, IL 60482' },
];

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function plainText(value: unknown) {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’' };
  return stringValue(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
      if (entity.startsWith('#')) {
        const hex = entity[1]?.toLowerCase() === 'x';
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      }
      return named[entity.toLowerCase()] ?? `&${entity};`;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function toLocalIso(value: unknown) {
  const match = stringValue(value).match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})[ T]?(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}T${match[4] ?? '00'}:${match[5] ?? '00'}:${match[6] ?? '00'}`;
}

function names(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(names);
  if (value && typeof value === 'object') {
    const record = value as UnknownRecord;
    const own = plainText(record.name ?? record.label ?? record.title);
    return own ? [own] : Object.values(record).flatMap(names);
  }
  const direct = plainText(value);
  return direct ? [direct] : [];
}

function audience(title: string, description: string, labels: string[], sourceKind: SourceKind) {
  const text = `${title} ${description} ${labels.join(' ')}`;
  const lower = text.toLowerCase();
  const family = /\bfamil(?:y|ies)\b|all ages|all-ages/.test(lower) || labels.some((label) => /^(all|everyone)$/i.test(label));
  const namedAudience = `${title} ${labels.join(' ')}`.toLowerCase();
  const namedTeen = /\bteens?|teenagers?|high school|young adults?\b/.test(namedAudience)
    || namedAudience.includes('diversiteen')
    || namedAudience.includes('volunteen')
    || /\b(?:for teens?|teens? only|high school students?)\b/.test(lower);
  const ageCandidates: Array<{ min: number; max: number; label: string }> = [];
  for (const match of text.matchAll(/\bages?\s*:?\s*(\d{1,2})\s*(?:[-–—]|to|through)\s*(\d{1,2})\b/gi)) {
    ageCandidates.push({ min: Number(match[1]), max: Number(match[2]), label: `Ages ${match[1]}–${match[2]}` });
  }
  for (const match of text.matchAll(/\bages?\s*:?\s*(\d{1,2})\s*(?:\+|(?:and|&)\s*(?:up|older)|or older)/gi)) {
    ageCandidates.push({ min: Number(match[1]), max: 99, label: `Ages ${match[1]}+` });
  }
  for (const match of text.matchAll(/\bgrades?\s*:?\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\s*(?:[-–—]|to|through)\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const grade = (value: string) => value.toLowerCase() === 'k' ? 0 : Number(value);
    ageCandidates.push({ min: grade(match[1]) + 5, max: grade(match[2]) + 6, label: `Grades ${match[1].toUpperCase()}–${match[2].toUpperCase()}` });
  }
  if (ageCandidates.length) {
    const matching = ageCandidates.filter((candidate) => candidate.min <= 16 && candidate.max >= 7);
    const selected = matching.find((candidate) => candidate.min < 13) ?? matching[0];
    if (!selected) return { include: false, ages: '', teenOnly: false, family: false };
    const includesNine = matching.some((candidate) => candidate.min <= 9 && candidate.max >= 9);
    return { include: true, ages: selected.label, teenOnly: matching.every((candidate) => candidate.min >= 12) || (!includesNine && namedTeen), family };
  }
  if (/\badults? only\b|\b18\s*\+|\bseniors?\b|\btoddlers?\b|\bpreschool|\b(?:library|branch|building)\s+(?:is\s+)?closed\b|holiday hours/.test(lower)) return { include: false, ages: '', teenOnly: false, family: false };
  if (/\bteens?|tweens?|middle school|high school/.test(lower)) return { include: true, ages: labels.find((label) => /teen|tween/i.test(label)) ?? 'Teens / tweens', teenOnly: namedTeen || (!family && !/\bchildren|kids?|elementary|school[- ]age\b/.test(lower) && /\bteens?|high school\b/.test(lower)), family };
  if (family) return { include: true, ages: 'Family / all ages', teenOnly: false, family: true };
  if (/\bchildren|child(?:ren)?|kids?|youth|school[- ]age/.test(lower)) return { include: true, ages: labels.find((label) => /child|kid|youth/i.test(label)) ?? 'Kids / youth', teenOnly: false, family };
  const publicActivity = /\b(concert|festival|fair|market|hike|walk|nature|birds?|skate|arts?|craft|story|show|movie|dance|celebration|workshop)\b/.test(lower);
  return { include: sourceKind !== 'Library' && publicActivity, ages: 'Family / age not specified', teenOnly: false, family: true };
}

function categoryFor(text: string) {
  const lower = text.toLowerCase();
  if (/concert|music|dance|perform/.test(lower)) return { category: 'Music', tone: 'gold', mark: 'LISTEN' };
  if (/nature|outdoor|hike|bird|forest|garden|wildlife/.test(lower)) return { category: 'Outdoor', tone: 'blue', mark: 'EXPLORE' };
  if (/book|read|story|author/.test(lower)) return { category: 'Read', tone: 'plum', mark: 'READ' };
  if (/lego|build|code|robot/.test(lower)) return { category: 'Build', tone: 'blue', mark: 'BUILD' };
  if (/art|craft|paint|draw|create|studio/.test(lower)) return { category: 'Create', tone: 'coral', mark: 'CREATE' };
  if (/game|chess|bingo|play|trivia/.test(lower)) return { category: 'Play', tone: 'plum', mark: 'PLAY' };
  return { category: 'Explore', tone: 'gold', mark: 'GO' };
}

function normalize(record: UnknownRecord, feed: BrowserFeed, start: string, end: string): LiveEvent | null {
  const startLocal = toLocalIso(record.start_date);
  const endLocal = toLocalIso(record.end_date) || undefined;
  const dateKey = startLocal.slice(0, 10);
  if (!startLocal || dateKey < start || dateKey >= end) return null;
  const title = plainText(record.title) || 'Untitled event';
  const fullDescription = plainText(record.description ?? record.excerpt);
  const description = fullDescription.length > 420 ? `${fullDescription.slice(0, 417).trimEnd()}…` : fullDescription;
  const labels = [...names(record.categories), ...names(record.tags)];
  const matchedAudience = audience(title, fullDescription, labels, feed.sourceKind);
  if (!matchedAudience.include) return null;
  const venueRecord = record.venue && typeof record.venue === 'object' && !Array.isArray(record.venue) ? record.venue as UnknownRecord : {};
  const venue = plainText(venueRecord.venue) || feed.name;
  const address = [venueRecord.address, venueRecord.city, venueRecord.state, venueRecord.zip].map(plainText).filter(Boolean).join(', ') || feed.address;
  const url = stringValue(record.url).startsWith('http') ? stringValue(record.url) : feed.endpoint;
  const registrationStatus = /registration (?:is )?required|must register/i.test(fullDescription)
    ? 'Registration required'
    : /register|registration|sign.?up|rsvp/i.test(fullDescription)
      ? 'Registration available'
      : /drop[ -]?in|no registration/i.test(fullDescription)
        ? 'Drop-in / no signup'
        : 'Check official listing';
  const scheduleNotice = /cancelled|canceled|canclled/i.test(`${title} ${fullDescription}`)
    ? 'Cancellation notice — check the official listing'
    : /rescheduled/i.test(`${title} ${fullDescription}`)
      ? 'Rescheduled — confirm the new date on the official listing'
      : undefined;
  return {
    id: `${feed.id}-${stringValue(record.global_id ?? record.id) || `${dateKey}-${title}`}`,
    title,
    startLocal,
    endLocal,
    dateKey,
    allDay: Boolean(record.all_day),
    source: feed.name,
    sourceKind: feed.sourceKind,
    venue,
    address,
    distance: feed.distance,
    ages: matchedAudience.ages,
    teenOnly: matchedAudience.teenOnly,
    family: matchedAudience.family,
    ...categoryFor(`${title} ${fullDescription} ${labels.join(' ')}`),
    description,
    registrationStatus,
    registrationUrl: url,
    url,
    scheduleNotice,
  };
}

export async function fetchBrowserOnlyEvents(start: string, externalSignal?: AbortSignal) {
  const end = addDays(start, 7);
  const results = await Promise.allSettled(browserFeeds.map(async (feed) => {
    const endpoint = new URL(feed.endpoint);
    endpoint.searchParams.set('start_date', `${start} 00:00:00`);
    endpoint.searchParams.set('end_date', `${end} 00:00:00`);
    endpoint.searchParams.set('per_page', '50');
    const signal = externalSignal ? AbortSignal.any([externalSignal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000);
    const response = await fetch(endpoint.toString(), { headers: { Accept: 'application/json' }, signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as UnknownRecord;
    const records = Array.isArray(payload.events) ? payload.events : [];
    return {
      feed,
      events: records.filter((record): record is UnknownRecord => Boolean(record && typeof record === 'object')).map((record) => normalize(record, feed, start, end)).filter((event): event is LiveEvent => Boolean(event)),
    };
  }));
  const successful = results.filter((result): result is PromiseFulfilledResult<{ feed: BrowserFeed; events: LiveEvent[] }> => result.status === 'fulfilled');
  return {
    events: successful.flatMap((result) => result.value.events),
    sourceStatus: {
      attempted: browserFeeds.length,
      connected: successful.length,
      empty: successful.filter((result) => result.value.events.length === 0).length,
      failed: results.length - successful.length,
      failedSources: results.flatMap((result, index) => result.status === 'rejected' ? [browserFeeds[index].name] : []),
    },
  };
}

type EventSupplement = Pick<EventsResponse, 'events' | 'sourceStatus'>;

function canonicalEventUrl(event: LiveEvent) {
  for (const value of [event.url, event.registrationUrl]) {
    try {
      const url = new URL(value);
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) {
        if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
      }
      if (url.pathname !== '/' && !/\/(?:events?|calendar)\/?$/i.test(url.pathname)) return `${url.origin}${url.pathname}${url.search}`.toLowerCase();
    } catch {
      // Ignore malformed optional URLs and fall back to the event identity below.
    }
  }
  return '';
}

export function mergeEventSources(server: EventsResponse, ...supplements: EventSupplement[]): EventsResponse {
  const deduped = new Map<string, LiveEvent>();
  const seenOfficialUrls = new Set<string>();
  for (const event of [server, ...supplements].flatMap((source) => source.events)) {
    const officialUrl = canonicalEventUrl(event);
    const urlKey = officialUrl ? `${officialUrl}|${event.dateKey}` : '';
    if (urlKey && seenOfficialUrls.has(urlKey)) continue;
    const key = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${event.startLocal}|${event.venue.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
    if (!deduped.has(key)) deduped.set(key, event);
    if (urlKey) seenOfficialUrls.add(urlKey);
  }
  const statuses = [server.sourceStatus, ...supplements.map((source) => source.sourceStatus)];
  return {
    ...server,
    events: [...deduped.values()].sort((a, b) => a.startLocal.localeCompare(b.startLocal) || a.distance - b.distance),
    sourceStatus: {
      attempted: statuses.reduce((sum, status) => sum + status.attempted, 0),
      connected: statuses.reduce((sum, status) => sum + status.connected, 0),
      empty: statuses.reduce((sum, status) => sum + status.empty, 0),
      failed: statuses.reduce((sum, status) => sum + status.failed, 0),
      failedSources: statuses.flatMap((status) => status.failedSources),
    },
  };
}

export const mergeBrowserEvents = (server: EventsResponse, browser: EventSupplement) => mergeEventSources(server, browser);
