// Word of the Day (batch 15, SPEC section 8): each person gets their own order. Their first day is
// the day they first saw the card (saved in their profile); from then on it's the next word each
// calendar day, in `sequence` order through the approved words, starting over after the last.
import { dayNumber } from './dates.ts';
import { shuffledOrder } from './order.ts';
import type { LocalDate } from './types.ts';

/**
 * Today's word for someone who started on `startedOn`. Days they don't open the app still count
 * (one word per calendar day). Null when there are no approved words.
 */
export function wordOfTheDay<T extends { sequence: number }>(
  words: readonly T[],
  startedOn: LocalDate,
  today: LocalDate,
): T | null {
  if (words.length === 0) return null;
  const ordered = [...words].sort((a, b) => a.sequence - b.sequence);
  const day = Math.max(0, dayNumber(today) - dayNumber(startedOn));
  return ordered[day % ordered.length];
}

/**
 * Batch 16: the meanings to pick from (the right one and its wrong ones), shuffled the same way
 * every time for that word, so reopening the app never reorders them.
 */
export function wordChoices(wordId: string, meaning: string, wrongMeanings: readonly string[]): string[] {
  return shuffledOrder(wordId, [meaning, ...wrongMeanings]);
}
