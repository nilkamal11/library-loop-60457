import { COLLECTOR_SCHEMA } from '@/db/schema';
import type { CollectorBatch, CollectorSourceResult } from '@/lib/collector-contract';
import { addDays, type EventsResponse, type LiveEvent } from '@/lib/live-event';
import {
  BULK_DELETE_SUCCESS_EVENTS_SQL,
  BULK_INSERT_SUCCESS_EVENTS_SQL,
  BULK_UPSERT_SOURCE_COVERAGE_SQL,
  BULK_UPSERT_SOURCES_SQL,
  FINALIZE_SOURCE_ERRORS_SQL,
  INSERT_COLLECTOR_RUN_SQL,
  INSERT_RUN_SOURCE_RECEIPTS_SQL,
} from '@/lib/collector-sql.mjs';
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
} from '@/lib/structured-calendar-sql.mjs';

type CollectorEnv = Cloudflare.Env & {
  DB?: D1Database;
  LIBRARY_LOOP_INGEST_TOKEN?: string;
};

type EventRow = { event_json: string };
type SourceRow = {
  source_name: string;
  status: string;
  event_count: number;
  collected_at: string;
  error: string | null;
  last_success_at: string | null;
  complete: number;
};
type RunSourceRow = { source_id: string; applied: number; event_count: number };
type StructuredRunRow = {
  run_id: string;
  start_date: string;
  end_date: string;
  days: number;
  updated_at: string;
  source_status_json: string;
  event_count: number;
};

export type StructuredSourceReceipt = {
  sourceId: string;
  sourceName: string;
  status: 'success' | 'empty' | 'failed';
  eventCount: number;
  latestEventDate: string | null;
  error: string | null;
};

type SourceWriteRecord = {
  sourceId: string;
  sourceName: string;
  status: CollectorSourceResult['status'];
  complete: boolean;
  eventCount: number;
  collectedAt: string;
  lastSuccessAt: string | null;
  writeToken: string;
  finalError: string | null;
  consecutiveFailures: number;
  events: LiveEvent[];
};

export async function collectorEnv() {
  let bindings = {} as CollectorEnv;
  try {
    const workers = await import('cloudflare:workers');
    bindings = workers.env as CollectorEnv;
  } catch {
    // The Node preview server does not provide Cloudflare runtime bindings.
  }
  const processToken = typeof process === 'undefined' ? undefined : process.env.LIBRARY_LOOP_INGEST_TOKEN;
  return {
    ...bindings,
    LIBRARY_LOOP_INGEST_TOKEN: bindings.LIBRARY_LOOP_INGEST_TOKEN ?? processToken,
  } as CollectorEnv;
}

export async function collectorDatabase() {
  const database = (await collectorEnv()).DB;
  if (!database) throw new Error('Overnight event storage is not configured');
  return database;
}

export async function ensureCollectorSchema(database: D1Database) {
  await database.batch(COLLECTOR_SCHEMA.map((statement) => database.prepare(statement)));
}

export async function collectorRunExists(database: D1Database, runId: string) {
  const row = await database.prepare('SELECT run_id FROM collector_runs WHERE run_id = ? LIMIT 1').bind(runId).first<{ run_id: string }>();
  return Boolean(row);
}

function sourceError(result: CollectorSourceResult) {
  const defaultError = result.status === 'empty'
    ? 'No confidently publishable events were found; retained the last-known-good snapshot.'
    : 'Collection did not complete';
  return result.status === 'success' ? null : result.error?.trim().slice(0, 500) || defaultError;
}

function writeRecords(batch: CollectorBatch) {
  const sources: SourceWriteRecord[] = [];
  for (const result of batch.sourceResults) {
    const writeToken = `apply:${batch.runId}:${result.sourceId}:${batch.collectedAt}`;
    sources.push({
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      status: result.status,
      complete: result.complete === true,
      eventCount: result.status === 'success' ? result.events.length : 0,
      collectedAt: batch.collectedAt,
      lastSuccessAt: result.status === 'success' ? batch.collectedAt : null,
      writeToken,
      finalError: sourceError(result),
      consecutiveFailures: result.status === 'failed' || result.status === 'blocked' ? 1 : 0,
      events: result.status === 'success' ? result.events : [],
    });
  }
  return sources;
}

export async function writeCollectorBatch(database: D1Database, batch: CollectorBatch, bodyHash: string) {
  const sourcesJson = JSON.stringify(writeRecords(batch));
  const receivedAt = new Date().toISOString();
  await database.batch([
    database.prepare(BULK_UPSERT_SOURCES_SQL).bind(sourcesJson),
    database.prepare(BULK_UPSERT_SOURCE_COVERAGE_SQL).bind(sourcesJson),
    database.prepare(BULK_DELETE_SUCCESS_EVENTS_SQL).bind(sourcesJson),
    database.prepare(BULK_INSERT_SUCCESS_EVENTS_SQL).bind(sourcesJson),
    database.prepare(INSERT_RUN_SOURCE_RECEIPTS_SQL).bind(batch.runId, sourcesJson),
    database.prepare(INSERT_COLLECTOR_RUN_SQL).bind(
      batch.runId,
      batch.collectedAt,
      receivedAt,
      batch.adapterVersion,
      batch.sourceResults.length,
      bodyHash,
      batch.runId,
    ),
    database.prepare(FINALIZE_SOURCE_ERRORS_SQL).bind(sourcesJson, sourcesJson),
  ]);

  const receipt = await database.prepare(`SELECT source_id, applied, event_count
    FROM collector_run_sources WHERE run_id = ? ORDER BY source_id`).bind(batch.runId).all<RunSourceRow>();
  const applied = receipt.results.filter((row) => row.applied === 1);
  return {
    eventCount: applied.reduce((sum, row) => sum + row.event_count, 0),
    appliedSourceCount: applied.length,
    staleSourceIds: receipt.results.filter((row) => row.applied !== 1).map((row) => row.source_id),
  };
}

export async function readCollectorEvents(database: D1Database, start: string, end: string): Promise<EventsResponse> {
  const [eventRows, sourceRows] = await Promise.all([
    database.prepare(`SELECT event_json FROM collector_events
      WHERE event_date >= ? AND event_date < ?
      ORDER BY start_local ASC`).bind(start, end).all<EventRow>(),
    database.prepare(`SELECT source.source_name, source.status, source.event_count, source.collected_at,
        source.error, source.last_success_at, COALESCE(coverage.complete, 0) AS complete
      FROM collector_sources AS source
      LEFT JOIN collector_source_coverage AS coverage ON coverage.source_id = source.source_id
      ORDER BY source.source_name ASC`).all<SourceRow>(),
  ]);
  const rows = sourceRows.results;
  const retained = rows.filter((row) =>
    (row.status !== 'success' && Boolean(row.last_success_at))
    || (row.status === 'success' && row.complete !== 1));
  const retainedSourceNames = new Set(retained.map((row) => row.source_name));
  const events = eventRows.results.map((row) => {
    try {
      const event = JSON.parse(row.event_json) as LiveEvent;
      return retainedSourceNames.has(event.source) ? {
        ...event,
        scheduleNotice: event.scheduleNotice || 'Saved from a prior or incomplete source check — confirm details with the organizer.',
      } : event;
    } catch {
      throw new Error('Stored overnight event data is invalid');
    }
  });
  const connected = rows.filter((row) => row.status === 'success' || row.status === 'empty');
  const failed = rows.filter((row) => row.status === 'failed' || row.status === 'blocked');
  const updatedAt = rows.reduce((latest, row) => row.collected_at > latest ? row.collected_at : latest, '');
  return {
    events,
    updatedAt,
    window: { start, end, days: Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)) },
    sourceStatus: {
      attempted: rows.length,
      connected: connected.length,
      empty: rows.filter((row) => row.status === 'empty').length,
      failed: failed.length,
      failedSources: failed.map((row) => row.source_name),
      retained: retained.length,
      retainedSources: retained.map((row) => row.source_name),
    },
  };
}

function validStoredPayload(payload: EventsResponse) {
  return Array.isArray(payload.events)
    && Boolean(payload.sourceStatus)
    && typeof payload.updatedAt === 'string'
    && Boolean(payload.window);
}

function parseStoredEvents(rows: EventRow[]) {
  return rows.map((row) => {
    try {
      return JSON.parse(row.event_json) as LiveEvent;
    } catch {
      throw new Error('Stored structured event data is invalid');
    }
  });
}

async function readStructuredRun(
  database: D1Database,
  run: StructuredRunRow,
  start = run.start_date,
  endExclusive = addDays(run.end_date, 1),
): Promise<EventsResponse | null> {
  let sourceStatus: EventsResponse['sourceStatus'];
  try {
    sourceStatus = JSON.parse(run.source_status_json) as EventsResponse['sourceStatus'];
  } catch {
    return null;
  }
  if (!sourceStatus || !Number.isInteger(sourceStatus.attempted)) return null;
  const rows = await database.prepare(`SELECT event_json FROM structured_calendar_events
    WHERE run_id = ? AND event_date >= ? AND event_date < ?
    ORDER BY event_date ASC, start_local ASC`)
    .bind(run.run_id, start, endExclusive).all<EventRow>();
  return {
    events: parseStoredEvents(rows.results),
    updatedAt: run.updated_at,
    window: { start: run.start_date, end: run.end_date, days: run.days },
    sourceStatus,
  };
}

async function exactStructuredRun(database: D1Database, start: string, days: number) {
  return database.prepare(`SELECT run_id, start_date, end_date, days, updated_at, source_status_json, event_count
    FROM structured_calendar_runs
    WHERE start_date = ? AND days = ?
    ORDER BY updated_at DESC LIMIT 1`).bind(start, days).first<StructuredRunRow>();
}

async function latestStructuredRun(database: D1Database, start?: string, endExclusive?: string) {
  if (!start || !endExclusive) {
    return database.prepare(`SELECT run_id, start_date, end_date, days, updated_at, source_status_json, event_count
      FROM structured_calendar_runs ORDER BY updated_at DESC LIMIT 1`).first<StructuredRunRow>();
  }
  const requestedEnd = addDays(endExclusive, -1);
  const covering = await database.prepare(`SELECT run_id, start_date, end_date, days, updated_at, source_status_json, event_count
    FROM structured_calendar_runs
    WHERE start_date <= ? AND end_date >= ?
    ORDER BY updated_at DESC LIMIT 1`).bind(start, requestedEnd).first<StructuredRunRow>();
  if (covering) return covering;
  return database.prepare(SELECT_BEST_OVERLAPPING_STRUCTURED_RUN_SQL)
    .bind(requestedEnd, start, start, endExclusive).first<StructuredRunRow>();
}

async function legacyDailyCalendarSnapshot(database: D1Database, snapshotKey: string): Promise<EventsResponse | null> {
  const row = await database.prepare('SELECT payload_json FROM daily_calendar_snapshots WHERE snapshot_key = ? LIMIT 1')
    .bind(snapshotKey).first<{ payload_json: string }>();
  if (!row) return null;
  try {
    const payload = JSON.parse(row.payload_json) as EventsResponse;
    return validStoredPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export async function readDailyCalendarSnapshot(database: D1Database, snapshotKey: string): Promise<EventsResponse | null> {
  const [start, rawDays] = snapshotKey.split('|');
  const days = Number(rawDays);
  if (/^\d{4}-\d{2}-\d{2}$/.test(start) && Number.isInteger(days) && days > 0) {
    const run = await exactStructuredRun(database, start, days);
    if (run) {
      const payload = await readStructuredRun(database, run);
      if (payload) return payload;
    }
  }
  return legacyDailyCalendarSnapshot(database, snapshotKey);
}

export async function readLatestDailyCalendarSnapshot(
  database: D1Database,
  start?: string,
  endExclusive?: string,
): Promise<EventsResponse | null> {
  const structured = await latestStructuredRun(database, start, endExclusive);
  if (structured) {
    const payload = await readStructuredRun(database, structured, start, endExclusive);
    if (payload) return payload;
  }

  const rows = await database.prepare(`SELECT payload_json FROM daily_calendar_snapshots
    ORDER BY updated_at DESC LIMIT 25`).all<{ payload_json: string }>();
  let newestOverlap: EventsResponse | null = null;
  for (const row of rows.results) {
    try {
      const payload = JSON.parse(row.payload_json) as EventsResponse;
      if (!validStoredPayload(payload)) continue;
      if (!start || !endExclusive) return payload;
      const requestedEnd = addDays(endExclusive, -1);
      if (payload.window.start <= start && payload.window.end >= requestedEnd) return payload;
      if (!newestOverlap && payload.window.end >= start && payload.window.start < endExclusive) newestOverlap = payload;
    } catch {
      // Try the next newest snapshot rather than failing the entire saved calendar.
    }
  }
  return newestOverlap;
}

export async function writeDailyCalendarSnapshot(
  database: D1Database,
  snapshotKey: string,
  payload: EventsResponse,
  sourceReceipts: StructuredSourceReceipt[] = [],
) {
  if (payload.events.length > MAX_STRUCTURED_EVENTS) {
    throw new Error(`Structured calendar exceeds the ${MAX_STRUCTURED_EVENTS} event safety limit`);
  }
  const runId = `structured:${payload.updatedAt}:${snapshotKey}`;
  const eventRecords = payload.events.map((event, index) => ({
    eventKey: `${event.id}|${event.startLocal}|${index}`,
    event,
  }));
  const statements = [
    database.prepare(UPSERT_STRUCTURED_RUN_SQL).bind(
      runId,
      payload.window.start,
      payload.window.end,
      payload.window.days,
      payload.updatedAt,
      JSON.stringify(payload.sourceStatus),
      payload.events.length,
    ),
    database.prepare(DELETE_STRUCTURED_RUN_EVENTS_SQL).bind(runId),
    database.prepare(DELETE_STRUCTURED_RUN_SOURCES_SQL).bind(runId),
  ];
  for (let offset = 0; offset < eventRecords.length; offset += STRUCTURED_EVENT_WRITE_BATCH_SIZE) {
    statements.push(database.prepare(INSERT_STRUCTURED_EVENTS_SQL)
      .bind(runId, JSON.stringify(eventRecords.slice(offset, offset + STRUCTURED_EVENT_WRITE_BATCH_SIZE))));
  }
  if (sourceReceipts.length) {
    statements.push(database.prepare(INSERT_STRUCTURED_RUN_SOURCES_SQL).bind(runId, JSON.stringify(sourceReceipts)));
  }
  statements.push(
    database.prepare(DELETE_OLD_STRUCTURED_EVENTS_SQL).bind(STRUCTURED_RUN_RETENTION),
    database.prepare(DELETE_OLD_STRUCTURED_SOURCES_SQL).bind(STRUCTURED_RUN_RETENTION),
    database.prepare(DELETE_OLD_STRUCTURED_RUNS_SQL).bind(STRUCTURED_RUN_RETENTION),
  );
  await database.batch(statements);
  return { runId, eventCount: payload.events.length, statementCount: statements.length };
}
