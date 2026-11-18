// Local-date helpers. The current time is always passed in, never read here.
import type { LocalDate } from './types.ts';

/** The local calendar date ("YYYY-MM-DD") of an instant in a given IANA time zone. */
export function localDateFor(instantMs: number, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Adds (or subtracts) whole days to a local date. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Whole days since 1970-01-01 for a local date. Used to rotate wording by day
 * (docs/COPY.md: "pick one deterministically, for example by day number").
 */
export function dayNumber(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Day of the week for a local date: 0 = Sunday, 1 = Monday, … 6 = Saturday. */
export function weekday(date: LocalDate): number {
  // 1970-01-01 was a Thursday (4).
  return (((dayNumber(date) + 4) % 7) + 7) % 7;
}
