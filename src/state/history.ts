// Turning saved rows back into the engine's shapes (batch 9). The attempts log in the database is
// the record of truth (SPEC section 7): everything else, bands included, is recomputed from it.
// Plain TypeScript, unit-tested.
import { isWrittenAnswer } from '../engine/index.ts';
import type { Attempt, AttemptKind, AttemptResult, Band, FreeWrite, ResponseType, Skill, SkillStates } from '../engine/index.ts';

export interface AttemptRow {
  exercise_id: string;
  kind: AttemptKind;
  local_date: string;
  response_type: ResponseType;
  result: AttemptResult;
  total: number | null;
  reading_seconds: number;
  created_at: string;
}

export interface FreeWriteRow {
  prompt_id: string;
  text: string;
  local_date: string;
  created_at: string;
}

/** What the engine needs to know about the exercise an attempt answered. */
export interface ExerciseFacts {
  skill: Skill;
  band: Band;
  word_count: number;
}

/**
 * One saved attempt as the engine's Attempt. The score is the code's total turned back into 0-1:
 * written answers (open text, six-word stories) out of 6, Word Sprint out of 5, the other types 1
 * or 0; unscored is null. Null if the exercise is unknown.
 */
export function attemptFromRow(row: AttemptRow, exercise: ExerciseFacts | undefined): Attempt | null {
  if (!exercise) return null;
  let score: number | null = null;
  if (row.result !== 'unscored' && row.total !== null) {
    score = isWrittenAnswer(row.response_type) ? row.total / 6 : row.response_type === 'word_sprint' ? row.total / 5 : row.total;
  }
  return {
    exerciseId: row.exercise_id,
    skill: exercise.skill,
    band: exercise.band,
    kind: row.kind,
    responseType: row.response_type,
    result: row.result,
    score,
    localDate: row.local_date,
    createdAt: Date.parse(row.created_at),
    wordCount: exercise.word_count,
    readingSeconds: row.reading_seconds,
  };
}

export function freeWriteFromRow(row: FreeWriteRow): FreeWrite {
  return { promptId: row.prompt_id, text: row.text, localDate: row.local_date, createdAt: Date.parse(row.created_at) };
}

/** The `skill_state` rows to save: a cache of the engine's result (SPEC section 7). */
export function skillStateRows(states: SkillStates) {
  return Object.values(states).map((s) => ({
    skill: s.skill,
    band: s.band,
    consecutive_fails: s.consecutiveFails,
    review_remaining: s.reviewRemaining,
    fast_track_used: s.fastTrackUsed,
  }));
}
