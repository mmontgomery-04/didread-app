// Daily limit (P5), practice days and streak (P6), and stamina (P7).
import { addDays } from './dates.ts';
import type { Attempt, LocalDate } from './types.ts';

const MAX_BONUS_PER_DAY = 2;
const MAX_READING_SECONDS = 600;

/** P5: today's daily exercise and bonus exercises. */
export interface DailyStatus {
  dailyDone: boolean;
  bonusRemaining: number;
}

export function dailyStatus(attempts: readonly Attempt[], today: LocalDate): DailyStatus {
  const submittedToday = attempts.filter((a) => a.localDate === today).length;
  const bonusDone = Math.max(0, submittedToday - 1);
  return {
    dailyDone: submittedToday > 0,
    bonusRemaining: submittedToday > 0 ? Math.max(0, MAX_BONUS_PER_DAY - bonusDone) : 0,
  };
}

/**
 * P6: a day counts when any response is submitted, including unscored ones, or when a
 * "Say it your way" free-write is saved (`freeWriteDates`: the local dates they were saved).
 */
export function practicedDates(attempts: readonly Attempt[], freeWriteDates: readonly LocalDate[] = []): Set<LocalDate> {
  return new Set([...attempts.map((a) => a.localDate), ...freeWriteDates]);
}

/**
 * P6: consecutive practiced days ending today if today is practiced, otherwise
 * ending yesterday. 0 if neither today nor yesterday was practiced.
 */
export function currentStreak(
  attempts: readonly Attempt[],
  today: LocalDate,
  freeWriteDates: readonly LocalDate[] = [],
): number {
  const days = practicedDates(attempts, freeWriteDates);
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** P6: distinct practiced days in the same calendar month as `today`. */
export function daysPracticedThisMonth(
  attempts: readonly Attempt[],
  today: LocalDate,
  freeWriteDates: readonly LocalDate[] = [],
): number {
  const month = today.slice(0, 7);
  return [...practicedDates(attempts, freeWriteDates)].filter((d) => d.slice(0, 7) === month && d <= today).length;
}

/** P7: seconds from passage open to question open, capped at 600. Times are passed in. */
export function readingSeconds(passageOpenedAtMs: number, questionOpenedAtMs: number): number {
  const seconds = Math.floor((questionOpenedAtMs - passageOpenedAtMs) / 1000);
  return Math.min(MAX_READING_SECONDS, Math.max(0, seconds));
}

/** P7: passage words read, optionally only on one local date. */
export function wordsRead(attempts: readonly Attempt[], onDate?: LocalDate): number {
  return attempts
    .filter((a) => onDate === undefined || a.localDate === onDate)
    .reduce((sum, a) => sum + a.wordCount, 0);
}

/** P7: total reading time in seconds. */
export function totalReadingSeconds(attempts: readonly Attempt[]): number {
  return attempts.reduce((sum, a) => sum + a.readingSeconds, 0);
}

/** Home card "About {minutes} min" (SPEC section 8): round up (word count ÷ 220) + 1. */
export function estimatedMinutes(wordCount: number): number {
  return Math.ceil(wordCount / 220) + 1;
}
