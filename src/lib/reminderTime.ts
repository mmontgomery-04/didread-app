// Small helpers for showing and storing a reminder time (Settings and Onboarding).
import type { ReminderTime } from '@/engine';

/** A Date on an arbitrary day at this time (for the time wheel). */
export function asDate(time: ReminderTime): Date {
  return new Date(2000, 0, 1, time.hour, time.minute);
}

/** In the phone's own format, e.g. "8:00 AM". */
export function formatTime(time: ReminderTime): string {
  return asDate(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** As the database's `time` type, e.g. "08:00:00" (profiles.reminder_time). */
export function toDbTime(time: ReminderTime): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(time.hour)}:${pad(time.minute)}:00`;
}
