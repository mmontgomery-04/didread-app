// score-response: the only code in DidRead that talks to AI (SPEC section 6).
//
// The app sends one written answer (open text, or a six-word story). This function checks who's asking, checks the request,
// looks up the exercise's passage and rubric itself, asks the AI for criterion scores, validates
// them, lets code decide pass or fail, saves the attempt, and returns the result.
//
// It runs on Supabase, not in the app. The AI key and the database's service key exist only here.
// Deploy:  npx supabase functions deploy score-response --project-ref <ref> --use-api --no-verify-jwt
// (--no-verify-jwt because this file checks the sign-in itself, below.)
import { answerLengthProblem, isOverDailyLimit, TEST_USER_EMAIL, validateRequest, type ScoreRequest } from '../_shared/contract.ts';
import { readModelConfig } from '../_shared/providers.ts';
import { openerStyleFor, type RubricRow } from '../_shared/prompt-v6.ts';
import { scoreAnswer } from '../_shared/scoreAnswer.ts';

/** Written answers, scored here: open text and six-word stories (SPEC sections 5 and 6). */
const WRITTEN_TYPES = ['open_text', 'six_word_story'];

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// Provided automatically by Supabase. Bypasses row-level security, so it never leaves this function.
// If the project's legacy keys are ever turned off, add the secret key as the DIDREAD_SECRET_KEY secret.
const SERVICE_KEY = Deno.env.get('DIDREAD_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface ExerciseRow {
  id: string;
  passage: string;
  question: string;
  response_type: string;
  rubric: RubricRow[] | null;
  status: string;
  version: number;
}

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { apikey: SERVICE_KEY, ...extra };
  // Older-style keys are JWTs and also go in Authorization; new sb_secret_ keys go only in apikey.
  if (SERVICE_KEY.startsWith('eyJ')) headers.authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}

/** Returns the signed-in user, or null. Supabase Auth checks the token. */
async function signedInUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(auth)) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, authorization: auth },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string };
  return typeof user.id === 'string' ? { id: user.id, email: user.email ?? null } : null;
}

async function loadExercise(id: string): Promise<ExerciseRow | null> {
  const select = 'id,passage,question,response_type,rubric,status,version';
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/exercises?id=eq.${encodeURIComponent(id)}&select=${select}`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`Loading exercise failed: HTTP ${res.status}`);
  const rows = (await res.json()) as ExerciseRow[];
  return rows[0] ?? null;
}

/**
 * How many written attempts (open text and six-word stories) this user already has: on one local
 * date (each was one scoring call, for the daily limit), or on any date (for the feedback opening style).
 */
async function openTextAttempts(userId: string, localDate?: string): Promise<number> {
  const onDate = localDate ? `&local_date=eq.${localDate}` : '';
  const query = `user_id=eq.${userId}${onDate}&response_type=in.(${WRITTEN_TYPES.join(',')})&select=id&limit=1`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/attempts?${query}`, {
    headers: serviceHeaders({ prefer: 'count=exact' }),
  });
  if (!res.ok) throw new Error(`Counting attempts failed: HTTP ${res.status}`);
  const total = Number((res.headers.get('content-range') ?? '').split('/')[1]);
  if (!Number.isInteger(total)) throw new Error('Counting attempts failed: no count returned');
  return total;
}

interface AttemptToSave {
  criteria_scores: Record<string, number> | null;
  total: number | null;
  result: 'pass' | 'fail' | 'unscored';
  feedback_text: string | null;
  prompt_version: string | null;
}

async function saveAttempt(
  userId: string,
  request: ScoreRequest,
  exercise: ExerciseRow,
  outcome: AttemptToSave,
): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/attempts?select=id`, {
    method: 'POST',
    headers: serviceHeaders({ 'content-type': 'application/json', prefer: 'return=representation' }),
    body: JSON.stringify({
      user_id: userId,
      exercise_id: request.exercise_id,
      exercise_version: exercise.version,
      kind: request.kind,
      local_date: request.local_date,
      response_type: exercise.response_type,
      response_text: request.response_text,
      reading_seconds: request.reading_seconds,
      ...outcome,
    }),
  });
  if (!res.ok) throw new Error(`Saving attempt failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const rows = (await res.json()) as { id: string }[];
  return rows[0].id;
}

const UNSCORED: AttemptToSave = {
  criteria_scores: null,
  total: null,
  result: 'unscored',
  feedback_text: null,
  prompt_version: null,
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
    return reply(500, { error: 'server_error' });
  }

  try {
    // 1. Who's asking. Only signed-in users can score answers.
    const user = await signedInUser(req);
    if (!user) return reply(401, { error: 'not_signed_in' });
    const userId = user.id;

    // 2. Is the request well formed? Refused requests save nothing.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return reply(400, { error: 'bad_request' });
    }
    const todayUtc = new Date().toISOString().slice(0, 10);
    // Only the test user may send a date further than a day away ("Skip to tomorrow").
    const checked = validateRequest(body, todayUtc, user.email === TEST_USER_EMAIL);
    if (!checked.ok) return reply(400, { error: checked.problem });
    const request = checked.request;

    // 3. The exercise must exist, be a written type, and be approved (drafts are for calibration only).
    const exercise = await loadExercise(request.exercise_id);
    if (!exercise || !WRITTEN_TYPES.includes(exercise.response_type) || !exercise.rubric) {
      return reply(404, { error: 'not_found' });
    }
    if (exercise.status !== 'approved') return reply(403, { error: 'not_available' });
    // Open text needs at least 8 words; a six-word story exactly six (the app checks first; this is
    // the backstop). Refused, so nothing is saved, like an answer over 1,000 characters.
    const lengthProblem = answerLengthProblem(exercise.response_type, request.response_text);
    if (lengthProblem) return reply(400, { error: lengthProblem });
    // If the exercise was edited mid-answer, the current rubric and version are used (SPEC section 6).

    // 4. Daily limit: on the 11th call, save the attempt as unscored without calling the AI.
    //    The app shows the unscored fallback, and the day still counts (P6).
    if (isOverDailyLimit(await openTextAttempts(userId, request.local_date))) {
      console.log(`Unscored ${exercise.id}: daily scoring limit reached.`);
      const attemptId = await saveAttempt(userId, request, exercise, UNSCORED);
      return reply(200, {
        attempt_id: attemptId,
        result: 'unscored',
        total: null,
        feedback: null,
        exercise_version: exercise.version,
      });
    }

    // 5. Ask the AI. Any failure, timeout or invalid reply becomes "unscored", never a guess.
    const config = readModelConfig((name) => Deno.env.get(name));
    let outcome: AttemptToSave;
    if (typeof config === 'string') {
      console.error(`Unscored ${exercise.id}: AI config problem. ${config}`);
      outcome = UNSCORED;
    } else {
      // Code picks the feedback's opening style, rotating by the user's earlier open-text attempts.
      const openerStyle = openerStyleFor(await openTextAttempts(userId));
      const scored = await scoreAnswer(
        exercise as ExerciseRow & { rubric: RubricRow[] },
        request.response_text,
        config,
        openerStyle,
      );
      if (scored.result === 'unscored') {
        console.error(`Unscored ${exercise.id}: ${scored.reason}`);
        outcome = { ...UNSCORED, prompt_version: scored.promptVersion };
      } else {
        outcome = {
          criteria_scores: scored.criteriaScores,
          total: scored.total,
          result: scored.result,
          feedback_text: scored.feedback,
          prompt_version: scored.promptVersion,
        };
      }
    }

    // 6. Save and return. The app gets the result and feedback, never the criterion scores.
    const attemptId = await saveAttempt(userId, request, exercise, outcome);
    return reply(200, {
      attempt_id: attemptId,
      result: outcome.result,
      total: outcome.total,
      feedback: outcome.feedback_text,
      exercise_version: exercise.version,
    });
  } catch (error) {
    console.error(`score-response failed: ${(error as Error).message}`);
    return reply(500, { error: 'server_error' });
  }
});
