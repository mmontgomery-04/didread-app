// Exercise selection, rule P4. Only `approved` exercises are ever served.
import { addDays } from './dates.ts';
import { bandBelow, computeSkillStates } from './progression.ts';
import { isChapter } from './series.ts';
import { BANDS, isNewFormat, isPlusOnly, SKILLS } from './types.ts';
import type {
  Attempt,
  DailyAssignment,
  ExerciseSummary,
  LocalDate,
  ResponseType,
  Selection,
  Skill,
  SkillStates,
} from './types.ts';

const RECENT_DAYS = 7;

export interface SelectionInput {
  exercises: readonly ExerciseSummary[];
  attempts: readonly Attempt[];
  /** The user's local today. */
  today: LocalDate;
  /** True for DidRead Plus users. Without Plus, Plus-only types are never served. */
  plus?: boolean;
  /** The user's id: decides their surprise days (batch 13). Without it there are none. */
  seed?: string;
}

/** FNV-1a: a small, stable string hash, so the same user and date always give the same answer. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const SURPRISE_ONE_IN = 4;
/** How far back to look for a run of candidate days (a longer run is vanishingly rare). */
const SURPRISE_LOOKBACK = 60;

/**
 * P4, batch 13: about 1 day in 4 is a surprise day, never two in a row. A day is a candidate when
 * the hash of user and date falls in 1 of 4 buckets; in a run of candidate days, the 1st, 3rd, 5th…
 * are surprise days (so the day after a surprise day never is). Code decides; nothing is stored.
 */
export function isSurpriseDay(seed: string, date: LocalDate): boolean {
  const candidate = (d: LocalDate) => hash(`${seed}|${d}`) % SURPRISE_ONE_IN === 0;
  let run = 0;
  for (let back = 0; back < SURPRISE_LOOKBACK && candidate(addDays(date, -back)); back++) run++;
  return run % 2 === 1;
}

/**
 * Skills ranked by fewest attempts in the last 7 days (local today plus the 6
 * days before). Every submitted attempt counts, of any kind, scored or not.
 * Ties go in the fixed order: comprehension, inference, reasoning, articulation.
 */
export function rankSkills(attempts: readonly Attempt[], today: LocalDate): Skill[] {
  const earliest = addDays(today, -(RECENT_DAYS - 1));
  const counts = new Map<Skill, number>(SKILLS.map((s) => [s, 0]));
  for (const a of attempts) {
    if (a.localDate >= earliest && a.localDate <= today) counts.set(a.skill, counts.get(a.skill)! + 1);
  }
  // Array sort is stable, so equal counts keep the fixed order.
  return [...SKILLS].sort((x, y) => counts.get(x)! - counts.get(y)!);
}

function lowestBandIndex(states: SkillStates): number {
  return Math.min(...SKILLS.map((s) => BANDS.indexOf(states[s].band)));
}

/**
 * Starter mode (P4, batch 13; daily-only from batch 14): every attempt so far that wasn't a bonus
 * pick is a starter read (so a brand-new user, with none, starts here) and an approved starter is
 * still unseen. Bonus picks from the Activities menu don't end it.
 */
export function inStarterMode(input: Pick<SelectionInput, 'exercises' | 'attempts'>): boolean {
  const starters = input.exercises.filter((e) => e.starter && e.status === 'approved');
  const starterIds = new Set(starters.map((e) => e.id));
  if (!input.attempts.every((a) => a.kind === 'bonus' || starterIds.has(a.exerciseId))) return false;
  const seen = new Set(input.attempts.map((a) => a.exerciseId));
  return starters.some((e) => !seen.has(e.id));
}

/** The band to serve in each skill: the user's band, or the band below during review (P3). */
function bandsFrom(states: SkillStates) {
  return (skill: Skill) => {
    const state = states[skill];
    const reviewBand = state.reviewRemaining > 0 ? bandBelow(state.band) : null;
    return { band: reviewBand ?? state.band, review: reviewBand !== null };
  };
}

/**
 * Batch 14, the Activities menu (P4): the next bonus read of one activity type. The lowest-sequence
 * unseen approved exercise of that type, at the user's band for its skill (the band below during
 * review), trying skills in the ranked order. Null when there is none: the type is all caught up
 * (never a repeat). Starters are never served from the menu, and Plus-only types need Plus.
 * Six-word stories (batch 16): when there's none at the user's band, the next unseen story from the
 * lowest band that has one, whatever their level (they chose it; it doesn't count toward P1).
 */
export function chooseExerciseOfType(input: SelectionInput, type: ResponseType): Selection | null {
  if (input.plus !== true && isPlusOnly(type)) return null;
  const seen = new Set(input.attempts.map((a) => a.exerciseId));
  // Story series chapters come only from the Stories card (series.ts).
  const candidates = input.exercises.filter(
    (e) => e.status === 'approved' && !e.starter && !isChapter(e) && e.responseType === type && !seen.has(e.id),
  );
  if (candidates.length === 0) return null;
  const bandFor = bandsFrom(computeSkillStates(input.attempts));
  for (const skill of rankSkills(input.attempts, input.today)) {
    const { band, review } = bandFor(skill);
    const match = candidates
      .filter((e) => e.skill === skill && e.band === band)
      .sort((x, y) => x.sequence - y.sequence)[0];
    if (match) return { exerciseId: match.id, kind: review ? 'review' : 'bonus' };
  }
  if (type === 'six_word_story') {
    const anyBand = [...candidates].sort(
      (x, y) => BANDS.indexOf(x.band) - BANDS.indexOf(y.band) || x.sequence - y.sequence,
    )[0];
    return { exerciseId: anyBand.id, kind: 'bonus' };
  }
  return null;
}

/**
 * Picks the next exercise to serve. `slot` is 'daily' for today's exercise or
 * 'bonus' for a bonus one. Returns null when no approved exercise is available.
 */
export function chooseExercise(input: SelectionInput, slot: 'daily' | 'bonus'): Selection | null {
  // Without Plus, Plus-only types are skipped everywhere below, so the next exercise is served.
  // Story series chapters are never picked here (not daily, not as repeats): only by the Stories card.
  const allowed = input.exercises.filter(
    (e) => e.status === 'approved' && !isChapter(e) && (input.plus === true || !isPlusOnly(e.responseType)),
  );
  const seen = new Set(input.attempts.map((a) => a.exerciseId));
  const ranked = rankSkills(input.attempts, input.today);

  // 0. Starter mode (batch 13): a user whose daily reads are all starters (none at all, at first)
  // gets the next unseen starter as the daily pick, by skill rank, until every starter is done.
  // Bonus picks and everyone else never get starters, as picks or as repeats.
  if (slot === 'daily' && inStarterMode(input)) {
    for (const skill of ranked) {
      const starter = allowed
        .filter((e) => e.starter && e.skill === skill && !seen.has(e.id))
        .sort((x, y) => x.sequence - y.sequence)[0];
      if (starter) return { exerciseId: starter.id, kind: slot };
    }
  }
  const states = computeSkillStates(input.attempts);
  const bandFor = bandsFrom(states);

  // Surprise days (batch 13): the daily pick is the lowest-sequence unseen new-format exercise, by
  // skill rank, at the user's band. If there is none, it's a normal day (never a repeat).
  const nonStarters = allowed.filter((e) => !e.starter);
  if (slot === 'daily' && input.seed && isSurpriseDay(input.seed, input.today)) {
    for (const skill of ranked) {
      const { band, review } = bandFor(skill);
      const surprise = nonStarters
        .filter((e) => isNewFormat(e.responseType) && e.skill === skill && e.band === band && !seen.has(e.id))
        .sort((x, y) => x.sequence - y.sequence)[0];
      if (surprise) return { exerciseId: surprise.id, kind: review ? 'review' : slot };
    }
  }
  // Other days, the daily pick never uses new formats; bonus picks may use any format.
  const approved = slot === 'daily' ? nonStarters.filter((e) => !isNewFormat(e.responseType)) : nonStarters;

  // 1. Unseen exercises: try each skill in ranked order.
  for (const skill of ranked) {
    const { band, review } = bandFor(skill);
    const match = approved
      .filter((e) => e.skill === skill && e.band === band && !seen.has(e.id))
      .sort((x, y) => x.sequence - y.sequence)[0];
    if (match) return { exerciseId: match.id, kind: review ? 'review' : slot };
  }

  // 2. Repeats: any approved exercise already done, any skill, at or below the
  // user's lowest band. Last seen longest ago first; ties by skill order, then sequence.
  const maxBand = lowestBandIndex(states);
  const lastSeen = new Map<string, number>();
  for (const a of input.attempts) {
    lastSeen.set(a.exerciseId, Math.max(lastSeen.get(a.exerciseId) ?? -Infinity, a.createdAt));
  }
  const repeat = approved
    .filter((e) => seen.has(e.id) && BANDS.indexOf(e.band) <= maxBand)
    .sort(
      (x, y) =>
        lastSeen.get(x.id)! - lastSeen.get(y.id)! ||
        SKILLS.indexOf(x.skill) - SKILLS.indexOf(y.skill) ||
        x.sequence - y.sequence,
    )[0];
  return repeat ? { exerciseId: repeat.id, kind: 'repeat' } : null;
}

/**
 * Today's exercise. If one is already stored for today it is returned unchanged,
 * so reopening the app never changes it. Otherwise a new one is chosen; the app
 * must store the returned assignment.
 */
export function getDailyAssignment(
  input: SelectionInput,
  stored: DailyAssignment | null,
): DailyAssignment | null {
  if (stored && stored.localDate === input.today) return stored;
  const selection = chooseExercise(input, 'daily');
  return selection ? { ...selection, localDate: input.today } : null;
}
