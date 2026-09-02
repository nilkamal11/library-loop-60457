import test from 'node:test';
import assert from 'node:assert/strict';
import { CALENDAR_HORIZON_DAYS, calendarDays, isValidDateKey } from './calendar-config.ts';

test('calendar defaults to 60 days and clamps the public range safely', () => {
  assert.equal(calendarDays(null), CALENDAR_HORIZON_DAYS);
  assert.equal(calendarDays(''), CALENDAR_HORIZON_DAYS);
  assert.equal(calendarDays('not-a-number'), CALENDAR_HORIZON_DAYS);
  assert.equal(calendarDays('30days'), CALENDAR_HORIZON_DAYS);
  assert.equal(calendarDays('0'), 1);
  assert.equal(calendarDays('7'), 7);
  assert.equal(calendarDays('30'), 30);
  assert.equal(calendarDays('60'), 60);
  assert.equal(calendarDays('61'), 60);
});

test('calendar accepts only real ISO date keys', () => {
  assert.equal(isValidDateKey('2026-09-02'), true);
  assert.equal(isValidDateKey('2028-02-29'), true);
  assert.equal(isValidDateKey('2026-02-29'), false);
  assert.equal(isValidDateKey('2026-99-99'), false);
  assert.equal(isValidDateKey('September 2, 2026'), false);
});
