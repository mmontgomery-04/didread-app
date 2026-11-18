// Tap the sentence (SPEC section 5): `sentences` is a list of paragraphs, each a list of
// sentences. Pure helpers, shared by the app and scripts/check-content.ts.

/** Sentences within a paragraph joined with single spaces; paragraphs joined with a blank line. */
export function joinParagraphs(paragraphs: readonly (readonly string[])[]): string {
  return paragraphs.map((sentences) => sentences.join(' ')).join('\n\n');
}

/** Each sentence with its index counted across the whole passage from 0, grouped by paragraph. */
export function numberSentences(
  paragraphs: readonly (readonly string[])[],
): { index: number; text: string }[][] {
  let index = 0;
  return paragraphs.map((sentences) => sentences.map((text) => ({ index: index++, text })));
}

/** Where `word` first appears in `text` as a whole word (any case), or -1. Word Sprint highlights its answers with it. */
export function wholeWordIndex(text: string, word: string): number {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=[^\\p{L}\\p{N}]|$)`, 'iu').exec(text);
  return match ? match.index + match[1].length : -1;
}
