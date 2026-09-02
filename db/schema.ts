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
  `CREATE TABLE IF NOT EXISTS collector_source_coverage (
    source_id TEXT PRIMARY KEY,
    complete INTEGER NOT NULL DEFAULT 0,
    collected_at TEXT NOT NULL
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
  `CREATE TABLE IF NOT EXISTS structured_calendar_runs (
    run_id TEXT PRIMARY KEY,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    source_status_json TEXT NOT NULL,
    event_count INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS structured_calendar_runs_coverage_idx ON structured_calendar_runs (start_date, end_date, updated_at)',
  `CREATE TABLE IF NOT EXISTS structured_calendar_events (
    run_id TEXT NOT NULL,
    event_key TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_local TEXT NOT NULL,
    event_json TEXT NOT NULL,
    PRIMARY KEY (run_id, event_key)
  )`,
  'CREATE INDEX IF NOT EXISTS structured_calendar_events_run_date_idx ON structured_calendar_events (run_id, event_date, start_local)',
  `CREATE TABLE IF NOT EXISTS structured_calendar_run_sources (
    run_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    status TEXT NOT NULL,
    event_count INTEGER NOT NULL,
    latest_event_date TEXT,
    error TEXT,
    PRIMARY KEY (run_id, source_id)
  )`,
  'CREATE INDEX IF NOT EXISTS structured_calendar_run_sources_status_idx ON structured_calendar_run_sources (run_id, status, source_id)',
] as const;
