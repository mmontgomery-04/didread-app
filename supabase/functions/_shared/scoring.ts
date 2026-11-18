// Open-text scoring rules (SPEC section 4, "Scoring"), for the score-response function.
//
// This is a copy of the open-text part of src/engine/scoring.ts, because backend functions can only
// use files inside supabase/functions/. A unit test (scoring.test.ts) checks that both give the same
// result for every possible set of scores, so the two can't drift apart.
// The AI only supplies criterion scores; this code decides pass, fail, or unscored.

export type AttemptResult = 'pass' | 'fail' | 'unscored';

export const MIN_OPEN_TEXT_WORDS = 8;
const MAX_TOTAL = 6;
const PASS_TOTAL = 4;

export interface ScoreResult {
  result: AttemptResult;
  /** Sum of criterion scores. Null when unscored. */
  total: number | null;
  /** Normalized 0–1. Null when unscored. */
  score: number | null;
}

export interface RubricCriterion {
  id: string;
  required: boolean;
}

export interface CriterionScore {
  id: string;
  score: number;
}

export interface ScoringFlags {
  off_topic: boolean;
  not_an_answer: boolean;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

/** Open-text answers under 8 words are blocked before sending; nothing is recorded. */
export function isAnswerTooShort(text: string): boolean {
  return countWords(text) < MIN_OPEN_TEXT_WORDS;
}

const UNSCORED: ScoreResult = { result: 'unscored', total: null, score: null };

/**
 * Decides the result of an open-text answer from the AI's criterion scores.
 * Pass = total at least 4 of 6 and the required criterion at least 1.
 * If the scores don't match the rubric exactly, the answer is unscored (never guessed).
 */
export function scoreOpenText(
  rubric: readonly RubricCriterion[],
  criteria: readonly CriterionScore[],
  flags: ScoringFlags,
): ScoreResult {
  const rubricIds = rubric.map((c) => c.id).sort();
  const scoreIds = criteria.map((c) => c.id).sort();
  const idsMatch =
    rubricIds.length === 3 &&
    rubric.filter((c) => c.required).length === 1 &&
    rubricIds.length === scoreIds.length &&
    rubricIds.every((id, i) => id === scoreIds[i]);
  const scoresValid = criteria.every((c) => Number.isInteger(c.score) && c.score >= 0 && c.score <= 2);
  if (!idsMatch || !scoresValid) return UNSCORED;

  // Off-topic or not-an-answer: every criterion is treated as 0.
  const zeroed = flags.off_topic || flags.not_an_answer;
  const scoreFor = (id: string) => (zeroed ? 0 : criteria.find((c) => c.id === id)!.score);

  const total = rubric.reduce((sum, c) => sum + scoreFor(c.id), 0);
  const required = rubric.find((c) => c.required)!;
  const passed = total >= PASS_TOTAL && scoreFor(required.id) >= 1;
  return { result: passed ? 'pass' : 'fail', total, score: total / MAX_TOTAL };
}
