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
  return {
    events, updatedAt: '2026-09-01T12:00:00.000Z', window: { start, end, days: 7 },
    sourceStatus: { attempted, connected: attempted, empty: 0, failed: 0, failedSources: [] },
  };
}

test('uses an overlapping prior-day structured snapshot instead of collapsing to overnight-only', () => {
  const daily = response([event('daily', '2026-09-03')], '2026-09-01', '2026-09-07', 80);
  const overnight = response([event('overnight', '2026-09-08', 'Overnight source')], '2026-09-02', '2026-09-09', 17);
  const merged = mergeCalendarSnapshots(daily, overnight, '2026-09-02', 7, new Date('2026-09-02T12:00:00.000Z'));
  assert.equal(merged.health, 'partial');
  assert.equal(merged.sourceStatus.attempted, 97);
  assert.deepEqual(merged.events.map((item) => item.id), ['daily', 'overnight']);
});

test('filters saved records to the requested rolling window', () => {
  const daily = response([event('old', '2026-09-01'), event('inside', '2026-09-02'), event('late', '2026-09-09')], '2026-09-01', '2026-09-09', 80);
  const overnight = response([], '2026-09-02', '2026-09-09', 17);
  const merged = mergeCalendarSnapshots(daily, overnight, '2026-09-02', 7, new Date('2026-09-02T12:00:00.000Z'));
  assert.deepEqual(merged.events.map((item) => item.id), ['inside']);
});

test('deduplicates the same official event across collection lanes', () => {
  const shared = event('shared', '2026-09-04');
  const daily = response([shared], '2026-09-02', '2026-09-08', 80);
  const overnight = response([{ ...shared, id: 'duplicate', source: 'Overnight source' }], '2026-09-02', '2026-09-09', 17);
  const merged = mergeCalendarSnapshots(daily, overnight, '2026-09-02', 7, new Date('2026-09-02T12:00:00.000Z'));
  assert.equal(merged.events.length, 1);
  assert.equal(merged.events[0].id, 'shared');
});

test('keeps distinct same-time events that share a feed URL', () => {
  const first = { ...event('first', '2026-09-04'), url: 'https://example.org/feed', registrationUrl: 'https://example.org/feed' };
  const second = { ...event('second', '2026-09-04'), url: 'https://example.org/feed', registrationUrl: 'https://example.org/feed' };
  const merged = mergeCalendarSnapshots(
    response([first, second], '2026-09-02', '2026-09-08', 80),
    response([], '2026-09-02', '2026-09-08', 17),
    '2026-09-02',
    7,
    new Date('2026-09-02T12:00:00.000Z'),
  );
  assert.equal(merged.events.length, 2);
});

test('marks fresh but incomplete source coverage as partial', () => {
  const daily = response([event('daily', '2026-09-04')], '2026-09-02', '2026-09-08', 80);
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
