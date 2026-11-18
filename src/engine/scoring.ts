// Scoring rules (SPEC section 4, "Scoring"). The AI only supplies criterion
// scores; this code decides pass, fail, or unscored.
import type { AttemptResult, ResponseType } from './types.ts';

export const MIN_OPEN_TEXT_WORDS = 8;
const MAX_TOTAL = 6;
const PASS_TOTAL = 4;

export interface ScoreResult {
  result: AttemptResult;
  /** Sum of criterion scores (open text only). Null when unscored or MC. */
  total: number | null;
  /** Normalized 0–1. Null when unscored. */
  score: number | null;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

/** Open-text answers under 8 words are blocked before sending; nothing is recorded. */
export function isAnswerTooShort(text: string): boolean {
  return countWords(text) < MIN_OPEN_TEXT_WORDS;
}

export const STORY_WORDS = 6;

/**
 * Six-word stories: split on whitespace (line breaks included); a piece is a word if it has at
 * least one letter or digit. So "don't", "pea-sized" and "1961" are one word each, and a lone
 * dash, "…" or an emoji is none. The same rule is in supabase/functions/_shared/storyWords.ts
 * (the backend's check) and scripts/check-content.ts; a test keeps them in step.
 */
export function countStoryWords(text: string): number {
  return text.split(/\s+/).filter((piece) => /[\p{L}\p{N}]/u.test(piece)).length;
}

/**
 * Written answers that may not be sent yet (nothing is recorded): open text under 8 words, or a
 * six-word story that isn't exactly six words.
 */
export function isAnswerBlocked(responseType: ResponseType, text: string): boolean {
  if (responseType === 'six_word_story') return countStoryWords(text) !== STORY_WORDS;
  return isAnswerTooShort(text);
}

/** Right or wrong: 1.0 and pass, or 0.0 and fail. */
function rightOrWrong(correct: boolean): ScoreResult {
  return { result: correct ? 'pass' : 'fail', total: null, score: correct ? 1 : 0 };
}

/** Word Sprint (batch 13): seconds allowed in rounds 1 to 5 (no timer in Relaxed mode or with VoiceOver). */
export const SPRINT_SECONDS: readonly number[] = [10, 9, 8, 7, 6];
const SPRINT_PASS = 4;

/**
 * Word Sprint (batch 13): `picks` holds the word tapped in each round, or null when time ran out.
 * total = rounds right (0-5), score = total ÷ 5, pass = 4 or more. Case doesn't matter.
 */
export function scoreWordSprint(picks: readonly (string | null)[], answers: readonly string[]): ScoreResult {
  const total = answers.filter((answer, i) => picks[i]?.toLowerCase() === answer.toLowerCase()).length;
  return { result: total >= SPRINT_PASS ? 'pass' : 'fail', total, score: total / answers.length };
}

/** Bad Summary (batch 13): right when the tapped summary is the one that gets the passage wrong. */
export function scoreBadSummary(pickedSummaryId: string, wrongSummaryId: string): ScoreResult {
  return rightOrWrong(pickedSummaryId === wrongSummaryId);
}

export function scoreMultipleChoice(selectedOptionId: string, correctOptionId: string): ScoreResult {
  return rightOrWrong(selectedOptionId === correctOptionId);
}

/** Tap the sentence: the tapped sentence must be the correct one. */
export function scoreTapSentence(selectedIndex: number, correctIndex: number): ScoreResult {
  return rightOrWrong(selectedIndex === correctIndex);
}

/** Put it in order: only a fully correct order passes. No partial credit. */
export function scoreOrder(submittedIds: readonly string[], correctIds: readonly string[]): ScoreResult {
  return rightOrWrong(
    submittedIds.length === correctIds.length && submittedIds.every((id, i) => id === correctIds[i]),
  );
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
