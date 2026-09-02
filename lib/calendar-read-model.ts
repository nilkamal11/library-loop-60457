import { addDays } from '@/lib/live-event';
import {
  collectorDatabase,
  ensureCollectorSchema,
  readCollectorEvents,
  readLatestDailyCalendarSnapshot,
} from '@/lib/collector-db';
import { mergeCalendarSnapshots } from '@/lib/calendar-merge';

export { unavailableCalendar } from '@/lib/calendar-merge';
export type { CalendarHealth, CalendarPayload } from '@/lib/calendar-merge';

export async function readSavedCalendar(start: string, days: number) {
  const database = await collectorDatabase();
  await ensureCollectorSchema(database);
  const endExclusive = addDays(start, days);
  const [daily, overnight] = await Promise.all([
    readLatestDailyCalendarSnapshot(database, start, endExclusive),
    readCollectorEvents(database, start, endExclusive),
  ]);
  return mergeCalendarSnapshots(daily, overnight, start, days);
}
