// Analytics: the 5 minimum events (SPEC section 10 and decision log, 2026-10-02), saved in our own
// database's `events` table through the outbox, so events made with no signal are sent later.
// Plain TypeScript, so the rules for when an event counts are unit-tested.
import type { AttemptKind, LocalDate } from '../engine/index.ts';

export type EventName = 'app_open' | 'exercise_started' | 'exercise_completed' | 'feedback_unscored' | 'day_practiced';

/** The exercise an exercise event is about. */
export interface EventExercise {
  exerciseId: string;
  kind: AttemptKind;
}

/** The row saved in `events` (supabase/migrations/20261002120000_analytics_events.sql). */
export function eventRow(name: EventName, occurredAtMs: number, localDate: LocalDate, exercise?: EventExercise) {
  return {
    name,
    local_date: localDate,
    exercise_id: exercise?.exerciseId ?? null,
    kind: exercise?.kind ?? null,
    occurred_at: new Date(occurredAtMs).toISOString(),
  };
}

/**
 * app_open: the app comes back after being in the background (it may pass through "inactive" on
 * the way). Brief interruptions that never left the screen (Control Center, the app switcher, a
 * notification pulled down) only go "inactive", so they don't count. Returns the new
 * "was in the background" flag and whether this change is an app_open.
 */
export function appStateStep(wasInBackground: boolean, next: string): { wasInBackground: boolean; opened: boolean } {
  if (next === 'background') return { wasInBackground: true, opened: false };
  if (next === 'active') return { wasInBackground: false, opened: wasInBackground };
  return { wasInBackground, opened: false };
}
