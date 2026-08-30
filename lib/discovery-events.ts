import { type EventsResponse } from '@/lib/live-event';

function failedDiscovery(start: string): Pick<EventsResponse, 'events' | 'sourceStatus'> {
  return {
    events: [],
    sourceStatus: {
      attempted: 1,
      connected: 0,
      empty: 0,
      failed: 1,
      failedSources: ['KiddoChicago'],
    },
  };
}

export async function fetchDiscoveryEvents(start: string, externalSignal?: AbortSignal) {
  try {
    const signal = externalSignal ? AbortSignal.any([externalSignal, AbortSignal.timeout(22000)]) : AbortSignal.timeout(22000);
    const response = await fetch(`/api/discovery-events?start=${start}&days=7&discovery_version=3`, { signal });
    if (!response.ok) return failedDiscovery(start);
    return await response.json() as EventsResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && externalSignal?.aborted) throw error;
    return failedDiscovery(start);
  }
}
