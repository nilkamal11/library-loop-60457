import { env } from 'cloudflare:workers';
import { COLLECTOR_SCHEMA } from '@/db/schema';
import type { CollectorBatch, CollectorSourceResult } from '@/lib/collector-contract';
import type { EventsResponse, LiveEvent } from '@/lib/live-event';
import {
  BULK_DELETE_SUCCESS_EVENTS_SQL,
  BULK_INSERT_SUCCESS_EVENTS_SQL,
  BULK_UPSERT_SOURCES_SQL,
  FINALIZE_SOURCE_ERRORS_SQL,
  INSERT_COLLECTOR_RUN_SQL,
  INSERT_RUN_SOURCE_RECEIPTS_SQL,
} from '@/lib/collector-sql.mjs';

type CollectorEnv = Cloudflare.Env & {
  DB?: D1Database;
  LIBRARY_LOOP_INGEST_TOKEN?: string;
};

type EventRow = { event_json: string };
type SourceRow = {
  source_name: string;
  status: string;
  event_count: number;
  error: string | null;
  last_success_at: string | null;
};
type RunSourceRow = { source_id: string; applied: number; event_count: number };

type SourceWriteRecord = {
  sourceId: string;
  sourceName: string;
  status: CollectorSourceResult['status'];
  eventCount: number;
  collectedAt: string;
  lastSuccessAt: string | null;
  writeToken: string;
  finalError: string | null;
  consecutiveFailures: number;
  events: LiveEvent[];
};

export function collectorEnv() {
  const bindings = env as CollectorEnv;
  return {
    ...bindings,
    LIBRARY_LOOP_INGEST_TOKEN: bindings.LIBRARY_LOOP_INGEST_TOKEN ?? process.env.LIBRARY_LOOP_INGEST_TOKEN,
  } as CollectorEnv;
}

export function collectorDatabase() {
  const database = collectorEnv().DB;
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

export async function readCollectorEvents(database: D1Database, start: string, end: string): Promise<Pick<EventsResponse, 'events' | 'sourceStatus'>> {
  const [eventRows, sourceRows] = await Promise.all([
    database.prepare(`SELECT event_json FROM collector_events
      WHERE event_date >= ? AND event_date < ?
      ORDER BY start_local ASC`).bind(start, end).all<EventRow>(),
    database.prepare(`SELECT source_name, status, event_count, error, last_success_at FROM collector_sources
      ORDER BY source_name ASC`).all<SourceRow>(),
  ]);
  const events = eventRows.results.map((row) => {
    try {
      return JSON.parse(row.event_json) as LiveEvent;
    } catch {
      throw new Error('Stored overnight event data is invalid');
    }
  });
  const rows = sourceRows.results;
  const connected = rows.filter((row) => row.status === 'success' || row.status === 'empty');
  const failed = rows.filter((row) => row.status === 'failed' || row.status === 'blocked');
  const retained = rows.filter((row) => row.status !== 'success' && Boolean(row.last_success_at));
  return {
    events,
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
