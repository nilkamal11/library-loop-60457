import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCalendarSnapshots } from './calendar-merge.ts';
import type { EventsResponse, LiveEvent } from './live-event.ts';

function event(id: string, dateKey: string, source = 'Structured source'): LiveEvent {
  return {
    id, title: `Event ${id}`, startLocal: `${dateKey}T10:00:00`, dateKey, allDay: false,
    source, sourceKind: 'Library', venue: source, address: 'Official listing', distance: 4,
    ages: 'Ages 7–12', teenOnly: false, family: false, category: 'Build', description: '',
    tone: 'blue', mark: 'BUILD',
    registrationStatus: 'Check official listing', registrationUrl: `https://example.org/${id}`, url: `https://example.org/${id}`,
  };
}

function response(events: LiveEvent[], start: string, end: string, attempted: number): EventsResponse {
  const days = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1;
  return {
    events, updatedAt: '2026-09-01T12:00:00.000Z', window: { start, end, days },
    sourceStatus: { attempted, connected: attempted, empty: 0, failed: 0, failedSources: [] },
  };
}

test('uses an overlapping prior-day structured snapshot instead of collapsing to overnight-only', () => {
  const daily = response([event('daily', '2026-09-03')], '2026-09-01', '2026-09-07', 85);
  const overnight = response([event('overnight', '2026-09-08', 'Overnight source')], '2026-09-02', '2026-09-09', 17);
  const merged = mergeCalendarSnapshots(daily, overnight, '2026-09-02', 7, new Date('2026-09-02T12:00:00.000Z'));
  assert.equal(merged.health, 'partial');
  assert.equal(merged.sourceStatus.attempted, 102);
  assert.deepEqual(merged.events.map((item) => item.id), ['daily', 'overnight']);
});

test('filters saved records to the requested rolling window', () => {
  const daily = response([event('old', '2026-09-01'), event('inside', '2026-09-02'), event('late', '2026-09-09')], '2026-09-01', '2026-09-09', 85);
  const overnight = response([], '2026-09-02', '2026-09-09', 17);
  const merged = mergeCalendarSnapshots(daily, overnight, '2026-09-02', 7, new Date('2026-09-02T12:00:00.000Z'));
  assert.deepEqual(merged.events.map((item) => item.id), ['inside']);
});

test('serves day 0 through day 59 and reports useful month-ahead coverage', () => {
  const daily = response([
    event('today', '2026-09-02', 'Today source'),
    event('day-30', '2026-10-02', 'Month-ahead source'),
    event('day-59', '2026-10-31', 'Far source'),
    event('day-60', '2026-11-01', 'Outside source'),
  ], '2026-09-02', '2026-10-31', 85);
  const merged = mergeCalendarSnapshots(
    daily,
    response([], '2026-09-02', '2026-10-31', 17),
    '2026-09-02',
    60,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.deepEqual(merged.events.map((item) => item.id), ['today', 'day-30', 'day-59']);
  assert.deepEqual(merged.futureCoverage, {
    latestEventDate: '2026-10-31',
    activeDates: 3,
    eventsAfter30Days: 2,
    sourcesAfter30Days: 2,
  });
});

test('deduplicates the same official event across collection lanes', () => {
  const shared = event('shared', '2026-09-04');
  const daily = response([shared], '2026-09-02', '2026-09-08', 85);
  const overnight = response([{ ...shared, id: 'duplicate', source: 'Overnight source' }], '2026-09-02', '2026-09-09', 17);
  const merged = mergeCalendarSnapshots(daily, overnight, '2026-09-02', 7, new Date('2026-09-02T12:00:00.000Z'));
  assert.equal(merged.events.length, 1);
  assert.equal(merged.events[0].id, 'shared');
});

test('keeps distinct same-time events that share a feed URL', () => {
  const first = { ...event('first', '2026-09-04'), url: 'https://example.org/feed', registrationUrl: 'https://example.org/feed' };
  const second = { ...event('second', '2026-09-04'), url: 'https://example.org/feed', registrationUrl: 'https://example.org/feed' };
  const merged = mergeCalendarSnapshots(
    response([first, second], '2026-09-02', '2026-09-08', 85),
    response([], '2026-09-02', '2026-09-08', 17),
    '2026-09-02',
    7,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.equal(merged.events.length, 2);
});

test('prefers an official organizer record over a matching family-guide copy', () => {
  const official = event('official', '2026-09-06', 'Chicago Park District');
  const guide = {
    ...official,
    id: 'guide',
    source: 'Chicago Park District · via KiddoChicago',
    sourceKind: 'Family guide' as const,
    venue: 'Slightly different guide venue label',
  };
  const merged = mergeCalendarSnapshots(
    response([guide, official], '2026-09-02', '2026-09-08', 85),
    response([], '2026-09-02', '2026-09-08', 17),
    '2026-09-02',
    7,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.deepEqual(merged.events.map((item) => item.id), ['official']);
});

test('prefers the child-compatible record when duplicate official entries disagree about teen-only', () => {
  const teen = { ...event('same', '2026-09-06'), teenOnly: true, ages: 'Ages 13–19' };
  const childCompatible = { ...teen, id: 'younger', teenOnly: false, ages: 'Ages 10–13', url: 'https://example.org/alternate' };
  const merged = mergeCalendarSnapshots(
    response([teen, childCompatible], '2026-09-02', '2026-09-08', 85),
    response([], '2026-09-02', '2026-09-08', 17),
    '2026-09-02',
    7,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.deepEqual(merged.events.map((item) => item.id), ['younger']);
});

test('keeps separate performances of the same show', () => {
  const early = { ...event('circus', '2026-09-06'), title: 'Midnight Circus', startLocal: '2026-09-06T14:00:00' };
  const late = { ...early, id: 'circus-late', startLocal: '2026-09-06T17:00:00' };
  const merged = mergeCalendarSnapshots(
    response([early, late], '2026-09-02', '2026-09-08', 85),
    response([], '2026-09-02', '2026-09-08', 17),
    '2026-09-02',
    7,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.equal(merged.events.length, 2);
});

test('placeholder locations and a generic calendar URL do not merge separate organizers', () => {
  const left = {
    ...event('placeholder-left', '2026-09-06', 'Library A'),
    title: 'Family Storytime',
    venue: 'Venue varies',
    address: 'See official listing',
    url: 'https://example.org/events',
    registrationUrl: 'https://example.org/events',
  };
  const right = { ...left, id: 'placeholder-right', source: 'Library B' };
  const merged = mergeCalendarSnapshots(
    response([left, right], '2026-09-02', '2026-09-08', 85),
    response([], '2026-09-02', '2026-09-08', 17),
    '2026-09-02',
    7,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.equal(merged.events.length, 2);
});

test('same specific event URL and start merge even when guide title differs', () => {
  const url = 'https://example.org/events/midnight-circus-596';
  const official = {
    ...event('official-url', '2026-09-06', 'Chicago Park District'),
    title: 'Midnight Circus at Park No. 596',
    sourceKind: 'Park district' as const,
    url,
    registrationUrl: url,
  };
  const guide = {
    ...official,
    id: 'guide-url',
    title: 'Midnight Circus',
    source: 'Chicago Park District · via KiddoChicago',
    sourceKind: 'Family guide' as const,
  };
  const merged = mergeCalendarSnapshots(
    response([official, guide], '2026-09-02', '2026-09-08', 85),
    response([], '2026-09-02', '2026-09-08', 17),
    '2026-09-02',
    7,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.equal(merged.events.length, 1);
  assert.equal(merged.events[0].id, 'official-url');
});

test('marks fresh but incomplete source coverage as partial', () => {
  const daily = response([event('daily', '2026-09-04')], '2026-09-02', '2026-09-08', 85);
  daily.sourceStatus.connected = 79;
  daily.sourceStatus.failed = 1;
  daily.sourceStatus.failedSources = ['Unavailable source'];
  const merged = mergeCalendarSnapshots(
    daily,
    response([], '2026-09-02', '2026-09-08', 17),
    '2026-09-02',
    7,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.equal(merged.health, 'partial');
});

test('marks an old overnight-only snapshot as stale', () => {
  const overnight = response([event('overnight', '2026-09-04')], '2026-09-02', '2026-09-08', 17);
  overnight.updatedAt = '2026-08-30T00:00:00.000Z';
  const merged = mergeCalendarSnapshots(null, overnight, '2026-09-02', 7, new Date('2026-09-02T12:00:00.000Z'));
  assert.equal(merged.health, 'stale');
});

test('withholds legacy events whose audience was guessed rather than evidenced', () => {
  const guessed = { ...event('guessed', '2026-09-04'), ages: 'Family / age not specified', family: true };
  const explicit = { ...event('explicit', '2026-09-04'), ages: 'Family / all ages', family: true };
  const merged = mergeCalendarSnapshots(
    response([guessed, explicit], '2026-09-02', '2026-09-08', 85),
    response([], '2026-09-02', '2026-09-08', 17),
    '2026-09-02',
    7,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.deepEqual(merged.events.map((item) => item.id), ['explicit']);
});
