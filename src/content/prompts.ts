// "Say it your way" prompts (SPEC section 5, batch 3c), from docs/content/prompts-v1.json.
// Only `approved` prompts are served; development builds may show drafts too.
import data from '../../docs/content/prompts-v1.json';

import type { ExerciseStatus, Prompt } from '@/engine';

interface PromptRecord extends Prompt {
  status: ExerciseStatus;
}

const ALL: readonly PromptRecord[] = data.prompts as PromptRecord[];

export const SERVED_PROMPTS: readonly Prompt[] = ALL.filter((p) => __DEV__ || p.status === 'approved');
