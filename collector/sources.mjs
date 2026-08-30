// This manifest mirrors the current `page` and `manual` library rows in
// app/sources/page.tsx, excluding Chicago Public Library because its verified
// filtered RSS belongs in the direct-feed path. URLs are never guessed.
const configuredSources = [
  { id: 'justice-public-library', name: 'Justice Public Library District', distance: 2.00, status: 'page', method: 'Web page + partial RSS', note: 'Calendar details can be extracted from the site.', url: 'https://justicepubliclibrary.com/' },
  { id: 'bedford-park-public-library', name: 'Bedford Park Public Library District', distance: 3.45, status: 'manual', method: 'Custom dynamic calendar', note: 'Needs browser-assisted collection.', url: 'https://bedfordparklibrary.com/events-calendar' },
  { id: 'hodgkins-public-library', name: 'Hodgkins Public Library District', distance: 3.56, status: 'page', method: 'HTML/PDF + partial RSS', note: 'Youth program details are available on the site.', url: 'https://www.hodgkinslibrary.org/children/programs/' },
  { id: 'summit-public-library', name: 'Summit Public Library District', distance: 3.85, status: 'manual', method: 'Wix flyer + OCR', note: 'Events are published visually and need review.', url: 'https://www.summitlibrary.info/events' },
  { id: 'palos-park-public-library', name: 'Palos Park Public Library', distance: 4.06, status: 'manual', method: 'Wix embedded calendar', note: 'Needs browser-assisted collection.', url: 'https://www.palosparklibrary.org/test-calendar' },
  { id: 'hometown-public-library', name: 'Hometown Public Library', distance: 5.14, status: 'page', method: 'Static web page', note: 'Program details can be extracted from the site.', url: 'https://myhometownlibrary.com/' },
  { id: 'lyons-public-library', name: 'Lyons Public Library', distance: 6.31, status: 'page', method: 'Program pages', note: 'Events can be collected from maintained pages.', url: 'https://lyonslibrary.org/' },
  { id: 'crestwood-public-library', name: 'Crestwood Public Library District', distance: 6.89, status: 'page', method: 'Plone event pages', note: 'Future events can be extracted from HTML.', url: 'https://www.crestwoodlibrary.org/event_listing?mode=future' },
  { id: 'la-grange-park-public-library', name: 'La Grange Park Public Library District', distance: 7.31, status: 'page', method: 'Browser event pages', note: 'Queued for overnight collection; the older RSS path is blocked.', url: 'https://www.lplibrary.org/events/' },
  { id: 'william-leonard-public-library', name: 'William Leonard Public Library District', distance: 8.45, status: 'page', method: 'HTML/PDF program blocks', note: 'Queued for overnight page collection.', url: 'https://wlpld.org/' },
  { id: 'bellwood-public-library', name: 'Bellwood Public Library', distance: 11.16, status: 'page', method: 'Events page fallback', note: 'Queued for overnight page collection because the listed RSS feed is failing.', url: 'https://www.bellwoodlibrary.org/events' },
  { id: 'maywood-public-library', name: 'Maywood Public Library District', distance: 11.26, status: 'manual', method: 'Wix calendar', note: 'Needs browser-assisted collection.', url: 'https://www.maywoodlibrary.org/happeningnow', alternateUrls: ['https://www.maywoodlibrary.org/rsvp'] },
  { id: 'markham-public-library', name: 'Markham Public Library', distance: 11.77, status: 'manual', method: 'WhoFi embed', note: 'Needs browser-assisted collection.', url: 'https://www.markhamlibrary.org/events/', alternateUrls: ['https://markham-il.whofi.com/'] },
  { id: 'melrose-park-public-library', name: 'Melrose Park Public Library', distance: 11.87, status: 'manual', method: 'Flyer/PDF review', note: 'Queued for the overnight OCR and review lane.', url: 'https://www.melrosepark.org/melrose-park-library-events/' },
  { id: 'berkeley-public-library', name: 'Berkeley Public Library', distance: 11.88, status: 'manual', method: 'Wix calendar', note: 'Needs browser-assisted collection.', url: 'https://www.berkeleypl.org/events-calendar' },
  { id: 'harvey-public-library', name: 'Harvey Public Library District', distance: 12.31, status: 'page', method: 'Freshness audit', note: 'Queued for overnight current-date validation before events are published.', url: 'https://www.harveylibrary.org/' },
];

export const librarySources = Object.freeze(configuredSources.map((source) => Object.freeze({
  ...source,
  collectionMode: 'browser-page',
  enabled: Boolean(source.url),
  requiresVisualReview: source.requiresVisualReview ?? (source.status === 'manual' || /pdf|ocr|flyer/i.test(source.method)),
})));

export function findSource(sourceId) {
  return librarySources.find((source) => source.id === sourceId);
}

export function enabledSources() {
  return librarySources.filter((source) => source.enabled);
}
