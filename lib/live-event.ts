export type SourceKind = 'Library' | 'Park district' | 'Forest preserve' | 'Recreation' | 'Family guide';

export type LiveEvent = {
  id: string;
  title: string;
  startLocal: string;
  endLocal?: string;
  dateKey: string;
  allDay: boolean;
  source: string;
  sourceKind: SourceKind;
  venue: string;
  address: string;
  distance: number;
  ages: string;
  family: boolean;
  category: string;
  tone: string;
  mark: string;
  description: string;
  registrationStatus: string;
  registrationUrl: string;
  url: string;
  scheduleNotice?: string;
};

export type EventsResponse = {
  events: LiveEvent[];
  updatedAt: string;
  window: { start: string; end: string; days: number };
  sourceStatus: {
    attempted: number;
    connected: number;
    empty: number;
    failed: number;
    failedSources: string[];
  };
};

export type DateStripItem = {
  key: string;
  day: string;
  date: string;
  label: string;
  shortLabel: string;
};

const dateOnlyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function chicagoTodayKey(date = new Date()) {
  const parts = dateOnlyFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function makeDateStrip(startKey: string, days = 7): DateStripItem[] {
  return Array.from({ length: days }, (_, index) => {
    const key = addDays(startKey, index);
    const date = new Date(`${key}T12:00:00Z`);
    return {
      key,
      day: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date),
      date: new Intl.DateTimeFormat('en-US', { day: '2-digit', timeZone: 'UTC' }).format(date),
      label: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date),
      shortLabel: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date),
    };
  });
}

function localAsUtc(value: string) {
  return new Date(`${value.replace(' ', 'T').slice(0, 19)}Z`);
}

export function formatEventTime(event: Pick<LiveEvent, 'startLocal' | 'allDay'>) {
  if (event.allDay) return { time: 'All day', period: '' };
  const formatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(localAsUtc(event.startLocal));
  const [time, period = ''] = formatted.split(' ');
  return { time, period };
}

export function formatDuration(event: Pick<LiveEvent, 'startLocal' | 'endLocal' | 'allDay'>) {
  if (event.allDay) return 'All day';
  if (!event.endLocal) return 'Time listed';
  const minutes = Math.round((localAsUtc(event.endLocal).getTime() - localAsUtc(event.startLocal).getTime()) / 60000);
  if (minutes <= 0 || minutes > 24 * 60) return 'Time listed';
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? 'hr' : 'hrs'}`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export function formatEventDateTime(event: Pick<LiveEvent, 'dateKey' | 'startLocal' | 'endLocal' | 'allDay'>) {
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${event.dateKey}T12:00:00Z`));
  if (event.allDay) return `${date} · All day`;
  const start = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(localAsUtc(event.startLocal));
  if (!event.endLocal) return `${date} · ${start} CT`;
  const end = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(localAsUtc(event.endLocal));
  return `${date} · ${start}–${end} CT`;
}
