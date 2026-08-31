import type { EventsResponse } from '@/lib/live-event';
import { librarySources } from '../collector/sources.mjs';

type EventSupplement = Pick<EventsResponse, 'events' | 'sourceStatus'>;

function unavailableSupplement(): EventSupplement {
  return {
    events: [],
    sourceStatus: {
      attempted: librarySources.length,
      connected: 0,
      empty: 0,
      failed: librarySources.length,
      failedSources: librarySources.map((source) => source.name),
    },
  };
}

function isEventSupplement(value: unknown): value is EventSupplement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.events) || !candidate.sourceStatus || typeof candidate.sourceStatus !== 'object' || Array.isArray(candidate.sourceStatus)) return false;
  const status = candidate.sourceStatus as Record<string, unknown>;
  return ['attempted', 'connected', 'empty', 'failed'].every((key) => typeof status[key] === 'number')
    && Array.isArray(status.failedSources);
}

export async function fetchOvernightEvents(start: string, externalSignal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<EventSupplement> {
  try {
    const signal = externalSignal ? AbortSignal.any([externalSignal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
    const response = await fetchImpl(`/api/collector/events?start=${encodeURIComponent(start)}&days=7`, { signal });
    if (!response.ok) return unavailableSupplement();
    const payload: unknown = await response.json();
    return isEventSupplement(payload) ? payload : unavailableSupplement();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && externalSignal?.aborted) throw error;
    return unavailableSupplement();
  }
}
