const closestLibraries = [
  { name: 'Green Hills Public Library District', distance: 1.40, town: 'Palos Hills' },
  { name: 'Bridgeview Public Library', distance: 1.81, town: 'Bridgeview' },
  { name: 'Justice Public Library District', distance: 2.00, town: 'Justice' },
  { name: 'Worth Public Library District', distance: 3.02, town: 'Worth' },
  { name: 'Chicago Ridge Public Library', distance: 3.04, town: 'Chicago Ridge' },
  { name: 'Prairie Trails Public Library District', distance: 3.06, town: 'Burbank' },
  { name: 'Bedford Park Public Library District', distance: 3.45, town: 'Bedford Park' },
  { name: 'Hodgkins Public Library District', distance: 3.56, town: 'Hodgkins' },
  { name: 'Summit Public Library District', distance: 3.85, town: 'Summit' },
  { name: 'Oak Lawn Public Library', distance: 3.97, town: 'Oak Lawn' },
  { name: 'Palos Park Public Library', distance: 4.06, town: 'Palos Park' },
  { name: 'Chicago Public Library · Clearing', distance: 4.40, town: 'Chicago' },
  { name: 'Palos Heights Public Library', distance: 4.51, town: 'Palos Heights' },
  { name: 'Hometown Public Library', distance: 5.14, town: 'Hometown' },
  { name: 'McCook Public Library District', distance: 5.29, town: 'McCook' },
];

const radiusBands = [
  { range: 'Within 5 miles', count: 13, className: 'near', note: 'The closest group for quick outings.' },
  { range: '5–10 miles', count: 28, className: 'middle', note: 'A larger selection with modest travel.' },
  { range: '10–15 miles', count: 34, className: 'far', note: 'The full outer edge of this search.' },
];

export default function MapPage() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand brand-link" href="/"><span className="brand-mark" aria-hidden="true">L</span><span>Library Loop</span></a>
        <nav className="nav" aria-label="Main navigation">
          <a className="nav-link" href="/"><span aria-hidden="true">▦</span> Day planner</a>
          <a className="nav-link" href="/week"><span aria-hidden="true">□</span> Week view</a>
          <a className="nav-link active" href="/map" aria-current="page"><span aria-hidden="true">⌖</span> Library map</a>
          <a className="nav-link" href="/sources"><span aria-hidden="true">↻</span> Calendar sources</a>
        </nav>
        <div className="sidebar-spacer" />
        <section className="coverage-card" aria-label="Library radius">
          <p className="eyebrow">Search radius</p><strong>15 miles</strong>
          <p>75 library systems<br />centered on 60457</p>
          <div className="coverage-meter connected"><span /></div><small>Closest 15 shown below</small>
        </section>
      </aside>

      <section className="workspace map-workspace">
        <header className="topbar">
          <div><p className="eyebrow">Library map · 60457 + 15 miles</p><h1>Libraries by distance.</h1><p className="lede">A practical radius view for comparing nearby public-library systems.</p></div>
          <a className="back-button" href="/sources">View all 75 sources →</a>
        </header>

        <div className="map-grid">
          <section className="radius-card" aria-label="Libraries grouped by distance from 60457">
            <div className="radius-visual" aria-hidden="true">
              <div className="radius-ring ring-far"><span><strong>34</strong><small>10–15 MI</small></span></div>
              <div className="radius-ring ring-middle"><span><strong>28</strong><small>5–10 MI</small></span></div>
              <div className="radius-ring ring-near"><span><strong>13</strong><small>0–5 MI</small></span></div>
              <div className="radius-center"><span>⌖</span><strong>60457</strong></div>
            </div>
            <div className="radius-copy">
              <p className="eyebrow">Distance bands</p><h2>75 library systems in reach.</h2>
              <p>The rings show how many systems fall into each distance band. This is a planning view, not a street-navigation map.</p>
              <div className="radius-band-list">
                {radiusBands.map((band) => <div key={band.range}><i className={band.className} aria-hidden="true" /><strong>{band.range}</strong><span>{band.count} systems</span><small>{band.note}</small></div>)}
              </div>
            </div>
          </section>

          <section className="nearest-card">
            <div className="nearest-heading"><div><p className="eyebrow">Closest first</p><h2>15 nearest libraries</h2></div><span>From 60457</span></div>
            <ol className="nearest-list">
              {closestLibraries.map((library, index) => (
                <li key={library.name}><span className="nearest-rank">{String(index + 1).padStart(2, '0')}</span><div><strong>{library.name}</strong><small>{library.town}</small></div><b>{library.distance.toFixed(2)} mi</b></li>
              ))}
            </ol>
            <a className="nearest-footer" href="/sources">See calendar access for all 75 libraries <span>→</span></a>
          </section>
        </div>
      </section>
    </main>
  );
}
