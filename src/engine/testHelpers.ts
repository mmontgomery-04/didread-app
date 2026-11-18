// Builders for unit tests only. Not used by the app.
import { addDays } from './dates.ts';
import type { Attempt, Band, ExerciseSummary, Skill } from './types.ts';

let clock = 0;

/** A scored or unscored attempt with sensible defaults. Each call is later than the last. */
export function attempt(overrides: Partial<Attempt> & Pick<Attempt, 'skill'>): Attempt {
  clock += 1000;
  const result = overrides.result ?? 'pass';
  return {
    exerciseId: `${overrides.skill}-${clock}`,
    band: 'foundation',
    kind: 'daily',
    responseType: 'open_text',
    result,
    score: result === 'unscored' ? null : result === 'pass' ? 4 / 6 : 1 / 6,
    localDate: '2026-10-01',
    createdAt: clock,
    wordCount: 150,
    readingSeconds: 60,
    ...overrides,
  };
}

/** One attempt per day, starting at `start`, from a list of partial attempts. */
export function onSeparateDays(
  start: string,
  list: (Partial<Attempt> & Pick<Attempt, 'skill'>)[],
): Attempt[] {
  return list.map((a, i) => attempt({ localDate: addDays(start, i), ...a }));
}

export function exercise(skill: Skill, band: Band, sequence: number, status: ExerciseSummary['status'] = 'approved'): ExerciseSummary {
  return { id: `${skill}-${band}-${sequence}`, skill, band, sequence, status };
}
