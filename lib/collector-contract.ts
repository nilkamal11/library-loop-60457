import type { LiveEvent } from '@/lib/live-event';
import { librarySources } from '@/collector/sources.mjs';
import { MAX_EVENTS_PER_BATCH, MAX_EVENTS_PER_SOURCE } from '@/lib/collector-limits.mjs';

export type CollectorStatus = 'success' | 'empty' | 'failed' | 'blocked';

export type CollectorSourceResult = {
  sourceId: string;
  sourceName: string;
  status: CollectorStatus;
  /** True only when the collector proved it scanned the complete configured window. */
  complete?: boolean;
  error?: string;
  events: LiveEvent[];
};

export type CollectorBatch = {
  runId: string;
  collectedAt: string;
  adapterVersion: string;
  sourceResults: CollectorSourceResult[];
};

// The reviewed local browser manifest is also the server write allowlist. A new
// source must be deliberately added to collector/sources.mjs before it can write.
export const OVERNIGHT_SOURCE_IDS = new Set<string>(librarySources.map((source) => source.id));

const SOURCE_KINDS = new Set(['Library', 'Park district', 'Forest preserve', 'Recreation', 'Family guide']);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function boundedString(value: unknown, max: number, required = true) {
  if (typeof value !== 'string') return false;
  const length = value.trim().length;
  return required ? length > 0 && length <= max : length <= max;
}

function safeHttpUrl(value: unknown) {
  if (!boundedString(value, 1200)) return false;
  try {
    return new URL(value as string).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isLiveEvent(value: unknown): value is LiveEvent {
  if (!isRecord(value)) return false;
  return boundedString(value.id, 260)
    && boundedString(value.title, 240)
    && boundedString(value.startLocal, 24) && LOCAL_TIME.test(value.startLocal as string)
    && (value.endLocal === undefined || (boundedString(value.endLocal, 24) && LOCAL_TIME.test(value.endLocal as string)))
    && boundedString(value.dateKey, 10) && DATE_KEY.test(value.dateKey as string)
    && (value.startLocal as string).slice(0, 10) === value.dateKey
    && typeof value.allDay === 'boolean'
    && boundedString(value.source, 180)
    && typeof value.sourceKind === 'string' && SOURCE_KINDS.has(value.sourceKind)
    && boundedString(value.venue, 240)
    && boundedString(value.address, 360)
    && typeof value.distance === 'number' && Number.isFinite(value.distance) && value.distance >= 0 && value.distance <= 15.5
    && boundedString(value.ages, 80)
    && typeof value.teenOnly === 'boolean'
    && typeof value.family === 'boolean'
    && boundedString(value.category, 60)
    && boundedString(value.tone, 40)
    && boundedString(value.mark, 20)
    && boundedString(value.description, 600, false)
    && boundedString(value.registrationStatus, 160)
    && safeHttpUrl(value.registrationUrl)
    && safeHttpUrl(value.url)
    && (value.scheduleNotice === undefined || boundedString(value.scheduleNotice, 180));
}

export function parseCollectorBatch(value: unknown): CollectorBatch | null {
  if (!isRecord(value)
    || !boundedString(value.runId, 100)
    || !/^[a-zA-Z0-9._:-]+$/.test(value.runId as string)
    || !boundedString(value.collectedAt, 40)
    || Number.isNaN(Date.parse(value.collectedAt as string))
    || !boundedString(value.adapterVersion, 60)
    || !Array.isArray(value.sourceResults)
    || value.sourceResults.length === 0
    || value.sourceResults.length > OVERNIGHT_SOURCE_IDS.size) return null;

  const seen = new Set<string>();
  let totalEvents = 0;
  const sourceResults: CollectorSourceResult[] = [];
  for (const candidate of value.sourceResults) {
    if (!isRecord(candidate)
      || !boundedString(candidate.sourceId, 100)
      || !OVERNIGHT_SOURCE_IDS.has(candidate.sourceId as string)
      || seen.has(candidate.sourceId as string)
      || !boundedString(candidate.sourceName, 180)
      || !['success', 'empty', 'failed', 'blocked'].includes(candidate.status as string)
      || (candidate.complete !== undefined && typeof candidate.complete !== 'boolean')
      || !Array.isArray(candidate.events)
      || candidate.events.length > MAX_EVENTS_PER_SOURCE
      || (candidate.error !== undefined && !boundedString(candidate.error, 500, false))) return null;

    const status = candidate.status as CollectorStatus;
    if ((status === 'failed' || status === 'blocked') && candidate.events.length !== 0) return null;
    if (status === 'empty' && candidate.events.length !== 0) return null;
    if (status === 'success' && candidate.events.length === 0) return null;
    if (!candidate.events.every(isLiveEvent)) return null;
    totalEvents += candidate.events.length;
    if (totalEvents > MAX_EVENTS_PER_BATCH) return null;
    seen.add(candidate.sourceId as string);
    sourceResults.push(candidate as unknown as CollectorSourceResult);
  }

  return {
    runId: value.runId as string,
    collectedAt: new Date(value.collectedAt as string).toISOString(),
    adapterVersion: value.adapterVersion as string,
    sourceResults,
  };
}
