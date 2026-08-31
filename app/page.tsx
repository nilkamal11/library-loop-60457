/* eslint-disable @next/next/no-html-link-for-pages -- hard navigations are intentional for the current Sites runtime */
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  chicagoTodayKey,
  formatDuration,
  formatEventDateTime,
  formatEventTime,
  makeDateStrip,
  type EventsResponse,
  type LiveEvent,
} from '@/lib/live-event';
import { fetchDailyEvents } from '@/lib/daily-events';
import { mergeEventSources } from '@/lib/browser-only-feeds';
import { fetchOvernightEvents } from '@/lib/overnight-events';

const categoryCycle = ['All types', 'Make', 'Build', 'Play', 'Read', 'Create', 'Outdoor', 'Music', 'Explore'];

function updatedLabel(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago',
  }).format(new Date(value));
}

function registrationCta(event: LiveEvent) {
  const status = event.registrationStatus.toLowerCase();
  if ((status.includes('required') || status.includes('available') || status.includes('window open')) && !status.includes('closed')) return 'Open signup / event details';
  return 'View official event';
}

export default function Home() {
  const [weekStart, setWeekStart] = useState(chicagoTodayKey);
  const [selectedDate, setSelectedDate] = useState(0);
  const [includeFamily, setIncludeFamily] = useState(true);
  const [showTeenEvents, setShowTeenEvents] = useState(false);
  const [radius, setRadius] = useState(15);
  const [category, setCategory] = useState('All types');
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [data, setData] = useState<EventsResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  const dates = useMemo(() => makeDateStrip(weekStart), [weekStart]);
  const selectedKey = dates[selectedDate]?.key ?? weekStart;
  const todayKey = chicagoTodayKey();

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchDailyEvents(weekStart, controller.signal),
      fetchOvernightEvents(weekStart, controller.signal),
    ])
      .then(([dailyData, overnightData]) => {
        setData(mergeEventSources(dailyData, overnightData));
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadState('error');
      });
    return () => controller.abort();
  }, [weekStart]);

  const ageFilteredEvents = useMemo(() => (data?.events ?? []).filter((event) => showTeenEvents || !event.teenOnly), [data, showTeenEvents]);

  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of ageFilteredEvents) counts.set(event.dateKey, (counts.get(event.dateKey) ?? 0) + 1);
    return counts;
  }, [ageFilteredEvents]);

  const visibleEvents = useMemo(() => ageFilteredEvents.filter((event) =>
    event.dateKey === selectedKey
    && event.distance <= radius
    && (includeFamily || !event.family)
    && (category === 'All types' || event.category === category)
  ), [ageFilteredEvents, selectedKey, includeFamily, radius, category]);

  const cycleRadius = () => setRadius((current) => current === 15 ? 5 : current === 5 ? 10 : 15);
  const cycleCategory = () => setCategory((current) => categoryCycle[(categoryCycle.indexOf(current) + 1) % categoryCycle.length]);
  const toggleTeenEvents = () => {
    const next = !showTeenEvents;
    setShowTeenEvents(next);
    if (!next && selectedEvent?.teenOnly) setSelectedEvent(null);
  };
  const changeWeek = (amount: number) => {
    setLoadState('loading');
    setData(null);
    setWeekStart((current) => addDays(current, amount * 7));
    setSelectedDate(0);
    setSelectedEvent(null);
  };
  const chooseDate = (index: number) => {
    setSelectedDate(index);
    setSelectedEvent(null);
  };

  const sourceStatus = data?.sourceStatus;
  const sourceIssueNote = sourceStatus?.failed
    ? ` · ${sourceStatus.failed} ${sourceStatus.failed === 1 ? 'source is' : 'sources are'} temporarily unavailable`
    : sourceStatus?.retained
      ? ` · ${sourceStatus.retained} ${sourceStatus.retained === 1 ? 'source is' : 'sources are'} using last-known-good events`
      : '';
  const liveNote = loadState === 'loading'
    ? 'Loading today’s saved calendar snapshot…'
    : loadState === 'error'
      ? 'The live refresh did not finish. Try again shortly or open Calendar sources for the official pages.'
      : `${sourceStatus?.connected ?? 0} of ${sourceStatus?.attempted ?? 0} daily sources available${sourceIssueNote} · updated ${updatedLabel(data?.updatedAt)} CT`;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">L</span><span>Library Loop</span></div>
        <nav className="nav" aria-label="Main navigation">
          <a className="nav-link active" href="/" aria-current="page"><span aria-hidden="true">▦</span> Day planner</a>
          <a className="nav-link" href="/week"><span aria-hidden="true">□</span> Week view</a>
          <a className="nav-link" href="/map"><span aria-hidden="true">⌖</span> Library map</a>
          <a className="nav-link" href="/sources"><span aria-hidden="true">↻</span> Calendar sources</a>
        </nav>
        <div className="sidebar-spacer" />
        <section className="coverage-card" aria-label="Live feed coverage">
          <p className="eyebrow">Daily calendar snapshot</p>
          <strong>{sourceStatus ? `${sourceStatus.connected} of ${sourceStatus.attempted}` : 'Connecting…'}</strong>
          <p>Official events refreshed once each day</p>
          <div className={`coverage-meter ${loadState === 'ready' ? 'connected' : ''}`}><span /></div>
          <small>{sourceStatus
            ? sourceStatus.failed
              ? `${sourceStatus.failed} ${sourceStatus.failed === 1 ? 'source needs' : 'sources need'} another refresh`
              : sourceStatus.retained
                ? `${sourceStatus.retained} using last-known-good events`
                : `${sourceStatus.empty} connected calendars have no matching events this week`
            : 'Today’s saved events are loading'}</small>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{dates[selectedDate].label}</p><h1>{dates[selectedDate].day} events nearby.</h1><p className="lede">Live library, park, nature, and family-guide discoveries for kids. Teen-focused listings are optional.</p></div>
          <button className="location-button" type="button" title="The starting ZIP for this calendar"><span className="location-dot" aria-hidden="true" /> 60457 <span aria-hidden="true">15 mi</span></button>
        </header>

        <div className={`preview-note live-feed-note ${loadState}`} role="status"><span>{loadState === 'ready' ? 'Daily snapshot' : loadState === 'error' ? 'Refresh issue' : 'Loading'}</span>{liveNote}</div>

        <section className="date-strip" aria-label="Choose a date">
          <button className="month-button" onClick={() => changeWeek(-1)} type="button" aria-label="Previous week">‹</button>
          {dates.map((item, index) => (
            <button className={`date-button ${selectedDate === index ? 'active' : ''}`} aria-pressed={selectedDate === index} key={item.key} onClick={() => chooseDate(index)} type="button">
              <span>{item.day}</span><strong>{item.date}</strong>{(eventCounts.get(item.key) ?? 0) > 0 && <i aria-hidden="true" />}
            </button>
          ))}
          <button className="month-button" onClick={() => changeWeek(1)} type="button" aria-label="Next week">›</button>
        </section>

        <div className="filters" aria-label="Event filters">
          <button className={`filter-pill ${showTeenEvents ? 'active' : ''}`} aria-pressed={showTeenEvents} onClick={toggleTeenEvents} title="Show or hide teen-focused and high-school events" type="button">Teen events <span>{showTeenEvents ? '×' : '+'}</span></button>
          <button className={`filter-pill ${includeFamily ? 'active' : ''}`} aria-pressed={includeFamily} onClick={() => setIncludeFamily((value) => !value)} type="button">Family & all ages <span>{includeFamily ? '×' : '+'}</span></button>
          <button className="filter-pill" onClick={cycleRadius} type="button">Within {radius} mi <span>⌄</span></button>
          <button className={`filter-pill ${category !== 'All types' ? 'active' : ''}`} onClick={cycleCategory} type="button">{category} <span>⌄</span></button>
        </div>

        <div className="content-grid">
          <section className="agenda">
            <div className="section-heading"><div><span className="today-dot" /> {selectedKey === todayKey ? 'Today’s agenda' : dates[selectedDate].label}</div><span>{visibleEvents.length} live {visibleEvents.length === 1 ? 'event' : 'events'}</span></div>
            {loadState === 'loading' ? (
              <div className="empty-state loading-state"><span aria-hidden="true">↻</span><h2>Loading today’s saved events</h2><p>The dashboard does not contact library calendars during this page load.</p></div>
            ) : visibleEvents.length ? (
              <div className="timeline">
                {visibleEvents.map((event) => {
                  const displayTime = formatEventTime(event);
                  return (
                    <article className="event-row" key={event.id}>
                      <time dateTime={event.startLocal}><strong>{displayTime.time}</strong><span>{displayTime.period}</span></time>
                      <div className="timeline-node" aria-hidden="true"><span /></div>
                      <div className="event-card">
                        <div className={`event-mark ${event.tone}`}><span>{event.mark}</span></div>
                        <div className="event-copy">
                          <div className="event-meta"><span>{event.ages}</span><span>{formatDuration(event)}</span>{event.scheduleNotice && <span className="event-alert">Schedule update</span>}</div>
                          <h2>{event.title}</h2><p>{event.source}{event.venue !== event.source ? ` · ${event.venue}` : ''}</p>
                          <div className="event-footer"><span>⌖ {event.distance.toFixed(1)} mi · {event.registrationStatus}</span><button onClick={() => setSelectedEvent(event)} type="button">Details & signup <span>↗</span></button></div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state"><span aria-hidden="true">○</span><h2>No live matches for this day</h2><p>{loadState === 'error' ? 'The feed refresh had a problem. Please try again shortly.' : `Try another date, widen the distance, or ${showTeenEvents ? 'include family events' : 'turn on teen events'}.`}</p></div>
            )}
          </section>

          {selectedEvent ? (
            <aside className="detail-panel" aria-live="polite">
              <button className="close-button" onClick={() => setSelectedEvent(null)} type="button" aria-label="Close event details">×</button>
              <p className="eyebrow">{selectedEvent.sourceKind === 'Family guide' ? 'Family guide discovery · organizer link' : `${selectedEvent.sourceKind} · official live listing`}</p><h2>{selectedEvent.title}</h2>
              <div className="detail-tags"><span>{selectedEvent.ages}</span><span>{formatDuration(selectedEvent)}</span></div>
              {selectedEvent.scheduleNotice && <div className="schedule-warning">{selectedEvent.scheduleNotice}</div>}
              <dl>
                <div><dt>When</dt><dd>{formatEventDateTime(selectedEvent)}</dd></div>
                <div><dt>Where</dt><dd>{selectedEvent.venue}<br />{selectedEvent.address}</dd></div>
                <div><dt>Distance</dt><dd>{selectedEvent.distance.toFixed(1)} miles from 60457</dd></div>
                <div><dt>Signup status</dt><dd>{selectedEvent.registrationStatus}</dd></div>
              </dl>
              <p className="detail-note">{selectedEvent.description || 'This feed does not include a full description. The official event page has the latest details.'}</p>
              <a className="source-button source-button-live" href={selectedEvent.registrationUrl} target="_blank" rel="noreferrer">{registrationCta(selectedEvent)} <span aria-hidden="true">↗</span></a>
              {selectedEvent.registrationUrl !== selectedEvent.url && <a className="secondary-source-link" href={selectedEvent.url} target="_blank" rel="noreferrer">Open original event listing ↗</a>}
              <small className="source-disclaimer">The official organizer controls availability and last-minute changes.</small>
            </aside>
          ) : (
            <aside className="day-summary">
              <div className="summary-art" aria-hidden="true"><span>15</span><small>MILES</small></div>
              <p className="eyebrow">Live calendar area</p><h2>Nearby events from official sources.</h2>
              <p>Events are pulled from official calendars and permitted family guides. Teen-focused listings stay hidden unless you turn them on.</p>
              <dl><div><dt>Area</dt><dd>60457 + 15 mi</dd></div><div><dt>Audience</dt><dd>{showTeenEvents ? 'Kids, family + teens' : 'Kids + family'}</dd></div><div><dt>Feeds responding</dt><dd>{sourceStatus ? `${sourceStatus.connected}/${sourceStatus.attempted}` : 'Checking'}</dd></div></dl>
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
