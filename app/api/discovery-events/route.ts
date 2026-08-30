import { addDays, chicagoTodayKey, type EventsResponse, type LiveEvent } from '@/lib/live-event';

export const runtime = 'edge';

type UnknownRecord = Record<string, unknown>;

const KIDDO_ENDPOINT = 'https://api.kiddochicago.com/api/events';
const ZIP_CENTER = { lat: 41.7244, lng: -87.8273 };

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function compact(value: unknown, max = 420) {
  const text = stringValue(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function safeUrl(value: unknown) {
  try {
    const url = new URL(stringValue(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function haversineMiles(lat: number, lng: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat - ZIP_CENTER.lat);
  const dLng = radians(lng - ZIP_CENTER.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(ZIP_CENTER.lat)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseClock(hourValue: string, minuteValue: string | undefined, periodValue: string) {
  let hour = Number(hourValue);
  const minute = Number(minuteValue ?? '0');
  const period = periodValue.toLowerCase();
  if (period.startsWith('p') && hour !== 12) hour += 12;
  if (period.startsWith('a') && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function eventTimes(dateKey: string, value: unknown) {
  const raw = stringValue(value);
  const matches = [...raw.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/gi)];
  if (!matches.length || /all\s*day/i.test(raw)) return { startLocal: `${dateKey}T00:00:00`, allDay: true };
  const startLocal = `${dateKey}T${parseClock(matches[0][1], matches[0][2], matches[0][3])}`;
  const endLocal = matches[1] ? `${dateKey}T${parseClock(matches[1][1], matches[1][2], matches[1][3])}` : undefined;
  return { startLocal, endLocal: endLocal && endLocal > startLocal ? endLocal : undefined, allDay: false };
}

function ageCandidates(text: string) {
  const candidates: Array<{ min: number; max: number; label: string }> = [];
  for (const match of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:[-–—]|to|through)\s*(\d{1,2})(?!\s*months?\b)\b/gi)) {
    candidates.push({ min: Number(match[1]), max: Number(match[2]), label: `Ages ${match[1]}–${match[2]}` });
  }
  for (const match of text.matchAll(/\b(\d{1,2})\s*(?:[-–—]|to|through)\s*(\d{1,2})\s*years?\b/gi)) {
    candidates.push({ min: Number(match[1]), max: Number(match[2]), label: `Ages ${match[1]}–${match[2]}` });
  }
  for (const match of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:\+|(?:and|&)\s*(?:up|older)|or older)/gi)) {
    candidates.push({ min: Number(match[1]), max: 99, label: `Ages ${match[1]}+` });
  }
  for (const match of text.matchAll(/\b(?:ages?|age|children)\s*:?\s*(\d{1,2})\s*(?:and|&)\s*(?:under|younger)/gi)) {
    candidates.push({ min: 0, max: Number(match[1]), label: `Ages ${match[1]} and under` });
  }
  for (const match of text.matchAll(/\b(?:children|kids?)?\s*(?:up to|through)\s*(?:age\s*)?(\d{1,2})(?!\s*months?\b)\b/gi)) {
    candidates.push({ min: 0, max: Number(match[1]), label: `Ages ${match[1]} and under` });
  }
  for (const match of text.matchAll(/\b(?:newborn|infants?|\d{1,2}\s*months?)\s*(?:[-–—]|to|through|up to)\s*(\d{1,2})\s*months?\b/gi)) {
    const maxAge = Math.max(0, Math.ceil(Number(match[1]) / 12));
    candidates.push({ min: 0, max: maxAge, label: `Ages ${maxAge} and under` });
  }
  for (const match of text.matchAll(/\b(\d{1,2})\s*(?:[-–—]|to|through)\s*(\d{1,2})\s*months?\b/gi)) {
    const maxAge = Math.max(0, Math.ceil(Number(match[2]) / 12));
    candidates.push({ min: 0, max: maxAge, label: `Ages ${maxAge} and under` });
  }
  for (const match of text.matchAll(/\bgrades?\s*:?\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\s*(?:[-–—]|to|through)\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const grade = (entry: string) => entry.toLowerCase() === 'k' ? 0 : Number(entry);
    candidates.push({ min: grade(match[1]) + 5, max: grade(match[2]) + 6, label: `Grades ${match[1].toUpperCase()}–${match[2].toUpperCase()}` });
  }
  return candidates;
}

function audienceFor(record: UnknownRecord) {
  const title = stringValue(record.title);
  const description = stringValue(record.description);
  const ageRange = stringValue(record.ageRange);
  const text = `${title} ${description} ${ageRange}`;
  const lower = text.toLowerCase();
  const candidates = ageCandidates(text);
  const matchingAges = candidates.filter((candidate) => candidate.min <= 16 && candidate.max >= 7);
  const matchingAge = matchingAges.find((candidate) => candidate.min < 13) ?? matchingAges[0];
  if (candidates.length && !matchingAge) return { include: false, ages: '', teenOnly: false, family: false };

  const family = /\bfamil(?:y|ies)\b|all ages|all-ages|caregiver/.test(lower);
  const namedAudience = `${title} ${ageRange}`.toLowerCase();
  const namedTeen = /\bteens?|teenagers?|high school|young adults?\b/.test(namedAudience)
    || namedAudience.includes('diversiteen')
    || namedAudience.includes('volunteen')
    || /\b(?:for teens?|teens? only|high school students?)\b/.test(lower);
  const includesNine = matchingAges.some((candidate) => candidate.min <= 9 && candidate.max >= 9);
  const teenOnly = (matchingAges.length > 0 && matchingAges.every((candidate) => candidate.min >= 13))
    || (!includesNine && namedTeen);
  const youngOnly = /\b(?:newborns?|infants?|bab(?:y|ies)|toddlers?|tots?|preschool(?:ers)?|early childhood|little ones?|birth\s*(?:-|to|through)\s*[0-6])\b/.test(lower);
  const youngOnlyTitle = /\b(?:bab(?:y|ies)|toddlers?|preschool(?:ers)?|lapsit|early childhood)\b|little wigglers|wiggle\s*(?:&|and)\s*wobble/.test(title.toLowerCase())
    && !/baby shark/.test(title.toLowerCase());
  const adultOnly = /\badults? only\b|\b21\s*\+|\b18\s*(?:\+|and (?:up|older))|\bseniors?\b/.test(lower)
    && !/\bchildren|kids?|youth|teens?|tweens?|family|all ages\b/.test(lower);
  const administrative = /\b(board|committee|commission) meetings?\b|public hearing|meeting minutes|staff training/.test(lower);
  const falseFamilyMatch = /\bfounding families\b|\bfamily (?:history|records|genealogy)\b/.test(lower);
  const adultProgram = /\b(?:ceramics open studio|forest bathing|medicare|retirement|blood pressure|resume review|business networking)\b/.test(lower)
    && !/\b(?:kids?|children|youth|teens?|tweens?)\b/.test(title.toLowerCase());
  if (adultOnly || administrative || falseFamilyMatch || adultProgram || youngOnlyTitle || (youngOnly && !matchingAge)) {
    return { include: false, ages: '', teenOnly: false, family: false };
  }
  if (matchingAge) return { include: true, ages: matchingAge.label, teenOnly, family };
  if (/\bteens?|high school\b/.test(lower)) return { include: true, ages: 'Teens', teenOnly: teenOnly || (!family && !/\bchildren|kids?|elementary|school[- ]age\b/.test(lower)), family };
  if (/\btweens?|preteens?|middle school\b/.test(lower)) return { include: true, ages: 'Tweens / teens', teenOnly, family };
  if (family) return { include: true, ages: 'Family / all ages', teenOnly: false, family: true };
  if (/\belementary|school[- ]age|children|kids?|youth\b/.test(lower) && !youngOnly) return { include: true, ages: ageRange || 'Kids / youth', teenOnly: false, family };

  const clearFamilyActivity = /\btouch[ -]a[ -]truck|kids? corner|children'?s activities|family fun|story(?:time|walk)|lego|minecraft|pokemon|junior|youth|parade|movie in the park|zoo|all ages\b/.test(lower);
  return clearFamilyActivity
    ? { include: true, ages: 'Family / age not specified', teenOnly: false, family: true }
    : { include: false, ages: '', teenOnly: false, family: false };
}

function categoryFor(text: string, supplied: unknown) {
  const lower = `${stringValue(supplied)} ${text}`.toLowerCase();
  if (/concert|music|sing|dance|perform/.test(lower)) return { category: 'Music', tone: 'gold', mark: 'LISTEN' };
  if (/nature|outdoor|hike|bird|forest|garden|wildlife|zoo|climb/.test(lower)) return { category: 'Outdoor', tone: 'blue', mark: 'EXPLORE' };
  if (/book|read|story|author/.test(lower)) return { category: 'Read', tone: 'plum', mark: 'READ' };
  if (/lego|build|code|coding|robot|engineering/.test(lower)) return { category: 'Build', tone: 'blue', mark: 'BUILD' };
  if (/science|stem|steam|maker|experiment/.test(lower)) return { category: 'Make', tone: 'coral', mark: 'MAKE' };
  if (/art|craft|paint|draw|create|studio|sew/.test(lower)) return { category: 'Create', tone: 'coral', mark: 'CREATE' };
  if (/game|chess|bingo|dungeons|dragon|play|trivia|pokemon/.test(lower)) return { category: 'Play', tone: 'plum', mark: 'PLAY' };
  return { category: 'Explore', tone: 'gold', mark: 'GO' };
}

function normalize(record: UnknownRecord, start: string, end: string): LiveEvent | null {
  const dateKey = stringValue(record.date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey < start || dateKey >= end) return null;
  const coords = record.coords && typeof record.coords === 'object' && !Array.isArray(record.coords) ? record.coords as UnknownRecord : {};
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null;
  const distance = haversineMiles(lat, lng);
  if (distance > 15) return null;

  const title = compact(record.title, 160) || 'Untitled event';
  const descriptionText = compact(record.description);
  const matchedAudience = audienceFor(record);
  if (!matchedAudience.include) return null;
  const url = safeUrl(record.sourceUrl);
  if (!url) return null;
  const price = compact(record.price, 60);
  const description = compact(`${price ? `${price}. ` : ''}${descriptionText}`);
  const sourceName = compact(record.sourceName, 100) || compact(record.location, 100) || 'Official organizer';
  const registrationRequired = record.registrationRequired === true || stringValue(record.registrationRequired).toLowerCase() === 'true';
  const registrationStatus = registrationRequired
    ? 'Registration required'
    : /no registration|drop[ -]?in/i.test(descriptionText)
      ? 'Drop-in / no signup'
      : 'Check official listing';
  const times = eventTimes(dateKey, record.time);
  const scheduleText = `${title} ${descriptionText}`.toLowerCase();
  const scheduleNotice = /cancelled|canceled|canclled/.test(scheduleText)
    ? 'Cancellation notice — check the official listing'
    : /rescheduled/.test(scheduleText)
      ? 'Rescheduled — confirm the new date on the official listing'
      : /postponed/.test(scheduleText)
        ? 'Postponed — check the official listing'
        : undefined;

  return {
    id: `kiddo-${stringValue(record.id) || `${dateKey}-${title}`}`,
    title,
    ...times,
    dateKey,
    source: `${sourceName} · via KiddoChicago`,
    sourceKind: 'Family guide',
    venue: compact(record.location, 120) || sourceName,
    address: compact(record.address, 180) || 'See official listing',
    distance,
    ages: matchedAudience.ages,
    teenOnly: matchedAudience.teenOnly,
    family: matchedAudience.family,
    ...categoryFor(`${title} ${descriptionText}`, record.category),
    description,
    registrationStatus,
    registrationUrl: url,
    url,
    scheduleNotice,
  };
}

function emptyResponse(start: string, days: number, failed: boolean): EventsResponse {
  return {
    events: [],
    updatedAt: new Date().toISOString(),
    window: { start, end: addDays(start, days - 1), days },
    sourceStatus: {
      attempted: 1,
      connected: failed ? 0 : 1,
      empty: failed ? 0 : 1,
      failed: failed ? 1 : 0,
      failedSources: failed ? ['KiddoChicago'] : [],
    },
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const requestedStart = query.get('start') ?? chicagoTodayKey();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart) ? requestedStart : chicagoTodayKey();
  const days = Math.min(7, Math.max(1, Number.parseInt(query.get('days') ?? '7', 10) || 7));
  const end = addDays(start, days);

  try {
    const response = await fetch(KIDDO_ENDPOINT, {
      headers: { Accept: 'application/json', 'User-Agent': 'LibraryLoop/1.0' },
      signal: AbortSignal.timeout(18000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) throw new Error('Invalid event response');
    const events = payload
      .filter((record): record is UnknownRecord => Boolean(record && typeof record === 'object'))
      .map((record) => normalize(record, start, end))
      .filter((event): event is LiveEvent => Boolean(event))
      .sort((a, b) => a.startLocal.localeCompare(b.startLocal) || a.distance - b.distance);
    const deduped = new Map<string, LiveEvent>();
    for (const event of events) {
      const key = `${event.url.toLowerCase()}|${event.dateKey}|${event.startLocal}`;
      if (!deduped.has(key)) deduped.set(key, event);
    }
    const body = emptyResponse(start, days, false);
    body.events = [...deduped.values()];
    body.sourceStatus.empty = body.events.length ? 0 : 1;
    return Response.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=14400, stale-while-revalidate=43200' },
    });
  } catch {
    return Response.json(emptyResponse(start, days, true), {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    });
  }
}
