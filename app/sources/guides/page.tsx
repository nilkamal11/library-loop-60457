/* eslint-disable @next/next/no-html-link-for-pages -- hard navigations are intentional for the current Sites runtime */

type GuideStatus = 'feed' | 'page' | 'manual';

const guideSources: Array<{
  name: string;
  status: GuideStatus;
  method: string;
  note: string;
  url: string;
}> = [
  {
    name: 'KiddoChicago',
    status: 'feed',
    method: 'Public family-events API',
    note: 'Connected as a secondary discovery source. Events are distance- and age-filtered, and every card keeps the organizer’s official link.',
    url: 'https://kiddochicago.com/',
  },
  {
    name: 'Kidlist',
    status: 'manual',
    method: 'Manual discovery only',
    note: 'Excellent local leads, but its terms prohibit automated collection. Written permission is required before a live connection can be added.',
    url: 'https://mykidlist.com/events/',
  },
  {
    name: 'South Suburbs for Kids',
    status: 'page',
    method: 'Event pages + structured details',
    note: 'Useful Southland leads. Events need a low-frequency check and confirmation against the organizer’s page before display.',
    url: 'https://www.southsuburbsforkids.com/events',
  },
  {
    name: 'Visit Chicago Southland',
    status: 'page',
    method: 'Regional event pages',
    note: 'Public regional listings include organizer links. The source requests slow collection, so it is being treated as a lead source rather than a rapid live feed.',
    url: 'https://www.visitchicagosouthland.com/events',
  },
  {
    name: 'Chicago Kids',
    status: 'manual',
    method: 'Public calendar page',
    note: 'Good citywide reference, but no stable public event feed was found for reliable 15-mile automation.',
    url: 'https://www.chicagokids.com/calendar/',
  },
  {
    name: 'Macaroni KID Orland Park',
    status: 'manual',
    method: 'Protected calendar widget',
    note: 'Useful for browsing, but there is no supported public feed and automated harvesting is not permitted.',
    url: 'https://orlandpark.macaronikid.com/events',
  },
  {
    name: 'Chicago Parent',
    status: 'manual',
    method: 'Protected event directory',
    note: 'Kept as a manual research link because automated requests are blocked and no stable public event feed is available.',
    url: 'https://www.chicagoparent.com/events/',
  },
  {
    name: 'Eventbrite',
    status: 'manual',
    method: 'Manual local search',
    note: 'General local-event discovery no longer has a supported public search API. Organizer pages may still be used as direct event links.',
    url: 'https://www.eventbrite.com/b/il--hickory-hills/family-and-education/',
  },
];

const details: Record<GuideStatus, { label: string; description: string }> = {
  feed: { label: 'Connected', description: 'Live secondary feed with official organizer links.' },
  page: { label: 'Lead source', description: 'Usable for discovery, with a slower source-specific check.' },
  manual: { label: 'Manual only', description: 'Browse directly; automated collection is unavailable or not permitted.' },
};

export default function GuideSourcesPage() {
  const connected = guideSources.filter((source) => source.status === 'feed').length;
  const leadSources = guideSources.filter((source) => source.status === 'page').length;
  const manual = guideSources.filter((source) => source.status === 'manual').length;

  return (
    <main className="app-shell sources-shell">
      <aside className="sidebar">
        <a className="brand brand-link" href="/"><span className="brand-mark" aria-hidden="true">L</span><span>Library Loop</span></a>
        <nav className="nav" aria-label="Main navigation">
          <a className="nav-link" href="/"><span aria-hidden="true">▦</span> Day planner</a>
          <a className="nav-link" href="/week"><span aria-hidden="true">□</span> Week view</a>
          <a className="nav-link" href="/map"><span aria-hidden="true">⌖</span> Library map</a>
          <a className="nav-link active" href="/sources/guides" aria-current="page"><span aria-hidden="true">↻</span> Calendar sources</a>
        </nav>
        <div className="sidebar-spacer" />
        <section className="coverage-card" aria-label="Family guide source coverage">
          <p className="eyebrow">Family-guide coverage</p><strong>{connected} live</strong>
          <p>{leadSources} research leads<br />{manual} manual-only sources</p>
          <div className="coverage-meter connected"><span /></div><small>Official organizer links take priority</small>
        </section>
      </aside>

      <section className="workspace sources-workspace">
        <header className="topbar sources-topbar">
          <div><p className="eyebrow">Family event discovery · 15 miles from 60457</p><h1>More ways to find the good stuff.</h1><p className="lede">Family guides can uncover events the official calendars miss. They are connected only when public access and the source’s rules allow it.</p></div>
          <a className="back-button" href="/">← Back to planner</a>
        </header>

        <nav className="source-tabs" aria-label="Calendar source type">
          <a href="/sources"><span aria-hidden="true">▤</span><strong>Libraries</strong><small>75 sources</small></a>
          <a href="/sources/parks"><span aria-hidden="true">♧</span><strong>Parks & nature</strong><small>62 sources</small></a>
          <a className="active" href="/sources/guides" aria-current="page"><span aria-hidden="true">☆</span><strong>Family guides</strong><small>{guideSources.length} sources</small></a>
        </nav>

        <section className="source-metrics guide-metrics" aria-label="Family guide source totals">
          <div className="metric-card feed"><span className="status-dot feed" aria-hidden="true" /><strong>{connected}</strong><div><b>Connected</b><small>{details.feed.description}</small></div></div>
          <div className="metric-card page"><span className="status-dot page" aria-hidden="true" /><strong>{leadSources}</strong><div><b>Lead sources</b><small>{details.page.description}</small></div></div>
          <div className="metric-card manual"><span className="status-dot manual" aria-hidden="true" /><strong>{manual}</strong><div><b>Manual only</b><small>{details.manual.description}</small></div></div>
        </section>

        <section className="sources-panel">
          <div className="sources-toolbar"><div><p className="eyebrow">Discovery directory</p><h2>{guideSources.length} family-event sources</h2></div></div>
          <div className="sources-table-wrap">
            <table className="sources-table guide-sources-table">
              <thead><tr><th>Source</th><th>Access</th><th>Method and notes</th><th><span className="sr-only">Source link</span></th></tr></thead>
              <tbody>
                {guideSources.map((source) => (
                  <tr key={source.name}>
                    <td data-label="Source"><strong>{source.name}</strong></td>
                    <td data-label="Access"><span className={`status-pill ${source.status}`}><i aria-hidden="true" />{details[source.status].label}</span></td>
                    <td data-label="Method"><strong className="method-name">{source.method}</strong><small>{source.note}</small></td>
                    <td className="source-link-cell"><a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open ${source.name}`}>Open <span aria-hidden="true">↗</span></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="source-legend" aria-label="Family guide collection notes">
          <p><strong>How guide events work:</strong> Direct library, park, venue, or organizer data always wins. Guide listings fill gaps, preserve attribution, and send you to the organizer for signup.</p>
          <small>Kidlist remains a manual research link unless written permission for automated access is obtained.</small>
        </aside>
      </section>
    </main>
  );
}
