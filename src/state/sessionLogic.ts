// Pure state changes for the in-memory session (batch 3). No React, and the
// clock is passed in, so every change here can be unit-tested with `npm test`.
import { readingSeconds } from '../engine/index.ts';
import type {
  Attempt,
  AttemptKind,
  AttemptResult,
  DailyAssignment,
  FreeWrite,
  LocalDate,
  Selection,
} from '../engine/index.ts';
import type { Exercise } from '../content/exercises.ts';

/** The exercise the user has opened but not yet submitted. */
export interface CurrentExercise {
  exerciseId: string;
  kind: AttemptKind;
  /** First time the passage was opened. Re-reading never changes it (P7). */
  passageOpenedAt: number;
  /** First time the question was opened. Re-reading never changes it (P7). */
  questionOpenedAt: number | null;
  /** Open text: the answer typed so far. Kept if the user leaves the screen. */
  draft: string;
  /** Multiple choice: the option picked so far. */
  selectedOptionId: string | null;
  /** Tap the sentence: the sentence picked so far (counted across the whole passage). */
  selectedSentenceIndex: number | null;
  /** Put it in order: item ids in the order tapped so far. */
  orderPicks: string[];
  /** False when opened from the dev panel's "Open any exercise" list: never recorded. */
  counts: boolean;
}

/** What was submitted. Only the field for the exercise's response type is set. */
export interface SubmittedAnswer {
  selectedOptionId?: string;
  selectedSentenceIndex?: number;
  submittedOrder?: string[];
  /** Word Sprint (batch 13): the word tapped in each round, or null when time ran out. */
  roundAnswers?: (string | null)[];
}

/** What the Feedback and Finish screens show for the answer just submitted. */
export interface LastResult extends SubmittedAnswer {
  exerciseId: string;
  result: AttemptResult;
  /** False for a dev-panel attempt, which was not added to the attempts log. */
  counted: boolean;
  /** True only for the very first completed exercise, right or wrong. */
  firstEver: boolean;
  /** True when this answer made today a practice day, so the streak went up by one (batch 3d). */
  raisedStreak: boolean;
  /** Open text: the AI's feedback from score-response, or null (unscored, or a test-panel answer). */
  feedbackText: string | null;
}

export interface SessionState {
  attempts: Attempt[];
  dailyAssignment: DailyAssignment | null;
  current: CurrentExercise | null;
  lastResult: LastResult | null;
  /** Every completed exercise, including dev-panel ones. Decides "Your first DidRead!". */
  completedCount: number;
  /** Dev panel "Skip to tomorrow": days added to the real clock. */
  dayOffset: number;
  /** "Say it your way" free-writes saved so far (batch 3c; saved to the database in batch 9). */
  freeWrites: FreeWrite[];
  /** An unsaved free-write, kept silently for the rest of the day it was started. */
  freeWriteDraft: { promptId: string; localDate: LocalDate; text: string } | null;
  /** Monday of the week whose recap was dismissed with "Nice". */
  recapDismissedWeek: LocalDate | null;
}

export const EMPTY_SESSION: SessionState = {
  attempts: [],
  dailyAssignment: null,
  current: null,
  lastResult: null,
  completedCount: 0,
  dayOffset: 0,
  freeWrites: [],
  freeWriteDraft: null,
  recapDismissedWeek: null,
};

/** Opens the passage. Today's daily choice is stored so it doesn't change on reopen (P4). */
export function startExercise(
  s: SessionState,
  selection: Selection,
  counts: boolean,
  nowMs: number,
  today: LocalDate,
): SessionState {
  return {
    ...s,
    dailyAssignment: counts && selection.kind === 'daily' ? { ...selection, localDate: today } : s.dailyAssignment,
    current: {
      exerciseId: selection.exerciseId,
      kind: selection.kind,
      passageOpenedAt: nowMs,
      questionOpenedAt: null,
      draft: '',
      selectedOptionId: null,
      selectedSentenceIndex: null,
      orderPicks: [],
      counts,
    },
  };
}

/** Marks the question as opened. Only the first time counts for reading time (P7). */
export function openQuestion(s: SessionState, nowMs: number): SessionState {
  if (!s.current || s.current.questionOpenedAt !== null) return s;
  return { ...s, current: { ...s.current, questionOpenedAt: nowMs } };
}

export function updateCurrent(s: SessionState, change: Partial<CurrentExercise>): SessionState {
  return s.current ? { ...s, current: { ...s.current, ...change } } : s;
}

/** Records a submitted answer for the current exercise and clears it. */
export function recordAttempt(
  s: SessionState,
  exercise: Pick<Exercise, 'id' | 'skill' | 'band' | 'response_type' | 'word_count'>,
  result: AttemptResult,
  score: number | null,
  answer: SubmittedAnswer,
  nowMs: number,
  today: LocalDate,
  feedbackText: string | null = null,
): SessionState {
  const current = s.current;
  if (!current) return s;
  const attempt: Attempt = {
    exerciseId: exercise.id,
    skill: exercise.skill,
    band: exercise.band,
    kind: current.kind,
    responseType: exercise.response_type,
    result,
    score,
    localDate: today,
    createdAt: nowMs,
    wordCount: exercise.word_count,
    readingSeconds: readingSeconds(current.passageOpenedAt, current.questionOpenedAt ?? nowMs),
  };
  return {
    ...s,
    // Dev-panel attempts never count toward progress or streaks.
    attempts: current.counts ? [...s.attempts, attempt] : s.attempts,
    current: null,
    lastResult: {
      ...answer,
      exerciseId: exercise.id,
      result,
      counted: current.counts,
      firstEver: s.completedCount === 0,
      raisedStreak: current.counts && !practicedOn(s, today),
      feedbackText,
    },
    completedCount: s.completedCount + 1,
  };
}

/** Whether anything already made this date a practice day (P6): a counted attempt or a free-write. */
export function practicedOn(s: SessionState, date: LocalDate): boolean {
  return s.attempts.some((a) => a.localDate === date) || s.freeWrites.some((w) => w.localDate === date);
}

/**
 * Put it in order: tapping an unnumbered item gives it the next number. Tapping the item
 * with the highest number removes its number (undo the last pick). Any other numbered
 * item does nothing. ("Start over" clears everything; that's an empty list.)
 */
export function tapOrderItem(picks: readonly string[], itemId: string): string[] {
  if (!picks.includes(itemId)) return [...picks, itemId];
  if (picks[picks.length - 1] === itemId) return picks.slice(0, -1);
  return [...picks];
}

/** Say it your way: the draft for this prompt, if one was started today. */
export function draftFor(s: SessionState, promptId: string, today: LocalDate): string {
  const draft = s.freeWriteDraft;
  return draft && draft.promptId === promptId && draft.localDate === today ? draft.text : '';
}

/** Say it your way: saves the free-write (needs at least one character) and clears the draft. */
export function saveFreeWrite(s: SessionState, promptId: string, text: string, nowMs: number, today: LocalDate): SessionState {
  if (text.trim().length === 0) return s;
  return {
    ...s,
    freeWrites: [...s.freeWrites, { promptId, text, localDate: today, createdAt: nowMs }],
    freeWriteDraft: null,
  };
}
