/* eslint-disable @next/next/no-html-link-for-pages -- hard navigations are intentional for the current Sites runtime */
'use client';

import { useMemo, useState } from 'react';

type SourceStatus = 'feed' | 'page' | 'manual' | 'unavailable';

type CalendarSource = {
  name: string;
  distance: number;
  status: SourceStatus;
  method: string;
  note: string;
  url?: string;
};

const calendarSources: CalendarSource[] = [
  { name: 'Green Hills Public Library District', distance: 1.40, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://greenhillspld.librarycalendar.com/events/upcoming' },
  { name: 'Bridgeview Public Library', distance: 1.81, status: 'feed', method: 'WordPress Events', note: 'Structured events calendar.', url: 'https://bridgeviewlibrary.org/events/month/' },
  { name: 'Justice Public Library District', distance: 2.00, status: 'page', method: 'Web page + partial RSS', note: 'Calendar details can be extracted from the site.', url: 'https://justicepubliclibrary.com/' },
  { name: 'Worth Public Library District', distance: 3.02, status: 'feed', method: 'WordPress Events', note: 'Structured event listings.', url: 'https://www.worthlibrary.com/calendar/list/' },
  { name: 'Chicago Ridge Public Library', distance: 3.04, status: 'feed', method: 'Communico', note: 'Structured library calendar.', url: 'https://chicagoridgelibrary.org/all-events' },
  { name: 'Prairie Trails Public Library District', distance: 3.06, status: 'feed', method: 'LibraryCalendar', note: 'Structured event listings.', url: 'https://prairietrails.librarycalendar.com/events/list' },
  { name: 'Bedford Park Public Library District', distance: 3.45, status: 'manual', method: 'Custom dynamic calendar', note: 'Needs browser-assisted collection.', url: 'https://bedfordparklibrary.com/events-calendar' },
  { name: 'Hodgkins Public Library District', distance: 3.56, status: 'page', method: 'HTML/PDF + partial RSS', note: 'Youth program details are available on the site.', url: 'https://www.hodgkinslibrary.org/children/programs/' },
  { name: 'Summit Public Library District', distance: 3.85, status: 'manual', method: 'Wix flyer + OCR', note: 'Events are published visually and need review.', url: 'https://www.summitlibrary.info/events' },
  { name: 'Oak Lawn Public Library', distance: 3.97, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://oaklawnpl.librarycalendar.com/events/upcoming' },
  { name: 'Palos Park Public Library', distance: 4.06, status: 'manual', method: 'Wix embedded calendar', note: 'Needs browser-assisted collection.', url: 'https://www.palosparklibrary.org/test-calendar' },
  { name: 'Chicago Public Library', distance: 4.40, status: 'feed', method: 'BiblioCommons RSS', note: 'Official feed filtered to kids audiences and nearby branches.', url: 'https://chipublib.bibliocommons.com/v2/events?page=1' },
  { name: 'Palos Heights Public Library', distance: 4.51, status: 'feed', method: 'LibraryCalendar', note: 'Structured monthly calendar.', url: 'https://palosheights.librarycalendar.com/events/month' },
  { name: 'Hometown Public Library', distance: 5.14, status: 'page', method: 'Static web page', note: 'Program details can be extracted from the site.', url: 'https://myhometownlibrary.com/' },
  { name: 'McCook Public Library District', distance: 5.29, status: 'feed', method: 'WordPress Events', note: 'Feed works, although it is currently empty.', url: 'https://mccook.lib.il.us/calendar/' },
  { name: 'Lyons Public Library', distance: 6.31, status: 'page', method: 'Program pages', note: 'Events can be collected from maintained pages.', url: 'https://lyonslibrary.org/' },
  { name: 'La Grange Public Library', distance: 6.46, status: 'feed', method: 'LibraryCalendar', note: 'Structured event listings.', url: 'https://lagrange.librarycalendar.com/events/list' },
  { name: 'Stickney-Forest View Public Library District', distance: 6.53, status: 'feed', method: 'LibCal', note: 'Structured calendar feed.', url: 'https://sfvpld.org/calendar/' },
  { name: 'Alsip-Merrionette Park Public Library District', distance: 6.59, status: 'feed', method: 'LibraryCalendar', note: 'Structured event listings.', url: 'https://alsipmerrionette.librarycalendar.com/events/list' },
  { name: 'Evergreen Park Public Library', distance: 6.65, status: 'feed', method: 'Library Market', note: 'Structured monthly calendar.', url: 'https://evergreenparklibrary.librarymarket.com/events/month' },
  { name: 'Indian Prairie Public Library District', distance: 6.88, status: 'feed', method: 'LibCal', note: 'Structured calendar feed.', url: 'https://ippl.libcal.com/calendar?cid=9323&t=m&d=0000-00-00&cal=9323&inc=0' },
  { name: 'Crestwood Public Library District', distance: 6.89, status: 'page', method: 'Plone event pages', note: 'Future events can be extracted from HTML.', url: 'https://www.crestwoodlibrary.org/event_listing?mode=future' },
  { name: 'Thomas Ford Memorial Library', distance: 7.10, status: 'feed', method: 'LibraryCalendar', note: 'Structured event listings.', url: 'https://www.fordlibrary.org/events/list' },
  { name: 'Riverside Public Library', distance: 7.12, status: 'feed', method: 'LibCal', note: 'Structured calendar feed.', url: 'https://riversidelibrary.libcal.com/calendar' },
  { name: 'Linda Sokol Francis Brookfield Library', distance: 7.13, status: 'feed', method: 'Communico', note: 'Structured library calendar.', url: 'https://lsfbrookfieldlibrary.libnet.info/events' },
  { name: 'La Grange Park Public Library District', distance: 7.31, status: 'page', method: 'Browser event pages', note: 'Queued for overnight collection; the older RSS path is blocked.', url: 'https://www.lplibrary.org/events/' },
  { name: 'Orland Park Public Library', distance: 7.39, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://orlandpark.librarycalendar.com/events/upcoming' },
  { name: 'Hinsdale Public Library', distance: 7.58, status: 'feed', method: 'Communico', note: 'Structured library calendar.', url: 'https://hinsdale.libnet.info/events' },
  { name: 'Clarendon Hills Public Library', distance: 8.25, status: 'feed', method: 'LibCal', note: 'Structured calendar feed.', url: 'https://clarendonhillslibrary.libcal.com/calendar' },
  { name: 'Berwyn Public Library', distance: 8.25, status: 'feed', method: 'LibCal', note: 'Structured calendar feed.', url: 'https://berwynlibrary.libcal.com/calendar' },
  { name: 'William Leonard Public Library District', distance: 8.45, status: 'page', method: 'HTML/PDF program blocks', note: 'Queued for overnight page collection.', url: 'https://wlpld.org/' },
  { name: 'North Riverside Public Library District', distance: 8.47, status: 'feed', method: 'WordPress Events API', note: 'Structured JSON event feed.', url: 'https://www.nrpl.info/wp-json/tribe/events/v1/events' },
  { name: 'Midlothian Public Library', distance: 8.47, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://midlothian.librarycalendar.com/events/upcoming' },
  { name: 'Acorn Public Library District', distance: 8.89, status: 'feed', method: 'WordPress Events API', note: 'Structured JSON event feed.', url: 'https://acornlibrary.org/wp-json/tribe/events/v1/events' },
  { name: 'Blue Island Public Library', distance: 8.93, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://blueislandpl.librarycalendar.com/events/upcoming' },
  { name: 'Oak Brook Public Library', distance: 9.35, status: 'unavailable', method: 'Empty CivicPlus iCalendar', note: 'The official feed responds but currently contains no events.', url: 'https://www.oak-brook.org/common/modules/iCalendar/iCalendar.aspx?catID=23&feed=calendar' },
  { name: 'Westmont Public Library', distance: 9.44, status: 'feed', method: 'LibCal', note: 'Structured calendar feed.', url: 'https://westmontlibrary.libcal.com/calendar' },
  { name: 'Cicero Public Library', distance: 9.59, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://ciceropl.librarycalendar.com/events/upcoming' },
  { name: 'Westchester Public Library', distance: 9.60, status: 'feed', method: 'LibCal', note: 'Structured calendar feed.', url: 'https://westchesterpl.libcal.com/calendar' },
  { name: 'Broadview Public Library District', distance: 9.71, status: 'feed', method: 'LibCal iCalendar', note: 'Subscribable calendar feed.', url: 'https://broadviewlibrary.libcal.com/ical_subscribe.php?src=p&cid=7531' },
  { name: 'Calumet Park Public Library', distance: 9.77, status: 'feed', method: 'My Calendar API', note: 'Structured JSON event feed.', url: 'https://cpplibrary.org/wp-json/my-calendar/v1/events' },
  { name: 'Lemont Public Library District', distance: 10.04, status: 'feed', method: 'Communico', note: 'Structured library calendar.', url: 'https://lemontlibrary.libnet.info/events' },
  { name: 'Homer Township Public Library District', distance: 10.42, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://www.homerlibrary.org/events/upcoming' },
  { name: 'Forest Park Public Library', distance: 10.53, status: 'feed', method: 'WordPress RSS', note: 'Structured event feed.', url: 'https://cc.fppl.org/events/categories/forest-park-public-library/feed/' },
  { name: 'Oak Park Public Library', distance: 10.54, status: 'feed', method: 'LibraryCalendar', note: 'Structured feed with branch-level filtering.', url: 'https://oakpark.librarycalendar.com/events/upcoming' },
  { name: 'Downers Grove Public Library', distance: 10.55, status: 'feed', method: 'Communico', note: 'Structured library calendar.', url: 'https://downersgrove.libnet.info/events' },
  { name: 'Bellwood Public Library', distance: 11.16, status: 'page', method: 'Events page fallback', note: 'Queued for overnight page collection because the listed RSS feed is failing.', url: 'https://www.bellwoodlibrary.org/events' },
  { name: 'Tinley Park Public Library', distance: 11.18, status: 'feed', method: 'Communico', note: 'Structured library calendar.', url: 'https://tinley.libnet.info/events' },
  { name: 'Maywood Public Library District', distance: 11.26, status: 'manual', method: 'Wix calendar', note: 'Needs browser-assisted collection.', url: 'https://www.maywoodlibrary.org/happeningnow' },
  { name: 'Hillside Public Library', distance: 11.35, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://hillsidepl.librarycalendar.com/events/upcoming' },
  { name: 'Woodridge Public Library', distance: 11.35, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://www.woodridgelibrary.org/events/upcoming' },
  { name: 'River Forest Public Library', distance: 11.70, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://www.riverforestlibrary.org/events/upcoming' },
  { name: 'Markham Public Library', distance: 11.77, status: 'manual', method: 'WhoFi embed', note: 'Needs browser-assisted collection.', url: 'https://www.markhamlibrary.org/events/' },
  { name: 'Melrose Park Public Library', distance: 11.87, status: 'manual', method: 'Flyer/PDF review', note: 'Queued for the overnight OCR and review lane.', url: 'https://www.melrosepark.org/melrose-park-library-events/' },
  { name: 'Berkeley Public Library', distance: 11.88, status: 'manual', method: 'Wix calendar', note: 'Needs browser-assisted collection.', url: 'https://www.berkeleypl.org/events-calendar' },
  { name: 'Riverdale Public Library District', distance: 12.16, status: 'feed', method: 'WordPress Events API', note: 'Structured JSON event feed.', url: 'https://rpld.org/wp-json/tribe/events/v1/events' },
  { name: 'Harvey Public Library District', distance: 12.31, status: 'page', method: 'Freshness audit', note: 'Queued for overnight current-date validation before events are published.', url: 'https://www.harveylibrary.org/' },
  { name: 'Dolton Public Library District', distance: 12.78, status: 'unavailable', method: 'Closed EventKeeper', note: 'The former official calendar is no longer usable.', url: 'https://www.doltonpubliclibrary.org/events/' },
  { name: 'Fountaindale Public Library District', distance: 13.00, status: 'feed', method: 'Communico', note: 'Structured library calendar.', url: 'https://fountaindale.libnet.info/events' },
  { name: 'Phoenix Public Library District', distance: 13.19, status: 'unavailable', method: 'No usable official calendar', note: 'No current public calendar source was found.', url: 'https://www.bolcenter.org/about-us' },
  { name: 'Lisle Library District', distance: 13.23, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://lisle.librarycalendar.com/events/upcoming' },
  { name: 'Grande Prairie Public Library District', distance: 13.29, status: 'unavailable', method: 'Empty/unreachable iCalendar', note: 'The official site currently reports no upcoming events.', url: 'https://www.grandeprairie.org/events/list/?ical=1' },
  { name: 'Mokena Community Public Library District', distance: 13.43, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://mokena.librarycalendar.com/events/upcoming' },
  { name: 'Elmhurst Public Library', distance: 13.46, status: 'feed', method: 'LibCal', note: 'Structured calendar feed.', url: 'https://elmhurstpubliclibrary.libcal.com/calendar' },
  { name: 'Villa Park Public Library', distance: 13.52, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://villapark.librarycalendar.com/events/upcoming' },
  { name: 'Northlake Public Library District', distance: 13.52, status: 'feed', method: 'WordPress Events API', note: 'Structured JSON event feed.', url: 'https://www.northlakelibrary.org/wp-json/tribe/events/v1/events' },
  { name: 'Homewood Public Library District', distance: 13.92, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://homewood.librarycalendar.com/events/upcoming' },
  { name: 'White Oak Library District', distance: 14.05, status: 'feed', method: 'LibraryCalendar', note: 'Structured feed with branch-level filtering.', url: 'https://whiteoak.librarycalendar.com/events/upcoming' },
  { name: 'Elmwood Park Public Library', distance: 14.06, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://elmwoodpark.librarycalendar.com/events/upcoming' },
  { name: 'South Holland Public Library', distance: 14.22, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://www.shlibrary.org/events/upcoming' },
  { name: 'River Grove Public Library', distance: 14.24, status: 'feed', method: 'LibCal', note: 'Structured calendar feed.', url: 'https://rivergrovelibrary.libcal.com/calendar' },
  { name: 'Helen Plum Library', distance: 14.52, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://www.helenplum.org/events/upcoming' },
  { name: 'Franklin Park Public Library District', distance: 14.52, status: 'feed', method: 'WordPress Events API', note: 'Structured JSON event feed.', url: 'https://www.fppld.org/wp-json/tribe/events/v1/events' },
  { name: 'Flossmoor Public Library', distance: 14.67, status: 'feed', method: 'LibraryCalendar', note: 'Structured upcoming-events feed.', url: 'https://flossmoor.librarycalendar.com/events/upcoming' },
  { name: 'Naperville Public Library', distance: 14.88, status: 'feed', method: 'LibraryCalendar', note: 'Structured feed filtered to the nearby Naper Boulevard branch.', url: 'https://napervillepl.librarycalendar.com/events/upcoming' },
];

const statusDetails: Record<SourceStatus, { label: string; short: string; description: string }> = {
  feed: { label: 'Direct live feed', short: 'Live', description: 'A structured calendar is connected directly.' },
  page: { label: 'Overnight page', short: 'Overnight', description: 'The local overnight collector handles this official page.' },
  manual: { label: 'Overnight browser', short: 'Browser', description: 'A browser, OCR, or review step is needed overnight.' },
  unavailable: { label: 'Blocked / empty', short: 'Blocked', description: 'No current publishable event source is available.' },
};

const filterOrder: Array<'all' | SourceStatus> = ['all', 'feed', 'page', 'manual', 'unavailable'];

export default function SourcesPage() {
  const [filter, setFilter] = useState<'all' | SourceStatus>('all');
  const [query, setQuery] = useState('');

  const totals = useMemo(() => ({
    feed: calendarSources.filter((source) => source.status === 'feed').length,
    page: calendarSources.filter((source) => source.status === 'page').length,
    manual: calendarSources.filter((source) => source.status === 'manual').length,
    unavailable: calendarSources.filter((source) => source.status === 'unavailable').length,
  }), []);

  const visibleSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return calendarSources.filter((source) => {
      const matchesFilter = filter === 'all' || source.status === filter;
      const matchesQuery = !normalizedQuery || `${source.name} ${source.method} ${source.note}`.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  const collectableTotal = totals.feed + totals.page + totals.manual;

  return (
    <main className="app-shell sources-shell">
      <aside className="sidebar">
        <a className="brand brand-link" href="/"><span className="brand-mark" aria-hidden="true">L</span><span>Library Loop</span></a>
        <nav className="nav" aria-label="Main navigation">
          <a className="nav-link" href="/"><span aria-hidden="true">▦</span> Day planner</a>
          <a className="nav-link" href="/week"><span aria-hidden="true">□</span> Week view</a>
          <a className="nav-link" href="/map"><span aria-hidden="true">⌖</span> Library map</a>
          <a className="nav-link active" href="/sources" aria-current="page"><span aria-hidden="true">↻</span> Calendar sources</a>
        </nav>
        <div className="sidebar-spacer" />
        <section className="coverage-card" aria-label="Calendar coverage">
          <p className="eyebrow">Calendar coverage</p><strong>{collectableTotal} of 75</strong>
          <p>have a direct or overnight<br />collection path</p>
          <div className="coverage-meter connected"><span /></div><small>{totals.feed} direct · {totals.page + totals.manual} overnight · {totals.unavailable} blocked</small>
        </section>
      </aside>

      <section className="workspace sources-workspace">
        <header className="topbar sources-topbar">
          <div><p className="eyebrow">Library calendars · 15 miles from 60457</p><h1>Calendar collection status.</h1><p className="lede">Every public library in scope, showing what is connected directly, queued for the overnight collector, or currently blocked.</p></div>
          <a className="back-button" href="/">← Back to planner</a>
        </header>

        <nav className="source-tabs" aria-label="Calendar source type">
          <a className="active" href="/sources" aria-current="page"><span aria-hidden="true">▤</span><strong>Libraries</strong><small>75 sources</small></a>
          <a href="/sources/parks"><span aria-hidden="true">♧</span><strong>Parks & nature</strong><small>62 sources</small></a>
          <a href="/sources/guides"><span aria-hidden="true">☆</span><strong>Family guides</strong><small>8 sources</small></a>
        </nav>

        <section className="source-metrics" aria-label="Calendar source totals">
          {(Object.keys(statusDetails) as SourceStatus[]).map((status) => (
            <button className={`metric-card ${status} ${filter === status ? 'selected' : ''}`} key={status} onClick={() => setFilter(filter === status ? 'all' : status)} type="button" aria-pressed={filter === status}>
              <span className={`status-dot ${status}`} aria-hidden="true" />
              <strong>{totals[status]}</strong>
              <div><b>{statusDetails[status].label}</b><small>{statusDetails[status].description}</small></div>
            </button>
          ))}
        </section>

        <section className="sources-panel">
          <div className="sources-toolbar">
            <div>
              <p className="eyebrow">Source directory</p>
              <h2>{visibleSources.length} {visibleSources.length === 1 ? 'library' : 'libraries'}</h2>
            </div>
            <label className="source-search">
              <span className="sr-only">Search libraries</span>
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search library or method" type="search" />
            </label>
          </div>

          <div className="source-filters" aria-label="Filter by calendar access">
            {filterOrder.map((status) => {
              const label = status === 'all' ? 'All sources' : statusDetails[status].label;
              const count = status === 'all' ? calendarSources.length : totals[status];
              return <button className={filter === status ? 'active' : ''} key={status} onClick={() => setFilter(status)} type="button" aria-pressed={filter === status}>{label}<span>{count}</span></button>;
            })}
          </div>

          <div className="sources-table-wrap">
            <table className="sources-table">
              <thead><tr><th>Library</th><th>Distance</th><th>Calendar access</th><th>Method and notes</th><th><span className="sr-only">Calendar link</span></th></tr></thead>
              <tbody>
                {visibleSources.map((source) => (
                  <tr key={source.name}>
                    <td data-label="Library"><strong>{source.name}</strong></td>
                    <td data-label="Distance"><span className="distance-value">{source.distance.toFixed(2)} mi</span></td>
                    <td data-label="Access"><span className={`status-pill ${source.status}`}><i aria-hidden="true" />{statusDetails[source.status].label}</span></td>
                    <td data-label="Method"><strong className="method-name">{source.method}</strong><small>{source.note}</small></td>
                    <td className="source-link-cell">{source.url ? <a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open calendar source for ${source.name}`}>Open <span aria-hidden="true">↗</span></a> : <span aria-label="Verified link not yet added">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!visibleSources.length && <div className="sources-empty"><h2>No matching libraries</h2><p>Try a different search or calendar-access filter.</p></div>}
        </section>

        <aside className="source-legend" aria-label="How to read the statuses">
          <p><strong>How to read this:</strong> Direct feeds refresh from the Site. Overnight page and browser sources run locally while your computer and the ChatGPT desktop app are on. A failed overnight source keeps its last verified event snapshot instead of clearing the calendar.</p>
          <small>Blocked or empty sources stay listed for monitoring and are never filled with guessed events.</small>
        </aside>
      </section>
    </main>
  );
}
