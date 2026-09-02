import { chicagoTodayKey } from '@/lib/live-event';
import { calendarDays, isValidDateKey } from '@/lib/calendar-config';
import { readSavedCalendar } from '@/lib/calendar-read-model';

export const runtime = 'edge';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const requestedStart = query.get('start') ?? chicagoTodayKey();
  const start = isValidDateKey(requestedStart) ? requestedStart : chicagoTodayKey();
  const days = calendarDays(query.get('days'));
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
