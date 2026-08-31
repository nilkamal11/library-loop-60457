// Each statement consumes one D1 query regardless of the number of sources or
// events encoded in its JSON parameter. writeCollectorBatch executes these in
// one D1 batch so a failure rolls back the complete collection run.
export const BULK_UPSERT_SOURCES_SQL = `INSERT INTO collector_sources
  (source_id, source_name, status, event_count, collected_at, last_success_at, error, consecutive_failures)
  SELECT
    json_extract(incoming.value, '$.sourceId'),
    json_extract(incoming.value, '$.sourceName'),
    json_extract(incoming.value, '$.status'),
    CAST(json_extract(incoming.value, '$.eventCount') AS INTEGER),
    json_extract(incoming.value, '$.collectedAt'),
    json_extract(incoming.value, '$.lastSuccessAt'),
    json_extract(incoming.value, '$.writeToken'),
    CAST(json_extract(incoming.value, '$.consecutiveFailures') AS INTEGER)
  FROM json_each(?) AS incoming
  WHERE 1
  ON CONFLICT(source_id) DO UPDATE SET
    source_name = excluded.source_name,
    status = excluded.status,
    event_count = CASE
      WHEN excluded.status = 'success' THEN excluded.event_count
      ELSE collector_sources.event_count
    END,
    collected_at = excluded.collected_at,
    last_success_at = CASE
      WHEN excluded.status = 'success' THEN excluded.last_success_at
      ELSE collector_sources.last_success_at
    END,
    error = excluded.error,
    consecutive_failures = CASE
      WHEN excluded.status IN ('success', 'empty') THEN 0
      ELSE collector_sources.consecutive_failures + 1
    END
  WHERE collector_sources.collected_at < excluded.collected_at`;

export const BULK_DELETE_SUCCESS_EVENTS_SQL = `DELETE FROM collector_events
  WHERE source_id IN (
    SELECT json_extract(incoming.value, '$.sourceId')
    FROM json_each(?) AS incoming
    JOIN collector_sources AS source
      ON source.source_id = json_extract(incoming.value, '$.sourceId')
      AND source.error = json_extract(incoming.value, '$.writeToken')
    WHERE json_extract(incoming.value, '$.status') = 'success'
  )`;

export const BULK_INSERT_SUCCESS_EVENTS_SQL = `INSERT INTO collector_events
  (source_id, event_id, event_date, start_local, event_json, collected_at)
  SELECT
    json_extract(incoming.value, '$.sourceId'),
    json_extract(event.value, '$.id'),
    json_extract(event.value, '$.dateKey'),
    json_extract(event.value, '$.startLocal'),
    event.value,
    json_extract(incoming.value, '$.collectedAt')
  FROM json_each(?) AS incoming
  JOIN json_each(incoming.value, '$.events') AS event
  JOIN collector_sources AS source
    ON source.source_id = json_extract(incoming.value, '$.sourceId')
    AND source.error = json_extract(incoming.value, '$.writeToken')`;

export const INSERT_RUN_SOURCE_RECEIPTS_SQL = `INSERT INTO collector_run_sources
  (run_id, source_id, status, applied, event_count)
  SELECT
    ?,
    json_extract(incoming.value, '$.sourceId'),
    json_extract(incoming.value, '$.status'),
    CASE WHEN source.error = json_extract(incoming.value, '$.writeToken') THEN 1 ELSE 0 END,
    CASE
      WHEN source.error = json_extract(incoming.value, '$.writeToken')
        AND json_extract(incoming.value, '$.status') = 'success'
      THEN CAST(json_extract(incoming.value, '$.eventCount') AS INTEGER)
      ELSE 0
    END
  FROM json_each(?) AS incoming
  LEFT JOIN collector_sources AS source
    ON source.source_id = json_extract(incoming.value, '$.sourceId')`;

export const INSERT_COLLECTOR_RUN_SQL = `INSERT INTO collector_runs
  (run_id, collected_at, received_at, adapter_version, source_count, event_count, body_hash)
  SELECT ?, ?, ?, ?, ?, COALESCE(SUM(event_count), 0), ?
  FROM collector_run_sources
  WHERE run_id = ?`;

export const FINALIZE_SOURCE_ERRORS_SQL = `UPDATE collector_sources AS source
  SET error = (
    SELECT json_extract(incoming.value, '$.finalError')
    FROM json_each(?) AS incoming
    WHERE json_extract(incoming.value, '$.sourceId') = source.source_id
      AND json_extract(incoming.value, '$.writeToken') = source.error
    LIMIT 1
  )
  WHERE EXISTS (
    SELECT 1
    FROM json_each(?) AS incoming
    WHERE json_extract(incoming.value, '$.sourceId') = source.source_id
      AND json_extract(incoming.value, '$.writeToken') = source.error
  )`;
