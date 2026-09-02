export const CALENDAR_HORIZON_DAYS = 60;
export const CALENDAR_RANGE_OPTIONS = [7, 30, CALENDAR_HORIZON_DAYS] as const;
export const CALENDAR_STALE_HOURS = 36;

export function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function calendarDays(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  if (!/^\d+$/.test(normalized)) return CALENDAR_HORIZON_DAYS;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) return CALENDAR_HORIZON_DAYS;
  return Math.min(CALENDAR_HORIZON_DAYS, Math.max(1, parsed));
}
