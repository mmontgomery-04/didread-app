// Batch 8 calibration (SPEC section 5, "QC pipeline", step 3; section 9, batch 8). Run it with:
//
//   npm run calibrate                    every open-text exercise that isn't retired
//   npm run calibrate -- inf-f-001 ...   only these exercises
//
// For each model in scripts/calibration-models.json, every anchor of every exercise is scored 5 times
// through the calibrate-response backend function (the AI key stays in Supabase). Runs 1-5 use
// feedback opening styles 1, 2, 3, 1, 2, so the report also shows opener variety. The report says
// which exercises pass the calibration rule, each model's pass rate, and its estimated cost per call.
// It's printed here and saved in docs/calibration/. Nothing is saved in the database, and no
// exercise status is changed: the founder does that in docs/content/ and imports.
//
// Hard stop: the run doesn't start if its estimated cost is over max_run_cost_usd, and it stops
// early if the actual cost gets there.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildSystemPrompt,
  buildUserMessage,
  PROMPT_VERSION,
  type OpenerStyle,
  type RubricRow,
} from '../supabase/functions/_shared/prompt-v6.ts';
import {
  callCost,
  estimateTokens,
  firstSentence,
  judgeExercise,
  asksOneQuestion,
  opensWithGenericPraise,
  RUNS,
  type AnchorSpec,
  type ExerciseVerdict,
  type ModelPrice,
  type RunResult,
} from './lib/calibration.ts';
import { keyHeaders, requireEnv, ROOT } from './lib/env.ts';

const MAX_OUTPUT_TOKENS = 400; // worst case per call, for the estimate
const PARALLEL_CALLS = 4;
const styleForRun = (run: number): OpenerStyle => ((run % 3) + 1) as OpenerStyle;

// --- Settings -------------------------------------------------------------------------------------
const settings = JSON.parse(readFileSync(join(ROOT, 'scripts', 'calibration-models.json'), 'utf8')) as {
  max_run_cost_usd: number;
  models: { model: string; input_usd_per_million: number | null; output_usd_per_million: number | null }[];
};
const unpriced = settings.models.filter(
  (m) => typeof m.input_usd_per_million !== 'number' || typeof m.output_usd_per_million !== 'number',
);
if (unpriced.length > 0) {
  console.error(`Fill in the prices in scripts/calibration-models.json first (missing for ${unpriced.map((m) => m.model).join(', ')}).`);
  process.exit(1);
}
const models = settings.models as ModelPrice[];
const maxCost = settings.max_run_cost_usd;

const env = requireEnv('SUPABASE_URL', 'SUPABASE_SECRET_KEY');
const headers = { ...keyHeaders(env.SUPABASE_SECRET_KEY), 'content-type': 'application/json' };

// --- Exercises: from the database, which must match docs/content/ ----------------------------------
interface Exercise {
  id: string;
  status: string;
  version: number;
  passage: string;
  question: string;
  rubric: RubricRow[];
  anchors: (AnchorSpec & { text: string })[];
}

const res = await fetch(
  `${env.SUPABASE_URL}/rest/v1/exercises?response_type=in.(open_text,six_word_story)&status=neq.retired` +
    '&select=id,status,version,passage,question,rubric,anchors&order=id',
  { headers },
);
if (!res.ok) {
  console.error(`Couldn't read exercises (HTTP ${res.status}). Check SUPABASE_URL and SUPABASE_SECRET_KEY in .env.`);
  process.exit(1);
}
let exercises = (await res.json()) as Exercise[];
const onlyIds = process.argv.slice(2);
if (onlyIds.length > 0) {
  const unknown = onlyIds.filter((id) => !exercises.some((e) => e.id === id));
  if (unknown.length > 0) {
    console.error(`Not found as open-text exercises in the database: ${unknown.join(', ')}.`);
    process.exit(1);
  }
  exercises = exercises.filter((e) => onlyIds.includes(e.id));
}
if (exercises.length === 0) {
  console.error('No open-text exercises to calibrate. Run npm run import-exercises first.');
  process.exit(1);
}

/** JSON with object keys sorted, so database and file copies compare fairly. */
function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canon(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
const local = new Map<string, Record<string, unknown>>();
const contentDir = join(ROOT, 'docs', 'content');
for (const file of readdirSync(contentDir).filter((f) => /^exercises-.*\.json$/.test(f))) {
  for (const e of (JSON.parse(readFileSync(join(contentDir, file), 'utf8')) as { exercises: Record<string, unknown>[] }).exercises) {
    local.set(e.id as string, e);
  }
}
const outOfDate = exercises.filter((e) => {
  const l = local.get(e.id);
  return !l || (['passage', 'question', 'rubric', 'anchors'] as const).some((k) => canon(l[k]) !== canon(e[k]));
});
if (outOfDate.length > 0) {
  console.error(`The database doesn't match docs/content/ for: ${outOfDate.map((e) => e.id).join(', ')}.`);
  console.error('Run npm run import-exercises first, so calibration tests what is in the files.');
  process.exit(1);
}

// --- Estimate and hard stop ------------------------------------------------------------------------
const estimatedInput = (e: Exercise, anchorIndex: number) =>
  estimateTokens(buildSystemPrompt(e, 1) + buildUserMessage(e.anchors[anchorIndex].text)) + 20;
const callsPerModel = exercises.reduce((n, e) => n + e.anchors.length * RUNS, 0);
const estimateFor = (m: ModelPrice) =>
  exercises.reduce(
    (sum, e) => sum + e.anchors.reduce((s, _a, i) => s + RUNS * callCost(m, estimatedInput(e, i), MAX_OUTPUT_TOKENS), 0),
    0,
  );
const estimate = models.reduce((sum, m) => sum + estimateFor(m), 0);
const usd = (n: number) => `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
console.log(`Calibrating ${plural(exercises.length, 'exercise')} × ${callsPerModel / exercises.length} runs ` +
  `(anchors × ${RUNS}) × ${plural(models.length, 'model')} = ${callsPerModel * models.length} calls.`);
console.log(`Estimated cost: at most ${usd(estimate)} (limit ${usd(maxCost)}).`);
if (estimate > maxCost) {
  console.error(`That's over the ${usd(maxCost)} limit, so nothing was run. Calibrate fewer exercises or models.`);
  process.exit(1);
}

// --- Run -------------------------------------------------------------------------------------------
interface Call {
  model: ModelPrice;
  exercise: Exercise;
  anchorIndex: number;
  run: number;
}
interface Outcome extends Call {
  result: RunResult;
  feedback: string | null;
  reason: string | null;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  promptVersion: string | null;
}

let spent = 0;
let stoppedForCost = false;
const outcomes: Outcome[] = [];
const unavailable = new Map<string, string>();

async function callOnce(call: Call): Promise<Outcome> {
  const r = await fetch(`${env.SUPABASE_URL}/functions/v1/calibrate-response`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      exercise_id: call.exercise.id,
      anchor_index: call.anchorIndex,
      model: call.model.model,
      opener_style: styleForRun(call.run),
    }),
  });
  const body = (await r.json().catch(() => ({}))) as Record<string, any>;
  if (r.status === 401) {
    console.error('\ncalibrate-response refused the key (secret_key_required). Check SUPABASE_SECRET_KEY in .env.');
    process.exit(1);
  }
  const inputTokens = body.input_tokens ?? 0;
  const outputTokens = body.output_tokens ?? 0;
  const scored = r.ok && (body.result === 'pass' || body.result === 'fail');
  return {
    ...call,
    result: scored ? { result: body.result, criteria_scores: body.criteria_scores } : { result: 'unscored' },
    feedback: scored ? body.feedback : null,
    reason: scored ? null : (body.reason ?? body.detail ?? body.error ?? `HTTP ${r.status}`),
    inputTokens,
    outputTokens,
    cost: callCost(call.model, inputTokens, outputTokens),
    promptVersion: body.prompt_version ?? null,
  };
}

/** Why a model can't be used at all, judged from its first call's error, or null if it's usable. */
function whyUnusable(reason: string | null): string | null {
  if (!reason) return null;
  if (/HTTP 404|model_not_found|does not exist|invalid model/i.test(reason)) return 'not available on this account';
  if (/temperature/i.test(reason) && /unsupported|not support|invalid|only the default/i.test(reason)) {
    return 'rejects temperature 0';
  }
  return null;
}

for (const model of models) {
  const calls: Call[] = [];
  for (let run = 0; run < RUNS; run++) {
    for (const exercise of exercises) {
      exercise.anchors.forEach((_a, anchorIndex) => calls.push({ model, exercise, anchorIndex, run }));
    }
  }
  process.stdout.write(`\n${model.model}: `);

  // One call first, to check the model is available and accepts DidRead's settings.
  const first = await callOnce(calls[0]);
  spent += first.cost;
  const unusable = first.result.result === 'unscored' ? whyUnusable(first.reason) : null;
  if (unusable) {
    unavailable.set(model.model, `${unusable} (${first.reason})`);
    console.log(`skipped: ${unusable}.`);
    continue;
  }
  outcomes.push(first);

  let next = 1;
  let done = 1;
  const worker = async () => {
    while (next < calls.length && !stoppedForCost) {
      const call = calls[next++];
      const worst = callCost(model, estimatedInput(call.exercise, call.anchorIndex), MAX_OUTPUT_TOKENS);
      if (spent + worst > maxCost) {
        stoppedForCost = true;
        break;
      }
      const outcome = await callOnce(call);
      spent += outcome.cost;
      outcomes.push(outcome);
      if (++done % 10 === 0) process.stdout.write(`${done} `);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_CALLS }, worker));
  console.log(`${done} calls, ${usd(outcomes.filter((o) => o.model === model).reduce((s, o) => s + o.cost, 0))}`);
  if (stoppedForCost) {
    console.log(`\nStopped early: the next call could have taken the run over ${usd(maxCost)}.`);
    break;
  }
}

// --- Report ----------------------------------------------------------------------------------------
const lines: string[] = [];
const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
// Seconds too, so two runs in the same minute don't overwrite each other's report.
const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

lines.push(`# Calibration report, ${stamp} ${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4)}`, '');
lines.push(`Prompt \`${PROMPT_VERSION}\`. Each anchor scored ${RUNS} times; runs 1–5 use opening styles 1, 2, 3, 1, 2 ` +
  '(1 quotes their answer, 2 names the idea they got right, 3 says what their answer made the AI notice).');
lines.push('Rule (SPEC section 5): every criterion matches in at least 4 of 5 runs; strong always passes; weak always fails.');
lines.push(`Total cost of this run: ${usd(spent)}.${stoppedForCost ? ' **Stopped early at the cost limit; results are incomplete.**' : ''}`, '');

const verdicts = new Map<string, Map<string, ExerciseVerdict>>();
lines.push('## Summary', '');
lines.push('| Model | Exercises passed | Pass rate | Calls | Unscored | Avg tokens in / out | Est. cost per call | Cost | Generic-praise openers | Not exactly one question |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const model of models) {
  if (unavailable.has(model.model)) {
    lines.push(`| ${model.model} | skipped: ${unavailable.get(model.model)!.split(" (")[0]} | | | | | | | | |`);
    continue;
  }
  const mine = outcomes.filter((o) => o.model === model);
  if (mine.length === 0) {
    lines.push(`| ${model.model} | not run (cost limit) | | | | | | | | |`);
    continue;
  }
  const byExercise = new Map<string, ExerciseVerdict>();
  for (const e of exercises) {
    const runsByAnchor = e.anchors.map((_a, i) =>
      mine.filter((o) => o.exercise === e && o.anchorIndex === i).sort((a, b) => a.run - b.run).map((o) => o.result),
    );
    byExercise.set(e.id, judgeExercise(e.anchors, runsByAnchor));
  }
  verdicts.set(model.model, byExercise);
  const passed = [...byExercise.values()].filter((v) => v.passed).length;
  const scored = mine.filter((o) => o.feedback);
  const generic = scored.filter((o) => opensWithGenericPraise(o.feedback!)).length;
  const notOneQuestion = scored.filter((o) => !asksOneQuestion(o.feedback!)).length;
  const avgIn = Math.round(mine.reduce((s, o) => s + o.inputTokens, 0) / mine.length);
  const avgOut = Math.round(mine.reduce((s, o) => s + o.outputTokens, 0) / mine.length);
  const cost = mine.reduce((s, o) => s + o.cost, 0);
  lines.push(`| ${model.model} | ${passed} of ${exercises.length} | ${Math.round((passed / exercises.length) * 100)}% | ` +
    `${mine.length} | ${mine.length - scored.length} | ${avgIn} / ${avgOut} | ${usd(cost / mine.length)} | ${usd(cost)} | ` +
    `${generic} of ${scored.length} | ${notOneQuestion} of ${scored.length} |`);
}
lines.push('');

for (const [model, byExercise] of verdicts) {
  lines.push(`## ${model}`, '');
  lines.push('| Exercise | Status | Calibration | Strong / partial / weak passes | Problems |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const e of exercises) {
    const v = byExercise.get(e.id)!;
    const passes = v.anchors.map((a) => `${a.passes}/${a.passes + a.fails + a.unscored}`).join(' · ');
    lines.push(`| ${e.id} | ${e.status} | ${v.passed ? 'PASS' : 'FAIL'} | ${passes} | ${v.problems.join('; ') || '—'} |`);
  }
  const reasons = new Map<string, number>();
  for (const o of outcomes.filter((x) => x.model.model === model && x.reason)) {
    reasons.set(o.reason!, (reasons.get(o.reason!) ?? 0) + 1);
  }
  if (reasons.size > 0) {
    lines.push('', 'Unscored reasons:');
    for (const [reason, n] of reasons) lines.push(`- ${n}× ${reason}`);
  }
  lines.push('', 'Opening examples (first sentence, strong anchor):', '');
  for (const style of [1, 2, 3] as const) {
    const example = outcomes.find(
      (o) => o.model.model === model && o.feedback && o.anchorIndex === 0 && styleForRun(o.run) === style,
    );
    if (example) lines.push(`- Style ${style} (${example.exercise.id}): ${firstSentence(example.feedback!)}`);
  }
  lines.push('');
}
for (const [model, reason] of unavailable) lines.push(`${model} was skipped: ${reason}`, '');
lines.push('Statuses were not changed. To mark an exercise calibrated, change its status in docs/content/ and run npm run import-exercises.');

const report = lines.join('\n');
const dir = join(ROOT, 'docs', 'calibration');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${stamp}-${time}.md`);
writeFileSync(file, `${report}\n`);
console.log(`\n${report}\n\nSaved to docs/calibration/${stamp}-${time}.md`);
