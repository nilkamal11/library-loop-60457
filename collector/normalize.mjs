import { createHash } from 'node:crypto';
import {
  CHICAGO_TIME_ZONE,
  MAX_DESCRIPTION_LENGTH,
  MAX_EVENTS_PER_BATCH,
  MAX_EVENTS_PER_SOURCE,
} from './constants.mjs';
import { librarySources } from './sources.mjs';

const allowedSources = new Map(librarySources.map((source) => [source.id, source]));

const chicagoFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CHICAGO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const requiredLiveEventKeys = [
  'id', 'title', 'startLocal', 'dateKey', 'allDay', 'source', 'sourceKind',
  'venue', 'address', 'distance', 'ages', 'teenOnly', 'family', 'category',
  'tone', 'mark', 'description', 'registrationStatus', 'registrationUrl', 'url',
];

const allowedLiveEventKeys = new Set([...requiredLiveEventKeys, 'endLocal', 'scheduleNotice']);

export function cleanText(value, maxLength = 4_000) {
  const text = String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : text;
}

function localParts(date) {
  const parts = chicagoFormatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`;
}

export function parseDateValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1_000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : { localIso: localParts(date), allDay: false };
  }

  const raw = cleanText(value, 160);
  if (!raw) return null;

  const validCalendarDate = (year, month, day) => {
    const candidate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return candidate.getUTCFullYear() === Number(year)
      && candidate.getUTCMonth() === Number(month) - 1
      && candidate.getUTCDate() === Number(day);
  };

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    if (!validCalendarDate(dateOnly[1], dateOnly[2], dateOnly[3])) return null;
    return { localIso: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00`, allDay: true };
  }

  const local = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (local) {
    const [, year, month, day, hour, minute, second = '00'] = local;
    const numbers = [month, day, hour, minute, second].map(Number);
    if (validCalendarDate(year, month, day)
      && numbers[2] <= 23 && numbers[3] <= 59 && numbers[4] <= 59) {
      return { localIso: `${year}-${month}-${day}T${hour}:${minute}:${second}`, allDay: false };
    }
    return null;
  }

  // Offset-bearing values are unambiguous and safe to convert. Ambiguous prose
  // dates are intentionally not guessed.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : { localIso: localParts(date), allDay: false };
}

export function safeUrl(value, baseUrl) {
  try {
    const url = new URL(String(value ?? ''), baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.hash = '';
    const normalized = url.toString();
    return normalized.length <= 1_200 ? normalized : '';
  } catch {
    return '';
  }
}

function namesFromJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(namesFromJsonLd);
  if (value && typeof value === 'object') {
    const direct = cleanText(value.name ?? value.audienceType ?? value.typicalAgeRange, 180);
    return direct ? [direct] : Object.values(value).flatMap(namesFromJsonLd);
  }
  const direct = cleanText(value, 180);
  return direct ? [direct] : [];
}

function flattenJsonLd(value, output) {
  if (Array.isArray(value)) {
    for (const item of value) flattenJsonLd(item, output);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.some((type) => String(type).toLowerCase() === 'event')) output.push(value);
  for (const [key, child] of Object.entries(value)) {
    if (key !== '@context' && key !== '@type') flattenJsonLd(child, output);
  }
}

export function extractJsonLdEvents(rawScripts) {
  const events = [];
  for (const raw of rawScripts) {
    try {
      flattenJsonLd(JSON.parse(raw), events);
    } catch {
      // Invalid structured data is common; the DOM path may still be usable.
    }
  }
  return events;
}

function postalAddress(value) {
  if (typeof value === 'string') return cleanText(value, 300);
  if (!value || typeof value !== 'object') return '';
  return cleanText([
    value.streetAddress,
    value.addressLocality,
    value.addressRegion,
    value.postalCode,
  ].filter(Boolean).join(', '), 300);
}

export function jsonLdToCandidate(record, baseUrl) {
  const location = Array.isArray(record.location) ? record.location[0] : record.location;
  const offers = Array.isArray(record.offers) ? record.offers[0] : record.offers;
  const organizer = Array.isArray(record.organizer) ? record.organizer[0] : record.organizer;
  const eventUrl = safeUrl(record.url ?? record['@id'] ?? offers?.url, baseUrl);
  const registrationUrl = safeUrl(offers?.url ?? record.url, baseUrl) || eventUrl;
  const audience = namesFromJsonLd(record.audience).join(' ');
  const status = cleanText(record.eventStatus, 180);
  return {
    extractionMethod: 'json-ld',
    title: cleanText(record.name ?? record.headline, 220),
    start: record.startDate,
    end: record.endDate,
    description: cleanText(record.description, 4_000),
    text: cleanText([record.name, record.description, audience, status].filter(Boolean).join(' '), 5_000),
    audience,
    venue: cleanText(location?.name ?? organizer?.name, 240),
    address: postalAddress(location?.address) || cleanText(location?.address, 300),
    url: eventUrl,
    registrationUrl,
    eventStatus: status,
  };
}

function explicitAge(text, structuredAudience = '') {
  const candidates = [];
  for (const match of text.matchAll(/\bat least\s+(\d{1,2})(?:\s+years?(?:\s+\d{1,2}\s+months?)?)?\s+but\s+less\s+than\s+(\d{1,2})\b/gi)) {
    const maximum = Math.max(Number(match[1]), Number(match[2]) - 1);
    candidates.push({ min: Number(match[1]), max: maximum, label: `Ages ${match[1]}–${maximum}`, kind: 'age' });
  }
  for (const match of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:yrs?|years?)?\s*(?:[-–—]|to|through)\s*(\d{1,2})\b/gi)) {
    candidates.push({ min: Number(match[1]), max: Number(match[2]), label: `Ages ${match[1]}–${match[2]}`, kind: 'age' });
  }
  for (const match of text.matchAll(/\b(\d{1,2})\s*(?:[-–—]|to|through)\s*(\d{1,2})\s*years?\b/gi)) {
    candidates.push({ min: Number(match[1]), max: Number(match[2]), label: `Ages ${match[1]}–${match[2]}`, kind: 'age' });
  }
  for (const match of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:\+|(?:and|&)\s*(?:up|older)|or older)(?=\s|[.,;:)]|$)/gi)) {
    candidates.push({ min: Number(match[1]), max: 99, label: `Ages ${match[1]}+`, kind: 'age' });
  }
  for (const match of structuredAudience.matchAll(/\b(\d{1,2})\s*(?:\+|(?:and|&)\s*(?:up|older)|or older)(?=\s|[.,;:)]|$)/gi)) {
    candidates.push({ min: Number(match[1]), max: 99, label: `Ages ${match[1]}+`, kind: 'age' });
  }
  for (const match of text.matchAll(/\bgrades?\s*:?\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\s*(?:[-–—]|to|through)\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const grade = (entry) => entry.toLowerCase() === 'k' ? 0 : Number(entry);
    candidates.push({ min: grade(match[1]) + 5, max: grade(match[2]) + 6, label: `Grades ${match[1].toUpperCase()}–${match[2].toUpperCase()}`, kind: 'grade' });
  }
  return candidates;
}

export function classifyAudience(value, structuredAudience = '') {
  const text = cleanText(value, 7_000);
  const lower = text.toLowerCase();
  const ages = explicitAge(text, cleanText(structuredAudience, 1_000));
  const overlapsTarget = ages.filter((age) => age.min <= 16 && age.max >= 7);
  const includesNine = overlapsTarget.some((age) => age.min <= 9 && age.max >= 9);
  const namedTeen = /\bteens?|teenagers?|high school|young adults?|grades?\s*(?:7|8|9|10|11|12)\b/.test(lower)
    || lower.includes('diversiteen') || lower.includes('volunteen');
  const family = /\bfamil(?:y|ies)\b|all ages|all-ages|caregiver|parent(?:s)? and child/.test(lower);
  const youth = /\bchildren|child(?:ren)?|kids?|youth|school[- ]age|elementary|tweens?|middle school|teenagers?\b/.test(lower);
  const adultOnly = /\badults? only\b|\b18\s*(?:\+|and (?:up|older))|\b21\s*\+|\bseniors?\b|\b55\s*\+/.test(lower);
  const youngOnly = /\b(?:bab(?:y|ies)|toddlers?|tots?|preschool(?:ers)?|birth\s*(?:-|to|through)\s*5)\b/.test(lower);
  const administrative = /\b(board|committee|commission) meetings?\b|public hearing|bid opening|meeting minutes|\b(?:library|branch|building)\s+(?:is\s+)?closed\b|holiday hours/.test(lower);

  if (ages.length) {
    if (!overlapsTarget.length) return { decision: 'excluded', reason: 'explicit age range is outside ages 7–16' };
    const selected = overlapsTarget.find((age) => age.min < 13) ?? overlapsTarget[0];
    return {
      decision: 'accepted',
      reason: 'explicit age or grade range overlaps ages 7–16',
      ages: selected.label,
      teenOnly: overlapsTarget.every((age) => age.min >= 13) || (selected.kind === 'grade' && !includesNine && namedTeen),
      family,
    };
  }
  if (administrative) return { decision: 'excluded', reason: 'administrative meeting' };
  if (adultOnly) return { decision: 'excluded', reason: 'adult-only language' };
  if (youngOnly && !family) return { decision: 'excluded', reason: 'early-childhood-only language' };
  if (namedTeen) return { decision: 'accepted', reason: 'explicit teen audience', ages: 'Teens / tweens', teenOnly: true, family };
  if (family) return { decision: 'accepted', reason: 'family or all-ages audience', ages: 'Family / all ages', teenOnly: false, family: true };
  if (youth) return { decision: 'accepted', reason: 'explicit youth audience', ages: 'Kids / youth', teenOnly: false, family: false };
  return { decision: 'review', reason: 'no explicit age, family, youth, or teen audience signal' };
}

function categoryFor(text) {
  const lower = text.toLowerCase();
  if (/concert|music|dance|perform/.test(lower)) return { category: 'Music', tone: 'gold', mark: 'LISTEN' };
  if (/nature|outdoor|hike|bird|forest|garden|wildlife/.test(lower)) return { category: 'Outdoor', tone: 'blue', mark: 'EXPLORE' };
  if (/book|read|story|author/.test(lower)) return { category: 'Read', tone: 'plum', mark: 'READ' };
  if (/lego|build|code|coding|robot|engineering/.test(lower)) return { category: 'Build', tone: 'blue', mark: 'BUILD' };
  if (/art|craft|paint|draw|create|studio/.test(lower)) return { category: 'Create', tone: 'coral', mark: 'CREATE' };
  if (/game|chess|bingo|play|trivia/.test(lower)) return { category: 'Play', tone: 'plum', mark: 'PLAY' };
  return { category: 'Explore', tone: 'gold', mark: 'GO' };
}

function registrationStatus(text) {
  if (/registration (?:is )?required|must register/i.test(text)) return 'Registration required';
  if (/register|registration|sign.?up|rsvp/i.test(text)) return 'Registration available';
  if (/drop[ -]?in|no registration/i.test(text)) return 'Drop-in / no signup';
  return 'Check official listing';
}

function eventIdentity(sourceId, title, startLocal, url) {
  const hash = createHash('sha256').update(`${sourceId}|${title.toLowerCase()}|${startLocal}|${url}`).digest('hex').slice(0, 18);
  return `collector-${sourceId}-${hash}`;
}

export function normalizeCandidate(candidate, source, window) {
  const title = cleanText(candidate.title, 220);
  const start = parseDateValue(candidate.start);
  const eventUrl = safeUrl(candidate.url, source.url);
  if (!title || title.length < 3) return { decision: 'excluded', reason: 'missing event title' };
  if (!start) return { decision: 'review', reason: 'missing or ambiguous semantic start date', preview: { title, url: eventUrl } };
  if (!eventUrl) return { decision: 'review', reason: 'missing safe official event URL', preview: { title, startLocal: start.localIso } };

  const dateKey = start.localIso.slice(0, 10);
  if (dateKey < window.start || dateKey >= window.end) return { decision: 'excluded', reason: 'outside collection window' };

  const fullText = cleanText([
    title,
    candidate.description,
    candidate.text,
    candidate.audience,
  ].filter(Boolean).join(' '), 7_000);
  const audience = classifyAudience(fullText, candidate.audience);
  if (audience.decision !== 'accepted') {
    return {
      decision: audience.decision,
      reason: audience.reason,
      preview: { title, startLocal: start.localIso, url: eventUrl },
    };
  }

  const end = parseDateValue(candidate.end);
  const registrationUrl = safeUrl(candidate.registrationUrl, eventUrl) || eventUrl;
  const description = cleanText(candidate.description || candidate.text, MAX_DESCRIPTION_LENGTH);
  const statusText = cleanText(`${candidate.eventStatus ?? ''} ${fullText}`, 7_000);
  const scheduleNotice = /cancelled|canceled/i.test(statusText)
    ? 'Cancellation notice — check the official listing'
    : /rescheduled|postponed/i.test(statusText)
      ? 'Schedule changed — confirm details on the official listing'
      : undefined;

  const event = {
    id: eventIdentity(source.id, title, start.localIso, eventUrl),
    title,
    startLocal: start.localIso,
    ...(end?.localIso ? { endLocal: end.localIso } : {}),
    dateKey,
    allDay: Boolean(start.allDay),
    source: source.name,
    sourceKind: 'Library',
    venue: cleanText(candidate.venue, 240) || source.name,
    address: cleanText(candidate.address, 300) || 'Check official listing',
    distance: source.distance,
    ages: audience.ages,
    teenOnly: Boolean(audience.teenOnly),
    family: Boolean(audience.family),
    ...categoryFor(fullText),
    description,
    registrationStatus: registrationStatus(fullText),
    registrationUrl,
    url: eventUrl,
    ...(scheduleNotice ? { scheduleNotice } : {}),
  };
  validateLiveEvent(event);
  return { decision: 'accepted', reason: audience.reason, event };
}

function canonicalEventUrl(event) {
  try {
    const url = new URL(event.url);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().toLowerCase();
  } catch {
    return '';
  }
}

export function normalizeCandidates(candidates, source, window) {
  const events = [];
  const review = [];
  const excluded = [];
  const seen = new Set();
  for (const candidate of candidates.slice(0, MAX_EVENTS_PER_SOURCE * 3)) {
    const result = normalizeCandidate(candidate, source, window);
    if (result.decision === 'accepted') {
      const key = `${canonicalEventUrl(result.event)}|${result.event.startLocal}|${result.event.title.toLowerCase()}`;
      if (!seen.has(key) && events.length < MAX_EVENTS_PER_SOURCE) {
        seen.add(key);
        events.push(result.event);
      }
    } else if (result.decision === 'review') {
      review.push({ reason: result.reason, ...result.preview });
    } else {
      excluded.push({ reason: result.reason, ...result.preview });
    }
  }
  events.sort((a, b) => a.startLocal.localeCompare(b.startLocal) || a.title.localeCompare(b.title));
  return { events, review, excluded };
}

export function validateLiveEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new TypeError('LiveEvent must be an object');
  for (const key of Object.keys(event)) {
    if (!allowedLiveEventKeys.has(key)) throw new TypeError(`LiveEvent contains unsupported field: ${key}`);
  }
  for (const key of requiredLiveEventKeys) {
    if (!(key in event)) throw new TypeError(`LiveEvent is missing required field: ${key}`);
  }
  for (const key of ['id', 'title', 'startLocal', 'dateKey', 'source', 'sourceKind', 'venue', 'address', 'ages', 'category', 'tone', 'mark', 'description', 'registrationStatus', 'registrationUrl', 'url']) {
    if (typeof event[key] !== 'string') throw new TypeError(`LiveEvent.${key} must be a string`);
  }
  const limits = { id: 260, title: 240, source: 180, venue: 240, address: 360, ages: 80, category: 60, tone: 40, mark: 20, description: 600, registrationStatus: 160, registrationUrl: 1_200, url: 1_200 };
  for (const [key, limit] of Object.entries(limits)) {
    if (event[key].length > limit) throw new TypeError(`LiveEvent.${key} exceeds ${limit} characters`);
  }
  if (event.endLocal !== undefined && (typeof event.endLocal !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(event.endLocal))) {
    throw new TypeError('LiveEvent.endLocal must be a local ISO timestamp when present');
  }
  if (event.scheduleNotice !== undefined && (typeof event.scheduleNotice !== 'string' || !event.scheduleNotice || event.scheduleNotice.length > 180)) {
    throw new TypeError('LiveEvent.scheduleNotice must be a short string when present');
  }
  if (typeof event.allDay !== 'boolean' || typeof event.teenOnly !== 'boolean' || typeof event.family !== 'boolean') {
    throw new TypeError('LiveEvent allDay, teenOnly, and family fields must be booleans');
  }
  if (typeof event.distance !== 'number' || !Number.isFinite(event.distance) || event.distance < 0 || event.distance > 15.5) {
    throw new TypeError('LiveEvent.distance must be between 0 and 15.5 miles');
  }
  if (event.sourceKind !== 'Library') throw new TypeError('Collector LiveEvent.sourceKind must be Library');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(event.startLocal)) throw new TypeError('LiveEvent.startLocal must be a local ISO timestamp');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.dateKey) || event.dateKey !== event.startLocal.slice(0, 10)) throw new TypeError('LiveEvent.dateKey must match startLocal');
  if (!safeUrl(event.url) || !safeUrl(event.registrationUrl)) throw new TypeError('LiveEvent URLs must use HTTPS');
  return true;
}

export function validateIngestPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('Ingest payload must be an object');
  const topKeys = Object.keys(payload).sort();
  const expectedTopKeys = ['adapterVersion', 'collectedAt', 'runId', 'sourceResults'];
  if (topKeys.join('|') !== expectedTopKeys.sort().join('|')) throw new TypeError('Ingest payload fields do not match the collector contract');
  if (typeof payload.runId !== 'string' || !/^[a-zA-Z0-9._:-]{8,100}$/.test(payload.runId)) throw new TypeError('Invalid runId');
  if (typeof payload.collectedAt !== 'string' || Number.isNaN(Date.parse(payload.collectedAt))) throw new TypeError('Invalid collectedAt');
  if (typeof payload.adapterVersion !== 'string' || !payload.adapterVersion || payload.adapterVersion.length > 60) throw new TypeError('Invalid adapterVersion');
  if (!Array.isArray(payload.sourceResults) || payload.sourceResults.length === 0 || payload.sourceResults.length > allowedSources.size) {
    throw new TypeError(`sourceResults must contain 1 to ${allowedSources.size} entries`);
  }
  const seenSources = new Set();
  let totalEvents = 0;
  for (const result of payload.sourceResults) {
    const allowedKeys = new Set(['sourceId', 'sourceName', 'status', 'complete', 'error', 'events']);
    for (const key of Object.keys(result ?? {})) if (!allowedKeys.has(key)) throw new TypeError(`Source result contains unsupported field: ${key}`);
    if (typeof result?.sourceId !== 'string' || !/^[a-z0-9-]{3,100}$/.test(result.sourceId)) throw new TypeError('Source result has an invalid sourceId');
    const configuredSource = allowedSources.get(result.sourceId);
    if (!configuredSource) throw new TypeError(`Source result is not in the overnight manifest: ${result.sourceId}`);
    if (seenSources.has(result.sourceId)) throw new TypeError(`Duplicate source result: ${result.sourceId}`);
    seenSources.add(result.sourceId);
    if (typeof result.sourceName !== 'string' || result.sourceName !== configuredSource.name || result.sourceName.length > 180) throw new TypeError('Source result has an invalid sourceName');
    if (!['success', 'empty', 'failed', 'blocked'].includes(result.status)) throw new TypeError(`Invalid source status: ${result.status}`);
    if (result.complete !== undefined && typeof result.complete !== 'boolean') throw new TypeError('Source result complete must be a boolean');
    if (!Array.isArray(result.events) || result.events.length > MAX_EVENTS_PER_SOURCE) throw new TypeError('Source events must be a bounded array');
    if (result.error !== undefined && (typeof result.error !== 'string' || result.error.length > 500)) throw new TypeError('Source error must be a short string');
    if (result.status === 'success' && result.events.length === 0) throw new TypeError('A successful source must include at least one event');
    if (result.status !== 'success' && result.events.length !== 0) throw new TypeError(`${result.status} sources cannot include events`);
    totalEvents += result.events.length;
    if (totalEvents > MAX_EVENTS_PER_BATCH) throw new TypeError(`Collector batch cannot exceed ${MAX_EVENTS_PER_BATCH} events`);
    for (const event of result.events) {
      validateLiveEvent(event);
      if (event.source !== result.sourceName) throw new TypeError('LiveEvent source must match sourceName');
    }
  }
  return true;
}
