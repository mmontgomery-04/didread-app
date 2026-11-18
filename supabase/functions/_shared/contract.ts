// The score-response contract (SPEC section 6): what the app may send, what the AI must return,
// and the limits. Pure functions only, so they're unit-tested on the PC (contract.test.ts).
import { isAnswerTooShort, type CriterionScore, type ScoringFlags } from './scoring.ts';
import { countStoryWords, STORY_WORDS } from './storyWords.ts';

export const MAX_RESPONSE_CHARS = 1000;
export const MAX_SCORING_CALLS_PER_DAY = 10;
export const MAX_FEEDBACK_CHARS = 600;
export const MAX_READING_SECONDS = 600;
export const MAX_OUTPUT_TOKENS = 400;
export const AI_TIMEOUT_MS = 15_000;

const KINDS = ['daily', 'bonus', 'review', 'repeat'] as const;
export type AttemptKind = (typeof KINDS)[number];

// ---------------------------------------------------------------------------------------------
// Request (app → backend)
// ---------------------------------------------------------------------------------------------

export interface ScoreRequest {
  exercise_id: string;
  exercise_version: number;
  response_text: string;
  kind: AttemptKind;
  local_date: string; // YYYY-MM-DD, the user's local date at submission (P6)
  reading_seconds: number;
}

/** Why a request was refused. Nothing is saved for any of these. */
export type RequestProblem = 'bad_request' | 'too_long' | 'too_short' | 'not_six_words';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** The development test user (scripts/create-test-user.ts). Checked by the server, from the sign-in. */
export const TEST_USER_EMAIL = 'test@didread.test';

/** Days between two YYYY-MM-DD dates (b minus a). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Checks the app's request. `todayUtc` is the server's UTC date (passed in, never read here).
 * Every time zone's local date is within one day of the UTC date, so anything further away
 * didn't come from a real clock. The one exception is the test user (`anyDate`), whose test panel
 * can "Skip to tomorrow" (SPEC decision log, batch 9).
 */
export function validateRequest(
  body: unknown,
  todayUtc: string,
  anyDate = false,
): { ok: true; request: ScoreRequest } | { ok: false; problem: RequestProblem } {
  const bad = { ok: false, problem: 'bad_request' } as const;
  if (!isObject(body)) return bad;
  const { exercise_id, exercise_version, response_text, kind, local_date, reading_seconds } = body;

  if (typeof exercise_id !== 'string' || !/^[a-z]+-[a-z]+-[0-9]{3}$/.test(exercise_id)) return bad;
  if (!Number.isInteger(exercise_version) || (exercise_version as number) < 1) return bad;
  if (typeof kind !== 'string' || !(KINDS as readonly string[]).includes(kind)) return bad;
  if (typeof local_date !== 'string' || !isRealDate(local_date)) return bad;
  if (!anyDate && Math.abs(daysBetween(todayUtc, local_date)) > 1) return bad;
  if (!Number.isInteger(reading_seconds) || (reading_seconds as number) < 0) return bad;
  if ((reading_seconds as number) > MAX_READING_SECONDS) return bad;
  if (typeof response_text !== 'string') return bad;
  // The app's box stops at 1,000 characters; anything longer is refused and nothing is saved.
  if (response_text.length > MAX_RESPONSE_CHARS) return { ok: false, problem: 'too_long' };
  // The length rules depend on the exercise's type: answerLengthProblem, once it's loaded.

  return {
    ok: true,
    request: {
      exercise_id,
      exercise_version: exercise_version as number,
      response_text,
      kind: kind as AttemptKind,
      local_date,
      reading_seconds: reading_seconds as number,
    },
  };
}

/**
 * The length rules, which depend on the type (SPEC section 4, "Blocked before sending"; the app
 * checks first, this is the backstop): open text needs at least 8 words, and a six-word story
 * exactly six. Refused, so nothing is saved. Null when the length is fine.
 * (Until Oct 15 the 8-word rule ran before the type was known, so every six-word story was refused.)
 */
export function answerLengthProblem(responseType: string, responseText: string): 'too_short' | 'not_six_words' | null {
  if (responseType === 'six_word_story') return countStoryWords(responseText) === STORY_WORDS ? null : 'not_six_words';
  return isAnswerTooShort(responseText) ? 'too_short' : null;
}

/** True once the user already has 10 scored-or-unscored open-text attempts on this local date. */
export function isOverDailyLimit(openTextAttemptsToday: number): boolean {
  return openTextAttemptsToday >= MAX_SCORING_CALLS_PER_DAY;
}

// ---------------------------------------------------------------------------------------------
// AI output (validated before anything is saved). Anything invalid → unscored, never guessed.
// ---------------------------------------------------------------------------------------------

export interface AiScore {
  criteria: CriterionScore[];
  flags: ScoringFlags;
  feedback: string;
}

/**
 * Cuts feedback to the last full sentence that ends within 600 characters.
 * Returns null if there's no full sentence in that space (then the answer is unscored).
 */
export function truncateFeedback(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= MAX_FEEDBACK_CHARS) return trimmed;
  const head = trimmed.slice(0, MAX_FEEDBACK_CHARS);
  // A sentence ends with . ! or ?, maybe followed by closing quotes or brackets, then a space.
  const ends = [...`${head} `.matchAll(/[.!?]["'”’)\]]*(?=\s)/g)];
  if (ends.length === 0) return null;
  const last = ends[ends.length - 1];
  return head.slice(0, last.index! + last[0].length).trim();
}

/** Takes the model's raw text reply, returns the validated score or null (= unscored). */
export function parseAiOutput(raw: string, rubricIds: readonly string[]): AiScore | null {
  // Some models wrap JSON in a ```json fence; remove it, but nothing else is "repaired".
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;

  const { criteria, flags, feedback } = data;
  if (!Array.isArray(criteria) || criteria.length !== rubricIds.length) return null;
  const parsed: CriterionScore[] = [];
  for (const c of criteria) {
    if (!isObject(c) || typeof c.id !== 'string') return null;
    if (!Number.isInteger(c.score) || (c.score as number) < 0 || (c.score as number) > 2) return null;
    parsed.push({ id: c.id, score: c.score as number });
  }
  const ids = parsed.map((c) => c.id).sort();
  const expected = [...rubricIds].sort();
  if (!ids.every((id, i) => id === expected[i])) return null;

  if (!isObject(flags) || typeof flags.off_topic !== 'boolean' || typeof flags.not_an_answer !== 'boolean') {
    return null;
  }
  if (typeof feedback !== 'string') return null;
  const cut = truncateFeedback(feedback);
  if (cut === null) return null;

  return {
    criteria: parsed,
    flags: { off_topic: flags.off_topic, not_an_answer: flags.not_an_answer },
    feedback: cut,
  };
}
