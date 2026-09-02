import { chicagoTodayKey } from '@/lib/live-event';
import { CALENDAR_HORIZON_DAYS } from '@/lib/calendar-config';
import { readSavedCalendar, unavailableCalendar } from '@/lib/calendar-read-model';
import CalendarExplorer from '@/app/calendar-explorer';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function Home() {
  const start = chicagoTodayKey();
  const initialData = await readSavedCalendar(start, CALENDAR_HORIZON_DAYS)
    .catch(() => unavailableCalendar(start, CALENDAR_HORIZON_DAYS));
  return <CalendarExplorer initialData={initialData} />;
}
