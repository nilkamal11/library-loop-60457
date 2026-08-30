import { addDays, chicagoTodayKey, type LiveEvent, type SourceKind } from '@/lib/live-event';

export const runtime = 'edge';

type FeedType = 'librarycalendar' | 'tribe' | 'civicplus' | 'squarespace';

type FeedConfig = {
  id: string;
  name: string;
  endpoint: string;
  type: FeedType;
  sourceKind: SourceKind;
  distance: number;
  address: string;
  detailBase?: string;
  venueDistance?: boolean;
  icsUtc?: boolean;
  maxPages?: number;
};

type UnknownRecord = Record<string, unknown>;

const ZIP_CENTER = { lat: 41.7244, lng: -87.8273 };

const feeds: FeedConfig[] = [
  { id: 'green-hills', name: 'Green Hills Public Library District', endpoint: 'https://greenhillspld.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 1.4, address: '8611 W 103rd St, Palos Hills, IL 60465' },
  { id: 'prairie-trails', name: 'Prairie Trails Public Library District', endpoint: 'https://prairietrails.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 3.06, address: '8449 S Moody Ave, Burbank, IL 60459' },
  { id: 'oak-lawn-library', name: 'Oak Lawn Public Library', endpoint: 'https://oaklawnpl.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 3.97, address: '9427 S Raymond Ave, Oak Lawn, IL 60453' },
  { id: 'palos-heights-library', name: 'Palos Heights Public Library', endpoint: 'https://palosheights.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 4.51, address: '12501 S 71st Ave, Palos Heights, IL 60463' },
  { id: 'la-grange', name: 'La Grange Public Library', endpoint: 'https://lagrange.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 6.46, address: '10 W Cossitt Ave, La Grange, IL 60525' },
  { id: 'alsip-merrionette', name: 'Alsip-Merrionette Park Public Library District', endpoint: 'https://alsipmerrionette.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 6.59, address: '11960 S Pulaski Rd, Alsip, IL 60803' },
  { id: 'evergreen-park-library', name: 'Evergreen Park Public Library', endpoint: 'https://evergreenparklibrary.librarymarket.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 6.65, address: '9400 S Troy Ave, Evergreen Park, IL 60805' },
  { id: 'thomas-ford', name: 'Thomas Ford Memorial Library', endpoint: 'https://www.fordlibrary.org/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 7.1, address: '800 Chestnut St, Western Springs, IL 60558' },
  { id: 'orland-park-library', name: 'Orland Park Public Library', endpoint: 'https://orlandpark.librarycalendar.com/events/feed/json', type: 'librarycalendar', sourceKind: 'Library', distance: 7.39, address: '14921 S Ravinia Ave, Orland Park, IL 60462' },
  { id: 'bridgeview', name: 'Bridgeview Public Library', endpoint: 'https://bridgeviewlibrary.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 1.81, address: '7840 W 79th St, Bridgeview, IL 60455' },
  { id: 'mccook', name: 'McCook Public Library District', endpoint: 'https://mccook.lib.il.us/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 5.29, address: '8419 W 50th St, McCook, IL 60525' },
  { id: 'indian-prairie-library', name: 'Indian Prairie Public Library District', endpoint: 'https://ippl.libcal.com/ical_subscribe.php?src=p&cid=9323', type: 'civicplus', sourceKind: 'Library', distance: 6.88, address: '401 Plainfield Rd, Darien, IL 60561', icsUtc: true },
  { id: 'north-riverside-library', name: 'North Riverside Public Library District', endpoint: 'https://www.nrpl.info/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 8.47, address: '2400 S Des Plaines Ave, North Riverside, IL 60546' },
  { id: 'acorn-library', name: 'Acorn Public Library District', endpoint: 'https://acornlibrary.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Library', distance: 8.89, address: '15624 Central Ave, Oak Forest, IL 60452' },
  { id: 'westmont-library', name: 'Westmont Public Library', endpoint: 'https://westmontlibrary.libcal.com/ical_subscribe.php?src=p&cid=21445', type: 'civicplus', sourceKind: 'Library', distance: 9.44, address: '428 N Cass Ave, Westmont, IL 60559', icsUtc: true },
  { id: 'fpdcc', name: 'Forest Preserves of Cook County', endpoint: 'https://fpdcc.com/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Forest preserve', distance: 15, address: 'Venue varies', venueDistance: true, maxPages: 3 },
  { id: 'lake-katherine', name: 'Lake Katherine Nature Center', endpoint: 'https://www.lakekatherine.org/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar', type: 'civicplus', sourceKind: 'Forest preserve', distance: 3.6, address: '7402 Lake Katherine Dr, Palos Heights, IL 60463', detailBase: 'https://www.lakekatherine.org/calendar.aspx?EID=' },
  { id: 'western-springs-community', name: 'Western Springs Community Events', endpoint: 'https://www.wsprings.com/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 7.8, address: 'Western Springs, IL 60558', detailBase: 'https://www.wsprings.com/calendar.aspx?EID=' },
  { id: 'chicago-ridge-parks', name: 'Chicago Ridge Park District', endpoint: 'https://chicagoridgeparks.com/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 3, address: '10736 Lombard Ave, Chicago Ridge, IL 60415' },
  { id: 'summit-parks', name: 'Summit Park District', endpoint: 'https://summitparks.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 4, address: '5700 S Archer Rd, Summit, IL 60501' },
  { id: 'oak-lawn-parks', name: 'Oak Lawn Park District', endpoint: 'https://www.olparks.com/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 4, address: '9401 S Oak Park Ave, Oak Lawn, IL 60453' },
  { id: 'lyons-parks', name: 'Village of Lyons Parks & Recreation', endpoint: 'https://www.villageoflyons-il.net/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Recreation', distance: 6.3, address: '4200 Lawndale Ave, Lyons, IL 60534' },
  { id: 'westmont-parks', name: 'Westmont Park District', endpoint: 'https://www.westmontparks.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 9.4, address: '55 E Richmond St, Westmont, IL 60559' },
  { id: 'lemont-parks', name: 'Lemont Park District', endpoint: 'https://www.lemontparkdistrict.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 10, address: '16028 127th St, Lemont, IL 60439' },
  { id: 'oak-park-parks', name: 'Park District of Oak Park', endpoint: 'https://pdop.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 10.5, address: '218 Madison St, Oak Park, IL 60302', maxPages: 3 },
  { id: 'tinley-parks', name: 'Tinley Park-Park District', endpoint: 'https://tinleyparkdistrict.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 11.2, address: '8125 W 171st St, Tinley Park, IL 60477' },
  { id: 'woodridge-parks', name: 'Woodridge Park District', endpoint: 'https://www.woodridgeparks.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 11.4, address: '2600 Center Dr, Woodridge, IL 60517' },
  { id: 'dolton-parks', name: 'Dolton Park District', endpoint: 'https://doltonparkdistrict.org/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 12.8, address: '721 Engle St, Dolton, IL 60419', maxPages: 3 },
  { id: 'hf-parks', name: 'Homewood-Flossmoor Park District', endpoint: 'https://hfparks.com/wp-json/tribe/events/v1/events', type: 'tribe', sourceKind: 'Park district', distance: 14.3, address: '1824 Ridge Rd, Homewood, IL 60430' },
  { id: 'evergreen-rec', name: 'Evergreen Park Recreation', endpoint: 'https://www.evergreenpark-ill.com/common/modules/iCalendar/iCalendar.aspx?catID=22&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 6.6, address: '3450 W 97th St, Evergreen Park, IL 60805', detailBase: 'https://www.evergreenpark-ill.com/calendar.aspx?EID=' },
  { id: 'evergreen-youth', name: 'Evergreen Park Youth Programs', endpoint: 'https://www.evergreenpark-ill.com/common/modules/iCalendar/iCalendar.aspx?catID=26&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 6.6, address: '3450 W 97th St, Evergreen Park, IL 60805', detailBase: 'https://www.evergreenpark-ill.com/calendar.aspx?EID=' },
  { id: 'palos-heights-rec', name: 'Palos Heights Parks & Recreation', endpoint: 'https://www.palosheightsrec.org/common/modules/iCalendar/iCalendar.aspx?catID=25&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 4.7, address: '6601 W 127th St, Palos Heights, IL 60463', detailBase: 'https://www.palosheightsrec.org/calendar.aspx?EID=' },
  { id: 'indian-head-rec', name: 'Indian Head Park Recreation', endpoint: 'https://indianheadpark-il.gov/common/modules/iCalendar/iCalendar.aspx?catID=22&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 6.2, address: '201 Acacia Dr, Indian Head Park, IL 60525', detailBase: 'https://www.indianheadpark-il.gov/calendar.aspx?EID=' },
  { id: 'bedford-parks', name: 'Bedford Park District', endpoint: 'https://www.bedfordparkdistrict.org/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar', type: 'civicplus', sourceKind: 'Park district', distance: 3.5, address: '6652 S 78th Ave, Bedford Park, IL 60638', detailBase: 'https://www.bedfordparkdistrict.org/calendar.aspx?EID=' },
  { id: 'burbank-parks', name: 'Burbank Park District', endpoint: 'https://www.burbankil.gov/common/modules/iCalendar/iCalendar.aspx?catID=29&feed=calendar', type: 'civicplus', sourceKind: 'Park district', distance: 4.7, address: '6100 W 85th St, Burbank, IL 60459', detailBase: 'https://www.burbankil.gov/calendar.aspx?EID=' },
  { id: 'palos-park-rec', name: 'Palos Park Recreation & Parks', endpoint: 'https://www.palospark.org/common/modules/iCalendar/iCalendar.aspx?catID=30&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 7.5, address: '8901 W 123rd St, Palos Park, IL 60464', detailBase: 'https://www.palospark.org/calendar.aspx?EID=' },
  { id: 'north-riverside-rec', name: 'North Riverside Parks & Recreation', endpoint: 'https://www.northriverside-il.org/common/modules/iCalendar/iCalendar.aspx?catID=24&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 8.5, address: '2401 S Des Plaines Ave, North Riverside, IL 60546', detailBase: 'https://www.northriverside-il.org/calendar.aspx?EID=' },
  { id: 'forest-park-parks', name: 'Forest Park Park District', endpoint: 'https://www.pdofp.org/events?format=json', type: 'squarespace', sourceKind: 'Park district', distance: 10.5, address: '7501 Harrison St, Forest Park, IL 60130' },
  { id: 'maywood-parks', name: 'Maywood Park District', endpoint: 'https://www.maywoodparkdistrict.org/2026-calendar?format=json', type: 'squarespace', sourceKind: 'Park district', distance: 11.3, address: '921 S 9th Ave, Maywood, IL 60153' },
  { id: 'lisle-parks', name: 'Lisle Park District', endpoint: 'https://www.calendarwiz.com/CalendarWiz_iCal.php?crd=lisleparkdistrict', type: 'civicplus', sourceKind: 'Park district', distance: 13.2, address: '1925 Ohio St, Lisle, IL 60532', icsUtc: true },
  { id: 'villa-park-events', name: 'Villa Park Parks & Recreation', endpoint: 'https://villaparkil.gov/common/modules/iCalendar/iCalendar.aspx?catID=35&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 13.5, address: '320 E Wildwood Ave, Villa Park, IL 60181', detailBase: 'https://villaparkil.gov/calendar.aspx?EID=' },
  { id: 'elmwood-park-rec', name: 'Elmwood Park Parks & Recreation', endpoint: 'https://www.elmwoodpark.org/common/modules/iCalendar/iCalendar.aspx?catID=25&feed=calendar', type: 'civicplus', sourceKind: 'Recreation', distance: 14.1, address: '2 Conti Pkwy, Elmwood Park, IL 60707', detailBase: 'https://www.elmwoodpark.org/calendar.aspx?EID=' },
];

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

function explicitAge(text: string) {
  const candidates: Array<{ min: number; max: number; label: string }> = [];
  for (const exactYears of text.matchAll(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\s*(?:yrs?|years?)?\s*(?:[-–—]|to|through)\s*(\d{1,2})\s*(?:yrs?|years?)\b/gi)) {
    candidates.push({ min: Number(exactYears[1]), max: Number(exactYears[2]), label: `Ages ${exactYears[1]}–${exactYears[2]}` });
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
      teenOnly: matching.length > 0 && matching.every((candidate) => candidate.min >= 13),
    };
  }
  const single = text.match(/\b(?:ages?|age)\s*:?\s*(\d{1,2})\b/i);
  if (single) {
    const value = Number(single[1]);
    return { min: value, max: value, label: `Age ${single[1]}`, includesNine: value === 9, teenOnly: value >= 13 };
  }
  return null;
}

function deriveAudience(title: string, description: string, labels: string[], sourceKind: SourceKind) {
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
  const teenOnly = age
    ? Boolean(age.teenOnly) || (!age.includesNine && namedTeen)
    : namedTeen;
  const adultOnly = /\badults? only\b|\b18\s*(?:\+|and (?:up|older))|\b21\s*\+|\bseniors?\b|\b55\s*\+/.test(lower);
  const youngOnly = /\b(?:bab(?:y|ies)|toddlers?|tots?|preschool(?:ers)?|birth\s*(?:-|to|through)\s*5)\b/.test(lower);
  const administrative = /\b(board|committee|commission) meetings?\b|public hearing|bid opening|meeting minutes/.test(lower);
  const teen = /\bteens?|tweens?|middle school|high school|grades?\b/.test(lower);
  const youth = /\bchildren|child(?:ren)?|kids?|youth|school[- ]age|homeschool/.test(lower);
  const adultActivity = /\b(bodypump|cycle|cycling|spin|nia|foam rolling|werq|zumba|pilates|barre|yoga|cardio|aerobics|fitness class|workout|strength training|pickleball|golf league|softball league)\b/.test(lower);
  const adultProgram = /\b(adults?|lapidary|lunch\s*(?:&|and)\s*learn|independent housing|retirement|medicare|matinee|provider training|staff training|certification)\b/.test(lower);
  const notAnEvent = /\b(?:pool|office|village hall|facility|building)\s+(?:is\s+)?closed\b|\bclosed\s+(?:august|september|october|november|december|january|february|march|april|may|june|july)|delayed opening|holiday hours/.test(lower);
  const generalPublicActivity = /\b(concert|festival|fest|fair|market|hike|walk|nature|hummingbirds?|birds?|bones?|kayak|open mic|improv|spray pad|swim|skate|climb|ceramics|arts?|craft|story|show|garage sale|touch-a-truck|yappy|wildlife|music|bingo|movie|theat(?:er|re)|audition|health fair|dance|holiday|celebration|workshop)\b/.test(lower);
  if (administrative || notAnEvent || (adultOnly && !age) || ((adultActivity || adultProgram) && !age && !teen && !youth && !familyNamed)) return { include: false, ages: '', teenOnly: false, family: false };
  if (age) return { include: age.min <= 16 && age.max >= 7, ages: age.label, teenOnly, family };
  if (teen) return { include: true, ages: labels.find((label) => /teen|tween/i.test(label)) ?? 'Teens / tweens', teenOnly: teenOnly || (!family && !youth && /\bteens?|high school\b/.test(lower)), family };
  if (youngOnly) return { include: false, ages: '', teenOnly: false, family: false };
  if (family) return { include: true, ages: 'Family / all ages', teenOnly: false, family: true };
  if (youth) return { include: true, ages: labels.find((label) => /child|kid|youth/i.test(label)) ?? 'Kids / youth', teenOnly: false, family };
  if (sourceKind !== 'Library' && generalPublicActivity) return { include: true, ages: 'Family / age not specified', teenOnly: false, family: true };
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
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
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
  const audience = deriveAudience(title, fullDescription, labels, feed.sourceKind);
  if (!audience.include) return null;
  const category = deriveCategory(`${title} ${fullDescription} ${objectNames(record.program_type).join(' ')}`);
  const branch = objectNames(record.branch)[0] ?? '';
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
    address: offsite || feed.address,
    distance: feed.distance,
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
  const audience = deriveAudience(title, fullDescription, labels, feed.sourceKind);
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
  const audience = deriveAudience(title, fullDescription, labels, feed.sourceKind);
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
  const audience = deriveAudience(title, fullDescription, labels, feed.sourceKind);
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

async function fetchWithTimeout(url: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json, text/calendar;q=0.9, text/plain;q=0.8', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

  const endpoint = new URL(feed.endpoint);
  endpoint.searchParams.set('start_date', `${start} 00:00:00`);
  endpoint.searchParams.set('end_date', `${end} 00:00:00`);
  endpoint.searchParams.set('per_page', '50');
  const response = await fetchWithTimeout(endpoint.toString());
  const payload = await response.json() as UnknownRecord;
  const records = Array.isArray(payload.events) ? [...payload.events] : [];
  const totalPages = Math.min(Number(payload.total_pages) || 1, feed.maxPages ?? 1);
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
  const start = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart) ? requestedStart : chicagoTodayKey();
  const days = Math.min(7, Math.max(1, Number.parseInt(query.get('days') ?? '7', 10) || 7));
  const end = addDays(start, days);
  const results = await settledPool(feeds, 5, async (feed) => ({ feed, events: await fetchFeed(feed, start, end) }));
  const successful = results.filter((result): result is PromiseFulfilledResult<{ feed: FeedConfig; events: LiveEvent[] }> => result.status === 'fulfilled');
  const failedSources = results.flatMap((result, index) => result.status === 'rejected' ? [feeds[index].name] : []);
  const deduped = new Map<string, LiveEvent>();
  for (const { events } of successful.map((result) => result.value)) {
    for (const event of events) {
      const key = `${event.title.toLowerCase()}|${event.startLocal}|${event.source.toLowerCase()}`;
      if (!deduped.has(key)) deduped.set(key, event);
    }
  }
  const events = [...deduped.values()].sort((a, b) => a.startLocal.localeCompare(b.startLocal) || a.distance - b.distance);
  return Response.json({
    events,
    updatedAt: new Date().toISOString(),
    window: { start, end: addDays(end, -1), days },
    sourceStatus: {
      attempted: feeds.length,
      connected: successful.length,
      empty: successful.filter((result) => result.value.events.length === 0).length,
      failed: failedSources.length,
      failedSources,
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=21600' },
  });
}
