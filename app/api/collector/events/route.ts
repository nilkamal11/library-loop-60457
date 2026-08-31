import { addDays, chicagoTodayKey } from '@/lib/live-event';
import { collectorDatabase, ensureCollectorSchema, readCollectorEvents } from '@/lib/collector-db';

export const runtime = 'edge';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const requestedStart = query.get('start') ?? chicagoTodayKey();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart) ? requestedStart : chicagoTodayKey();
  const days = Math.min(7, Math.max(1, Number.parseInt(query.get('days') ?? '7', 10) || 7));
  const end = addDays(start, days);
  try {
    const database = collectorDatabase();
    await ensureCollectorSchema(database);
    const result = await readCollectorEvents(database, start, end);
    return Response.json({ ...result, window: { start, end, days } }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
  } catch {
    return Response.json({
      events: [],
      updatedAt: '',
      window: { start, end, days },
      sourceStatus: { attempted: 0, connected: 0, empty: 0, failed: 0, failedSources: [] },
      error: 'Overnight event storage is temporarily unavailable',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
