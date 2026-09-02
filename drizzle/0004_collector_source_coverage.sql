CREATE TABLE IF NOT EXISTS collector_source_coverage (
  source_id TEXT PRIMARY KEY,
  complete INTEGER NOT NULL DEFAULT 0,
  collected_at TEXT NOT NULL
);
