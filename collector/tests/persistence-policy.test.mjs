import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  BULK_DELETE_SUCCESS_EVENTS_SQL,
  BULK_INSERT_SUCCESS_EVENTS_SQL,
  BULK_UPSERT_SOURCE_COVERAGE_SQL,
  BULK_UPSERT_SOURCES_SQL,
  FINALIZE_SOURCE_ERRORS_SQL,
  INSERT_COLLECTOR_RUN_SQL,
  INSERT_RUN_SOURCE_RECEIPTS_SQL,
} from '../../lib/collector-sql.mjs';

const WRITE_STATEMENT_COUNT = 7;
const SCHEMA_STATEMENT_COUNT = 13;
const OTHER_INGEST_STATEMENT_COUNT = 2; // Duplicate-run lookup and receipt read.

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE collector_runs (
    run_id TEXT PRIMARY KEY,
    collected_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    adapter_version TEXT NOT NULL,
    source_count INTEGER NOT NULL,
    event_count INTEGER NOT NULL,
    body_hash TEXT NOT NULL
  );
  CREATE TABLE collector_sources (
    source_id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    status TEXT NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 0,
    collected_at TEXT NOT NULL,
    last_success_at TEXT,
    error TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE collector_source_coverage (
    source_id TEXT PRIMARY KEY,
    complete INTEGER NOT NULL DEFAULT 0,
    collected_at TEXT NOT NULL
  );
  CREATE TABLE collector_run_sources (
    run_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    status TEXT NOT NULL,
    applied INTEGER NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (run_id, source_id)
  );
  CREATE TABLE collector_events (
    source_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_local TEXT NOT NULL,
    event_json TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    PRIMARY KEY (source_id, event_id)
  );`);
  return db;
}

function event(id, dateKey = '2026-09-01', title = 'Family event') {
  return { id, title, dateKey, startLocal: `${dateKey}T10:00:00` };
}

function sourceRecord({ sourceId, sourceName, status, collectedAt, runId, events = [], error = null, complete = true }) {
  return {
    sourceId,
    sourceName,
    status,
    complete,
    eventCount: status === 'success' ? events.length : 0,
    collectedAt,
    lastSuccessAt: status === 'success' ? collectedAt : null,
    writeToken: `apply:${runId}:${sourceId}:${collectedAt}`,
    finalError: error,
    consecutiveFailures: status === 'failed' || status === 'blocked' ? 1 : 0,
    events: status === 'success' ? events : [],
  };
}

function batchStatements(db, { runId, collectedAt, results }) {
  const sources = results.map((result) => sourceRecord({ ...result, runId, collectedAt }));
  const sourcesJson = JSON.stringify(sources);
  return [
    () => db.prepare(BULK_UPSERT_SOURCES_SQL).run(sourcesJson),
    () => db.prepare(BULK_UPSERT_SOURCE_COVERAGE_SQL).run(sourcesJson),
    () => db.prepare(BULK_DELETE_SUCCESS_EVENTS_SQL).run(sourcesJson),
    () => db.prepare(BULK_INSERT_SUCCESS_EVENTS_SQL).run(sourcesJson),
    () => db.prepare(INSERT_RUN_SOURCE_RECEIPTS_SQL).run(runId, sourcesJson),
    () => db.prepare(INSERT_COLLECTOR_RUN_SQL).run(runId, collectedAt, collectedAt, 'test-v1', results.length, 'hash', runId),
    () => db.prepare(FINALIZE_SOURCE_ERRORS_SQL).run(sourcesJson, sourcesJson),
  ];
}

function applyBatch(db, input) {
  const statements = batchStatements(db, input);
  db.exec('BEGIN');
  try {
    for (const statement of statements) statement();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return db.prepare('SELECT source_id, applied, event_count FROM collector_run_sources WHERE run_id = ? ORDER BY source_id').all(input.runId);
}

test('empty and failed results preserve the last successful snapshot and only actual failures increment', () => {
  const db = database();
  const source = { sourceId: 'justice-public-library', sourceName: 'Justice Public Library District' };
  const first = '2026-08-30T01:00:00.000Z';
  const empty = '2026-08-30T02:00:00.000Z';

  applyBatch(db, { runId: 'run-1', collectedAt: first, results: [{ ...source, status: 'success', events: [event('event-a')] }] });
  applyBatch(db, { runId: 'run-2', collectedAt: empty, results: [{ ...source, status: 'empty', events: [], error: 'No confident events' }] });

  const storedSource = db.prepare('SELECT * FROM collector_sources WHERE source_id = ?').get(source.sourceId);
  const storedEvents = db.prepare('SELECT event_id FROM collector_events WHERE source_id = ?').all(source.sourceId);
  assert.equal(storedSource.status, 'empty');
  assert.equal(storedSource.event_count, 1);
  assert.equal(storedSource.last_success_at, first);
  assert.equal(storedSource.collected_at, empty);
  assert.equal(storedSource.consecutive_failures, 0);
  assert.deepEqual(storedEvents.map((row) => row.event_id), ['event-a']);

  applyBatch(db, { runId: 'run-3', collectedAt: '2026-08-30T03:00:00.000Z', results: [{ ...source, status: 'failed', events: [], error: 'Navigation failed' }] });
  assert.equal(db.prepare('SELECT event_id FROM collector_events').get().event_id, 'event-a');
  assert.equal(db.prepare('SELECT consecutive_failures FROM collector_sources').get().consecutive_failures, 1);
});

test('older and equal-timestamp results cannot replace a newer source snapshot', () => {
  const db = database();
  const source = { sourceId: 'justice-public-library', sourceName: 'Justice Public Library District' };
  const newest = '2026-08-30T03:00:00.000Z';

  applyBatch(db, { runId: 'run-new', collectedAt: newest, results: [{ ...source, status: 'success', events: [event('event-new')] }] });
  const oldReceipt = applyBatch(db, { runId: 'run-old', collectedAt: '2026-08-30T02:30:00.000Z', results: [{ ...source, status: 'success', events: [event('event-old')] }] });
  const equalReceipt = applyBatch(db, { runId: 'run-equal', collectedAt: newest, results: [{ ...source, status: 'success', events: [event('event-equal')] }] });
  applyBatch(db, { runId: 'run-blocked', collectedAt: '2026-08-30T02:45:00.000Z', results: [{ ...source, status: 'blocked', events: [], error: 'Stale block' }] });

  assert.equal(oldReceipt[0].applied, 0);
  assert.equal(equalReceipt[0].applied, 0);
  const storedSource = db.prepare('SELECT status, collected_at, last_success_at FROM collector_sources').get();
  const storedEvents = db.prepare('SELECT event_id FROM collector_events').all();
  assert.deepEqual({ ...storedSource }, { status: 'success', collected_at: newest, last_success_at: newest });
  assert.deepEqual(storedEvents.map((row) => row.event_id), ['event-new']);
});

test('an incomplete successful page read updates known events without erasing later last-known-good events', () => {
  const db = database();
  const source = { sourceId: 'justice-public-library', sourceName: 'Justice Public Library District' };
  applyBatch(db, {
    runId: 'run-complete',
    collectedAt: '2026-08-30T01:00:00.000Z',
    results: [{ ...source, status: 'success', complete: true, events: [
      event('event-soon', '2026-09-02', 'Original title'),
      event('event-later', '2026-10-20'),
    ] }],
  });
  applyBatch(db, {
    runId: 'run-partial',
    collectedAt: '2026-08-31T01:00:00.000Z',
    results: [{ ...source, status: 'success', complete: false, events: [
      event('event-soon', '2026-09-02', 'Updated title'),
    ] }],
  });

  const stored = db.prepare('SELECT event_id, event_json FROM collector_events ORDER BY event_id').all();
  assert.deepEqual(stored.map((row) => row.event_id), ['event-later', 'event-soon']);
  assert.equal(JSON.parse(stored.find((row) => row.event_id === 'event-soon').event_json).title, 'Updated title');
  assert.equal(db.prepare('SELECT complete FROM collector_source_coverage').get().complete, 0);
});

test('mixed sources produce exact durable receipts and keep event JSON intact', () => {
  const db = database();
  const collectedAt = '2026-08-30T04:00:00.000Z';
  const special = event('a-2', '2026-09-01', 'Robotics: “Build & test”\nFamily lab');
  const receipt = applyBatch(db, {
    runId: 'run-mixed',
    collectedAt,
    results: [
      { sourceId: 'source-a', sourceName: 'Source A', status: 'success', events: [event('a-1'), special] },
      { sourceId: 'source-b', sourceName: 'Source B', status: 'empty', events: [], error: 'No confident events' },
      { sourceId: 'source-c', sourceName: 'Source C', status: 'failed', events: [], error: 'Timed out' },
    ],
  });

  assert.deepEqual(receipt.map((row) => ({ ...row })), [
    { source_id: 'source-a', applied: 1, event_count: 2 },
    { source_id: 'source-b', applied: 1, event_count: 0 },
    { source_id: 'source-c', applied: 1, event_count: 0 },
  ]);
  assert.equal(db.prepare('SELECT event_count FROM collector_runs WHERE run_id = ?').get('run-mixed').event_count, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM collector_events').get().count, 2);
  assert.deepEqual(JSON.parse(db.prepare("SELECT event_json FROM collector_events WHERE event_id = 'a-2'").get().event_json), special);
  assert.equal(db.prepare("SELECT error FROM collector_sources WHERE source_id = 'source-a'").get().error, null);
  assert.equal(db.prepare("SELECT error FROM collector_sources WHERE source_id = 'source-b'").get().error, 'No confident events');
});

test('a failure in any write statement rolls back the entire run', () => {
  const db = database();
  db.exec(`CREATE TRIGGER reject_for_test BEFORE INSERT ON collector_events
    WHEN NEW.event_id = 'force-failure'
    BEGIN SELECT RAISE(ABORT, 'forced event write failure'); END;`);
  const input = {
    runId: 'run-rollback',
    collectedAt: '2026-08-30T05:00:00.000Z',
    results: [{
      sourceId: 'source-a',
      sourceName: 'Source A',
      status: 'success',
      events: [event('normal'), event('force-failure')],
    }],
  };
  assert.throws(() => applyBatch(db, input), /forced event write failure/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM collector_sources').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM collector_events').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM collector_runs').get().count, 0);
});

test('maximum batch still uses a fixed statement count below the free D1 limit', () => {
  const db = database();
  const results = Array.from({ length: 17 }, (_, sourceIndex) => ({
    sourceId: `source-${sourceIndex}`,
    sourceName: `Source ${sourceIndex}`,
    status: 'success',
    events: Array.from({ length: sourceIndex < 8 ? 177 : 176 }, (_, eventIndex) => event(`${sourceIndex}-${eventIndex}`)),
  }));
  assert.equal(results.reduce((sum, result) => sum + result.events.length, 0), 3000);
  const input = { runId: 'run-max', collectedAt: '2026-08-30T06:00:00.000Z', results };
  assert.equal(batchStatements(db, input).length, WRITE_STATEMENT_COUNT);
  assert.equal(SCHEMA_STATEMENT_COUNT + OTHER_INGEST_STATEMENT_COUNT + WRITE_STATEMENT_COUNT, 22);
  assert.ok(SCHEMA_STATEMENT_COUNT + OTHER_INGEST_STATEMENT_COUNT + WRITE_STATEMENT_COUNT < 50);
  assert.equal(applyBatch(db, input).reduce((sum, row) => sum + row.event_count, 0), 3000);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM collector_events').get().count, 3000);
});
