CREATE TABLE IF NOT EXISTS structured_calendar_runs (
  run_id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  source_status_json TEXT NOT NULL,
  event_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS structured_calendar_runs_coverage_idx
ON structured_calendar_runs (start_date, end_date, updated_at);

CREATE TABLE IF NOT EXISTS structured_calendar_events (
  run_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  event_date TEXT NOT NULL,
  start_local TEXT NOT NULL,
  event_json TEXT NOT NULL,
  PRIMARY KEY (run_id, event_key)
);

CREATE INDEX IF NOT EXISTS structured_calendar_events_run_date_idx
ON structured_calendar_events (run_id, event_date, start_local);

CREATE TABLE IF NOT EXISTS structured_calendar_run_sources (
  run_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  status TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  latest_event_date TEXT,
  error TEXT,
  PRIMARY KEY (run_id, source_id)
);

CREATE INDEX IF NOT EXISTS structured_calendar_run_sources_status_idx
ON structured_calendar_run_sources (run_id, status, source_id);
