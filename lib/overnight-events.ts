import type { EventsResponse } from '@/lib/live-event';

type EventSupplement = Pick<EventsResponse, 'events' | 'sourceStatus'>;

export async function fetchOvernightEvents(start: string, externalSignal?: AbortSignal): Promise<EventSupplement> {
  const empty: EventSupplement = {
    events: [],
    sourceStatus: { attempted: 0, connected: 0, empty: 0, failed: 0, failedSources: [] },
  };
  try {
    const signal = externalSignal ? AbortSignal.any([externalSignal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
    const response = await fetch(`/api/collector/events?start=${encodeURIComponent(start)}&days=7`, { signal });
    if (!response.ok) return empty;
    return await response.json() as EventSupplement;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && externalSignal?.aborted) throw error;
    return empty;
  }
}
