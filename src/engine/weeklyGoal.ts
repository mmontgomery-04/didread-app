// The this-week strip and the weekly goal (SPEC section 8, batch 17). All deterministic; the date
// is passed in. The goal counts practice days (P6), Monday to Sunday, and never affects bands.
import { addDays, weekday } from './dates.ts';
import { practicedDates } from './practice.ts';
import type { Attempt, LocalDate } from './types.ts';

/** The goals a person can pick, in days a week (7 is "Every day"). */
export const WEEKLY_GOAL_CHOICES = [2, 3, 5, 7] as const;
/** "Not now" on onboarding, testers from before batch 17, and anything unexpected. */
export const DEFAULT_WEEKLY_GOAL = 3;

/** A saved goal, or the default when it's missing or not one of the choices. */
export function weeklyGoalOrDefault(goal: number | null | undefined): number {
  return WEEKLY_GOAL_CHOICES.some((c) => c === goal) ? (goal as number) : DEFAULT_WEEKLY_GOAL;
}

/** Monday of the week (Monday to Sunday) that `date` is in. */
export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, -((weekday(date) + 6) % 7));
}

/**
 * One day on the strip: practiced (✓), a past day without practice (○), or open (·): today before
 * it's practiced, and days still to come.
 */
export type DayMark = 'practiced' | 'missed' | 'open';

export interface WeekDay {
  date: LocalDate;
  mark: DayMark;
  isToday: boolean;
}

export interface ThisWeek {
  /** Monday to Sunday. */
  days: WeekDay[];
  /** Practice days so far this week. */
  practiced: number;
  goal: number;
  /** The goal is reached (it stays reached for the rest of the week). */
  met: boolean;
}

export function thisWeek(
  attempts: readonly Attempt[],
  freeWriteDates: readonly LocalDate[],
  today: LocalDate,
  goal: number,
): ThisWeek {
  const practiced = practicedDates(attempts, freeWriteDates);
  const monday = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i): WeekDay => {
    const date = addDays(monday, i);
    const mark: DayMark = practiced.has(date) ? 'practiced' : date < today ? 'missed' : 'open';
    return { date, mark, isToday: date === today };
  });
  const count = days.filter((d) => d.mark === 'practiced').length;
  return { days, practiced: count, goal, met: count >= goal };
}

/**
 * Finish: true when the read just submitted is the one that reached the goal. That's when it made
 * today a practice day (`raisedToday`) and this week's practice days now equal the goal exactly.
 */
export function reachedGoalWithThisRead(week: ThisWeek, raisedToday: boolean): boolean {
  return raisedToday && week.practiced === week.goal;
}
