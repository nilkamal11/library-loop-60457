'use client';

import { useMemo, useState } from 'react';

type EventItem = {
  time: string; period: string; duration: string; title: string; library: string;
  distance: number; ages: string; tone: string; mark: string; category: string;
  family: boolean; address: string;
};

const dates = [
  { day: 'Sat', date: '29', label: 'Saturday, August 29' },
  { day: 'Sun', date: '30', label: 'Sunday, August 30' },
  { day: 'Mon', date: '31', label: 'Monday, August 31' },
  { day: 'Tue', date: '01', label: 'Tuesday, September 1' },
  { day: 'Wed', date: '02', label: 'Wednesday, September 2' },
  { day: 'Thu', date: '03', label: 'Thursday, September 3' },
  { day: 'Fri', date: '04', label: 'Friday, September 4' },
];

const eventSets: EventItem[][] = [
  [
    { time:'10:00',period:'AM',duration:'60 min',title:'Family Maker Lab',library:'Green Hills Public Library District',distance:1.4,ages:'All ages',tone:'coral',mark:'MAKE',category:'Make',family:true,address:'8611 W 103rd St, Palos Hills' },
    { time:'1:30',period:'PM',duration:'90 min',title:'Tween LEGO Challenge',library:'Oak Lawn Public Library',distance:4.0,ages:'Ages 8–12',tone:'blue',mark:'BUILD',category:'Build',family:false,address:'9427 S Raymond Ave, Oak Lawn' },
    { time:'3:00',period:'PM',duration:'2 hrs',title:'Teen Dungeons & Dragons',library:'Chicago Public Library · Clearing',distance:4.4,ages:'Ages 13–17',tone:'plum',mark:'PLAY',category:'Play',family:false,address:'6423 W 63rd Pl, Chicago' },
  ],
  [
    { time:'11:00',period:'AM',duration:'45 min',title:'Sunday Family Stories',library:'Palos Heights Public Library',distance:4.5,ages:'Family',tone:'gold',mark:'READ',category:'Read',family:true,address:'12501 S 71st Ave, Palos Heights' },
    { time:'2:00',period:'PM',duration:'60 min',title:'Young Artists Studio',library:'Bridgeview Public Library',distance:1.8,ages:'Ages 7–12',tone:'coral',mark:'CREATE',category:'Create',family:false,address:'7840 W 79th St, Bridgeview' },
  ],
  [{ time:'4:00',period:'PM',duration:'60 min',title:'After-School Chess Club',library:'Worth Public Library District',distance:3.0,ages:'Grades 3–8',tone:'blue',mark:'PLAY',category:'Play',family:false,address:'6917 W 111th St, Worth' }],
  [{ time:'6:00',period:'PM',duration:'75 min',title:'Family Science Night',library:'Prairie Trails Public Library District',distance:3.1,ages:'Family',tone:'gold',mark:'DISCOVER',category:'Make',family:true,address:'8449 S Moody Ave, Burbank' }],
  [
    { time:'4:30',period:'PM',duration:'60 min',title:'Graphic Novel Book Club',library:'Justice Public Library District',distance:2.0,ages:'Ages 10–14',tone:'plum',mark:'READ',category:'Read',family:false,address:'7641 S 78th Ave, Justice' },
    { time:'6:30',period:'PM',duration:'60 min',title:'Family Bingo',library:'Evergreen Park Public Library',distance:6.7,ages:'All ages',tone:'coral',mark:'PLAY',category:'Play',family:true,address:'9400 S Troy Ave, Evergreen Park' },
  ],
  [{ time:'5:00',period:'PM',duration:'90 min',title:'Teen Open Studio',library:'La Grange Public Library',distance:6.5,ages:'Grades 7–12',tone:'coral',mark:'CREATE',category:'Create',family:false,address:'10 W Cossitt Ave, La Grange' }],
  [{ time:'3:30',period:'PM',duration:'60 min',title:'Coding for Curious Kids',library:'Indian Prairie Public Library District',distance:6.9,ages:'Ages 9–13',tone:'blue',mark:'BUILD',category:'Build',family:false,address:'401 Plainfield Rd, Darien' }],
];

const categoryCycle = ['All types', 'Make', 'Build', 'Play', 'Read', 'Create'];

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(0);
  const [includeFamily, setIncludeFamily] = useState(true);
  const [radius, setRadius] = useState(15);
  const [category, setCategory] = useState('All types');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const visibleEvents = useMemo(() => eventSets[selectedDate].filter((event) =>
    event.distance <= radius && (includeFamily || !event.family) && (category === 'All types' || event.category === category)
  ), [selectedDate, includeFamily, radius, category]);

  const cycleRadius = () => setRadius((current) => current === 15 ? 5 : current === 5 ? 10 : 15);
  const cycleCategory = () => setCategory((current) => categoryCycle[(categoryCycle.indexOf(current) + 1) % categoryCycle.length]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">L</span><span>Library Loop</span></div>
        <nav className="nav" aria-label="Main navigation">
          <a className="nav-link active" href="#day"><span aria-hidden="true">▦</span> Day planner</a>
          <a className="nav-link" href="#week"><span aria-hidden="true">□</span> Week view</a>
          <a className="nav-link" href="#map"><span aria-hidden="true">⌖</span> Library map</a>
          <a className="nav-link" href="/sources"><span aria-hidden="true">↻</span> Calendar sources</a>
        </nav>
        <div className="sidebar-spacer" />
        <section className="coverage-card" id="sources" aria-label="Search coverage">
          <p className="eyebrow">Search coverage</p><strong>15 mile radius</strong>
          <p>75 library systems<br />132 physical branches</p>
          <div className="coverage-meter connected"><span /></div><small>65 calendars ready to automate</small>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{dates[selectedDate].label}</p><h1>{selectedDate === 0 ? 'Saturday plans, sorted.' : `${dates[selectedDate].day} plans, sorted.`}</h1><p className="lede">Library events for kids ages 7–16, close to 60457.</p></div>
          <button className="location-button" type="button" title="The starting ZIP for this dashboard"><span className="location-dot" aria-hidden="true" /> 60457 <span aria-hidden="true">⌄</span></button>
        </header>

        <div className="preview-note" role="note"><span>Design preview</span>Example event details are shown until live library calendars are connected.</div>

        <section className="date-strip" id="week" aria-label="Choose a date">
          <button className="month-button" type="button" aria-label="Previous week">‹</button>
          {dates.map((item, index) => (
            <button className={`date-button ${selectedDate === index ? 'active' : ''}`} aria-pressed={selectedDate === index} key={`${item.day}-${item.date}`} onClick={() => { setSelectedDate(index); setSelectedEvent(null); }} type="button">
              <span>{item.day}</span><strong>{item.date}</strong>{eventSets[index].length > 0 && <i aria-hidden="true" />}
            </button>
          ))}
          <button className="month-button" type="button" aria-label="Next week">›</button>
        </section>

        <div className="filters" aria-label="Event filters">
          <button className="filter-pill active" type="button">Ages 7–16 <span aria-hidden="true">✓</span></button>
          <button className={`filter-pill ${includeFamily ? 'active' : ''}`} aria-pressed={includeFamily} onClick={() => setIncludeFamily((value) => !value)} type="button">Family & all ages <span>{includeFamily ? '×' : '+'}</span></button>
          <button className="filter-pill" onClick={cycleRadius} type="button">Within {radius} mi <span>⌄</span></button>
          <button className={`filter-pill ${category !== 'All types' ? 'active' : ''}`} onClick={cycleCategory} type="button">{category} <span>⌄</span></button>
        </div>

        <div className="content-grid">
          <section className="agenda" id="day">
            <div className="section-heading"><div><span className="today-dot" /> {selectedDate === 0 ? 'Today’s agenda' : dates[selectedDate].label}</div><span>{visibleEvents.length} example {visibleEvents.length === 1 ? 'event' : 'events'}</span></div>
            {visibleEvents.length ? (
              <div className="timeline">
                {visibleEvents.map((event) => (
                  <article className="event-row" key={event.title}>
                    <time><strong>{event.time}</strong><span>{event.period}</span></time>
                    <div className="timeline-node" aria-hidden="true"><span /></div>
                    <div className="event-card">
                      <div className={`event-mark ${event.tone}`}><span>{event.mark}</span></div>
                      <div className="event-copy">
                        <div className="event-meta"><span>{event.ages}</span><span>{event.duration}</span></div>
                        <h2>{event.title}</h2><p>{event.library}</p>
                        <div className="event-footer"><span>⌖ {event.distance.toFixed(1)} mi</span><button onClick={() => setSelectedEvent(event)} type="button">View details <span>↗</span></button></div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state"><span aria-hidden="true">○</span><h2>No examples match these filters</h2><p>Try widening the distance or including family events.</p></div>
            )}
          </section>

          {selectedEvent ? (
            <aside className="detail-panel" aria-live="polite">
              <button className="close-button" onClick={() => setSelectedEvent(null)} type="button" aria-label="Close event details">×</button>
              <p className="eyebrow">Example event</p><h2>{selectedEvent.title}</h2>
              <div className="detail-tags"><span>{selectedEvent.ages}</span><span>{selectedEvent.duration}</span></div>
              <dl><div><dt>When</dt><dd>{dates[selectedDate].label}<br />{selectedEvent.time} {selectedEvent.period}</dd></div><div><dt>Where</dt><dd>{selectedEvent.library}<br />{selectedEvent.address}</dd></div><div><dt>Distance</dt><dd>{selectedEvent.distance.toFixed(1)} miles</dd></div></dl>
              <p className="detail-note">The live version will show registration, availability, accessibility notes, and a verified link to the library’s original listing.</p>
              <button className="source-button" type="button" disabled>Source link arrives with live feeds</button>
            </aside>
          ) : (
            <aside className="day-summary" id="map">
              <div className="summary-art" aria-hidden="true"><span>15</span><small>MILES</small></div>
              <p className="eyebrow">Your search</p><h2>One useful calendar,<br />not 75 browser tabs.</h2>
              <p>We’ll combine nearby library calendars, keep events that welcome ages 7–16, and link every listing back to its source.</p>
              <dl><div><dt>Area</dt><dd>60457 + 15 mi</dd></div><div><dt>Ages</dt><dd>7–16 + family</dd></div><div><dt>Libraries</dt><dd>75 systems</dd></div></dl>
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
