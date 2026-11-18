// Story series (SPEC section 5, "Story series"): one story told in chapters, each chapter a normal
// exercise. Chapters are served only from the Activities menu's Stories card, in order, and never
// by the daily pick, repeats or the other cards (selection.ts). One band per series, open to
// everyone whatever their level; a chapter at another band than the person's counts as a practice
// day but never toward P1-P3 (progression.ts already counts only attempts at the current band).
import type { Attempt, ExerciseSummary, Selection } from './types.ts';

export function isChapter(e: Pick<ExerciseSummary, 'seriesId'>): boolean {
  return e.seriesId != null;
}

/** The approved chapters of each series, in chapter order. */
function approvedSeries(exercises: readonly ExerciseSummary[]): Map<string, ExerciseSummary[]> {
  const bySeries = new Map<string, ExerciseSummary[]>();
  for (const e of exercises) {
    if (e.status !== 'approved' || e.seriesId == null || e.chapter == null) continue;
    bySeries.set(e.seriesId, [...(bySeries.get(e.seriesId) ?? []), e]);
  }
  for (const chapters of bySeries.values()) chapters.sort((x, y) => x.chapter! - y.chapter!);
  return bySeries;
}

/** "Chapter {n} of {total}": the total is the series' approved chapters. Null if not a chapter. */
export function chapterOf(
  exercises: readonly ExerciseSummary[],
  exerciseId: string,
): { chapter: number; total: number; last: boolean } | null {
  const e = exercises.find((x) => x.id === exerciseId);
  if (!e || e.seriesId == null || e.chapter == null) return null;
  const total = approvedSeries(exercises).get(e.seriesId)?.length ?? 0;
  if (total === 0) return null;
  return { chapter: e.chapter, total, last: e.chapter >= total };
}

export type Stories =
  /** No approved series: the Stories card doesn't show. */
  | { state: 'none' }
  /** The next chapter to read. `started`: an earlier chapter of this series is done. */
  | { state: 'next'; selection: Selection; chapter: number; total: number; started: boolean }
  /** Every chapter of every approved series is done. */
  | { state: 'allCaughtUp' };

/**
 * The Stories card's next chapter. A chapter is done once any answer to it was submitted (any
 * result). A series already started comes first (the lowest series id, if somehow several);
 * otherwise the next series not yet started, by series id. Within a series, the lowest chapter not
 * yet done. Served as a bonus read (P5's cap applies, like every Activities card).
 */
export function nextChapter(exercises: readonly ExerciseSummary[], attempts: readonly Attempt[]): Stories {
  const series = approvedSeries(exercises);
  if (series.size === 0) return { state: 'none' };
  const done = new Set(attempts.map((a) => a.exerciseId));
  const ids = [...series.keys()].sort();
  const unfinished = ids.filter((id) => series.get(id)!.some((c) => !done.has(c.id)));
  const started = unfinished.find((id) => series.get(id)!.some((c) => done.has(c.id)));
  const seriesId = started ?? unfinished[0];
  if (seriesId === undefined) return { state: 'allCaughtUp' };
  const chapters = series.get(seriesId)!;
  const next = chapters.find((c) => !done.has(c.id))!;
  return {
    state: 'next',
    selection: { exerciseId: next.id, kind: 'bonus' },
    chapter: next.chapter!,
    total: chapters.length,
    started: started !== undefined,
  };
}
