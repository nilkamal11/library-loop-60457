export const COLLECTOR_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS collector_runs (
    run_id TEXT PRIMARY KEY,
    collected_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    adapter_version TEXT NOT NULL,
    source_count INTEGER NOT NULL,
    event_count INTEGER NOT NULL,
    body_hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS collector_sources (
    source_id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    status TEXT NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 0,
    collected_at TEXT NOT NULL,
    last_success_at TEXT,
    error TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS collector_run_sources (
    run_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    status TEXT NOT NULL,
    applied INTEGER NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (run_id, source_id)
  )`,
  `CREATE TABLE IF NOT EXISTS collector_events (
    source_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_local TEXT NOT NULL,
    event_json TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    PRIMARY KEY (source_id, event_id)
  )`,
  'CREATE INDEX IF NOT EXISTS collector_events_date_idx ON collector_events (event_date, start_local)',
  `CREATE TABLE IF NOT EXISTS daily_calendar_snapshots (
    snapshot_key TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
] as const;
