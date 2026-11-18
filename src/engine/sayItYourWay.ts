// "Say it your way" (SPEC section 8, batch 3c): an ungraded, AI-free, private free-write,
// always on Home. It never affects bands; saving one counts as practice for P6 (practice.ts).
import type { LocalDate } from './types.ts';

export interface Prompt {
  id: string;
  text: string;
}

/** A saved free-write. */
export interface FreeWrite {
  promptId: string;
  text: string;
  localDate: LocalDate;
  createdAt: number;
}

/**
 * The prompt the card shows: in id order, never repeated until all have been used. A prompt
 * counts as used only when a free-write is saved for it, so after saving the card moves on.
 * `prompts` is already filtered (approved only, or drafts too in dev). Null if there are none.
 */
export function nextPrompt(prompts: readonly Prompt[], freeWrites: readonly FreeWrite[]): Prompt | null {
  if (prompts.length === 0) return null;
  const uses = (id: string) => freeWrites.filter((w) => w.promptId === id).length;
  const fewest = Math.min(...prompts.map((p) => uses(p.id)));
  return [...prompts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).find((p) => uses(p.id) === fewest)!;
}
