// Proves what a production iPhone build does and doesn't contain (batch 5a). Run it with:
//   npm run check-production
//
// It builds the production JavaScript bundle (the same one EAS puts in a release build), then
// searches it:
//   * development-only things must be absent: the test sign-in, the test panel, the Apple button
//     placeholder;
//   * secrets from .env must be absent: the Supabase secret key and the test user's password
//     (searched for, never printed);
//   * as a control, wording that production should show must be present, which proves the search
//     can see inside the bundle at all.
// Prints PASS or FAIL for each check and exits with an error if anything fails.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ROOT } from './lib/env.ts';

const outDir = mkdtempSync(join(tmpdir(), 'didread-production-check-'));
console.log('Building the production iPhone bundle (takes a minute)…');
const build = spawnSync(`npx expo export --platform ios --output-dir "${outDir}"`, {
  cwd: ROOT,
  shell: true,
  encoding: 'utf8',
});
if (build.status !== 0) {
  console.error(build.stdout, build.stderr);
  console.error('\nThe production build failed, so nothing was checked.');
  process.exit(1);
}

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}
const bundles = filesIn(outDir).filter((f) => /\.(hbc|js)$/.test(f));
const bundle = Buffer.concat(bundles.map((f) => readFileSync(f)));
const contains = (text: string) => bundle.includes(Buffer.from(text, 'utf8'));

// Secrets, read from .env without printing them. Missing ones are simply not checked.
const secrets: Record<string, string> = {};
try {
  process.loadEnvFile(join(ROOT, '.env'));
  for (const name of ['SUPABASE_SECRET_KEY', 'TEST_USER_PASSWORD']) {
    const value = process.env[name]?.trim();
    if (value) secrets[name] = value;
  }
} catch {
  // No .env: nothing to compare against.
}

const checks: [string, boolean][] = [
  ['Control: Welcome wording is in the bundle ("Too long? Read it anyway.")', contains('Too long? Read it anyway.')],
  ['Test sign-in is absent ("Sign in as test user")', !contains('Sign in as test user')],
  ['Test sign-in fields are absent ("Test user password")', !contains('Test user password')],
  ['Apple button placeholder is absent', !contains('Sign in with Apple button goes here')],
  ['Test panel is absent ("Reset progress")', !contains('Reset progress')],
  ['Test panel is absent ("Send a test reminder")', !contains('Send a test reminder')],
  ...Object.entries(secrets).map(([name, value]): [string, boolean] => [`${name} from .env is absent`, !contains(value)]),
];

rmSync(outDir, { recursive: true, force: true });

console.log('');
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`);
if (failed > 0) process.exitCode = 1;
