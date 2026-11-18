// Weekly recap (SPEC section 8, batch 3c). All deterministic; the date is passed in.
import { addDays, weekday } from './dates.ts';
import { practicedDates, wordsRead } from './practice.ts';
import { SKILLS } from './types.ts';
import type { Attempt, LocalDate, Skill } from './types.ts';

export interface WeeklyRecap {
  /** Monday of the week the recap covers (Monday through Sunday). */
  weekStart: LocalDate;
  daysPracticed: number;
  wordsRead: number;
  /** Every submitted exercise that week: daily, bonus, review, repeat, including unscored. */
  readsFinished: number;
  /** Most exercises that week; ties broken by the fixed skill order. Null if none. */
  mostPracticed: Skill | null;
}

/**
 * The week the recap covers on `today`: on Sunday, Monday–Sunday of this week; on Monday,
 * the week that just ended. Null on every other day (no recap).
 */
export function recapWeekStart(today: LocalDate): LocalDate | null {
  const day = weekday(today);
  if (day === 0) return addDays(today, -6);
  if (day === 1) return addDays(today, -7);
  return null;
}

/**
 * Today's recap, or null when it's hidden: not Sunday or Monday, 0 days practiced that week,
 * or "Nice" already tapped for that week (`dismissedWeekStart`). `attempts` must not include
 * test-panel attempts. Free-writes count toward days practiced only (P6), not skills.
 */
export function weeklyRecap(
  attempts: readonly Attempt[],
  freeWriteDates: readonly LocalDate[],
  today: LocalDate,
  dismissedWeekStart: LocalDate | null = null,
): WeeklyRecap | null {
  const weekStart = recapWeekStart(today);
  if (!weekStart || weekStart === dismissedWeekStart) return null;
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (date: LocalDate) => date >= weekStart && date <= weekEnd;

  const weekAttempts = attempts.filter((a) => inWeek(a.localDate));
  const daysPracticed = [...practicedDates(weekAttempts, freeWriteDates.filter(inWeek))].length;
  if (daysPracticed === 0) return null;

  const count = (skill: Skill) => weekAttempts.filter((a) => a.skill === skill).length;
  const top = SKILLS.reduce((best, skill) => (count(skill) > count(best) ? skill : best), SKILLS[0]);

  return {
    weekStart,
    daysPracticed,
    wordsRead: wordsRead(weekAttempts),
    readsFinished: weekAttempts.length,
    mostPracticed: count(top) > 0 ? top : null,
  };
}
