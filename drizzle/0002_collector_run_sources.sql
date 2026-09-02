CREATE TABLE IF NOT EXISTS collector_run_sources (
  run_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL,
  applied INTEGER NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (run_id, source_id)
);
