import { chicagoTodayKey, type EventsResponse } from '@/lib/live-event';

export async function fetchDailyEvents(start: string, externalSignal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<EventsResponse> {
  const snapshot = chicagoTodayKey();
  const signal = externalSignal;
  const response = await fetchImpl(`/api/events?start=${encodeURIComponent(start)}&days=7&snapshot=${snapshot}`, {
    signal,
    cache: 'force-cache',
  });
  if (!response.ok) throw new Error('Daily calendar snapshot is unavailable');
  return response.json() as Promise<EventsResponse>;
}
