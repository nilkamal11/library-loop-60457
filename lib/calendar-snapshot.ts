import { type EventsResponse } from '@/lib/live-event';

export async function fetchCalendarSnapshot(start: string, externalSignal?: AbortSignal): Promise<EventsResponse> {
  const response = await fetch(`/api/collector/calendar?start=${encodeURIComponent(start)}&days=7`, { signal: externalSignal });
  if (!response.ok) throw new Error('Saved calendar snapshot is unavailable');
  return response.json() as Promise<EventsResponse>;
}
