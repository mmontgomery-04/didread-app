// Loads the exercises in docs/content/exercises-*.json into the Supabase exercises table
// (SPEC section 5, "Adding exercises: the import script"). Run it with:  npm run import-exercises
//
// * Runs `npm run check-content` first and stops if anything is wrong.
// * Adds new exercises and updates existing ones, keeping each exercise's status as written in the
//   file. So if you changed a status in the dashboard, importing sets it back to the file's status.
// * version and first_approved_at are managed by the database (batch 7 migration); the file's
//   version is ignored.
// * All four types: open text, multiple choice, and (from batch 6a) tap the sentence and put it in order.
// * Story series chapters go in the same files, with series_id, series_title, chapter and previously.
// * Batch 15: also loads the Word of the Day words in docs/content/words-*.json into the words
//   table, keeping each word's status the same way.
// * Uses the Supabase secret key from .env. It's never printed.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { keyHeaders, requireEnv, ROOT } from './lib/env.ts';

const COLUMNS = [
  'id', 'title', 'skill', 'band', 'topic', 'sequence', 'passage', 'question', 'response_type',
  'options', 'correct_option_id', 'mc_feedback', 'rubric', 'anchors', 'editorial_notes', 'status',
  // Batch 6a: tap the sentence and put it in order.
  'sentences', 'correct_sentence_index', 'order_items', 'order_instruction', 'feedback',
  // Batch 13: starter reads, Bad Summary and Word Sprint.
  'starter', 'summaries', 'wrong_summary_id', 'error_type', 'rounds',
  // Story series (needs 20261016130000_story_series.sql run first).
  'series_id', 'series_title', 'chapter', 'previously',
] as const;

type Exercise = Record<string, unknown> & { id: string; response_type: string };

const env = requireEnv('SUPABASE_URL', 'SUPABASE_SECRET_KEY');
const api = `${env.SUPABASE_URL}/rest/v1/exercises`;
const headers = { ...keyHeaders(env.SUPABASE_SECRET_KEY), 'content-type': 'application/json' };

// 1. Content check first.
const check = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/check-content.ts'], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (check.status !== 0) {
  console.error('\nNothing was imported. Fix the problems above, then run this again.');
  process.exit(1);
}

// 2. Read every exercise file.
const contentDir = join(ROOT, 'docs', 'content');
const exercises: Exercise[] = [];
for (const file of readdirSync(contentDir).filter((f) => /^exercises-.*\.json$/.test(f)).sort()) {
  const data = JSON.parse(readFileSync(join(contentDir, file), 'utf8')) as { exercises: Exercise[] };
  exercises.push(...data.exercises);
}

// 3. What's in the database now, to report added / updated / unchanged.
const before = await fetch(`${api}?select=id,status,version`, { headers });
if (!before.ok) {
  console.error(`\nCouldn't read the exercises table (HTTP ${before.status}): ${await before.text()}`);
  console.error('Check SUPABASE_URL and SUPABASE_SECRET_KEY in .env.');
  process.exit(1);
}
const existing = new Map(
  ((await before.json()) as { id: string; status: string; version: number }[]).map((r) => [r.id, r]),
);

// 4. Save each exercise. One at a time, so a problem names the exercise.
console.log('');
let failed = 0;
for (const e of exercises) {
  const row = Object.fromEntries(COLUMNS.map((c) => [c, e[c] ?? null]));
  row.starter = e.starter === true; // a required true/false column: missing means false
  const res = await fetch(`${api}?on_conflict=id&select=id,status,version`, {
    method: 'POST',
    headers: { ...headers, prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    failed += 1;
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    console.log(`✗ ${e.id}: not saved. ${body.message ?? `HTTP ${res.status}`}`);
    continue;
  }
  const [saved] = (await res.json()) as { id: string; status: string; version: number }[];
  const old = existing.get(e.id);
  const what = !old
    ? 'added'
    : old.version !== saved.version
      ? `updated, version ${old.version} → ${saved.version}`
      : old.status !== saved.status
        ? `status ${old.status} → ${saved.status}`
        : 'saved (version unchanged)';
  console.log(`✓ ${e.id}: ${what}. Status ${saved.status}, version ${saved.version}.`);
}

const ok = exercises.length - failed;
console.log(`\nImported ${ok} of ${exercises.length} exercises.`);

// 5. Word of the Day words (batch 15), if there are any files of them.
const WORD_COLUMNS = [
  'id', 'word', 'part_of_speech', 'meaning', 'example', 'sequence', 'status', 'editorial_notes',
  // Batch 16: the choice.
  'wrong_meanings', 'right_message', 'wrong_message',
] as const;
const words: Record<string, unknown>[] = [];
for (const file of readdirSync(contentDir).filter((f) => /^words-.*\.json$/.test(f)).sort()) {
  words.push(...(JSON.parse(readFileSync(join(contentDir, file), 'utf8')) as { words: Record<string, unknown>[] }).words);
}
let wordsFailed = 0;
if (words.length > 0) {
  console.log('');
  for (const w of words) {
    const row = Object.fromEntries(WORD_COLUMNS.map((c) => [c, w[c] ?? null]));
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/words?on_conflict=id`, {
      method: 'POST',
      headers: { ...headers, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      wordsFailed += 1;
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      console.log(`✗ ${String(w.id)}: not saved. ${body.message ?? `HTTP ${res.status}`}`);
      continue;
    }
    console.log(`✓ ${String(w.id)} (${String(w.word)}): saved. Status ${String(w.status)}.`);
  }
  console.log(`\nImported ${words.length - wordsFailed} of ${words.length} words.`);
}
if (failed > 0 || wordsFailed > 0) process.exitCode = 1;
