// The Exercise shape the screens use (SPEC section 5), and, in development builds only, every
// exercise in docs/content/ for the test panel's "Open any exercise" list (drafts included).
// Since batch 6b the app serves exercises from the database (src/content/catalog.tsx);
// production builds bundle none.
import type { Band, ExerciseStatus, ResponseType, Skill } from '@/engine';

export interface Option {
  id: string;
  text: string;
}

export interface WordSprintRound {
  definition: string;
  options: string[];
  answer: string;
  /** One sentence that uses the answer word, shown on Feedback. */
  example: string;
}

export interface RubricCriterion {
  id: string;
  text: string;
  required: boolean;
  level_0: string;
  level_1: string;
  level_2: string;
}

/** An exercise as the screens need it (SPEC section 5; internal fields left out). */
export interface Exercise {
  id: string;
  title: string;
  skill: Skill;
  band: Band;
  sequence: number;
  passage: string;
  word_count: number;
  question: string;
  response_type: ResponseType;
  options: Option[] | null;
  correct_option_id: string | null;
  mc_feedback: { correct: string; incorrect_by_option: Record<string, string> } | null;
  rubric: RubricCriterion[] | null;
  /** tap_sentence only: paragraphs, each a list of sentences; they rebuild `passage` exactly (see sentences.ts). */
  sentences?: string[][] | null;
  /** tap_sentence only: 0-based, counting sentences across the whole passage. */
  correct_sentence_index?: number | null;
  /** order only: 3–5 items, stored in the correct order. */
  order_items?: Option[] | null;
  /** order only: one line, e.g. "Put the steps in the order they happened". */
  order_instruction?: string | null;
  /** tap_sentence, order, bad_summary and word_sprint only. */
  feedback?: { correct: string; incorrect: string } | null;
  /** A starter read (batch 13): one short paragraph, served only to brand-new users (SPEC P4). */
  starter?: boolean;
  /** bad_summary only: exactly 3 one-line summaries; one gets the passage wrong. */
  summaries?: Option[] | null;
  /** bad_summary only: the id of the summary that gets it wrong. */
  wrong_summary_id?: string | null;
  /** word_sprint only (no passage): exactly 5 rounds; `answer` is one of `options` and appears in `example`. */
  rounds?: WordSprintRound[] | null;
  /** Story series (SPEC section 5): the series this chapter belongs to, e.g. "series-001". */
  series_id?: string | null;
  /** Story series: the series' name, shown on Finish after the last chapter. */
  series_title?: string | null;
  /** Story series: 1, 2, 3… */
  chapter?: number | null;
  /** Story series, chapter 2 on: a short recap shown above the passage (not counted in word_count). */
  previously?: string | null;
  status: ExerciseStatus;
  version: number;
}

type ContentFiles = ReturnType<typeof require.context>;

/** Every exercise in every exercises-*.json file in docs/content/. If an id repeats, the first file (by name) wins. */
function allContentFiles(files: ContentFiles): Exercise[] {
  const byId = new Map<string, Exercise>();
  for (const key of files.keys().sort()) {
    const exercises: Exercise[] = files(key)?.exercises ?? [];
    for (const e of exercises) if (!byId.has(e.id)) byId.set(e.id, e);
  }
  return [...byId.values()];
}

/**
 * Development builds: every exercises-*.json file in docs/content/, for previewing from the test
 * panel. Files added while `npx expo start` is running are picked up automatically. Production
 * builds get an empty list; the require.context branch is removed from them at build time.
 */
export const CONTENT_FILE_EXERCISES: readonly Exercise[] = __DEV__
  ? allContentFiles(require.context('../../docs/content', false, /exercises-.*\.json$/))
  : [];
