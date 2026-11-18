// Six-word stories (SPEC section 5): the word-counting rule and the "own words" check, for the
// backend (score-response refuses anything that isn't six words) and scripts/check-content.ts.
// The app's copy of the counter is countStoryWords in src/engine/scoring.ts; storyWords.test.ts
// keeps the two in step.

export const STORY_WORDS = 6;

/**
 * Split on whitespace (line breaks included); a piece is a word if it has at least one letter or
 * digit. So "don't", "pea-sized" and "1961" are one word each, and a lone dash, "…" or an emoji
 * is none.
 */
export function countStoryWords(text: string): number {
  return text.split(/\s+/).filter((piece) => /[\p{L}\p{N}]/u.test(piece)).length;
}

/** Words for comparing runs: lowercased, with punctuation around each word removed. */
function comparableWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((piece) => piece.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((word) => word.length > 0);
}

/** The longest run of words in a row that `answer` shares with `passage`, ignoring case and surrounding punctuation. */
export function longestSharedRun(answer: string, passage: string): number {
  const a = comparableWords(answer);
  const p = comparableWords(passage);
  let longest = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < p.length; j++) {
      let n = 0;
      while (i + n < a.length && j + n < p.length && a[i + n] === p[j + n]) n++;
      longest = Math.max(longest, n);
    }
  }
  return longest;
}

/** The c3 ("Uses its own words") score code expects for an answer: 4+ copied in a row = 0, 3 = 1, 2 or fewer = 2. */
export function ownWordsScore(answer: string, passage: string): 0 | 1 | 2 {
  const run = longestSharedRun(answer, passage);
  return run >= 4 ? 0 : run === 3 ? 1 : 2;
}
