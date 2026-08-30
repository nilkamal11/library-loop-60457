import { env } from 'cloudflare:workers';
import { COLLECTOR_SCHEMA } from '@/db/schema';
import type { CollectorBatch, CollectorSourceResult } from '@/lib/collector-contract';
import type { EventsResponse, LiveEvent } from '@/lib/live-event';

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

async function writeSuccessfulSource(database: D1Database, result: CollectorSourceResult, collectedAt: string) {
  const statements = [database.prepare('DELETE FROM collector_events WHERE source_id = ?').bind(result.sourceId)];
  for (const event of result.events) {
    statements.push(database.prepare(`INSERT INTO collector_events
      (source_id, event_id, event_date, start_local, event_json, collected_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(result.sourceId, event.id, event.dateKey, event.startLocal, JSON.stringify(event), collectedAt));
  }
  statements.push(database.prepare(`INSERT INTO collector_sources
    (source_id, source_name, status, event_count, collected_at, last_success_at, error, consecutive_failures)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 0)
    ON CONFLICT(source_id) DO UPDATE SET
      source_name = excluded.source_name,
      status = excluded.status,
      event_count = excluded.event_count,
      collected_at = excluded.collected_at,
      last_success_at = excluded.last_success_at,
      error = NULL,
      consecutive_failures = 0`)
    .bind(result.sourceId, result.sourceName, result.status, result.events.length, collectedAt, collectedAt));
  await database.batch(statements);
}

async function writeFailedSource(database: D1Database, result: CollectorSourceResult, collectedAt: string) {
  await database.prepare(`INSERT INTO collector_sources
    (source_id, source_name, status, event_count, collected_at, last_success_at, error, consecutive_failures)
    VALUES (?, ?, ?, 0, ?, NULL, ?, 1)
    ON CONFLICT(source_id) DO UPDATE SET
      source_name = excluded.source_name,
      status = excluded.status,
      collected_at = excluded.collected_at,
      error = excluded.error,
      consecutive_failures = collector_sources.consecutive_failures + 1`)
    .bind(result.sourceId, result.sourceName, result.status, collectedAt, result.error?.trim().slice(0, 500) || 'Collection did not complete')
    .run();
}

export async function writeCollectorBatch(database: D1Database, batch: CollectorBatch, bodyHash: string) {
  for (const result of batch.sourceResults) {
    if (result.status === 'success' || result.status === 'empty') await writeSuccessfulSource(database, result, batch.collectedAt);
    else await writeFailedSource(database, result, batch.collectedAt);
  }
  const eventCount = batch.sourceResults.reduce((sum, result) => sum + result.events.length, 0);
  await database.prepare(`INSERT INTO collector_runs
    (run_id, collected_at, received_at, adapter_version, source_count, event_count, body_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(batch.runId, batch.collectedAt, new Date().toISOString(), batch.adapterVersion, batch.sourceResults.length, eventCount, bodyHash)
    .run();
  return eventCount;
}

export async function readCollectorEvents(database: D1Database, start: string, end: string): Promise<Pick<EventsResponse, 'events' | 'sourceStatus'>> {
  const [eventRows, sourceRows] = await Promise.all([
    database.prepare(`SELECT event_json FROM collector_events
      WHERE event_date >= ? AND event_date < ?
      ORDER BY start_local ASC`).bind(start, end).all<EventRow>(),
    database.prepare(`SELECT source_name, status, event_count, error FROM collector_sources
      ORDER BY source_name ASC`).all<SourceRow>(),
  ]);
  const events = eventRows.results.flatMap((row) => {
    try {
      return [JSON.parse(row.event_json) as LiveEvent];
    } catch {
      return [];
    }
  });
  const rows = sourceRows.results;
  const connected = rows.filter((row) => row.status === 'success' || row.status === 'empty');
  const failed = rows.filter((row) => row.status === 'failed' || row.status === 'blocked');
  return {
    events,
    sourceStatus: {
      attempted: rows.length,
      connected: connected.length,
      empty: connected.filter((row) => row.event_count === 0).length,
      failed: failed.length,
      failedSources: failed.map((row) => row.source_name),
    },
  };
}
