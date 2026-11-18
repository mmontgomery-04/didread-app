// Tests the deployed score-response function from the PC, signed in as the dashboard test user
// (batch 7; the app keeps its test feedback until sign-in works in batch 5).
//
//   npm run test-score-response            Checks that bad requests are refused and nothing is saved.
//                                          Calls no AI, costs nothing. The draft check uses
//                                          DRAFT_EXERCISE, an open-text exercise that is still a draft.
//                                          (The test user may send dates far from today, for "Skip to
//                                          tomorrow", so the date check uses a date that doesn't exist.)
//   npm run test-score-response -- real    Scores inf-f-001's 3 anchors with the real AI (3 calls),
//                                          and a six-word story (STORY_EXERCISE's strong anchor, 1 call).
//                                          Needs both exercises approved.
//   npm run test-score-response -- limit   Uses up the rest of today's 10 scoring calls, then checks
//                                          that the 11th is saved as unscored without feedback.
//                                          Up to 10 AI calls. Also needs inf-f-001 approved.
//   Add a date after real or limit (e.g. -- real 2026-10-01) to use it instead of the PC's date.
//
// Settings come from .env (see docs/BATCH7-SETUP.md). Nothing secret is printed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { keyHeaders, requireEnv, ROOT } from './lib/env.ts';

const env = requireEnv('SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'TEST_USER_EMAIL', 'TEST_USER_PASSWORD');
const mode = process.argv[2] ?? 'checks';
if (!['checks', 'real', 'limit'].includes(mode)) {
  console.error('Use no word, "real" or "limit". For example:  npm run test-score-response -- real');
  process.exit(1);
}

const EXERCISE = 'inf-f-001';
/** An open-text exercise that is still a draft (Advanced, not yet approved). Change it if it gets approved. */
const DRAFT_EXERCISE = 'inf-a-001';
/** An approved six-word story (Oct 15: the 8-word rule used to refuse every story). */
const STORY_EXERCISE = 'art-d-006';
const STORY = 'Wrong contact. Lemon? Never. Chocolate, then.';
const publicHeaders = keyHeaders(env.SUPABASE_PUBLISHABLE_KEY);
const functionUrl = `${env.SUPABASE_URL}/functions/v1/score-response`;

interface Anchor {
  label: string;
  text: string;
  expected_pass: boolean;
}
const contentFile = JSON.parse(readFileSync(join(ROOT, 'docs', 'content', 'exercises-v1.json'), 'utf8')) as {
  exercises: { id: string; anchors?: Anchor[] }[];
};
const anchors = contentFile.exercises.find((e) => e.id === EXERCISE)!.anchors!;

/**
 * The PC's local date, like the app sends (P6). An optional date after the mode
 * (e.g. `-- real 2026-10-01`) is used instead, so a test can run after today's 10 calls are used up.
 * The function only accepts dates within one day of the UTC date.
 */
const dateOverride = process.argv[3];
if (dateOverride !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
  console.error('The optional date must look like 2026-10-01.');
  process.exit(1);
}
function localDate(): string {
  if (dateOverride) return dateOverride;
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const goodBody = (responseText: string) => ({
  exercise_id: EXERCISE,
  exercise_version: 1,
  response_text: responseText,
  kind: 'bonus',
  local_date: localDate(),
  reading_seconds: 60,
});

// --- Sign in as the test user -------------------------------------------------------------------
const signIn = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { ...publicHeaders, 'content-type': 'application/json' },
  body: JSON.stringify({ email: env.TEST_USER_EMAIL, password: env.TEST_USER_PASSWORD }),
});
if (!signIn.ok) {
  console.error(`Couldn't sign in as the test user (HTTP ${signIn.status}). Check TEST_USER_EMAIL and`);
  console.error('TEST_USER_PASSWORD in .env, and that the user exists in Authentication -> Users.');
  process.exit(1);
}
const { access_token: token } = (await signIn.json()) as { access_token: string };
console.log(`Signed in as the test user.\n`);

async function callFunction(body: unknown, signedIn = true) {
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      ...publicHeaders,
      'content-type': 'application/json',
      ...(signedIn ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

/** The test user's written attempts (open text and six-word stories, as the daily limit counts them), read with their own sign-in. */
async function attemptCount(date?: string): Promise<number> {
  const filter = date ? `&local_date=eq.${date}` : '';
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/attempts?select=id&response_type=in.(open_text,six_word_story)${filter}`, {
    headers: { ...publicHeaders, authorization: `Bearer ${token}`, prefer: 'count=exact', range: '0-0' },
  });
  const total = Number((res.headers.get('content-range') ?? '').split('/')[1]);
  if (!res.ok || !Number.isInteger(total)) throw new Error(`Couldn't count attempts (HTTP ${res.status}).`);
  return total;
}

let failures = 0;
function report(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const strong = anchors.find((a) => a.label === 'strong')!.text;

if (mode === 'checks') {
  const before = await attemptCount();

  let r = await callFunction(goodBody(strong), false);
  report('Signed out is refused', r.status === 401, `HTTP ${r.status}`);

  r = await callFunction({ ...goodBody(strong), exercise_id: DRAFT_EXERCISE });
  report(`Draft ${DRAFT_EXERCISE} is refused for app users`, r.status === 403 && r.json.error === 'not_available',
    `HTTP ${r.status} ${r.json.error ?? ''}`);

  r = await callFunction(goodBody('word '.repeat(200) + 'x'));
  report('Over 1,000 characters is refused', r.status === 400 && r.json.error === 'too_long',
    `HTTP ${r.status} ${r.json.error ?? ''}`);

  r = await callFunction(goodBody('Only seven words in this short answer.'));
  report('Under 8 words is refused', r.status === 400 && r.json.error === 'too_short',
    `HTTP ${r.status} ${r.json.error ?? ''}`);

  r = await callFunction({ ...goodBody('Wrong contact. Lemon? Never. Chocolate.'), exercise_id: STORY_EXERCISE });
  report('A six-word story that is not six words is refused', r.status === 400 && r.json.error === 'not_six_words',
    `HTTP ${r.status} ${r.json.error ?? ''}`);

  r = await callFunction({ ...goodBody(strong), exercise_id: 'zzz-f-999' });
  report('An exercise that does not exist is refused', r.status === 404, `HTTP ${r.status}`);

  r = await callFunction({ ...goodBody(strong), exercise_id: 'comp-f-001' });
  report('A multiple-choice exercise is refused', r.status === 404, `HTTP ${r.status}`);

  r = await callFunction({ ...goodBody(strong), local_date: '2026-13-45' });
  report('A date that does not exist is refused', r.status === 400 && r.json.error === 'bad_request',
    `HTTP ${r.status} ${r.json.error ?? ''}`);

  r = await callFunction({ ...goodBody(strong), kind: undefined });
  report('A request without kind is refused', r.status === 400, `HTTP ${r.status}`);

  const after = await attemptCount();
  report('Nothing was saved by any of these', after === before, `${before} attempts before, ${after} after`);
}

if (mode === 'real') {
  const before = await attemptCount();
  for (const anchor of anchors) {
    const r = await callFunction(goodBody(anchor.text));
    const expected = anchor.expected_pass ? 'pass' : 'fail';
    console.log(`\n${anchor.label} anchor -> HTTP ${r.status}, result: ${r.json.result ?? r.json.error}, ` +
      `total: ${r.json.total ?? '-'} (expected ${expected})`);
    if (r.json.feedback) console.log(`  Feedback: ${r.json.feedback}`);
    report(`${anchor.label} anchor was scored`, r.status === 200 && (r.json.result === 'pass' || r.json.result === 'fail'));
    if (r.json.result === 'pass' || r.json.result === 'fail') {
      report(`${anchor.label} anchor ${r.json.result === expected ? 'matches' : 'does NOT match'} the expected result`,
        r.json.result === expected);
    }
  }
  const story = await callFunction({ ...goodBody(STORY), exercise_id: STORY_EXERCISE });
  console.log(`\nSix-word story (${STORY_EXERCISE}) -> HTTP ${story.status}, result: ${story.json.result ?? story.json.error}`);
  report('A six-word story of exactly six words is scored', story.status === 200 && typeof story.json.attempt_id === 'string');
  const after = await attemptCount();
  console.log('');
  report('Each call saved exactly one attempt', after === before + anchors.length + 1, `${before} before, ${after} after`);
  console.log('\nOne run is a smoke test. Batch 8 calibration runs each anchor 5 times on 2-3 models.');
}

if (mode === 'limit') {
  const today = localDate();
  let used = await attemptCount(today);
  console.log(`The test user has ${used} open-text attempts today (${today}).`);
  while (used < 10) {
    const r = await callFunction(goodBody(strong));
    used += 1;
    console.log(`  Call ${used}: HTTP ${r.status}, result ${r.json.result ?? r.json.error}`);
    if (r.status !== 200) break;
  }
  const r = await callFunction(goodBody(strong));
  report('The 11th call today is saved as unscored', r.status === 200 && r.json.result === 'unscored',
    `HTTP ${r.status}, result ${r.json.result ?? r.json.error}`);
  report('The 11th call has no AI feedback', !r.json.feedback);
  report('It was saved (the day counts)', typeof r.json.attempt_id === 'string');
}

console.log(failures === 0 ? '\nEverything passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) process.exitCode = 1;
