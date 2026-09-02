import { addDays, chicagoTodayKey, type EventsResponse, type LiveEvent } from '@/lib/live-event';
import { CALENDAR_HORIZON_DAYS, calendarDays, isValidDateKey } from '@/lib/calendar-config';
import { collectorDatabase, collectorEnv, ensureCollectorSchema, readDailyCalendarSnapshot, readLatestDailyCalendarSnapshot, writeDailyCalendarSnapshot, type StructuredSourceReceipt } from '@/lib/collector-db';
import { ZIP_CENTER, structuredSources, type FeedConfig, type FeedType } from '@/lib/source-catalog';

export const runtime = 'edge';

async function equalSecret(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let index = 0; index < leftBytes.length; index += 1) mismatch |= leftBytes[index] ^ rightBytes[index];
  return mismatch === 0;
}

type UnknownRecord = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function plainText(value: unknown) {
  return decodeEntities(stringValue(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function compactDescription(value: unknown) {
  const text = plainText(value);
  return text.length > 420 ? `${text.slice(0, 417).trimEnd()}…` : text;
}

function toLocalIso(value: unknown) {
  const raw = stringValue(value).trim();
  const match = raw.match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})[ T]?(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}T${match[4] ?? '00'}:${match[5] ?? '00'}:${match[6] ?? '00'}`;
}

function objectNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectNames);
  if (value && typeof value === 'object') {
    const record = value as UnknownRecord;
    const ownName = plainText(record.name ?? record.label ?? record.title);
    if (ownName) return [ownName];
    return Object.values(record).flatMap(objectNames);
  }
  const direct = plainText(value);
  return direct ? [direct] : [];
}

function isFalse(value: unknown) {
  return value === false || value === 0 || value === '0' || value === 'false';
}

function isTrue(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function explicitAge(text: string) {
  const candidates: Array<{ min: number; max: number; label: string }> = [];
  for (const exactYears of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:yrs?|years?)?\s*(?:[-–—]|to|through)\s*(\d{1,2})\s*(?:yrs?|years?)\b/gi)) {
    candidates.push({ min: Number(exactYears[1]), max: Number(exactYears[2]), label: `Ages ${exactYears[1]}–${exactYears[2]}` });
  }
  for (const statedYears of text.matchAll(/\b(\d{1,2})\s*(?:[-–—]|to|through)\s*(\d{1,2})\s*years?\b/gi)) {
    candidates.push({ min: Number(statedYears[1]), max: Number(statedYears[2]), label: `Ages ${statedYears[1]}–${statedYears[2]}` });
  }
  for (const exact of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:[-–—]|to|through)\s*(\d{1,2})\b/gi)) {
    candidates.push({ min: Number(exact[1]), max: Number(exact[2]), label: `Ages ${exact[1]}–${exact[2]}` });
  }
  for (const plus of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:\+|(?:and|&)\s*(?:up|older)|or older)(?=\s|[.,;:)]|$)/gi)) {
    candidates.push({ min: Number(plus[1]), max: 99, label: `Ages ${plus[1]}+` });
  }
  for (const grade of text.matchAll(/\bgrades?\s*:?\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\s*(?:[-–—]|to|through)\s*([kK]|\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const gradeNumber = (entry: string) => entry.toLowerCase() === 'k' ? 0 : Number(entry);
    candidates.push({ min: gradeNumber(grade[1]) + 5, max: gradeNumber(grade[2]) + 6, label: `Grades ${grade[1].toUpperCase()}–${grade[2].toUpperCase()}` });
  }
  if (candidates.length) {
    const matching = candidates.filter((candidate) => candidate.min <= 16 && candidate.max >= 7);
    const selected = matching.find((candidate) => candidate.min < 13) ?? matching[0] ?? candidates[0];
    return {
      ...selected,
      includesNine: matching.some((candidate) => candidate.min <= 9 && candidate.max >= 9),
      teenOnly: matching.length > 0 && matching.every((candidate) => candidate.min >= 12),
    };
  }
  const single = text.match(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\b/i);
  if (single) {
    const value = Number(single[1]);
    return { min: value, max: value, label: `Age ${single[1]}`, includesNine: value === 9, teenOnly: value >= 12 };
  }
  return null;
}

function deriveAudience(title: string, description: string, labels: string[]) {
  const text = `${title} ${description} ${labels.join(' ')}`;
  const lower = text.toLowerCase();
  const age = explicitAge(text);
  const broadAudienceLabel = labels.some((label) => /^(all|everyone|all ages)$/i.test(label.trim()));
  const family = broadAudienceLabel || /\bfamil(?:y|ies)\b|all ages|all-ages|caregiver|parent(?:s)? and child/.test(lower);
  const familyNamed = broadAudienceLabel || /\bfamil(?:y|ies)\b|caregiver|parent(?:s)? and child/.test(lower);
  const namedAudience = `${title} ${labels.join(' ')}`.toLowerCase();
  const namedTeen = /\bteens?|teenagers?|high school|young adults?\b/.test(namedAudience)
    || namedAudience.includes('diversiteen')
    || namedAudience.includes('volunteen')
    || /\b(?:for teens?|teens? only|high school students?)\b/.test(lower);
  const namedYoungerAudience = /\bchildren|kids?|youth|elementary|school[- ]age\b/.test(namedAudience);
  const teenOnly = age
    ? Boolean(age.teenOnly) || (!age.includesNine && namedTeen)
    : namedTeen && !namedYoungerAudience;
  const adultOnly = /\badults? only\b|\b18\s*(?:\+|and (?:up|older))|\b21\s*\+|\bseniors?\b|\b55\s*\+/.test(lower);
  const youngOnly = /\b(?:bab(?:y|ies)|toddlers?|tots?|preschool(?:ers)?|birth\s*(?:-|to|through)\s*5)\b/.test(lower);
  const administrative = /\b(board|committee|commission) meetings?\b|public hearing|bid opening|meeting minutes/.test(lower);
  const teen = /\bteens?|tweens?|middle school|high school|grades?\b/.test(lower);
  const youth = /\bchildren|child(?:ren)?|kids?|youth|school[- ]age|homeschool/.test(lower);
  const adultActivity = /\b(bodypump|cycle|cycling|spin|nia|foam rolling|werq|zumba|pilates|barre|yoga|cardio|aerobics|fitness class|workout|strength training|pickleball|golf league|softball league)\b/.test(lower);
  const adultProgram = /\b(adults?|lapidary|lunch\s*(?:&|and)\s*learn|independent housing|retirement|medicare|matinee|provider training|staff training|certification)\b/.test(lower);
  const notAnEvent = /\b(?:library|branch|pool|office|village hall|facility|building)\s+(?:is\s+)?closed\b|\bclosed\s+(?:on|for|august|september|october|november|december|january|february|march|april|may|june|july)|delayed opening|holiday hours/.test(lower);
  if (administrative || notAnEvent || (adultOnly && !age) || ((adultActivity || adultProgram) && !age && !teen && !youth && !familyNamed)) return { include: false, ages: '', teenOnly: false, family: false };
  if (age) return { include: age.min <= 16 && age.max >= 7, ages: age.label, teenOnly, family };
  if (teen) return { include: true, ages: labels.find((label) => /teen|tween/i.test(label)) ?? 'Teens / tweens', teenOnly: teenOnly || (!family && !youth && /\bteens?|high school\b/.test(lower)), family };
  if (youngOnly) return { include: false, ages: '', teenOnly: false, family: false };
  if (family) return { include: true, ages: 'Family / all ages', teenOnly: false, family: true };
  if (youth) return { include: true, ages: labels.find((label) => /child|kid|youth/i.test(label)) ?? 'Kids / youth', teenOnly: false, family };
  return { include: false, ages: '', teenOnly: false, family: false };
}

function deriveCategory(text: string) {
  const lower = text.toLowerCase();
  if (/concert|music|sing|dance|perform/.test(lower)) return { category: 'Music', tone: 'gold', mark: 'LISTEN' };
  if (/nature|outdoor|hike|bird|forest|garden|wildlife|climb/.test(lower)) return { category: 'Outdoor', tone: 'blue', mark: 'EXPLORE' };
  if (/book|read|story|literacy|author/.test(lower)) return { category: 'Read', tone: 'plum', mark: 'READ' };
  if (/lego|build|code|coding|robot|engineering/.test(lower)) return { category: 'Build', tone: 'blue', mark: 'BUILD' };
  if (/science|stem|steam|maker|experiment/.test(lower)) return { category: 'Make', tone: 'coral', mark: 'MAKE' };
  if (/art|craft|paint|draw|create|studio|sew|felting/.test(lower)) return { category: 'Create', tone: 'coral', mark: 'CREATE' };
  if (/game|chess|bingo|dungeons|dragon|play|trivia/.test(lower)) return { category: 'Play', tone: 'plum', mark: 'PLAY' };
  return { category: 'Explore', tone: 'gold', mark: 'GO' };
}

function scheduleNotice(text: string) {
  const lower = text.toLowerCase();
  if (/cancelled|canceled|canclled/.test(lower)) return 'Cancellation notice — check the official listing';
  if (/rescheduled/.test(lower)) return 'Rescheduled — confirm the new date on the official listing';
  if (/postponed/.test(lower)) return 'Postponed — check the official listing';
  return undefined;
}

function cleanUrl(value: unknown, base: string) {
  const raw = decodeEntities(stringValue(value)).trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, base);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function stableRegistrationUrl(value: string) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:_?csrf(?:_token)?|session(?:_id)?|sid|phpsessid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value;
  }
}

function registrationLink(html: unknown, website: unknown, eventUrl: string) {
  const raw = stringValue(html);
  for (const match of raw.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = cleanUrl(match[1], eventUrl);
    const signal = `${plainText(match[2])} ${href}`.toLowerCase();
    if (href && /register|registration|sign.?up|rsvp|recdesk|myvscloud|amilia|activecommunities/.test(signal)) return stableRegistrationUrl(href);
  }
  const websiteUrl = cleanUrl(website, eventUrl);
  if (websiteUrl && /register|registration|sign.?up|rsvp|recdesk|myvscloud|amilia|activecommunities/.test(websiteUrl.toLowerCase())) return stableRegistrationUrl(websiteUrl);
  return eventUrl;
}

function registrationState(record: UnknownRecord, description: string, startLocal: string, type: FeedType) {
  const lower = description.toLowerCase();
  if (/registration (?:is )?closed|sold out|waitlist only/.test(lower)) return 'Registration closed / waitlist';
  if (/no registration|required no registration|drop[ -]?in|walk[ -]?in/.test(lower)) return 'Drop-in / no signup';
  if (type === 'librarycalendar') {
    if (record.registration_enabled === true || record.registration_enabled === 1 || record.registration_enabled === '1') {
      const now = instantToChicagoLocal(Date.now());
      const opens = toLocalIso(record.registration_start);
      const closes = toLocalIso(record.registration_end);
      if (opens && opens > now) return `Registration opens ${opens.slice(0, 10)}`;
      if (closes && closes < now) return 'Registration window closed';
      return 'Registration window open — confirm space';
    }
    return 'No signup listed';
  }
  if (type === 'communico') {
    const capacity = Number(record.max_attendee ?? record.seat_limit);
    const registered = Number(record.total_registrants);
    if (Number.isFinite(capacity) && capacity > 0 && Number.isFinite(registered) && registered >= capacity) {
      return 'Registration closed / waitlist';
    }
    if (isTrue(record.allow_reg) || isTrue(record.third_party_reg) || Boolean(stringValue(record.reg_url).trim())) return 'Registration available';
    return 'No signup listed';
  }
  if (/registration (?:is )?required|must register|pre-?registration required/.test(lower)) return 'Registration required';
  if (/register|registration|sign.?up|rsvp|recdesk/.test(lower)) return 'Registration available';
  return startLocal ? 'Check official listing' : 'See official listing';
}

function haversineMiles(lat: number, lng: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat - ZIP_CENTER.lat);
  const dLng = radians(lng - ZIP_CENTER.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(ZIP_CENTER.lat)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function libraryBranchContext(feed: FeedConfig, labels: string[]) {
  if (!feed.branchRules?.length) return { distance: feed.distance, address: feed.address };
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const matches = feed.branchRules.filter((rule) => normalizedLabels.some((label) => label.includes(rule.match.toLowerCase())));
  if (!matches.length) return feed.strictBranchDistance ? null : { distance: feed.distance, address: feed.address };
  const nearby = matches.filter((rule) => rule.distance <= 15).sort((a, b) => a.distance - b.distance);
  if (!nearby.length) return null;
  const closest = nearby[0];
  return {
    distance: closest.distance,
    address: labels.length > 1 && feed.multiBranchAddress ? feed.multiBranchAddress : closest.address,
  };
}

function normalizeLibraryCalendar(record: UnknownRecord, feed: FeedConfig, start: string, end: string): LiveEvent | null {
  if (isFalse(record.public) || isFalse(record.published) || (record.moderation_state && record.moderation_state !== 'published')) return null;
  const startLocal = toLocalIso(record.start_date);
  const endLocal = toLocalIso(record.end_date) || undefined;
  const dateKey = startLocal.slice(0, 10);
  if (!startLocal || dateKey < start || dateKey >= end) return null;
  const title = plainText(record.title) || 'Untitled event';
  const fullDescription = plainText(`${stringValue(record.description)} ${stringValue(record.program_description)}`);
  const description = compactDescription(fullDescription);
  const labels = objectNames(record.age_group);
  const audience = deriveAudience(title, fullDescription, labels);
  if (!audience.include) return null;
  const category = deriveCategory(`${title} ${fullDescription} ${objectNames(record.program_type).join(' ')}`);
  const branches = objectNames(record.branch);
  const branchContext = libraryBranchContext(feed, branches);
  if (!branchContext) return null;
  const branch = branches.join(' · ');
  const room = objectNames(record.room)[0] ?? '';
  const venue = [branch, room].filter(Boolean).join(' · ') || feed.name;
  const offsite = plainText(record.offsite_address ?? record.online_address);
  const url = cleanUrl(record.url, feed.endpoint) || feed.endpoint;
  const registrationStatus = registrationState(record, fullDescription, startLocal, feed.type);
  const inferredAllDay = startLocal.endsWith('T00:00:00') && Boolean(endLocal?.endsWith('T00:00:00'));
  return {
    id: `${feed.id}-${stringValue(record.uuid ?? record.id) || `${dateKey}-${title}`}`,
    title,
    startLocal,
    endLocal,
    dateKey,
    allDay: Boolean(record.all_day) || inferredAllDay,
    source: feed.name,
    sourceKind: feed.sourceKind,
    venue,
    address: offsite || branchContext.address,
    distance: branchContext.distance,
    ages: audience.ages,
    teenOnly: audience.teenOnly,
    family: audience.family,
    ...category,
    description,
    registrationStatus,
    registrationUrl: url,
    url,
    scheduleNotice: scheduleNotice(`${title} ${fullDescription}`),
  };
}

function normalizeCommunico(record: UnknownRecord, feed: FeedConfig, start: string, end: string): LiveEvent | null {
  if (isTrue(record.private_event)) return null;
  const startLocal = toLocalIso(record.event_start ?? record.raw_start_time);
  const endLocal = toLocalIso(record.event_end ?? record.raw_end_time) || undefined;
  const dateKey = startLocal.slice(0, 10);
  if (!startLocal || dateKey < start || dateKey >= end) return null;
  const title = plainText(record.title) || 'Untitled event';
  const fullDescription = plainText(`${stringValue(record.sub_title)} ${stringValue(record.description)} ${stringValue(record.long_description)} ${stringValue(record.changed_reason)}`);
  const description = compactDescription(fullDescription);
  const labels = [...objectNames(record.agesArray ?? record.ages), ...objectNames(record.tagsArray ?? record.tags), ...objectNames(record.search_tagsArray ?? record.search_tags)];
  const audience = deriveAudience(title, fullDescription, labels);
  if (!audience.include) return null;
  const url = cleanUrl(record.url, feed.endpoint) || feed.endpoint;
  const registrationUrl = cleanUrl(record.reg_url, url) || registrationLink(record.long_description, record.reg_url, url);
  const venue = [plainText(record.venue_name), plainText(record.venue_room)].filter(Boolean).join(' · ')
    || plainText(record.location ?? record.library)
    || feed.name;
  const allDay = startLocal.endsWith('T00:00:00') && Boolean(endLocal?.endsWith('T23:59:59'));
  return {
    id: `${feed.id}-${stringValue(record.id ?? record.recurring_id) || `${dateKey}-${title}`}`,
    title,
    startLocal,
    endLocal,
    dateKey,
    allDay,
    source: feed.name,
    sourceKind: feed.sourceKind,
    venue,
    address: feed.address,
    distance: feed.distance,
    ages: audience.ages,
    teenOnly: audience.teenOnly,
    family: audience.family,
    ...deriveCategory(`${title} ${fullDescription} ${labels.join(' ')}`),
    description,
    registrationStatus: registrationState(record, fullDescription, startLocal, feed.type),
    registrationUrl,
    url,
    scheduleNotice: scheduleNotice(`${title} ${fullDescription}`),
  };
}

function normalizeTribe(record: UnknownRecord, feed: FeedConfig, start: string, end: string): LiveEvent | null {
  const startLocal = toLocalIso(record.start_date);
  const endLocal = toLocalIso(record.end_date) || undefined;
  const dateKey = startLocal.slice(0, 10);
  if (!startLocal || dateKey < start || dateKey >= end) return null;
  const title = plainText(record.title) || 'Untitled event';
  const rawDescription = record.description ?? record.excerpt;
  const fullDescription = plainText(rawDescription);
  const description = compactDescription(fullDescription);
  const labels = [...objectNames(record.categories), ...objectNames(record.tags)];
  const audience = deriveAudience(title, fullDescription, labels);
  if (!audience.include) return null;
  const venueRecord = record.venue && !Array.isArray(record.venue) && typeof record.venue === 'object' ? record.venue as UnknownRecord : {};
  let distance = feed.distance;
  const lat = Number(venueRecord.geo_lat);
  const lng = Number(venueRecord.geo_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    distance = haversineMiles(lat, lng);
    if (distance > 15) return null;
  } else if (feed.venueDistance) {
    return null;
  }
  const venue = plainText(venueRecord.venue) || feed.name;
  const address = [venueRecord.address, venueRecord.city, venueRecord.state, venueRecord.zip].map(plainText).filter(Boolean).join(', ') || feed.address;
  const category = deriveCategory(`${title} ${fullDescription} ${labels.join(' ')}`);
  const url = cleanUrl(record.url, feed.endpoint) || feed.endpoint;
  const registrationStatus = registrationState(record, fullDescription, startLocal, feed.type);
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
    distance,
    ages: audience.ages,
    teenOnly: audience.teenOnly,
    family: audience.family,
    ...category,
    description,
    registrationStatus,
    registrationUrl: registrationLink(rawDescription, record.website, url),
    url,
    scheduleNotice: scheduleNotice(`${title} ${fullDescription}`),
  };
}

function xmlRawValue(block: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'))?.[1] ?? '';
}

function unwrapXmlValue(value: string) {
  return value.replace(/^<!\[CDATA\[/i, '').replace(/\]\]>$/i, '').trim();
}

function xmlText(block: string, tag: string) {
  return plainText(unwrapXmlValue(xmlRawValue(block, tag)));
}

function xmlTexts(block: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...block.matchAll(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'gi'))]
    .map((match) => plainText(unwrapXmlValue(match[1])))
    .filter(Boolean);
}

function parseRssItems(text: string) {
  return text.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
}

function twelveHourClock(hourValue: string, minuteValue: string | undefined, periodValue: string) {
  let hour = Number(hourValue);
  const period = periodValue.toLowerCase();
  if (period === 'p' && hour !== 12) hour += 12;
  if (period === 'a' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minuteValue ?? '00'}:00`;
}

function rssEventTimes(description: string, pubDate: string) {
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };
  const date = description.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i);
  const times = [...description.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/gi)];
  if (date && times.length) {
    const dateKey = `${date[3]}-${months[date[1].toLowerCase()]}-${date[2].padStart(2, '0')}`;
    return {
      startLocal: `${dateKey}T${twelveHourClock(times[0][1], times[0][2], times[0][3])}`,
      endLocal: times[1] ? `${dateKey}T${twelveHourClock(times[1][1], times[1][2], times[1][3])}` : undefined,
      allDay: false,
    };
  }
  const instant = Date.parse(pubDate);
  return {
    startLocal: Number.isNaN(instant) ? '' : instantToChicagoLocal(instant),
    endLocal: undefined,
    allDay: false,
  };
}

function normalizeRss(item: string, feed: FeedConfig, start: string, end: string): LiveEvent | null {
  const title = xmlText(item, 'title') || 'Untitled event';
  const rawDescription = unwrapXmlValue(xmlRawValue(item, 'description'));
  const fullDescription = plainText(rawDescription);
  const times = rssEventTimes(fullDescription, xmlText(item, 'pubDate'));
  const dateKey = times.startLocal.slice(0, 10);
  if (!times.startLocal || dateKey < start || dateKey >= end) return null;
  const labels = xmlTexts(item, 'category');
  const audience = deriveAudience(title, fullDescription, labels);
  if (!audience.include) return null;
  const url = cleanUrl(xmlText(item, 'link'), feed.endpoint) || feed.endpoint;
  const segments = rawDescription.split(/<br\s*\/?\s*>/gi).map((segment) => plainText(segment)).filter(Boolean);
  const venue = segments[1] || feed.name;
  const address = segments.length > 2 ? segments.slice(2).join(', ') : feed.address;
  return {
    id: `${feed.id}-${xmlText(item, 'guid') || `${dateKey}-${title}`}`,
    title,
    startLocal: times.startLocal,
    endLocal: times.endLocal,
    dateKey,
    allDay: times.allDay,
    source: feed.name,
    sourceKind: feed.sourceKind,
    venue,
    address,
    distance: feed.distance,
    ages: audience.ages,
    teenOnly: audience.teenOnly,
    family: audience.family,
    ...deriveCategory(`${title} ${fullDescription} ${labels.join(' ')}`),
    description: compactDescription(fullDescription),
    registrationStatus: registrationState({}, fullDescription, times.startLocal, feed.type),
    registrationUrl: registrationLink(rawDescription, '', url),
    url,
    scheduleNotice: scheduleNotice(`${title} ${fullDescription}`),
  };
}

function normalizeBibliocommons(item: string, feed: FeedConfig, start: string, end: string): LiveEvent | null {
  const startValue = xmlText(item, 'bc:start_date_local');
  const endValue = xmlText(item, 'bc:end_date_local');
  const startLocal = toLocalIso(startValue);
  const endLocal = toLocalIso(endValue) || undefined;
  const dateKey = startLocal.slice(0, 10);
  if (!startLocal || dateKey < start || dateKey >= end) return null;
  const title = xmlText(item, 'title') || 'Untitled event';
  const rawDescription = unwrapXmlValue(xmlRawValue(item, 'description'));
  const fullDescription = plainText(rawDescription);
  const labels = xmlTexts(item, 'category');
  const audience = deriveAudience(title, fullDescription, labels);
  if (!audience.include) return null;
  const location = xmlRawValue(item, 'bc:location');
  const virtual = xmlText(item, 'bc:is_virtual').toLowerCase() === 'true';
  const lat = Number(xmlText(location, 'bc:latitude'));
  const lng = Number(xmlText(location, 'bc:longitude'));
  let distance = feed.distance;
  if (!virtual && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    distance = haversineMiles(lat, lng);
    if (distance > 15) return null;
  }
  const locationName = xmlText(location, 'bc:name');
  const address = virtual
    ? 'Online event'
    : [xmlText(location, 'bc:number'), xmlText(location, 'bc:street'), xmlText(location, 'bc:city'), xmlText(location, 'bc:state'), xmlText(location, 'bc:zip')].filter(Boolean).join(' ') || feed.address;
  const url = cleanUrl(xmlText(item, 'link'), feed.endpoint) || feed.endpoint;
  const registration = xmlRawValue(item, 'bc:registration_info');
  const registrationRequired = xmlText(registration, 'bc:is_required').toLowerCase() === 'true';
  const registrationFull = xmlText(registration, 'bc:is_full').toLowerCase() === 'true';
  const cancelled = xmlText(item, 'bc:is_cancelled').toLowerCase() === 'true';
  return {
    id: `${feed.id}-${xmlText(item, 'guid') || `${dateKey}-${title}`}`,
    title,
    startLocal,
    endLocal,
    dateKey,
    allDay: /^\d{4}-\d{2}-\d{2}$/.test(startValue),
    source: feed.name,
    sourceKind: feed.sourceKind,
    venue: virtual ? 'Online event' : locationName || feed.name,
    address,
    distance,
    ages: audience.ages,
    teenOnly: audience.teenOnly,
    family: audience.family,
    ...deriveCategory(`${title} ${fullDescription} ${labels.join(' ')}`),
    description: compactDescription(fullDescription),
    registrationStatus: registrationFull ? 'Registration closed / waitlist' : registrationRequired ? 'Registration required' : 'No signup listed',
    registrationUrl: url,
    url,
    scheduleNotice: cancelled ? 'Cancellation notice — check the official listing' : scheduleNotice(`${title} ${fullDescription}`),
  };
}

function normalizeMyCalendar(record: UnknownRecord, feed: FeedConfig, start: string, end: string): LiveEvent | null {
  if (isFalse(record.event_status) || isFalse(record.event_approved)) return null;
  const startLocal = toLocalIso(record.occur_begin ?? record.event_begin);
  const endLocal = toLocalIso(record.occur_end ?? record.event_end) || undefined;
  const dateKey = startLocal.slice(0, 10);
  if (!startLocal || dateKey < start || dateKey >= end) return null;
  const title = plainText(record.event_title) || 'Untitled event';
  const rawDescription = `${stringValue(record.event_desc)} ${stringValue(record.event_short)} ${stringValue(record.event_registration)} ${stringValue(record.event_tickets)}`;
  const fullDescription = plainText(rawDescription);
  const labels = [plainText(record.category_name), ...objectNames(record.categories)].filter(Boolean);
  const audience = deriveAudience(title, fullDescription, labels);
  if (!audience.include) return null;
  const location = record.location && typeof record.location === 'object' && !Array.isArray(record.location)
    ? record.location as UnknownRecord
    : {};
  const venue = plainText(location.location_label ?? record.event_label) || feed.name;
  const suppliedAddress = [
    location.location_street ?? record.event_street,
    location.location_street2 ?? record.event_street2,
    location.location_city ?? record.event_city,
    location.location_state ?? record.event_state,
    location.location_postcode ?? record.event_postcode,
  ].map(plainText).filter(Boolean).join(', ');
  const eventId = stringValue(record.occur_id ?? record.event_id);
  const fallbackUrl = new URL('/', feed.endpoint);
  if (eventId) fallbackUrl.searchParams.set('mc_id', eventId);
  const url = cleanUrl(record.event_url ?? record.event_link, feed.endpoint) || fallbackUrl.toString();
  const registrationUrl = registrationLink(rawDescription, record.event_registration ?? record.event_tickets, url);
  const allDay = stringValue(record.event_time) === '00:00:00'
    && (stringValue(record.event_endtime) === '23:59:59' || Boolean(endLocal?.endsWith('T23:59:59')));
  return {
    id: `${feed.id}-${eventId || `${dateKey}-${title}`}`,
    title,
    startLocal,
    endLocal,
    dateKey,
    allDay,
    source: feed.name,
    sourceKind: feed.sourceKind,
    venue,
    address: suppliedAddress || feed.address,
    distance: feed.distance,
    ages: audience.ages,
    teenOnly: audience.teenOnly,
    family: audience.family,
    ...deriveCategory(`${title} ${fullDescription} ${labels.join(' ')}`),
    description: compactDescription(fullDescription),
    registrationStatus: registrationState(record, fullDescription, startLocal, feed.type),
    registrationUrl,
    url,
    scheduleNotice: scheduleNotice(`${title} ${fullDescription}`),
  };
}

function unescapeIcs(value: string) {
  return value.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function instantToChicagoLocal(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  let date: Date;
  if (Number.isFinite(numeric) && numeric > 1_000_000_000) {
    date = new Date(numeric);
  } else {
    const raw = stringValue(value);
    const match = raw.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/i);
    if (!match) return '';
    date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])));
  }
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

function parseIcs(text: string) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  return unfolded.split('BEGIN:VEVENT').slice(1).map((chunk) => {
    const body = chunk.split('END:VEVENT')[0] ?? '';
    const record: Record<string, string> = {};
    for (const line of body.split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).split(';')[0].toUpperCase();
      if (!record[key]) record[key] = unescapeIcs(line.slice(colon + 1));
    }
    return record;
  });
}

function normalizeIcs(record: Record<string, string>, feed: FeedConfig, start: string, end: string): LiveEvent | null {
  const startLocal = feed.icsUtc && /Z$/i.test(record.DTSTART ?? '') ? instantToChicagoLocal(record.DTSTART) : toLocalIso(record.DTSTART);
  const endLocal = (feed.icsUtc && /Z$/i.test(record.DTEND ?? '') ? instantToChicagoLocal(record.DTEND) : toLocalIso(record.DTEND)) || undefined;
  const dateKey = startLocal.slice(0, 10);
  if (!startLocal || dateKey < start || dateKey >= end) return null;
  const title = plainText(record.SUMMARY) || 'Untitled event';
  const rawIcsDescription = `${stringValue(record.DESCRIPTION)} ${stringValue(record['X-ALT-DESC'])}`;
  const fullDescription = plainText(rawIcsDescription);
  const description = compactDescription(fullDescription);
  const labels = stringValue(record.CATEGORIES).split(',').map((label) => plainText(label)).filter(Boolean);
  const audience = deriveAudience(title, fullDescription, labels);
  if (!audience.include) return null;
  const category = deriveCategory(`${title} ${fullDescription} ${labels.join(' ')}`);
  const uid = stringValue(record.UID);
  const eid = uid.match(/\d+/)?.[0] ?? uid;
  const constructed = feed.detailBase && eid ? `${feed.detailBase}${encodeURIComponent(eid)}` : '';
  const descriptionUrl = stringValue(record.DESCRIPTION).match(/https?:\/\/[^\s<>]+/i)?.[0] ?? '';
  const url = constructed || cleanUrl(descriptionUrl, feed.endpoint) || cleanUrl(record.URL, feed.endpoint) || feed.endpoint;
  const allDay = /^\d{8}$/.test(stringValue(record.DTSTART));
  return {
    id: `${feed.id}-${uid || `${dateKey}-${title}`}`,
    title,
    startLocal,
    endLocal,
    dateKey,
    allDay,
    source: feed.name,
    sourceKind: feed.sourceKind,
    venue: plainText(record.LOCATION) || feed.name,
    address: plainText(record.LOCATION) || feed.address,
    distance: feed.distance,
    ages: audience.ages,
    teenOnly: audience.teenOnly,
    family: audience.family,
    ...category,
    description,
    registrationStatus: registrationState(record, fullDescription, startLocal, feed.type),
    registrationUrl: registrationLink(record['X-ALT-DESC'], '', url),
    url,
    scheduleNotice: scheduleNotice(`${title} ${fullDescription}`),
  };
}

function normalizeSquarespace(record: UnknownRecord, feed: FeedConfig, start: string, end: string): LiveEvent | null {
  const startLocal = instantToChicagoLocal(record.startDate);
  const endLocal = instantToChicagoLocal(record.endDate) || undefined;
  const dateKey = startLocal.slice(0, 10);
  if (!startLocal || dateKey < start || dateKey >= end) return null;
  const title = plainText(record.title) || 'Untitled event';
  const fullDescription = plainText(record.excerpt ?? record.body);
  const description = compactDescription(fullDescription);
  const labels = [...objectNames(record.categories), ...objectNames(record.tags)];
  const audience = deriveAudience(title, fullDescription, labels);
  if (!audience.include) return null;
  const location = record.location && typeof record.location === 'object' && !Array.isArray(record.location) ? record.location as UnknownRecord : {};
  const venue = plainText(location.addressTitle) || feed.name;
  const address = [location.addressLine1, location.addressLine2].map(plainText).filter(Boolean).join(', ') || feed.address;
  let distance = feed.distance;
  const lat = Number(location.markerLat);
  const lng = Number(location.markerLng);
  if (address !== feed.address && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    distance = haversineMiles(lat, lng);
    if (distance > 15) return null;
  }
  const url = cleanUrl(record.fullUrl, feed.endpoint) || feed.endpoint;
  const registrationUrl = cleanUrl(record.sourceUrl, url) || url;
  const category = deriveCategory(`${title} ${fullDescription} ${labels.join(' ')}`);
  return {
    id: `${feed.id}-${stringValue(record.id) || `${dateKey}-${title}`}`,
    title,
    startLocal,
    endLocal,
    dateKey,
    allDay: Boolean(record.allDay),
    source: feed.name,
    sourceKind: feed.sourceKind,
    venue,
    address,
    distance,
    ages: audience.ages,
    teenOnly: audience.teenOnly,
    family: audience.family,
    ...category,
    description,
    registrationStatus: registrationUrl !== url ? 'Registration available' : registrationState(record, fullDescription, startLocal, feed.type),
    registrationUrl,
    url,
    scheduleNotice: scheduleNotice(`${title} ${fullDescription}`),
  };
}

const FETCH_AGENT = 'LibraryLoop/1.0 (+https://library-loop-60457.nilkamals463352.chatgpt.site/)';
const robotsCache = new Map<string, Promise<string>>();

async function sameOriginFetch(url: URL, accept: string, timeout = 12000) {
  const origin = url.origin;
  let current = url;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(current.toString(), {
      redirect: 'manual',
      headers: { Accept: accept, 'User-Agent': FETCH_AGENT },
      signal: AbortSignal.timeout(timeout),
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('Ambiguous redirect without a destination');
    const next = new URL(location, current);
    if (next.protocol !== 'https:' || next.origin !== origin) throw new Error('Unreviewed cross-origin redirect');
    current = next;
  }
  throw new Error('Too many redirects');
}

function robotsRuleMatches(rule: string, path: string) {
  if (!rule) return false;
  const anchored = rule.endsWith('$');
  const body = (anchored ? rule.slice(0, -1) : rule)
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
}

function robotsAllows(contents: string, path: string) {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; value: string }> }> = [];
  let agents: string[] = [];
  let rules: Array<{ allow: boolean; value: string }> = [];
  const finish = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (rules.length) finish();
      agents.push(value.toLowerCase());
    } else if ((field === 'allow' || field === 'disallow') && agents.length) {
      rules.push({ allow: field === 'allow', value });
    }
  }
  finish();
  const token = 'libraryloop';
  const specific = groups.filter((group) => group.agents.some((agent) => agent !== '*' && token.includes(agent)));
  const applicable = specific.length ? specific : groups.filter((group) => group.agents.includes('*'));
  const matches = applicable.flatMap((group) => group.rules).filter((rule) => robotsRuleMatches(rule.value, path));
  if (!matches.length) return true;
  matches.sort((left, right) => right.value.length - left.value.length || Number(right.allow) - Number(left.allow));
  return matches[0].allow;
}

async function allowedByRobots(url: URL) {
  let cached = robotsCache.get(url.origin);
  if (!cached) {
    cached = (async () => {
      const response = await sameOriginFetch(new URL('/robots.txt', url.origin), 'text/plain', 8000);
      if (response.status === 404 || response.status === 410) return '';
      if (!response.ok) throw new Error(`robots.txt returned HTTP ${response.status}`);
      return response.text();
    })();
    robotsCache.set(url.origin, cached);
  }
  return robotsAllows(await cached, `${url.pathname}${url.search}`);
}

async function fetchWithTimeout(url: string) {
  const target = new URL(url);
  if (target.protocol !== 'https:') throw new Error('Only reviewed HTTPS feeds are allowed');
  if (!(await allowedByRobots(target))) throw new Error('Blocked by robots.txt');
  const response = await sameOriginFetch(
    target,
    'application/json, text/calendar;q=0.9, application/rss+xml;q=0.8, application/xml;q=0.8, text/plain;q=0.7',
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('text/html')) throw new Error('Ambiguous HTML, login, or challenge response');
  return response;
}

async function fetchFeed(feed: FeedConfig, start: string, end: string) {
  if (feed.type === 'civicplus') {
    const response = await fetchWithTimeout(feed.endpoint);
    const calendar = await response.text();
    if (!calendar.includes('BEGIN:VCALENDAR')) throw new Error('Invalid iCalendar response');
    const records = parseIcs(calendar);
    return records.map((record) => normalizeIcs(record, feed, start, end)).filter((event): event is LiveEvent => Boolean(event));
  }

  if (feed.type === 'librarycalendar') {
    const response = await fetchWithTimeout(feed.endpoint);
    const payload = await response.json() as unknown;
    const records = Array.isArray(payload) ? payload : payload && typeof payload === 'object' && Array.isArray((payload as UnknownRecord).events) ? (payload as UnknownRecord).events as unknown[] : [];
    return records.filter((record): record is UnknownRecord => Boolean(record && typeof record === 'object')).map((record) => normalizeLibraryCalendar(record, feed, start, end)).filter((event): event is LiveEvent => Boolean(event));
  }

  if (feed.type === 'squarespace') {
    const response = await fetchWithTimeout(feed.endpoint);
    const payload = await response.json() as UnknownRecord;
    const records = Array.isArray(payload.upcoming) ? payload.upcoming : Array.isArray(payload.items) ? payload.items : [];
    return records.filter((record): record is UnknownRecord => Boolean(record && typeof record === 'object')).map((record) => normalizeSquarespace(record, feed, start, end)).filter((event): event is LiveEvent => Boolean(event));
  }

  if (feed.type === 'communico') {
    const endpoint = new URL(feed.endpoint);
    const startInstant = Date.parse(`${start}T00:00:00Z`);
    const endInstant = Date.parse(`${end}T00:00:00Z`);
    const windowDays = Math.max(1, Math.ceil((endInstant - startInstant) / 86_400_000));
    endpoint.searchParams.set('event_type', '0');
    endpoint.searchParams.set('req', JSON.stringify({ private: false, date: start, days: windowDays }));
    const response = await fetchWithTimeout(endpoint.toString());
    const payload = await response.json() as unknown;
    const records = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as UnknownRecord).events)
        ? (payload as UnknownRecord).events as unknown[]
        : [];
    return records
      .filter((record): record is UnknownRecord => Boolean(record && typeof record === 'object'))
      .map((record) => normalizeCommunico(record, feed, start, end))
      .filter((event): event is LiveEvent => Boolean(event));
  }

  if (feed.type === 'rss') {
    const response = await fetchWithTimeout(feed.endpoint);
    const xml = await response.text();
    if (!/<rss\b|<feed\b/i.test(xml)) throw new Error('Invalid RSS response');
    return parseRssItems(xml)
      .map((item) => normalizeRss(item, feed, start, end))
      .filter((event): event is LiveEvent => Boolean(event));
  }

  if (feed.type === 'bibliocommons') {
    const endpoint = new URL(feed.endpoint);
    const items: string[] = [];
    const seen = new Set<string>();
    let reachedEndOrExhausted = false;
    for (let page = 1; page <= (feed.maxPages ?? 30); page += 1) {
      endpoint.searchParams.set('page', String(page));
      const response = await fetchWithTimeout(endpoint.toString());
      const xml = await response.text();
      if (!/<rss\b/i.test(xml)) throw new Error('Invalid BiblioCommons RSS response');
      const pageItems = parseRssItems(xml);
      if (!pageItems.length) {
        reachedEndOrExhausted = true;
        break;
      }
      let newItems = 0;
      for (const item of pageItems) {
        const key = xmlText(item, 'guid') || item;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
        newItems += 1;
      }
      if (!newItems) {
        reachedEndOrExhausted = true;
        break;
      }
      const latestDate = pageItems.reduce((latest, item) => {
        const date = xmlText(item, 'bc:start_date_local').slice(0, 10);
        return date > latest ? date : latest;
      }, '');
      if (latestDate >= end) {
        reachedEndOrExhausted = true;
        break;
      }
    }
    if (!reachedEndOrExhausted) throw new Error('BiblioCommons pagination reached its reviewed safety cap');
    return items
      .map((item) => normalizeBibliocommons(item, feed, start, end))
      .filter((event): event is LiveEvent => Boolean(event));
  }

  if (feed.type === 'mycalendar') {
    const response = await fetchWithTimeout(feed.endpoint);
    const payload = await response.json() as unknown;
    const containers = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object'
        ? Object.values(payload as UnknownRecord)
        : [];
    const records = containers.flatMap((value) => Array.isArray(value) ? value : [value]);
    const seen = new Set<string>();
    return records
      .filter((record): record is UnknownRecord => Boolean(record && typeof record === 'object' && 'event_title' in record))
      .filter((record) => {
        const key = `${stringValue(record.occur_id ?? record.event_id)}|${stringValue(record.occur_begin ?? record.event_begin)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((record) => normalizeMyCalendar(record, feed, start, end))
      .filter((event): event is LiveEvent => Boolean(event));
  }

  if (feed.type !== 'tribe') throw new Error(`Unsupported feed type: ${feed.type}`);
  const endpoint = new URL(feed.endpoint);
  endpoint.searchParams.set('start_date', `${start} 00:00:00`);
  endpoint.searchParams.set('end_date', `${end} 00:00:00`);
  endpoint.searchParams.set('per_page', '50');
  const response = await fetchWithTimeout(endpoint.toString());
  const payload = await response.json() as UnknownRecord;
  const records = Array.isArray(payload.events) ? [...payload.events] : [];
  const reportedPages = Number(payload.total_pages) || 1;
  const maxPages = feed.maxPages ?? 20;
  if (reportedPages > maxPages) throw new Error(`Event pagination exceeded the ${maxPages}-page safety cap`);
  const totalPages = Math.min(reportedPages, maxPages);
  for (let page = 2; page <= totalPages; page += 1) {
    endpoint.searchParams.set('page', String(page));
    const nextResponse = await fetchWithTimeout(endpoint.toString());
    const nextPayload = await nextResponse.json() as UnknownRecord;
    if (Array.isArray(nextPayload.events)) records.push(...nextPayload.events);
  }
  return records.filter((record): record is UnknownRecord => Boolean(record && typeof record === 'object')).map((record) => normalizeTribe(record, feed, start, end)).filter((event): event is LiveEvent => Boolean(event));
}

async function settledPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;
  const runner = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const requestedStart = query.get('start') ?? chicagoTodayKey();
  const start = isValidDateKey(requestedStart) ? requestedStart : chicagoTodayKey();
  const days = calendarDays(query.get('days'));
  const end = addDays(start, days);
  const snapshotKey = `${start}|${days}`;
  const refresh = query.get('refresh') === '1';
  if (refresh) {
    const secret = (await collectorEnv()).LIBRARY_LOOP_INGEST_TOKEN;
    if (!secret) return Response.json({ error: 'Calendar refresh authentication is not configured' }, { status: 503 });
    const authorization = request.headers.get('authorization') ?? '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!supplied || !(await equalSecret(supplied, secret))) {
      return Response.json({ error: 'Calendar refresh is not authorized' }, { status: 401 });
    }
  }
  let database: D1Database | null = null;
  try {
    database = await collectorDatabase();
    await ensureCollectorSchema(database);
    if (!refresh) {
      const saved = await readDailyCalendarSnapshot(database, snapshotKey) ?? await readLatestDailyCalendarSnapshot(database, start, end);
      if (saved) return Response.json(saved, { headers: { 'Cache-Control': 'public, max-age=300' } });
      return Response.json({ error: 'No saved structured calendar is available' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  } catch {
    database = null;
  }
  if (!database) return Response.json({ error: 'Saved calendar storage is unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const previous = await readDailyCalendarSnapshot(database, snapshotKey)
    ?? await readLatestDailyCalendarSnapshot(database, start, end);
  const results = await settledPool(structuredSources, 5, async (feed) => ({ feed, events: await fetchFeed(feed, start, end) }));
  const successful = results.filter((result): result is PromiseFulfilledResult<{ feed: FeedConfig; events: LiveEvent[] }> => result.status === 'fulfilled');
  const failedSources = results.flatMap((result, index) => result.status === 'rejected' ? [structuredSources[index].name] : []);
  const sourceReceipts: StructuredSourceReceipt[] = results.map((result, index) => {
    const feed = structuredSources[index];
    if (result.status === 'rejected') {
      const message = result.reason instanceof Error ? result.reason.message : 'Structured source collection failed';
      return { sourceId: feed.id, sourceName: feed.name, status: 'failed', eventCount: 0, latestEventDate: null, error: message.replace(/\s+/g, ' ').slice(0, 500) };
    }
    const latestEventDate = result.value.events.reduce((latest, event) => event.dateKey > latest ? event.dateKey : latest, '');
    return {
      sourceId: feed.id,
      sourceName: feed.name,
      status: result.value.events.length ? 'success' : 'empty',
      eventCount: result.value.events.length,
      latestEventDate: latestEventDate || null,
      error: null,
    };
  });
  const retainedSources: string[] = [];
  const deduped = new Map<string, LiveEvent>();
  for (const [index, result] of results.entries()) {
    const feed = structuredSources[index];
    const currentEvents = result.status === 'fulfilled' ? result.value.events : [];
    const shouldRetain = result.status === 'rejected' || currentEvents.length === 0;
    const retainedEvents = shouldRetain
      ? (previous?.events ?? []).filter((event) => event.source === feed.name && event.dateKey >= start && event.dateKey < end)
      : [];
    if (retainedEvents.length) retainedSources.push(feed.name);
    for (const event of currentEvents.length ? currentEvents : retainedEvents) {
      const retained = retainedEvents.includes(event);
      let canonicalUrl = '';
      try {
        const parsed = new URL(event.url || event.registrationUrl);
        parsed.hash = '';
        for (const key of [...parsed.searchParams.keys()]) {
          if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) parsed.searchParams.delete(key);
        }
        canonicalUrl = parsed.toString();
      } catch {
        canonicalUrl = '';
      }
      const key = [event.source, event.title, event.startLocal, event.venue, canonicalUrl]
        .map((value) => value.trim().toLowerCase()).join('|');
      if (!deduped.has(key)) deduped.set(key, event);
      if (retained) deduped.set(key, {
        ...event,
        scheduleNotice: event.scheduleNotice || 'Saved from the last successful source refresh — confirm details with the organizer.',
      });
    }
  }
  const events = [...deduped.values()].sort((a, b) => a.startLocal.localeCompare(b.startLocal) || a.distance - b.distance);
  const payload: EventsResponse = {
    events,
    updatedAt: new Date().toISOString(),
    window: { start, end: addDays(end, -1), days },
    sourceStatus: {
      attempted: structuredSources.length,
      connected: successful.length,
      empty: successful.filter((result) => result.value.events.length === 0).length,
      failed: failedSources.length,
      failedSources,
      retained: retainedSources.length,
      retainedSources,
    },
  };
  try {
    await writeDailyCalendarSnapshot(database, snapshotKey, payload, sourceReceipts);
    const confirmed = await readDailyCalendarSnapshot(database, snapshotKey);
    if (!confirmed || confirmed.updatedAt !== payload.updatedAt) throw new Error('Snapshot read-back did not match');
  } catch (error) {
    console.error('Structured calendar snapshot write failed', error);
    return Response.json({ error: 'Structured calendar was collected but could not be saved' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  return Response.json({ ...payload, persisted: true, horizonDays: CALENDAR_HORIZON_DAYS }, { headers: { 'Cache-Control': 'no-store' } });
}
