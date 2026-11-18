// Reading score-response's reply in the app (open text, SPEC section 6). Plain TypeScript, so it's
// unit-tested. Anything unexpected becomes "unscored": the app never guesses a score.
import type { AttemptResult } from '../engine/index.ts';

export interface ScoredOpenText {
  result: AttemptResult;
  /** Normalized score for ProgressionEngine: total ÷ 6, or null when unscored. */
  score: number | null;
  /** The AI's feedback to show, or null (unscored). */
  feedback: string | null;
  /** True when score-response saved the attempt (any 200 reply). */
  saved: boolean;
  /**
   * True when score-response refused the answer for good (Oct 15): it can never be scored, so
   * retrying is pointless. Not saved. Rare: the exercise was taken down mid-answer, the phone's
   * date is far off, or a length rule the app should have caught.
   */
  refused: boolean;
}

/** score-response's refusals (bad_request, too_long, too_short, not_six_words, not_found, not_available). */
const REFUSED_STATUSES = [400, 403, 404];

const UNSCORED_NOT_SAVED: ScoredOpenText = { result: 'unscored', score: null, feedback: null, saved: false, refused: false };

/**
 * `data` is the function's JSON body on success; `failed` is true for a network error or any
 * non-success status, and `status` is the HTTP status when there was one. On success the attempt
 * is already saved by score-response. A refusal (400, 403, 404) is final; anything else that
 * failed (no signal, 401, 500, a timeout) may work on a later try.
 */
export function readScoreReply(data: unknown, failed: boolean, status?: number): ScoredOpenText {
  if (failed) return { ...UNSCORED_NOT_SAVED, refused: status !== undefined && REFUSED_STATUSES.includes(status) };
  if (typeof data !== 'object' || data === null) return UNSCORED_NOT_SAVED;
  const { result, total, feedback } = data as Record<string, unknown>;
  const unscoredSaved: ScoredOpenText = { result: 'unscored', score: null, feedback: null, saved: true, refused: false };
  if (result === 'unscored') return unscoredSaved;
  if (result !== 'pass' && result !== 'fail') return unscoredSaved;
  if (!Number.isInteger(total) || (total as number) < 0 || (total as number) > 6) return unscoredSaved;
  if (typeof feedback !== 'string' || feedback.trim() === '') return unscoredSaved;
  return { result, score: (total as number) / 6, feedback, saved: true, refused: false };
}
