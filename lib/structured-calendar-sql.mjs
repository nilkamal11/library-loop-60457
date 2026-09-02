export const STRUCTURED_EVENT_WRITE_BATCH_SIZE = 300;
export const STRUCTURED_RUN_RETENTION = 3;
export const MAX_STRUCTURED_EVENTS = 6_000;

export const SELECT_BEST_OVERLAPPING_STRUCTURED_RUN_SQL = `SELECT
    run_id, start_date, end_date, days, updated_at, source_status_json, event_count,
    julianday(MIN(end_date, ?)) - julianday(MAX(start_date, ?)) AS overlap_days
  FROM structured_calendar_runs
  WHERE end_date >= ? AND start_date < ?
  ORDER BY overlap_days DESC, updated_at DESC
  LIMIT 1`;

export const UPSERT_STRUCTURED_RUN_SQL = `INSERT INTO structured_calendar_runs
  (run_id, start_date, end_date, days, updated_at, source_status_json, event_count)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(run_id) DO UPDATE SET
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    days = excluded.days,
    updated_at = excluded.updated_at,
    source_status_json = excluded.source_status_json,
    event_count = excluded.event_count`;

export const DELETE_STRUCTURED_RUN_EVENTS_SQL = 'DELETE FROM structured_calendar_events WHERE run_id = ?';
export const DELETE_STRUCTURED_RUN_SOURCES_SQL = 'DELETE FROM structured_calendar_run_sources WHERE run_id = ?';

export const INSERT_STRUCTURED_EVENTS_SQL = `INSERT INTO structured_calendar_events
  (run_id, event_key, event_date, start_local, event_json)
  SELECT
    ?,
    json_extract(incoming.value, '$.eventKey'),
    json_extract(incoming.value, '$.event.dateKey'),
    json_extract(incoming.value, '$.event.startLocal'),
    json_extract(incoming.value, '$.event')
  FROM json_each(?) AS incoming`;

export const INSERT_STRUCTURED_RUN_SOURCES_SQL = `INSERT INTO structured_calendar_run_sources
  (run_id, source_id, source_name, status, event_count, latest_event_date, error)
  SELECT
    ?,
    json_extract(incoming.value, '$.sourceId'),
    json_extract(incoming.value, '$.sourceName'),
    json_extract(incoming.value, '$.status'),
    CAST(json_extract(incoming.value, '$.eventCount') AS INTEGER),
    json_extract(incoming.value, '$.latestEventDate'),
    json_extract(incoming.value, '$.error')
  FROM json_each(?) AS incoming`;

export const DELETE_OLD_STRUCTURED_EVENTS_SQL = `DELETE FROM structured_calendar_events
  WHERE run_id NOT IN (
    SELECT run_id FROM (
      SELECT run_id FROM structured_calendar_runs ORDER BY updated_at DESC LIMIT ?
    )
    UNION
    SELECT run_id FROM (
      SELECT run_id FROM structured_calendar_runs
      WHERE days = (SELECT MAX(days) FROM structured_calendar_runs)
      ORDER BY updated_at DESC LIMIT 1
    )
  )`;

export const DELETE_OLD_STRUCTURED_SOURCES_SQL = `DELETE FROM structured_calendar_run_sources
  WHERE run_id NOT IN (
    SELECT run_id FROM (
      SELECT run_id FROM structured_calendar_runs ORDER BY updated_at DESC LIMIT ?
    )
    UNION
    SELECT run_id FROM (
      SELECT run_id FROM structured_calendar_runs
      WHERE days = (SELECT MAX(days) FROM structured_calendar_runs)
      ORDER BY updated_at DESC LIMIT 1
    )
  )`;

export const DELETE_OLD_STRUCTURED_RUNS_SQL = `DELETE FROM structured_calendar_runs
  WHERE run_id NOT IN (
    SELECT run_id FROM (
      SELECT run_id FROM structured_calendar_runs ORDER BY updated_at DESC LIMIT ?
    )
    UNION
    SELECT run_id FROM (
      SELECT run_id FROM structured_calendar_runs
      WHERE days = (SELECT MAX(days) FROM structured_calendar_runs)
      ORDER BY updated_at DESC LIMIT 1
    )
  )`;
