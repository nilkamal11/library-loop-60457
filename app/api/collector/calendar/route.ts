import { addDays, chicagoTodayKey, type EventsResponse, type LiveEvent } from '@/lib/live-event';
import { collectorDatabase, ensureCollectorSchema, readCollectorEvents, readDailyCalendarSnapshot } from '@/lib/collector-db';

export const runtime = 'edge';

function mergeEvents(primary: EventsResponse, supplement: EventsResponse): EventsResponse {
  const deduped = new Map<string, LiveEvent>();
  for (const event of [...primary.events, ...supplement.events]) {
    const key = `${event.title.toLowerCase()}|${event.startLocal}|${event.venue.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, event);
  }
  return {
    ...primary,
    events: [...deduped.values()].sort((a, b) => a.startLocal.localeCompare(b.startLocal) || a.distance - b.distance),
    updatedAt: primary.updatedAt || supplement.updatedAt,
    sourceStatus: {
      attempted: primary.sourceStatus.attempted + supplement.sourceStatus.attempted,
      connected: primary.sourceStatus.connected + supplement.sourceStatus.connected,
      empty: primary.sourceStatus.empty + supplement.sourceStatus.empty,
      failed: primary.sourceStatus.failed + supplement.sourceStatus.failed,
      failedSources: [...primary.sourceStatus.failedSources, ...supplement.sourceStatus.failedSources],
      retained: (primary.sourceStatus.retained ?? 0) + (supplement.sourceStatus.retained ?? 0),
      retainedSources: [...(primary.sourceStatus.retainedSources ?? []), ...(supplement.sourceStatus.retainedSources ?? [])],
    },
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const requestedStart = query.get('start') ?? chicagoTodayKey();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart) ? requestedStart : chicagoTodayKey();
  const days = Math.min(7, Math.max(1, Number.parseInt(query.get('days') ?? '7', 10) || 7));
  const end = addDays(start, days);
  try {
    const database = collectorDatabase();
    await ensureCollectorSchema(database);
    const [daily, overnight] = await Promise.all([
      readDailyCalendarSnapshot(database, `${start}|${days}`),
      readCollectorEvents(database, start, end),
    ]);
    const result = daily ? mergeEvents(daily, overnight) : overnight;
    return Response.json(result, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return Response.json({ error: 'Saved calendar storage is temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
