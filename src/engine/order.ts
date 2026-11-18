// "Put it in order" shuffle (SPEC section 5, batch 3b). Deterministic: the same
// exercise id always gives the same order, and it's never already correct.

/** A 32-bit number from the exercise id (FNV-1a hash). */
function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Small seeded random-number generator (mulberry32): same seed, same numbers. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The items in the order they're shown: shuffled, seeded by the exercise id, and never
 * in the correct order. `items` is in the correct order (as stored in the exercise).
 */
export function shuffledOrder<T>(exerciseId: string, items: readonly T[]): T[] {
  const shuffled = [...items];
  const random = seededRandom(hashId(exerciseId));
  // Fisher–Yates shuffle.
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // If it came out correct, move the first item to the end. That can never be correct.
  if (shuffled.length > 1 && shuffled.every((item, i) => item === items[i])) {
    shuffled.push(shuffled.shift()!);
  }
  return shuffled;
}
