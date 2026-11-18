// Progression rules P1 (promotion), P2 (fast track), P3 (review) and the
// per-day cap from P5. Skill state is always recomputed from the attempts log
// (SPEC section 7), so the stored `skill_state` is only a cache of this result.
import { BANDS, isNewFormat, isWrittenAnswer, SKILLS, WRITING_SKILLS } from './types.ts';
import type { Attempt, Band, LocalDate, ResponseType, Skill, SkillState, SkillStates } from './types.ts';

const PROMOTION_MIN_ATTEMPTS = 5;
const PROMOTION_WINDOW = 5;
const PROMOTION_MIN_PASSES = 4;
const PROMOTION_MIN_OPEN_TEXT_PASSES = 2;
const FAST_TRACK_ATTEMPTS = 3;
const REVIEW_TRIGGER_FAILS = 3;
const REVIEW_LENGTH = 2;
/** SPEC P5: max scored attempts per skill per day that count toward progression. */
const MAX_COUNTED_PER_SKILL_PER_DAY = 3;

export function initialSkillState(skill: Skill): SkillState {
  return { skill, band: 'foundation', consecutiveFails: 0, reviewRemaining: 0, fastTrackUsed: false };
}

/** The band below, or null at Foundation. */
export function bandBelow(band: Band): Band | null {
  const i = BANDS.indexOf(band);
  return i > 0 ? BANDS[i - 1] : null;
}

function bandAbove(band: Band): Band | null {
  const i = BANDS.indexOf(band);
  return i < BANDS.length - 1 ? BANDS[i + 1] : null;
}

/** Attempts in submission order (stable for equal times). */
export function inOrder(attempts: readonly Attempt[]): Attempt[] {
  return attempts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.createdAt - y.a.createdAt || x.i - y.i)
    .map((x) => x.a);
}

interface Counted {
  passed: boolean;
  openText: boolean;
  score: number;
}

function replaySkill(skill: Skill, attempts: readonly Attempt[]): { state: SkillState; window: Counted[] } {
  const state = initialSkillState(skill);
  // Attempts that count toward promotion in the current band. Cleared on promotion.
  let window: Counted[] = [];
  const countedPerDay = new Map<LocalDate, number>();

  const promote = (to: Band) => {
    state.band = to;
    state.consecutiveFails = 0;
    state.reviewRemaining = 0;
    window = [];
  };

  // Batch 13: a user's first try at each new format is practice: it never counts toward P1-P3.
  const triedFormats = new Set<ResponseType>();
  for (const attempt of attempts) {
    const firstTry = isNewFormat(attempt.responseType) && !triedFormats.has(attempt.responseType);
    if (isNewFormat(attempt.responseType)) triedFormats.add(attempt.responseType);
    if (attempt.skill !== skill) continue;
    if (firstTry) continue;

    // P3: every review attempt, even unscored, uses up one review exercise.
    // Review attempts never count toward promotion or consecutive fails.
    if (attempt.kind === 'review') {
      if (state.reviewRemaining > 0) state.reviewRemaining -= 1;
      continue;
    }
    // P4: repeats never count toward progression.
    if (attempt.kind === 'repeat') continue;
    // Unscored attempts count as practice days only.
    if (attempt.result === 'unscored' || attempt.score === null) continue;
    // Only attempts at the user's current band count.
    if (attempt.band !== state.band) continue;
    // P5: at most 3 scored attempts per skill per day count.
    const countedToday = countedPerDay.get(attempt.localDate) ?? 0;
    if (countedToday >= MAX_COUNTED_PER_SKILL_PER_DAY) continue;
    countedPerDay.set(attempt.localDate, countedToday + 1);

    const passed = attempt.result === 'pass';
    window.push({ passed, openText: isWrittenAnswer(attempt.responseType), score: attempt.score });

    // P3: consecutive fails and review.
    if (passed) {
      state.consecutiveFails = 0;
    } else {
      state.consecutiveFails += 1;
      if (state.consecutiveFails >= REVIEW_TRIGGER_FAILS) {
        state.consecutiveFails = 0;
        // At Foundation there is no band below, so no review.
        if (bandBelow(state.band) !== null) state.reviewRemaining = REVIEW_LENGTH;
      }
    }

    const next = bandAbove(state.band);
    if (next === null) continue;

    // P2: fast track. The first 3 counted attempts at Foundation all score 1.0.
    if (
      state.band === 'foundation' &&
      !state.fastTrackUsed &&
      window.length === FAST_TRACK_ATTEMPTS &&
      window.every((c) => c.score === 1)
    ) {
      state.fastTrackUsed = true;
      promote(next);
      continue;
    }

    // P1: promotion.
    if (window.length >= PROMOTION_MIN_ATTEMPTS && passed) {
      const lastFive = window.slice(-PROMOTION_WINDOW);
      const passes = lastFive.filter((c) => c.passed);
      const openTextPasses = passes.filter((c) => c.openText).length;
      const needsWriting = WRITING_SKILLS.includes(skill);
      if (
        passes.length >= PROMOTION_MIN_PASSES &&
        (!needsWriting || openTextPasses >= PROMOTION_MIN_OPEN_TEXT_PASSES)
      ) {
        promote(next);
      }
    }
  }
  return { state, window };
}

/** Recomputes every skill's state from the full attempts log. */
export function computeSkillStates(attempts: readonly Attempt[]): SkillStates {
  const ordered = inOrder(attempts);
  const states = {} as SkillStates;
  for (const skill of SKILLS) states[skill] = replaySkill(skill, ordered).state;
  return states;
}

/**
 * How full each skill's bar on the Progress screen is, from 0 to 1 (SPEC section 8, founder's
 * decision): the passes among the last 5 counted attempts at the current band, out of 4. For
 * inference, reasoning and articulation, which also need 2 open-text passes to move up, the bar
 * stops at 3/4 until those are there. It starts again from empty after moving up.
 */
export function skillProgress(attempts: readonly Attempt[]): Record<Skill, number> {
  const ordered = inOrder(attempts);
  const progress = {} as Record<Skill, number>;
  for (const skill of SKILLS) {
    const lastFive = replaySkill(skill, ordered).window.slice(-PROMOTION_WINDOW);
    const passes = lastFive.filter((c) => c.passed);
    let fraction = Math.min(passes.length, PROMOTION_MIN_PASSES) / PROMOTION_MIN_PASSES;
    const openTextPasses = passes.filter((c) => c.openText).length;
    if (WRITING_SKILLS.includes(skill) && openTextPasses < PROMOTION_MIN_OPEN_TEXT_PASSES) {
      fraction = Math.min(fraction, 3 / 4);
    }
    progress[skill] = fraction;
  }
  return progress;
}
