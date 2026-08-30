const weekDays = [
  {
    day: 'Saturday', date: 'Aug 29', events: [
      { time: '10:00 AM', title: 'Family Maker Lab', library: 'Green Hills Public Library District', ages: 'All ages', distance: '1.4 mi', tone: 'coral' },
      { time: '1:30 PM', title: 'Tween LEGO Challenge', library: 'Oak Lawn Public Library', ages: 'Ages 8–12', distance: '4.0 mi', tone: 'blue' },
      { time: '3:00 PM', title: 'Teen Dungeons & Dragons', library: 'Chicago Public Library · Clearing', ages: 'Ages 13–17', distance: '4.4 mi', tone: 'plum' },
    ],
  },
  {
    day: 'Sunday', date: 'Aug 30', events: [
      { time: '11:00 AM', title: 'Sunday Family Stories', library: 'Palos Heights Public Library', ages: 'Family', distance: '4.5 mi', tone: 'gold' },
      { time: '2:00 PM', title: 'Young Artists Studio', library: 'Bridgeview Public Library', ages: 'Ages 7–12', distance: '1.8 mi', tone: 'coral' },
    ],
  },
  { day: 'Monday', date: 'Aug 31', events: [{ time: '4:00 PM', title: 'After-School Chess Club', library: 'Worth Public Library District', ages: 'Grades 3–8', distance: '3.0 mi', tone: 'blue' }] },
  { day: 'Tuesday', date: 'Sep 1', events: [{ time: '6:00 PM', title: 'Family Science Night', library: 'Prairie Trails Public Library District', ages: 'Family', distance: '3.1 mi', tone: 'gold' }] },
  {
    day: 'Wednesday', date: 'Sep 2', events: [
      { time: '4:30 PM', title: 'Graphic Novel Book Club', library: 'Justice Public Library District', ages: 'Ages 10–14', distance: '2.0 mi', tone: 'plum' },
      { time: '6:30 PM', title: 'Family Bingo', library: 'Evergreen Park Public Library', ages: 'All ages', distance: '6.7 mi', tone: 'coral' },
    ],
  },
  { day: 'Thursday', date: 'Sep 3', events: [{ time: '5:00 PM', title: 'Teen Open Studio', library: 'La Grange Public Library', ages: 'Grades 7–12', distance: '6.5 mi', tone: 'coral' }] },
  { day: 'Friday', date: 'Sep 4', events: [{ time: '3:30 PM', title: 'Coding for Curious Kids', library: 'Indian Prairie Public Library District', ages: 'Ages 9–13', distance: '6.9 mi', tone: 'blue' }] },
];

export default function WeekPage() {
  const eventCount = weekDays.reduce((total, day) => total + day.events.length, 0);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand brand-link" href="/"><span className="brand-mark" aria-hidden="true">L</span><span>Library Loop</span></a>
        <nav className="nav" aria-label="Main navigation">
          <a className="nav-link" href="/"><span aria-hidden="true">▦</span> Day planner</a>
          <a className="nav-link active" href="/week" aria-current="page"><span aria-hidden="true">□</span> Week view</a>
          <a className="nav-link" href="/map"><span aria-hidden="true">⌖</span> Library map</a>
          <a className="nav-link" href="/sources"><span aria-hidden="true">↻</span> Calendar sources</a>
        </nav>
        <div className="sidebar-spacer" />
        <section className="coverage-card" aria-label="Week coverage">
          <p className="eyebrow">This example week</p><strong>{eventCount} events</strong>
          <p>Across 11 nearby libraries<br />for ages 7–16 + family</p>
          <div className="coverage-meter connected"><span /></div><small>Within the 15 mile search</small>
        </section>
      </aside>

      <section className="workspace week-workspace">
        <header className="topbar">
          <div><p className="eyebrow">August 29–September 4</p><h1>Week at a glance.</h1><p className="lede">A seven-day view of nearby library events for kids ages 7–16.</p></div>
          <div className="location-button" aria-label="Search location"><span className="location-dot" aria-hidden="true" /> 60457</div>
        </header>

        <div className="preview-note" role="note"><span>Design preview</span>Example event details are shown until live library calendars are connected.</div>

        <section className="week-board" aria-label="Example events for the week">
          {weekDays.map((day, index) => (
            <article className={`week-day-card ${index === 0 ? 'today' : ''}`} key={day.day}>
              <header><div><p>{day.day}</p><strong>{day.date}</strong></div><span>{day.events.length}</span></header>
              <div className="week-events">
                {day.events.map((event) => (
                  <div className="week-event" key={event.title}>
                    <i className={event.tone} aria-hidden="true" />
                    <time>{event.time}</time>
                    <h2>{event.title}</h2>
                    <p>{event.library}</p>
                    <footer><span>{event.ages}</span><span>⌖ {event.distance}</span></footer>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <aside className="week-note"><strong>Prefer one day at a time?</strong><span>Use the Day planner to filter by age, family events, distance, and activity type.</span><a href="/">Open Day planner →</a></aside>
      </section>
    </main>
  );
}
