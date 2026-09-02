import { chicagoTodayKey } from '@/lib/live-event';
import { readSavedCalendar, unavailableCalendar } from '@/lib/calendar-read-model';
import CalendarExplorer from '@/app/calendar-explorer';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function Home() {
  const start = chicagoTodayKey();
  const initialData = await readSavedCalendar(start, 7).catch(() => unavailableCalendar(start, 7));
  return <CalendarExplorer initialData={initialData} />;
}

