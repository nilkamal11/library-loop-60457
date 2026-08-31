CREATE TABLE IF NOT EXISTS daily_calendar_snapshots (
  snapshot_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
