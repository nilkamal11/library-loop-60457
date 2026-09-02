import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  DELETE_OLD_STRUCTURED_EVENTS_SQL,
  DELETE_OLD_STRUCTURED_RUNS_SQL,
  DELETE_OLD_STRUCTURED_SOURCES_SQL,
  DELETE_STRUCTURED_RUN_EVENTS_SQL,
  DELETE_STRUCTURED_RUN_SOURCES_SQL,
  INSERT_STRUCTURED_EVENTS_SQL,
  INSERT_STRUCTURED_RUN_SOURCES_SQL,
  MAX_STRUCTURED_EVENTS,
  SELECT_BEST_OVERLAPPING_STRUCTURED_RUN_SQL,
  STRUCTURED_EVENT_WRITE_BATCH_SIZE,
  STRUCTURED_RUN_RETENTION,
  UPSERT_STRUCTURED_RUN_SQL,
} from '../../lib/structured-calendar-sql.mjs';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE structured_calendar_runs (
    run_id TEXT PRIMARY KEY,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    source_status_json TEXT NOT NULL,
    event_count INTEGER NOT NULL
  );
  CREATE TABLE structured_calendar_events (
    run_id TEXT NOT NULL,
    event_key TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_local TEXT NOT NULL,
    event_json TEXT NOT NULL,
    PRIMARY KEY (run_id, event_key)
  );
  CREATE INDEX structured_calendar_events_run_date_idx
  ON structured_calendar_events (run_id, event_date, start_local);
  CREATE TABLE structured_calendar_run_sources (
    run_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    status TEXT NOT NULL,
    event_count INTEGER NOT NULL,
    latest_event_date TEXT,
    error TEXT,
    PRIMARY KEY (run_id, source_id)
  );`);
  return db;
}

function event(index, dateKey = `2026-10-${String(index % 28 + 1).padStart(2, '0')}`) {
  return {
    id: `event-${index}`,
    title: `Future family event ${index}`,
    startLocal: `${dateKey}T10:00:00`,
    dateKey,
    description: 'A bounded event record stored independently rather than in one oversized snapshot.',
  };
}

function applyRun(db, runId, updatedAt, events, days = 60) {
  const statements = [
    () => db.prepare(UPSERT_STRUCTURED_RUN_SQL).run(runId, '2026-09-02', days === 60 ? '2026-10-31' : '2026-09-08', days, updatedAt, JSON.stringify({ attempted: 80, connected: 80, empty: 0, failed: 0, failedSources: [] }), events.length),
    () => db.prepare(DELETE_STRUCTURED_RUN_EVENTS_SQL).run(runId),
    () => db.prepare(DELETE_STRUCTURED_RUN_SOURCES_SQL).run(runId),
  ];
  const records = events.map((item, index) => ({ eventKey: `${item.id}|${item.startLocal}|${index}`, event: item }));
  for (let offset = 0; offset < records.length; offset += STRUCTURED_EVENT_WRITE_BATCH_SIZE) {
    statements.push(() => db.prepare(INSERT_STRUCTURED_EVENTS_SQL).run(runId, JSON.stringify(records.slice(offset, offset + STRUCTURED_EVENT_WRITE_BATCH_SIZE))));
  }
  statements.push(
    () => db.prepare(INSERT_STRUCTURED_RUN_SOURCES_SQL).run(runId, JSON.stringify([{ sourceId: 'source-a', sourceName: 'Source A', status: 'success', eventCount: events.length, latestEventDate: '2026-10-31', error: null }])),
    () => db.prepare(DELETE_OLD_STRUCTURED_EVENTS_SQL).run(STRUCTURED_RUN_RETENTION),
    () => db.prepare(DELETE_OLD_STRUCTURED_SOURCES_SQL).run(STRUCTURED_RUN_RETENTION),
    () => db.prepare(DELETE_OLD_STRUCTURED_RUNS_SQL).run(STRUCTURED_RUN_RETENTION),
  );
  db.exec('BEGIN');
  try {
    for (const statement of statements) statement();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return statements.length;
}

test('stores a long calendar as indexed event rows instead of one oversized JSON value', () => {
  const db = database();
  const events = Array.from({ length: 725 }, (_, index) => event(index));
  const statementCount = applyRun(db, 'run-one', '2026-09-02T12:00:00.000Z', events);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM structured_calendar_events').get().count, events.length);
  assert.equal(db.prepare('SELECT event_count FROM structured_calendar_runs').get().event_count, events.length);
  assert.equal(db.prepare('SELECT latest_event_date FROM structured_calendar_run_sources').get().latest_event_date, '2026-10-31');
  assert.equal(statementCount, 10);
  const saved = JSON.parse(db.prepare('SELECT event_json FROM structured_calendar_events ORDER BY event_key LIMIT 1').get().event_json);
  assert.match(saved.title, /Future family event/);
});

test('keeps only the newest three structured runs', () => {
  const db = database();
  for (let index = 1; index <= 4; index += 1) {
    applyRun(db, `run-${index}`, `2026-09-0${index}T12:00:00.000Z`, [event(index)]);
  }
  assert.deepEqual(db.prepare('SELECT run_id FROM structured_calendar_runs ORDER BY updated_at').all().map((row) => row.run_id), ['run-2', 'run-3', 'run-4']);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM structured_calendar_events').get().count, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM structured_calendar_run_sources').get().count, 3);
});

test('narrow diagnostic runs cannot evict the newest widest-window fallback', () => {
  const db = database();
  applyRun(db, 'run-wide', '2026-09-01T12:00:00.000Z', [event(1)], 60);
  for (let index = 2; index <= 4; index += 1) {
    applyRun(db, `run-narrow-${index}`, `2026-09-0${index}T12:00:00.000Z`, [event(index)], 7);
  }
  assert.deepEqual(db.prepare('SELECT run_id FROM structured_calendar_runs ORDER BY updated_at').all().map((row) => row.run_id), [
    'run-wide', 'run-narrow-2', 'run-narrow-3', 'run-narrow-4',
  ]);
});

test('the widest overlap wins when no run covers the full requested window', () => {
  const db = database();
  applyRun(db, 'run-wide', '2026-09-01T12:00:00.000Z', [event(1)], 60);
  applyRun(db, 'run-new-narrow', '2026-09-02T12:00:00.000Z', [event(2)], 7);
  const selected = db.prepare(SELECT_BEST_OVERLAPPING_STRUCTURED_RUN_SQL)
    .get('2026-11-01', '2026-09-03', '2026-09-03', '2026-11-02');
  assert.equal(selected.run_id, 'run-wide');
});

test('maximum structured horizon stays below the 50-query invocation budget', () => {
  const eventInsertStatements = Math.ceil(MAX_STRUCTURED_EVENTS / STRUCTURED_EVENT_WRITE_BATCH_SIZE);
  const writeStatements = 3 + eventInsertStatements + 1 + 3;
  const runtimeSchemaStatements = 13;
  const previousAndReadBackStatements = 7;
  assert.equal(MAX_STRUCTURED_EVENTS, 6_000);
  assert.ok(runtimeSchemaStatements + previousAndReadBackStatements + writeStatements < 50);
});
