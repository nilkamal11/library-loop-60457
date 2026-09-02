'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatDuration, formatEventDateTime, formatEventTime, makeDateStrip, type LiveEvent } from '@/lib/live-event';
import type { CalendarPayload } from '@/lib/calendar-read-model';
import SiteHeader from '@/app/site-header';

const PAGE_SIZE = 24;

function formatSavedAt(value: string) {
  if (!value) return 'unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/Chicago', timeZoneName: 'short',
  }).format(new Date(value));
}

function formatShortDate(key: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${key}T12:00:00Z`));
}

function searchable(event: LiveEvent) {
  return [event.title, event.source, event.venue, event.ages, event.category, event.description].join(' ').toLowerCase();
}

export default function CalendarExplorer({ initialData }: { initialData: CalendarPayload }) {
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('all');
  const [radius, setRadius] = useState('15');
  const [category, setCategory] = useState('all');
  const [showTeens, setShowTeens] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<LiveEvent | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryError, setRetryError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const dates = useMemo(() => makeDateStrip(data.requestedWindow.start), [data.requestedWindow.start]);
  const categories = useMemo(() => [...new Set(data.events.map((event) => event.category))].sort(), [data.events]);

  const filteredWithoutDate = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.events.filter((event) =>
      event.distance <= Number(radius)
      && (showTeens || !event.teenOnly)
      && (category === 'all' || event.category === category)
      && (!needle || searchable(event).includes(needle)));
  }, [category, data.events, query, radius, showTeens]);

  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of filteredWithoutDate) counts.set(event.dateKey, (counts.get(event.dateKey) ?? 0) + 1);
    return counts;
  }, [filteredWithoutDate]);

  const filteredEvents = useMemo(() =>
    filteredWithoutDate.filter((event) => date === 'all' || event.dateKey === date),
  [date, filteredWithoutDate]);

  useEffect(() => {
    if (!selected) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
        window.setTimeout(() => openerRef.current?.focus(), 0);
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const closeDialog = () => {
    setSelected(null);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  };

  const openDialog = (event: LiveEvent, trigger: HTMLButtonElement) => {
    openerRef.current = trigger;
    setSelected(event);
  };

  const clearFilters = () => {
    setQuery('');
    setDate('all');
    setRadius('15');
    setCategory('all');
    setShowTeens(false);
    setLimit(PAGE_SIZE);
  };

  const retry = async () => {
    setRefreshing(true);
    setRetryError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(`/api/calendar?start=${data.requestedWindow.start}&days=7`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Calendar request failed');
      setData(await response.json() as CalendarPayload);
    } catch {
      setRetryError('The retry did not finish. The saved page data remains available.');
    } finally {
      window.clearTimeout(timeout);
      setRefreshing(false);
    }
  };

  const healthLabel = data.health === 'current' ? 'Current saved calendar'
    : data.health === 'partial' ? 'Partial saved coverage'
      : data.health === 'stale' ? 'Using last good calendar'
        : data.health === 'overnight-only' ? 'Overnight data only'
          : 'Calendar unavailable';

  return (
    <>
      <SiteHeader active="events" radius={radius} />
      <main id="main-content">
      <section className="intro" aria-labelledby="page-title">
        <div>
          <p className="kicker">Things to do in the next seven days</p>
          <h1 id="page-title">Find a good outing.</h1>
          <p>Library, park, recreation, and nature events for kids and families near 60457.</p>
        </div>
        <div className="week-total"><strong>{filteredEvents.length}</strong><span>matching events</span></div>
      </section>

      <section className={`health-banner ${data.health}`} aria-live="polite">
        <div><strong>{healthLabel}</strong><span>{data.message}</span></div>
        <p>Saved {formatSavedAt(data.updatedAt)} · {data.sourceStatus.connected}/{data.sourceStatus.attempted} responding · {data.sourceStatus.empty} with no matching events{data.sourceStatus.retained ? ` · ${data.sourceStatus.retained} retained` : ''}{data.sourceStatus.failed ? ` · ${data.sourceStatus.failed} unavailable` : ''}{data.structuredSnapshot ? ` · structured ${formatShortDate(data.structuredSnapshot.start)}–${formatShortDate(data.structuredSnapshot.end)}` : ''}</p>
        {(data.health !== 'current' || retryError) && <button type="button" onClick={retry} disabled={refreshing}>{refreshing ? 'Checking…' : 'Retry saved feed'}</button>}
        {retryError && <small>{retryError}</small>}
      </section>

      <section className="filters" aria-label="Filter events">
        <label className="search-field"><span>Search events</span><input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} placeholder="Try LEGO, art, Oak Lawn…" /></label>
        <label><span>Distance</span><select value={radius} onChange={(event) => { setRadius(event.target.value); setLimit(PAGE_SIZE); }}><option value="5">Within 5 miles</option><option value="10">Within 10 miles</option><option value="15">Within 15 miles</option></select></label>
        <label><span>Activity</span><select value={category} onChange={(event) => { setCategory(event.target.value); setLimit(PAGE_SIZE); }}><option value="all">All activities</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label className="teen-toggle"><input type="checkbox" checked={showTeens} onChange={(event) => { setShowTeens(event.target.checked); setLimit(PAGE_SIZE); }} /><span><b>Include teen-only</b><small>Hidden by default</small></span></label>
        <button className="clear-button" type="button" onClick={clearFilters}>Clear filters</button>
      </section>

      <nav className="date-filter" aria-label="Filter by date">
        <button type="button" className={date === 'all' ? 'active' : ''} aria-pressed={date === 'all'} onClick={() => { setDate('all'); setLimit(PAGE_SIZE); }}><b>All</b><span>{filteredWithoutDate.length}</span></button>
        {dates.map((item) => <button type="button" key={item.key} className={date === item.key ? 'active' : ''} aria-pressed={date === item.key} onClick={() => { setDate(item.key); setLimit(PAGE_SIZE); }}><b>{item.day} {item.date}</b><span>{countsByDate.get(item.key) ?? 0}</span></button>)}
      </nav>

      <section className="results" aria-labelledby="results-title">
        <div className="results-heading"><div><p className="kicker">Saved event listings</p><h2 id="results-title">{date === 'all' ? `${formatShortDate(data.requestedWindow.start)}–${formatShortDate(data.requestedWindow.end)}` : formatShortDate(date)}</h2></div><span>Showing {Math.min(limit, filteredEvents.length)} of {filteredEvents.length}</span></div>
        {filteredEvents.length ? <div className="event-grid">
          {filteredEvents.slice(0, limit).map((event) => {
            const time = formatEventTime(event);
            return <article className="event-card" key={event.id}>
              <div className="event-date"><span>{formatShortDate(event.dateKey)}</span><strong>{time.time}{time.period && <small> {time.period}</small>}</strong></div>
              <div className="event-body">
                <div className="event-tags"><span>{event.ages}</span><span>{event.category}</span>{event.scheduleNotice && <span className="warning">Schedule update</span>}</div>
                <h3>{event.title}</h3>
                <p><b>{event.source}</b>{event.venue && event.venue !== event.source ? ` · ${event.venue}` : ''}</p>
                <dl><div><dt>Distance</dt><dd>{event.distance.toFixed(1)} mi</dd></div><div><dt>Signup</dt><dd>{event.registrationStatus}</dd></div></dl>
                <button type="button" onClick={(click) => openDialog(event, click.currentTarget)}>View details</button>
              </div>
            </article>;
          })}
        </div> : <div className="empty-state"><strong>No events match these filters.</strong><p>Try all dates, a wider distance, or clear the search.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>}
        {limit < filteredEvents.length && <button className="more-button" type="button" onClick={() => setLimit((value) => value + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, filteredEvents.length - limit)} more events</button>}
      </section>
      </main>
      <footer><strong>Library Loop</strong><span>Updated daily from saved public calendar listings. Organizers control availability and last-minute changes.</span><Link href="/sources" prefetch={false}>Sources &amp; technology</Link></footer>
      {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
        <section ref={dialogRef} className="event-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <button ref={closeRef} className="dialog-close" type="button" onClick={closeDialog} aria-label="Close event details">×</button>
          <p className="kicker">{selected.sourceKind} · {selected.sourceKind === 'Family guide' ? 'discovery listing' : 'official organizer listing'}</p>
          <h2 id="dialog-title">{selected.title}</h2>
          <div className="dialog-tags"><span>{selected.ages}</span><span>{selected.category}</span><span>{formatDuration(selected)}</span></div>
          {selected.scheduleNotice && <div className="dialog-warning">{selected.scheduleNotice}</div>}
          <dl className="event-facts">
            <div><dt>When</dt><dd>{formatEventDateTime(selected)}</dd></div>
            <div><dt>Where</dt><dd>{selected.venue}<br /><small>{selected.address}</small></dd></div>
            <div><dt>Distance</dt><dd>{selected.distance.toFixed(1)} miles from 60457</dd></div>
            <div><dt>Signup</dt><dd>{selected.registrationStatus}</dd></div>
            <div><dt>Source</dt><dd>{selected.source}</dd></div>
          </dl>
          <p className="event-description">{selected.description || 'The saved listing does not include a full description. Check the official page for current details.'}</p>
          <a className="official-link" href={selected.registrationUrl || selected.url} target="_blank" rel="noopener noreferrer">Open official event page <span aria-hidden="true">↗</span></a>
          <small className="disclaimer">Confirm availability and last-minute changes with the organizer.</small>
        </section>
      </div>}
    </>
  );
}
