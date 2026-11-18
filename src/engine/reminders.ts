// Daily reminder rules (SPEC section 8, "Daily reminder", batch 11a). Pure: today's date and
// the current time are passed in. Scheduling itself lives in src/notifications/.
import { addDays, dayNumber } from './dates.ts';
import type { LocalDate } from './types.ts';

export interface ReminderTime {
  hour: number;
  minute: number;
}

/** The time used the first time the reminder is turned on. */
export const DEFAULT_REMINDER_TIME: ReminderTime = { hour: 8, minute: 0 };

/** A repeating notification can't change its text, so one is scheduled per day, this far ahead. */
export const REMINDER_DAYS_AHEAD = 30;

/** Marks the app's daily reminders among the phone's scheduled notifications. */
export const REMINDER_KIND = 'daily-reminder';

/** Stored with each scheduled reminder, so the setting can be read back from the phone. */
export interface ReminderData {
  kind: typeof REMINDER_KIND;
  date: LocalDate;
  hour: number;
  minute: number;
}

/**
 * The local dates to schedule: the next `days` days at `time`, starting today if that time
 * hasn't come yet (`nowMinutes` = minutes since local midnight), otherwise tomorrow.
 */
export function reminderDates(
  today: LocalDate,
  nowMinutes: number,
  time: ReminderTime,
  days: number = REMINDER_DAYS_AHEAD,
): LocalDate[] {
  const first = nowMinutes < time.hour * 60 + time.minute ? today : addDays(today, 1);
  return Array.from({ length: days }, (_, i) => addDays(first, i));
}

/** Which reminder text a date gets: local day number modulo the number of texts (like rotateByDay). */
export function reminderTextIndex(date: LocalDate, textCount: number): number {
  return dayNumber(date) % textCount;
}

/**
 * The reminder setting, read back from the data of the phone's scheduled notifications: on if any
 * daily reminder is scheduled, at the time of the earliest one. Anything else is ignored.
 */
export function reminderSettingFrom(scheduled: readonly unknown[]): { on: boolean; time: ReminderTime | null } {
  const reminders = scheduled.filter(isReminderData).sort((a, b) => a.date.localeCompare(b.date));
  if (reminders.length === 0) return { on: false, time: null };
  const { hour, minute } = reminders[0];
  return { on: true, time: { hour, minute } };
}

function isReminderData(value: unknown): value is ReminderData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.kind === REMINDER_KIND &&
    typeof v.date === 'string' &&
    Number.isInteger(v.hour) &&
    Number.isInteger(v.minute)
  );
}
