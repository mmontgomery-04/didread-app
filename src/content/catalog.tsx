// The exercises the app serves (batch 6b): loaded from the database's `exercises` table once
// someone is signed in. Row-level security returns only approved exercises (plus any the user has
// already answered), and never anchors or editorial notes (SPEC section 7).
// Development builds can also open any exercise in docs/content/, drafts included, from the test
// panel (SPEC decision log); those come from src/content/exercises.ts and are never served daily.
// Batch 15: the approved Word of the Day words load here too. If they can't load, the card just
// doesn't show; exercises still work.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { ExerciseSummary } from '@/engine';
import { supabase } from '@/lib/supabase';

import { CONTENT_FILE_EXERCISES, type Exercise } from './exercises';

/**
 * Every column the app may read (batch 4, 6a and 13 grants, and the story series fields from
 * 20261016130000_story_series.sql, which must be run before this app version is used).
 */
const COLUMNS =
  'id,title,skill,band,topic,sequence,passage,word_count,question,response_type,options,correct_option_id,' +
  'mc_feedback,rubric,status,version,sentences,correct_sentence_index,order_items,order_instruction,feedback,' +
  'starter,summaries,wrong_summary_id,rounds,series_id,series_title,chapter,previously';

/** A Word of the Day word (batch 15; SPEC section 5). Row-level security returns approved ones only. */
export interface Word {
  id: string;
  word: string;
  part_of_speech: string;
  meaning: string;
  example: string;
  sequence: number;
  /** Batch 16: 2 wrong meanings and the lines after a right or wrong pick. Null: the "Show me" card. */
  wrong_meanings: string[] | null;
  right_message: string | null;
  wrong_message: string | null;
}

export type CatalogStatus = 'loading' | 'ready' | 'error';

function useCatalogState(userId: string | null) {
  const [status, setStatus] = useState<CatalogStatus>('loading');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('exercises')
      .select(COLUMNS)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) return setStatus('error');
        setExercises(data as unknown as Exercise[]);
        setStatus('ready');
      });
    supabase
      .from('words')
      .select('id,word,part_of_speech,meaning,example,sequence,wrong_meanings,right_message,wrong_message')
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setWords(data as Word[]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  // After a failed load (no signal), try again when the app comes back to the front.
  useEffect(() => {
    if (status !== 'error') return;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setAttempt((n) => n + 1));
    return () => sub.remove();
  }, [status]);

  /** P4 picks only from approved exercises. */
  const selectable: ExerciseSummary[] = exercises
    .filter((e) => e.status === 'approved')
    .map(({ id, skill, band, sequence, status: s, response_type, starter, series_id, chapter }) => ({
      id,
      skill,
      band,
      sequence,
      status: s,
      responseType: response_type,
      starter: starter === true,
      seriesId: series_id ?? null,
      chapter: chapter ?? null,
    }));

  function getExercise(id: string): Exercise {
    const found = exercises.find((e) => e.id === id) ?? CONTENT_FILE_EXERCISES.find((e) => e.id === id);
    if (!found) throw new Error(`Unknown exercise ${id}`);
    return found;
  }

  return { status, exercises, selectable, words, getExercise, retry: () => setAttempt((n) => n + 1) };
}

type Catalog = ReturnType<typeof useCatalogState>;

const CatalogContext = createContext<Catalog | null>(null);

export function CatalogProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const catalog = useCatalogState(userId);
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Catalog {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error('useCatalog must be used inside CatalogProvider');
  return catalog;
}
