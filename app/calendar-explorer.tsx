'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, chicagoTodayKey, formatDuration, formatEventDateTime, formatEventTime, makeDateStrip, type LiveEvent } from '@/lib/live-event';
import { CALENDAR_HORIZON_DAYS, CALENDAR_RANGE_OPTIONS } from '@/lib/calendar-config';
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
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${key}T12:00:00Z`));
}

function formatMonth(key: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${key}-01T12:00:00Z`));
}

function searchable(event: LiveEvent) {
  return [event.title, event.source, event.venue, event.ages, event.category, event.description].join(' ').toLowerCase();
}

export default function CalendarExplorer({ initialData }: { initialData: CalendarPayload }) {
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('all');
  const [month, setMonth] = useState('all');
  const [rangeDays, setRangeDays] = useState(Math.min(CALENDAR_HORIZON_DAYS, data.requestedWindow.days));
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

  const dates = useMemo(() => makeDateStrip(data.requestedWindow.start, rangeDays), [data.requestedWindow.start, rangeDays]);
  const months = useMemo(() => [...new Set(dates.map((item) => item.key.slice(0, 7)))], [dates]);
  const visibleEndExclusive = useMemo(() => addDays(data.requestedWindow.start, rangeDays), [data.requestedWindow.start, rangeDays]);
  const categories = useMemo(() => [...new Set([
    ...data.events.map((event) => event.category),
    ...(category === 'all' ? [] : [category]),
  ])].sort(), [category, data.events]);
  const availableDateKeys = useMemo(() => new Set(data.events
    .filter((event) => event.dateKey >= data.requestedWindow.start && event.dateKey < visibleEndExclusive)
    .map((event) => event.dateKey)), [data.events, data.requestedWindow.start, visibleEndExclusive]);

  const filteredAcrossHorizon = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.events.filter((event) =>
      event.dateKey >= data.requestedWindow.start
      && event.distance <= Number(radius)
      && (showTeens || !event.teenOnly)
      && (category === 'all' || event.category === category)
      && (!needle || searchable(event).includes(needle)));
  }, [category, data.events, data.requestedWindow.start, query, radius, showTeens]);

  const filteredWithoutDate = useMemo(() =>
    filteredAcrossHorizon.filter((event) => event.dateKey < visibleEndExclusive),
  [filteredAcrossHorizon, visibleEndExclusive]);

  const countsByRange = useMemo(() => new Map(CALENDAR_RANGE_OPTIONS.map((days) => [
    days,
    filteredAcrossHorizon.filter((event) => event.dateKey < addDays(data.requestedWindow.start, days)).length,
  ])), [data.requestedWindow.start, filteredAcrossHorizon]);

  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of filteredWithoutDate) counts.set(event.dateKey, (counts.get(event.dateKey) ?? 0) + 1);
    return counts;
  }, [filteredWithoutDate]);

  const countsByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of filteredWithoutDate) {
      const key = event.dateKey.slice(0, 7);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [filteredWithoutDate]);

  const filteredEvents = useMemo(() =>
    filteredWithoutDate.filter((event) =>
      (month === 'all' || event.dateKey.startsWith(month))
      && (date === 'all' || event.dateKey === date)),
  [date, filteredWithoutDate, month]);

  const visibleFutureCoverage = useMemo(() => {
    const futureStart = addDays(data.requestedWindow.start, 30);
    const laterEvents = filteredAcrossHorizon.filter((event) => event.dateKey >= futureStart);
    return {
      latestEventDate: filteredAcrossHorizon.reduce((latest, event) => event.dateKey > latest ? event.dateKey : latest, ''),
      eventCount: laterEvents.length,
      sourceCount: new Set(laterEvents.map((event) => event.source)).size,
    };
  }, [data.requestedWindow.start, filteredAcrossHorizon]);

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
    setMonth('all');
    setRangeDays(CALENDAR_HORIZON_DAYS);
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
      const retryStart = chicagoTodayKey();
      const response = await fetch(`/api/calendar?start=${retryStart}&days=${data.requestedWindow.days}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Calendar request failed');
      setData(await response.json() as CalendarPayload);
      if (retryStart !== data.requestedWindow.start) {
        setDate('all');
        setMonth('all');
        setLimit(PAGE_SIZE);
      }
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

  const rangeEnd = addDays(data.requestedWindow.start, rangeDays - 1);
  const eventDates = dates.filter((item) => availableDateKeys.has(item.key) || item.key === date);
  const resultHeading = date !== 'all'
    ? formatShortDate(date)
    : month !== 'all'
      ? formatMonth(month)
      : `${formatShortDate(data.requestedWindow.start)}–${formatShortDate(rangeEnd)}`;
  const futureCoverageMessage = visibleFutureCoverage.latestEventDate
    ? visibleFutureCoverage.eventCount > 0
      ? `Across the full 60-day calendar, ${visibleFutureCoverage.eventCount} events matching the other filters are saved 30–60 days ahead from ${visibleFutureCoverage.sourceCount} sources. Listings reach ${formatShortDate(visibleFutureCoverage.latestEventDate)}.`
      : `No events matching the other filters are currently saved 30–60 days ahead. Saved matching listings reach ${formatShortDate(visibleFutureCoverage.latestEventDate)}; the calendar checks again every day.`
    : 'No matching future listings are currently saved; the calendar checks every configured source again each day.';

  return (
    <>
      <SiteHeader active="events" radius={radius} />
      <main id="main-content">
      <section className="intro" aria-labelledby="page-title">
        <div>
          <p className="kicker">Plan up to two months ahead</p>
          <h1 id="page-title">Find a good outing.</h1>
          <p>Library, park, recreation, and nature events for kids and families near 60457.</p>
        </div>
        <div className="range-total"><strong>{filteredEvents.length}</strong><span>matching events</span></div>
      </section>

      <section className={`health-banner ${data.health}`} aria-live="polite">
        <div><strong>{healthLabel}</strong><span>{data.message}</span></div>
        <p>Saved {formatSavedAt(data.updatedAt)} · {data.sourceStatus.connected}/{data.sourceStatus.attempted} responding · {data.sourceStatus.empty} with no matching events{data.sourceStatus.retained ? ` · ${data.sourceStatus.retained} retained or partial` : ''}{data.sourceStatus.failed ? ` · ${data.sourceStatus.failed} unavailable` : ''}{data.structuredSnapshot ? ` · collection window ${formatShortDate(data.structuredSnapshot.start)}–${formatShortDate(data.structuredSnapshot.end)}` : ''}</p>
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

      <section className="date-filter" aria-label="Plan by date range">
        <div className="date-filter-copy"><strong>Plan ahead</strong><span>{futureCoverageMessage}</span></div>
        <div className="range-options" role="group" aria-label="Planning horizon">
          {CALENDAR_RANGE_OPTIONS.map((days) => <button type="button" key={days} className={rangeDays === days ? 'active' : ''} aria-pressed={rangeDays === days} onClick={() => { setRangeDays(days); setMonth('all'); setDate('all'); setLimit(PAGE_SIZE); }}><b>{days} days</b><span>{countsByRange.get(days) ?? 0}</span></button>)}
        </div>
        <label><span>Month</span><select value={month} onChange={(event) => { setMonth(event.target.value); setDate('all'); setLimit(PAGE_SIZE); }}><option value="all">All months</option>{months.map((item) => <option value={item} key={item}>{formatMonth(item)} ({countsByMonth.get(item) ?? 0})</option>)}</select></label>
        <label><span>Exact event date</span><select value={date} onChange={(event) => { setDate(event.target.value); setMonth('all'); setLimit(PAGE_SIZE); }}><option value="all">Any event date</option>{eventDates.map((item) => <option value={item.key} key={item.key}>{item.label}, {item.key.slice(0, 4)} ({countsByDate.get(item.key) ?? 0})</option>)}</select></label>
      </section>

      <section className="results" aria-labelledby="results-title">
        <div className="results-heading"><div><p className="kicker">Saved event listings</p><h2 id="results-title">{resultHeading}</h2></div><span aria-live="polite">Showing {Math.min(limit, filteredEvents.length)} of {filteredEvents.length}</span></div>
        {filteredEvents.length ? <div className="event-grid">
          {filteredEvents.slice(0, limit).map((event) => {
            const time = formatEventTime(event);
            return <article className="event-card" key={`${event.source}|${event.id}|${event.startLocal}`}>
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
      <footer><strong>Library Loop</strong><span>Updated daily from saved public calendar listings. Organizers control availability and last-minute changes.</span><a href="/sources">Sources &amp; technology</a></footer>
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
