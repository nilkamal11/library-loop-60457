import type { LiveEvent } from './live-event';

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function eventSpecificUrl(value: string) {
  const canonical = canonicalUrl(value);
  if (!canonical) return '';
  const url = new URL(canonical);
  const identifyingParameter = [...url.searchParams.keys()].some((key) =>
    /^(?:eid|event|eventid|event_id|activity|activity_id|id)$/i.test(key));
  if (identifyingParameter) return canonical;
  const path = url.pathname.replace(/\/+$/, '').toLowerCase();
  if (!path || path === '/') return '';
  if (/\/(?:wp-json\/tribe\/events\/v1\/events|api\/events|events|calendar|feed|rss)$/.test(path)) return '';
  if (/(?:icalendar\.aspx|calendarwiz_ical\.php|\.ics|\.xml)$/.test(path)) return '';
  return canonical;
}

function meaningfulPlace(value: string) {
  const place = normalized(value);
  if (!place || /^(?:see official listing|venue varies|location varies|various locations?|online event|tbd|to be determined)$/.test(place)) return '';
  return place;
}

function sameEvent(left: LiveEvent, right: LiveEvent) {
  if (left.startLocal !== right.startLocal) return false;
  const leftUrl = eventSpecificUrl(left.url || left.registrationUrl);
  const rightUrl = eventSpecificUrl(right.url || right.registrationUrl);
  if (leftUrl && leftUrl === rightUrl) return true;
  if (normalized(left.title) !== normalized(right.title)) return false;
  const leftVenue = meaningfulPlace(left.venue);
  const rightVenue = meaningfulPlace(right.venue);
  const leftAddress = meaningfulPlace(left.address);
  const rightAddress = meaningfulPlace(right.address);
  const sameAddress = Boolean(leftAddress && leftAddress === rightAddress);
  const sameVenue = Boolean(leftVenue && leftVenue === rightVenue);
  const sameSource = normalized(left.source) === normalized(right.source);
  const nearby = Number.isFinite(left.distance) && Number.isFinite(right.distance)
    && Math.abs(left.distance - right.distance) <= 0.5;
  return sameAddress || (sameVenue && (sameSource || nearby));
}

function preferredEvent(existing: LiveEvent, candidate: LiveEvent) {
  const existingOfficial = existing.sourceKind !== 'Family guide';
  const candidateOfficial = candidate.sourceKind !== 'Family guide';
  if (existingOfficial !== candidateOfficial) return candidateOfficial ? candidate : existing;
  if (existing.teenOnly !== candidate.teenOnly) return candidate.teenOnly ? existing : candidate;
  const existingSignup = canonicalUrl(existing.registrationUrl) !== canonicalUrl(existing.url);
  const candidateSignup = canonicalUrl(candidate.registrationUrl) !== canonicalUrl(candidate.url);
  if (existingSignup !== candidateSignup) return candidateSignup ? candidate : existing;
  return existing;
}

export function dedupeEvents(events: LiveEvent[]) {
  const deduped: LiveEvent[] = [];
  for (const event of events) {
    const index = deduped.findIndex((existing) => sameEvent(existing, event));
    if (index < 0) deduped.push(event);
    else deduped[index] = preferredEvent(deduped[index], event);
  }
  return deduped;
}
