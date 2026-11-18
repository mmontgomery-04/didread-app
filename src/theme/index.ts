// Colors and fonts, defined once (SPEC section 8, "Visual style: calm and bookish").
// The app is always dark: warm near-black background, warm off-white text,
// and one forest green accent (chosen in batch 3).

export interface Colors {
  /** Warm near-black. */
  background: string;
  /** Cards sit slightly lighter than the page. */
  surface: string;
  /** Warm off-white text. */
  text: string;
  /** Secondary text: labels, meta lines, hints. */
  muted: string;
  border: string;
  /** The one deep color, for buttons and progress. Nothing else is colored. */
  accent: string;
  /** Text on top of the accent color. */
  onAccent: string;
  /** The "DidRead" wordmark on the opening cover: white. */
  wordmark: string;
}

const base = {
  background: '#1B1917',
  surface: '#25231F',
  text: '#ECE6DA',
  muted: '#A29C8F',
  border: '#39352E',
  onAccent: '#1B1917',
  wordmark: '#FFFFFF',
};

/** Forest green, lightened so it reads well on the dark background. */
const FOREST_GREEN = '#8DBE9F';

export const colors: Colors = { ...base, accent: FOREST_GREEN };

/** Apple's New York serif, built into iOS (chosen in batch 3). */
const SERIF = 'ui-serif';

export const fonts = {
  /** Passages: serif, 19–20 pt, generous line spacing. */
  passage: { fontFamily: SERIF, fontSize: 19, lineHeight: 30 },
  /** Titles use the passage serif too, so screens feel like a book. */
  titleFamily: SERIF,
  // Interface text uses SF Pro, the system default (no fontFamily needed).
};

export const space = { xs: 4, s: 8, m: 16, l: 24, xl: 32, xxl: 48 };

export const radius = { card: 16, button: 14 };

/** Kept as a hook so screens don't change if a light mode ever returns. */
export function useColors(): Colors {
  return colors;
}
