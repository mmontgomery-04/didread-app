// Scores one written answer (open text or a six-word story): build the prompt, ask the model,
// validate the reply, then let code decide pass or fail. Shared by the score-response and
// calibrate-response functions, so the app and calibration score exactly the same way.
import { parseAiOutput } from './contract.ts';
import {
  buildSystemPrompt,
  buildUserMessage,
  promptVersionFor,
  type ExerciseForScoring,
  type OpenerStyle,
} from './prompt-v6.ts';
import { callModel, type ModelConfig, type ModelReply } from './providers.ts';
import { scoreOpenText, type ScoringFlags } from './scoring.ts';
import { ownWordsScore } from './storyWords.ts';

export type ScoredAnswer =
  | {
      result: 'pass' | 'fail';
      total: number;
      /** {"c1": 2, "c2": 1, "c3": 0}, as stored in attempts.criteria_scores. */
      criteriaScores: Record<string, number>;
      flags: ScoringFlags;
      feedback: string;
      /** For attempts.prompt_version, e.g. "score-v6/opener-2". */
      promptVersion: string;
      reply: ModelReply;
    }
  | {
      result: 'unscored';
      /** Why, for the function's logs and the calibration report. Never shown to users. */
      reason: string;
      promptVersion: string;
      reply: ModelReply | null;
    };

export async function scoreAnswer(
  exercise: ExerciseForScoring,
  responseText: string,
  config: ModelConfig,
  openerStyle: OpenerStyle,
  call: typeof callModel = callModel,
): Promise<ScoredAnswer> {
  const criterionIds = exercise.rubric.map((c) => c.id);
  const promptVersion = promptVersionFor(openerStyle);

  let reply: ModelReply;
  try {
    reply = await call(config, {
      system: buildSystemPrompt(exercise, openerStyle),
      user: buildUserMessage(responseText),
      criterionIds,
    });
  } catch (error) {
    return { result: 'unscored', reason: `AI call failed: ${(error as Error).message}`, promptVersion, reply: null };
  }

  const ai = parseAiOutput(reply.text, criterionIds);
  if (!ai) return { result: 'unscored', reason: 'AI reply failed validation', promptVersion, reply };

  // Six-word stories: code scores c3 ("Uses its own words") from the longest run of words copied
  // from the passage (SPEC section 5); the AI can't count runs reliably, so its c3 is replaced.
  const criteria =
    exercise.response_type === 'six_word_story'
      ? ai.criteria.map((c) => (c.id === 'c3' ? { ...c, score: ownWordsScore(responseText, exercise.passage) } : c))
      : ai.criteria;

  const scored = scoreOpenText(exercise.rubric, criteria, ai.flags);
  if (scored.result === 'unscored' || scored.total === null) {
    return { result: 'unscored', reason: 'Scores did not match the rubric', promptVersion, reply };
  }

  // Stored as the scores that counted: all 0 when the AI flagged the answer (SPEC section 4).
  const zeroed = ai.flags.off_topic || ai.flags.not_an_answer;
  const criteriaScores = Object.fromEntries(criteria.map((c) => [c.id, zeroed ? 0 : c.score]));
  return {
    result: scored.result,
    total: scored.total,
    criteriaScores,
    flags: ai.flags,
    feedback: ai.feedback,
    promptVersion,
    reply,
  };
}
