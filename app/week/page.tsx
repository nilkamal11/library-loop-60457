/* eslint-disable @next/next/no-html-link-for-pages -- hard navigations are intentional for the current Sites runtime */
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  chicagoTodayKey,
  formatEventTime,
  makeDateStrip,
  type EventsResponse,
} from '@/lib/live-event';
import { fetchBrowserOnlyEvents, mergeBrowserEvents } from '@/lib/browser-only-feeds';

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(chicagoTodayKey);
  const [data, setData] = useState<EventsResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const dates = useMemo(() => makeDateStrip(weekStart), [weekStart]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/events?start=${weekStart}&days=7&feed_version=3`, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error('Event refresh failed');
        return response.json() as Promise<EventsResponse>;
      }),
      fetchBrowserOnlyEvents(weekStart, controller.signal),
    ])
      .then(([serverData, browserData]) => {
        setData(mergeBrowserEvents(serverData, browserData));
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadState('error');
      });
    return () => controller.abort();
  }, [weekStart]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, NonNullable<EventsResponse['events']>>();
    for (const event of data?.events ?? []) {
      const list = grouped.get(event.dateKey) ?? [];
      list.push(event);
      grouped.set(event.dateKey, list);
    }
    return grouped;
  }, [data]);
  const eventCount = data?.events.length ?? 0;
  const sourceStatus = data?.sourceStatus;

  const changeWeek = (amount: number) => {
    setLoadState('loading');
    setData(null);
    setWeekStart((current) => addDays(current, amount * 7));
  };

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
        <section className="coverage-card" aria-label="Live week coverage">
          <p className="eyebrow">This live week</p><strong>{loadState === 'loading' ? 'Checking…' : `${eventCount} events`}</strong>
          <p>{sourceStatus ? `${sourceStatus.connected} structured calendars responded` : 'Official calendars are loading'}<br />for ages 7–16 + family</p>
          <div className={`coverage-meter ${loadState === 'ready' ? 'connected' : ''}`}><span /></div><small>Within the 15 mile search</small>
        </section>
      </aside>

      <section className="workspace week-workspace">
        <header className="topbar">
          <div><p className="eyebrow">{dates[0].shortLabel}–{dates[6].shortLabel}</p><h1>Week at a glance.</h1><p className="lede">Live nearby library, park, recreation, and nature events with official detail and signup links.</p></div>
          <div className="week-controls" aria-label="Change week">
            <button onClick={() => changeWeek(-1)} type="button" aria-label="Previous week">‹</button>
            <span><i className="location-dot" aria-hidden="true" /> 60457</span>
            <button onClick={() => changeWeek(1)} type="button" aria-label="Next week">›</button>
          </div>
        </header>

        <div className={`preview-note live-feed-note ${loadState}`} role="status">
          <span>{loadState === 'ready' ? 'Live feeds' : loadState === 'error' ? 'Refresh issue' : 'Connecting'}</span>
          {loadState === 'loading' && 'Checking official calendars and signup links…'}
          {loadState === 'error' && 'The live refresh did not finish. Try again shortly.'}
          {loadState === 'ready' && `${sourceStatus?.connected ?? 0} of ${sourceStatus?.attempted ?? 0} structured calendars responded. Select any event to open its official listing.`}
        </div>

        {loadState === 'loading' ? (
          <div className="empty-state week-loading"><span aria-hidden="true">↻</span><h2>Building the live week</h2><p>Dates, locations, and registration information are loading now.</p></div>
        ) : (
          <section className="week-board" aria-label="Live events for the week">
            {dates.map((day) => {
              const events = eventsByDate.get(day.key) ?? [];
              return (
                <article className={`week-day-card ${day.key === chicagoTodayKey() ? 'today' : ''}`} key={day.key}>
                  <header><div><p>{day.day}</p><strong>{day.shortLabel}</strong></div><span>{events.length}</span></header>
                  <div className="week-events">
                    {events.map((event) => {
                      const displayTime = formatEventTime(event);
                      return (
                        <a className="week-event week-event-link" href={event.registrationUrl} target="_blank" rel="noreferrer" key={event.id} aria-label={`Open official details for ${event.title}`}>
                          <i className={event.tone} aria-hidden="true" />
                          <time dateTime={event.startLocal}>{displayTime.time} {displayTime.period}</time>
                          <h2>{event.title}</h2>
                          <p>{event.source}</p>
                          <footer><span>{event.ages}</span><span>⌖ {event.distance.toFixed(1)} mi ↗</span></footer>
                        </a>
                      );
                    })}
                    {!events.length && <div className="week-day-empty">No matching live events</div>}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <aside className="week-note"><strong>Need filters and full details?</strong><span>The Day planner includes distance, activity type, family-event filters, registration status, and descriptions.</span><a href="/">Open Day planner →</a></aside>
      </section>
    </main>
  );
}
