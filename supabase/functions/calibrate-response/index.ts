// calibrate-response: scores one anchor of one exercise, for the batch 8 calibration script
// (scripts/calibrate.ts). SPEC section 5, "QC pipeline", and section 6.
//
// * Only the Supabase SECRET key can use it, never the app: the caller's key must be able to read
//   exercises.anchors, which signed-in users and the publishable key can't (batch 4 security).
// * Scores exercises of any status (calibrating drafts is the point), with the same prompt and checks
//   as score-response, so calibration measures exactly what users will get.
// * The model can be chosen per call (to compare models); the provider and AI key come from the
//   Supabase secrets, as for score-response. The AI key never leaves Supabase.
// * Saves nothing. Returns the scores, feedback and token counts.
//
// Deploy:  npx supabase functions deploy calibrate-response --project-ref <ref> --use-api --no-verify-jwt
import { readModelConfig } from '../_shared/providers.ts';
import type { OpenerStyle, RubricRow } from '../_shared/prompt-v6.ts';
import { scoreAnswer } from '../_shared/scoreAnswer.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

interface Anchor {
  label: string;
  text: string;
}

interface CalibrationRow {
  id: string;
  passage: string;
  question: string;
  response_type: string;
  rubric: RubricRow[] | null;
  anchors: Anchor[] | null;
}

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** The caller's key, sent the way Supabase expects it. */
function callerHeaders(key: string): Record<string, string> {
  return key.startsWith('eyJ') ? { apikey: key, authorization: `Bearer ${key}` } : { apikey: key };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  try {
    // The script sends the secret key as apikey; if Supabase's gateway passes it on as a bearer
    // token instead, use that. Either way the anchors check below decides.
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const key = req.headers.get('apikey') || bearer;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return reply(400, { error: 'bad_request' });
    }
    if (!isObject(body)) return reply(400, { error: 'bad_request' });
    const { exercise_id, anchor_index, model, opener_style } = body;
    if (typeof exercise_id !== 'string' || !/^[a-z]+-[a-z]+-[0-9]{3}$/.test(exercise_id)) {
      return reply(400, { error: 'bad_request' });
    }
    if (!Number.isInteger(anchor_index) || (anchor_index as number) < 0) return reply(400, { error: 'bad_request' });
    if (typeof model !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(model)) return reply(400, { error: 'bad_request' });
    if (opener_style !== 1 && opener_style !== 2 && opener_style !== 3) return reply(400, { error: 'bad_request' });

    // Reading anchors with the caller's own key is the permission check: only the secret key can.
    if (!key) return reply(401, { error: 'secret_key_required' });
    const select = 'id,passage,question,response_type,rubric,anchors';
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/exercises?id=eq.${encodeURIComponent(exercise_id)}&select=${select}`,
      { headers: callerHeaders(key) },
    );
    if (res.status === 401 || res.status === 403) return reply(401, { error: 'secret_key_required' });
    if (!res.ok) {
      // A key without access to the anchors column gets a "permission denied" error here.
      const detail = (await res.json().catch(() => ({}))) as { code?: string };
      if (detail.code === '42501') return reply(401, { error: 'secret_key_required' });
      throw new Error(`Loading exercise failed: HTTP ${res.status}`);
    }
    const exercise = ((await res.json()) as CalibrationRow[])[0];
    if (!exercise || !['open_text', 'six_word_story'].includes(exercise.response_type) || !exercise.rubric || !exercise.anchors) {
      return reply(404, { error: 'not_found' });
    }
    const anchor = exercise.anchors[anchor_index as number];
    if (!anchor) return reply(404, { error: 'no_such_anchor' });

    const config = readModelConfig((name) => Deno.env.get(name));
    if (typeof config === 'string') return reply(500, { error: 'ai_config', detail: config });

    const scored = await scoreAnswer(
      { passage: exercise.passage, question: exercise.question, rubric: exercise.rubric, response_type: exercise.response_type },
      anchor.text,
      { ...config, model },
      opener_style as OpenerStyle,
    );
    const tokens = { input_tokens: scored.reply?.inputTokens ?? null, output_tokens: scored.reply?.outputTokens ?? null };
    if (scored.result === 'unscored') {
      return reply(200, { result: 'unscored', reason: scored.reason, prompt_version: scored.promptVersion, ...tokens });
    }
    return reply(200, {
      result: scored.result,
      total: scored.total,
      criteria_scores: scored.criteriaScores,
      flags: scored.flags,
      feedback: scored.feedback,
      prompt_version: scored.promptVersion,
      ...tokens,
    });
  } catch (error) {
    console.error(`calibrate-response failed: ${(error as Error).message}`);
    return reply(500, { error: 'server_error' });
  }
});
