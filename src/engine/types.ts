// Shared types for ProgressionEngine (docs/SPEC.md sections 4, 5, 7).
// Pure data only: no React, no networking, no clock.

export type Skill = 'comprehension' | 'inference' | 'reasoning' | 'articulation';

/** Fixed skill order, also used to break ties (SPEC P4). */
export const SKILLS: readonly Skill[] = ['comprehension', 'inference', 'reasoning', 'articulation'];

/** Skills whose promotion needs at least 2 open-text passes (SPEC P1). */
export const WRITING_SKILLS: readonly Skill[] = ['inference', 'reasoning', 'articulation'];

export type Band = 'foundation' | 'developing' | 'advanced' | 'deep';

/** Bands from lowest to highest. */
export const BANDS: readonly Band[] = ['foundation', 'developing', 'advanced', 'deep'];

/**
 * tap_sentence and order are scored by code and count like multiple choice for P1 (not open text).
 * six_word_story is written and AI-scored like open text, and counts as open text for P1.
 * bad_summary and word_sprint (batch 13) are scored by code and count like multiple choice.
 */
export type ResponseType =
  | 'open_text'
  | 'multiple_choice'
  | 'tap_sentence'
  | 'order'
  | 'six_word_story'
  | 'bad_summary'
  | 'word_sprint';

/** The new formats (batch 13): first try is practice (P1-P3), and they lead surprise days (P4). */
export function isNewFormat(responseType: ResponseType | undefined): boolean {
  return responseType === 'bad_summary' || responseType === 'word_sprint';
}

/** Written answers, scored by score-response against a rubric. Both count as open text for P1. */
export function isWrittenAnswer(responseType: ResponseType): boolean {
  return responseType === 'open_text' || responseType === 'six_word_story';
}

/** Types served only to DidRead Plus users (SPEC section 4, P4). */
export function isPlusOnly(responseType: ResponseType | undefined): boolean {
  return responseType === 'six_word_story';
}

export type AttemptKind = 'daily' | 'bonus' | 'review' | 'repeat';

export type AttemptResult = 'pass' | 'fail' | 'unscored';

export type ExerciseStatus = 'draft' | 'fact_checked' | 'calibrated' | 'approved' | 'retired';

/** A calendar date in the user's local time zone, written as "YYYY-MM-DD". */
export type LocalDate = string;

/** The parts of an exercise the engine needs for selection. */
export interface ExerciseSummary {
  id: string;
  skill: Skill;
  band: Band;
  sequence: number;
  status: ExerciseStatus;
  /** For P4: Plus-only types, new formats on surprise days, and the Activities menu (batch 14). */
  responseType?: ResponseType;
  /** A starter read (batch 13): served only in starter mode (P4). */
  starter?: boolean;
  /** Story series: the series this chapter belongs to, and its number. Served only by `nextChapter`. */
  seriesId?: string | null;
  chapter?: number | null;
}

/** One submitted answer, as recorded in the attempts log (SPEC section 7). */
export interface Attempt {
  exerciseId: string;
  /** Skill and band of the exercise that was answered. */
  skill: Skill;
  band: Band;
  kind: AttemptKind;
  responseType: ResponseType;
  result: AttemptResult;
  /** Normalized score 0–1 (open text: total ÷ 6; MC: 1 or 0). Null when unscored. */
  score: number | null;
  /** Local date fixed at submission time; never recalculated (SPEC P6). */
  localDate: LocalDate;
  /** Submission time in milliseconds since 1970. Used only to put attempts in order. */
  createdAt: number;
  /** Passage word count and capped reading seconds (SPEC P7). */
  wordCount: number;
  readingSeconds: number;
}

/** Per-skill state, the cache stored in `skill_state` (SPEC section 7). */
export interface SkillState {
  skill: Skill;
  band: Band;
  consecutiveFails: number;
  reviewRemaining: number;
  fastTrackUsed: boolean;
}

export type SkillStates = Record<Skill, SkillState>;

/** What to serve next, and how the resulting attempt should be recorded. */
export interface Selection {
  exerciseId: string;
  kind: AttemptKind;
}

/** Today's stored choice (SPEC P4, `daily_assignments`). */
export interface DailyAssignment extends Selection {
  localDate: LocalDate;
}
