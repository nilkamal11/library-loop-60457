import { chicagoTodayKey } from '@/lib/live-event';
import { readSavedCalendar } from '@/lib/calendar-read-model';

export const runtime = 'edge';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const requestedStart = query.get('start') ?? chicagoTodayKey();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart) ? requestedStart : chicagoTodayKey();
  const days = Math.min(7, Math.max(1, Number.parseInt(query.get('days') ?? '7', 10) || 7));
  try {
    const payload = await readSavedCalendar(start, days);
    return Response.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' },
    });
  } catch {
    return Response.json(
      { error: 'The saved calendar is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

