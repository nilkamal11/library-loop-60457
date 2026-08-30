/* eslint-disable @next/next/no-html-link-for-pages -- hard navigations are intentional for the current Sites runtime */
'use client';

import { useMemo, useState } from 'react';

type SourceStatus = 'feed' | 'page' | 'manual' | 'unavailable';

type ParkSource = {
  name: string;
  distance: string;
  status: SourceStatus;
  method: string;
  note: string;
  url: string;
};

const parkSources: ParkSource[] = [
  { name: 'Forest Preserves of Cook County', distance: 'Venue based', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Countywide feed; each venue will be filtered to 15 miles before age matching.', url: 'https://fpdcc.com/events/' },
  { name: 'Hickory Hills Park District', distance: '0–1 mi', status: 'page', method: 'Web page + PDF', note: 'Special events require page and seasonal flyer extraction.', url: 'https://www.hhparkdistrict.org/special-events/' },
  { name: 'Bridgeview Park District', distance: '1.5–2 mi', status: 'page', method: 'Web page + flyer OCR', note: 'Official event page is usable, with some details published as graphics.', url: 'https://bridgeviewparkdistrict.com/special-events-2/' },
  { name: 'Justice Park District', distance: '≈2 mi', status: 'manual', method: 'Wix + event images', note: 'Upcoming material needs browser assistance and visual review.', url: 'https://www.justiceparkdistrict.com/' },
  { name: 'Chicago Ridge Park District', distance: '≈3 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Structured feed with current upcoming events.', url: 'https://chicagoridgeparks.com/events/' },
  { name: 'Worth Park District', distance: '≈3 mi', status: 'page', method: 'Vermont Systems WebTrac', note: 'Structured calendar pages can be extracted; no public feed was found.', url: 'https://rectrac.worthparkdistrict.org/wbwsc/webtrac.wsc/search.html?display=Calendar&module=Event' },
  { name: 'Palos Hills Resource & Recreation', distance: '≈3 mi', status: 'page', method: 'Web page + seasonal PDF', note: 'Recreation schedules are primarily published in brochures and city listings.', url: 'https://www.paloshills-il.gov/index.php/departments/parks-recreation/index.html' },
  { name: 'Bedford Park District', distance: '≈3.5 mi', status: 'feed', method: 'CivicPlus iCalendar', note: 'Category feeds cover the main calendar and open gym.', url: 'https://www.bedfordparkdistrict.org/calendar.aspx' },
  { name: 'Hodgkins Park District', distance: '≈3.5 mi', status: 'page', method: 'Web page + PDF', note: 'Special events are published as pages and flyers.', url: 'https://hodgkinspark.org/events' },
  { name: 'Summit Park District', distance: '≈4 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'The feed works but is currently empty; freshness will be monitored.', url: 'https://summitparks.org/events/' },
  { name: 'Oak Lawn Park District', distance: '≈4 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Structured current event feed; sports schedules are kept separate.', url: 'https://www.olparks.com/events' },
  { name: 'Burbank Park District', distance: '4.5–5 mi', status: 'feed', method: 'CivicPlus iCalendar', note: 'Official city calendar category dedicated to Park District events.', url: 'https://www.burbankil.gov/calendar.aspx?CID=29' },
  { name: 'Willow Springs Parks & Recreation', distance: '≈5 mi', status: 'page', method: 'Modern Events Calendar HTML', note: 'Current calendar pages are stable enough for extraction.', url: 'https://www.willowsprings-il.gov/events-news/events/' },
  { name: 'Village of Lyons Parks & Recreation', distance: '≈6.3 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Feed endpoints work but currently contain no upcoming events.', url: 'https://www.villageoflyons-il.net/parks-and-recreation/' },
  { name: 'Evergreen Park Recreation & Youth', distance: '6.5–7 mi', status: 'feed', method: 'CivicPlus iCalendar', note: 'Separate recreation and youth calendar feeds can be combined.', url: 'https://www.evergreenpark-ill.com/calendar.aspx?CID=22' },
  { name: 'Indian Head Park Community Events', distance: '6.5–7.5 mi', status: 'feed', method: 'CivicPlus iCalendar', note: 'Community-events feed covers local recreation listings.', url: 'https://www.indianheadpark-il.gov/calendar.aspx?CID=22' },
  { name: 'Palos Heights Parks & Recreation', distance: '≈7 mi', status: 'feed', method: 'CivicPlus iCalendar', note: 'Recreation-event and open-gym feeds are available.', url: 'https://www.palosheightsrec.org/calendar.aspx?CID=25' },
  { name: 'Pleasant Dale Park District', distance: '≈7 mi', status: 'page', method: 'HTML + RecDesk', note: 'Current event pages and RecDesk calendar can be extracted.', url: 'https://pdparks.org/pages/events.php' },
  { name: 'Park District of La Grange', distance: '6.5–7.5 mi', status: 'page', method: 'Event tiles + registration pages', note: 'Event tiles are readable, with occasional image text.', url: 'https://pdlg.org/new-events' },
  { name: 'Palos Park Recreation & Parks', distance: '7–8 mi', status: 'feed', method: 'CivicPlus iCalendar', note: 'Special-events category feed is available.', url: 'https://www.palospark.org/calendar.aspx?CID=30' },
  { name: 'Community Park District of La Grange Park', distance: '7–8 mi', status: 'page', method: 'Structured homepage events', note: 'Current listings can be extracted from the official site.', url: 'https://www.communityparkdistrict.org/' },
  { name: 'Western Springs Recreation Department', distance: '7.5–8.5 mi', status: 'page', method: 'RecDesk calendar', note: 'Borderline by venue; events will be distance-checked individually.', url: 'https://wsprings.recdesk.com/Community/Calendar' },
  { name: 'Alsip Park District', distance: '7–8 mi', status: 'page', method: 'WordPress calendar page', note: 'Usable page with an added freshness check for older listings.', url: 'https://www.alsipparks.org/calendar-of-events/' },
  { name: 'Darien Park District', distance: '8.5–9 mi', status: 'page', method: 'Vermont Systems WebTrac', note: 'Server-rendered event calendar can be extracted.', url: 'https://registration.darienparks.com/webtrac/web/search.html?display=Calendar&module=Event' },
  { name: 'Clarendon Hills Park District', distance: '≈8.3 mi', status: 'page', method: 'Vermont Systems WebTrac', note: 'Server-rendered event calendar can be extracted.', url: 'https://ilclarendonhillsweb.myvscloud.com/webtrac/web/search.html?display=Calendar&module=Event' },
  { name: 'Berwyn Park District', distance: '≈8.3 mi', status: 'page', method: 'Drupal event listing', note: 'Special-events listings are available as stable pages.', url: 'https://www.berwynparks.org/special-events' },
  { name: 'Midlothian Park District', distance: '≈8.5 mi', status: 'page', method: 'Wix event tiles', note: 'Event information is extractable, with occasional image text.', url: 'https://www.midlothianparkdistrict.org/eventinformation' },
  { name: 'North Riverside Parks & Recreation', distance: '≈8.5 mi', status: 'feed', method: 'CivicPlus iCalendar', note: 'Parks and recreation and free-event categories are available.', url: 'https://www.northriverside-il.org/Calendar.aspx' },
  { name: 'Blue Island Park District', distance: '≈8.9 mi', status: 'page', method: 'Vermont Systems WebTrac', note: 'Calendar extraction will exclude private facility reservations.', url: 'https://ilblueislandweb.myvscloud.com/webtrac/web/search.html?display=Calendar&module=Event' },
  { name: 'North Berwyn Park District', distance: '≈9 mi', status: 'page', method: 'Structured event listing', note: 'Month-by-month special events are published as readable pages.', url: 'https://www.nbpd4fun.org/addprogram/special-events' },
  { name: 'Posen Park District', distance: '≈9 mi', status: 'page', method: 'Protected web calendar', note: 'Public feeds are intermittent and block hosted collection; page extraction is the reliable fallback.', url: 'https://posenparkdistrict.org/events/' },
  { name: 'Oak Brook Park District', distance: '9–10 mi', status: 'page', method: 'Drupal embedded event data', note: 'Complete event objects are embedded in the official calendar page.', url: 'https://www.obparks.org/calendar' },
  { name: 'Westmont Park District', distance: '≈9.4 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Structured current event feed.', url: 'https://www.westmontparks.org/events/' },
  { name: 'Westchester Park District', distance: '≈9.6 mi', status: 'page', method: 'Server-rendered calendar', note: 'Official calendar pages can be extracted.', url: 'https://wpdparks.org/calendar' },
  { name: 'Clyde Park District / Cicero', distance: '≈9.6 mi', status: 'manual', method: 'Town pages + newsletters', note: 'No current standalone district calendar; manual review is required.', url: 'https://thetownofcicero.com/event-directory/' },
  { name: 'Broadview Park District', distance: '≈9.7 mi', status: 'page', method: 'Static WordPress listings', note: 'Sources are fragmented but usable with page extraction.', url: 'https://broadviewparkdistrict.net/events-page/' },
  { name: 'Robbins Park District', distance: '9–10 mi', status: 'manual', method: 'Image calendar + OCR', note: 'The official calendar is published as an image.', url: 'https://www.robbinsparkdistrict.org/calendar.html' },
  { name: 'Lemont Park District', distance: '≈10 mi', status: 'feed', method: 'WordPress Events API', note: 'Structured JSON feed is available; iCalendar is blocked.', url: 'https://www.lemontparkdistrict.org/events/month/' },
  { name: 'Forest Park Park District', distance: '≈10.5 mi', status: 'feed', method: 'Squarespace JSON + event iCalendar', note: 'Structured collection JSON and event calendar links are available.', url: 'https://www.pdofp.org/events' },
  { name: 'Park District of Oak Park', distance: '≈10.5 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Structured current event feed.', url: 'https://pdop.org/event/' },
  { name: 'Downers Grove Park District', distance: '≈10.6 mi', status: 'page', method: 'Custom HTML calendar', note: 'Stable server-rendered calendar with no public feed found.', url: 'https://www.dgparks.org/calendar' },
  { name: 'Memorial Park District', distance: '11–14 mi', status: 'page', method: 'Homepage + brochure + Amilia', note: 'Calendar completeness is weaker, so multiple official pages are combined.', url: 'https://mempark.org/' },
  { name: 'Tinley Park-Park District', distance: '≈11.2 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Structured current event feed.', url: 'https://tinleyparkdistrict.org/events/month/' },
  { name: 'Maywood Park District', distance: '≈11.3 mi', status: 'feed', method: 'Squarespace JSON + event iCalendar', note: 'Structured collection JSON and event links are available.', url: 'https://www.maywoodparkdistrict.org/2026-calendar' },
  { name: 'Woodridge Park District', distance: '≈11.4 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Structured current event feed.', url: 'https://www.woodridgeparks.org/events/' },
  { name: 'River Forest Park District', distance: '≈11.7 mi', status: 'page', method: 'Server-rendered calendar', note: 'Official calendar pages can be extracted.', url: 'https://www.rfparks.com/calendar' },
  { name: 'Markham Park District', distance: '≈11.8 mi', status: 'unavailable', method: 'No public calendar found', note: 'The official site has no current public events listing.', url: 'https://markhamparkdistrict.org/' },
  { name: 'Phoenix Park District', distance: '≈12 mi', status: 'unavailable', method: 'No current calendar', note: 'Programs are listed, but the visible calendar material is stale.', url: 'https://www.phoenixparkdistrict.com/' },
  { name: 'Riverdale Park District', distance: '≈12.2 mi', status: 'page', method: 'RecDesk calendar', note: 'Official RecDesk calendar can be extracted.', url: 'https://riverdalepd.recdesk.com/Community/Calendar' },
  { name: 'Harvey Park District', distance: '≈12.3 mi', status: 'manual', method: 'Wix + event flyers', note: 'Needs extraction, OCR, and freshness review.', url: 'https://www.harveyparkdistrict.org/activities---events' },
  { name: 'Dolton Park District', distance: '≈12.8 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Structured current event feed.', url: 'https://doltonparkdistrict.org/events/' },
  { name: 'Lisle Park District', distance: '≈13.2 mi', status: 'feed', method: 'CalendarWiz iCalendar', note: 'Public subscription feed is available.', url: 'https://www.lisleparkdistrict.org/calendar.html' },
  { name: 'Mokena Community Park District', distance: '≈13.4 mi', status: 'page', method: 'Static WordPress listings', note: 'Upcoming events can be extracted from the official page.', url: 'https://www.mokenapark.com/upcoming-events-2/' },
  { name: 'Elmhurst Park District', distance: '≈13.5 mi', status: 'page', method: 'Drupal embedded event data', note: 'Complete event objects are embedded in the calendar page.', url: 'https://www.epd.org/calendar' },
  { name: 'Villa Park Parks & Recreation', distance: '≈13.5 mi', status: 'feed', method: 'CivicPlus iCalendar', note: 'Event and recreation-center category feeds are available.', url: 'https://www.villaparkil.gov/299/Events' },
  { name: 'Homewood-Flossmoor Park District', distance: '13.9–14.7 mi', status: 'feed', method: 'WordPress Events API + iCalendar', note: 'Borderline venues will be checked individually.', url: 'https://hfparks.com/events/month/' },
  { name: 'Elmwood Park Parks & Recreation', distance: '≈14.1 mi', status: 'feed', method: 'CivicPlus iCalendar', note: 'Parks and recreation and special-event feeds are available.', url: 'https://www.elmwoodpark.org/Calendar.aspx' },
  { name: 'South Holland Recreation & Events', distance: '≈14.2 mi', status: 'page', method: 'Municipal event pages', note: 'Retain only park and recreation events from the village calendar.', url: 'https://southholland.org/events' },
  { name: 'Franklin Park Park District', distance: '≈14.5 mi', status: 'page', method: 'Custom HTML calendar', note: 'Borderline calendar; events will be venue-distance checked.', url: 'https://www.fpparks.org/calendar' },
  { name: 'Veterans Park District', distance: '13–15 mi', status: 'page', method: 'Static WordPress listings', note: 'Borderline multi-community district; check each event venue.', url: 'https://vpdpark.org/special-events/' },
  { name: 'Chicago Park District', distance: 'Venue based', status: 'page', method: 'Drupal Event Finder', note: 'Citywide pages will be geofiltered to nearby Southwest Side parks.', url: 'https://www.chicagoparkdistrict.com/events' },
];

const statusDetails: Record<SourceStatus, { label: string; description: string }> = {
  feed: { label: 'Direct feed', description: 'A structured feed or calendar can be collected reliably.' },
  page: { label: 'Page extraction', description: 'Events are reachable on stable official pages.' },
  manual: { label: 'Browser/manual', description: 'Browser assistance, OCR, or freshness review is needed.' },
  unavailable: { label: 'Unavailable/stale', description: 'No current usable official calendar was found.' },
};

const filterOrder: Array<'all' | SourceStatus> = ['all', 'feed', 'page', 'manual', 'unavailable'];

export default function ParkSourcesPage() {
  const [filter, setFilter] = useState<'all' | SourceStatus>('all');
  const [query, setQuery] = useState('');

  const totals = useMemo(() => ({
    feed: parkSources.filter((source) => source.status === 'feed').length,
    page: parkSources.filter((source) => source.status === 'page').length,
    manual: parkSources.filter((source) => source.status === 'manual').length,
    unavailable: parkSources.filter((source) => source.status === 'unavailable').length,
  }), []);

  const visibleSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return parkSources.filter((source) => {
      const matchesFilter = filter === 'all' || source.status === filter;
      const matchesQuery = !normalizedQuery || `${source.name} ${source.method} ${source.note}`.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  const automatedTotal = totals.feed + totals.page;

  return (
    <main className="app-shell sources-shell">
      <aside className="sidebar">
        <a className="brand brand-link" href="/"><span className="brand-mark" aria-hidden="true">L</span><span>Library Loop</span></a>
        <nav className="nav" aria-label="Main navigation">
          <a className="nav-link" href="/"><span aria-hidden="true">▦</span> Day planner</a>
          <a className="nav-link" href="/week"><span aria-hidden="true">□</span> Week view</a>
          <a className="nav-link" href="/map"><span aria-hidden="true">⌖</span> Library map</a>
          <a className="nav-link active" href="/sources/parks" aria-current="page"><span aria-hidden="true">↻</span> Calendar sources</a>
        </nav>
        <div className="sidebar-spacer" />
        <section className="coverage-card" aria-label="Park and nature calendar coverage">
          <p className="eyebrow">Park & nature coverage</p><strong>{automatedTotal} of {parkSources.length}</strong>
          <p>can be collected without<br />browser control</p>
          <div className="coverage-meter park-connected"><span /></div><small>{Math.round((automatedTotal / parkSources.length) * 100)}% automation-ready</small>
        </section>
      </aside>

      <section className="workspace sources-workspace">
        <header className="topbar sources-topbar">
          <div><p className="eyebrow">Park & nature calendars · 15 miles from 60457</p><h1>Parks are in the loop.</h1><p className="lede">Park districts, municipal recreation departments, Chicago parks, and Forest Preserves—with the collection method found for each calendar.</p></div>
          <a className="back-button" href="/">← Back to planner</a>
        </header>

        <nav className="source-tabs" aria-label="Calendar source type">
          <a href="/sources"><span aria-hidden="true">▤</span><strong>Libraries</strong><small>75 sources</small></a>
          <a className="active" href="/sources/parks" aria-current="page"><span aria-hidden="true">♧</span><strong>Parks & nature</strong><small>{parkSources.length} sources</small></a>
        </nav>

        <section className="source-metrics" aria-label="Park and nature calendar source totals">
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
            <div><p className="eyebrow">Park & nature directory</p><h2>{visibleSources.length} {visibleSources.length === 1 ? 'organization' : 'organizations'}</h2></div>
            <label className="source-search"><span className="sr-only">Search park and nature sources</span><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search organization or method" type="search" /></label>
          </div>

          <div className="source-filters" aria-label="Filter by calendar access">
            {filterOrder.map((status) => {
              const label = status === 'all' ? 'All sources' : statusDetails[status].label;
              const count = status === 'all' ? parkSources.length : totals[status];
              return <button className={filter === status ? 'active' : ''} key={status} onClick={() => setFilter(status)} type="button" aria-pressed={filter === status}>{label}<span>{count}</span></button>;
            })}
          </div>

          <div className="sources-table-wrap">
            <table className="sources-table">
              <thead><tr><th>Organization</th><th>Distance</th><th>Calendar access</th><th>Method and notes</th><th><span className="sr-only">Calendar link</span></th></tr></thead>
              <tbody>
                {visibleSources.map((source) => (
                  <tr key={source.name}>
                    <td data-label="Organization"><strong>{source.name}</strong></td>
                    <td data-label="Distance"><span className="distance-value">{source.distance}</span></td>
                    <td data-label="Access"><span className={`status-pill ${source.status}`}><i aria-hidden="true" />{statusDetails[source.status].label}</span></td>
                    <td data-label="Method"><strong className="method-name">{source.method}</strong><small>{source.note}</small></td>
                    <td className="source-link-cell"><a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open calendar source for ${source.name}`}>Open <span aria-hidden="true">↗</span></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!visibleSources.length && <div className="sources-empty"><h2>No matching organizations</h2><p>Try a different search or calendar-access filter.</p></div>}
        </section>

        <aside className="source-legend" aria-label="Park calendar collection notes">
          <p><strong>How location works:</strong> Multi-site sources such as Forest Preserves and Chicago Park District are collected countywide or citywide first, then every event is filtered by its venue’s distance from 60457.</p>
          <small>Age matching uses explicit age ranges plus family, youth, tween, and teen language. Events with unclear ages can be marked for review.</small>
        </aside>
      </section>
    </main>
  );
}
