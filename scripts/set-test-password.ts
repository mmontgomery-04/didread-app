// Sets a new password for the test user (test@didread.test), one you can type on the iPhone for
// the test panel's "Sign in as test user" (batch 5a). Run it with:  npm run set-test-password
//
// You type the new password here, twice; it isn't shown on screen. It's saved in Supabase and in
// .env as TEST_USER_PASSWORD (the scripts use it too). Never printed, never sent anywhere else.
// Uses SUPABASE_URL and SUPABASE_SECRET_KEY from .env.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { keyHeaders, requireEnv, ROOT } from './lib/env.ts';

const EMAIL = 'test@didread.test';
const MIN_LENGTH = 10;
const env = requireEnv('SUPABASE_URL', 'SUPABASE_SECRET_KEY');
const headers = { ...keyHeaders(env.SUPABASE_SECRET_KEY), 'content-type': 'application/json' };

/** Asks a question and reads the answer without showing what's typed. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    const output = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    output._writeToOutput = (s: string) => {
      if (!muted) output.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

const password = await askHidden(`New password for ${EMAIL} (at least ${MIN_LENGTH} characters): `);
if (password.length < MIN_LENGTH) {
  console.error(`That's ${password.length} characters; use at least ${MIN_LENGTH}. Nothing was changed.`);
  process.exit(1);
}
if (/\s/.test(password)) {
  console.error('Please leave out spaces. Nothing was changed.');
  process.exit(1);
}
if ((await askHidden('Type it again: ')) !== password) {
  console.error("The two didn't match. Nothing was changed.");
  process.exit(1);
}

// Find the test user, then set the new password.
const list = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
if (!list.ok) {
  console.error(`Couldn't read the users list (HTTP ${list.status}). Check SUPABASE_URL and SUPABASE_SECRET_KEY in .env.`);
  process.exit(1);
}
const users = ((await list.json()) as { users: { id: string; email?: string }[] }).users;
const user = users.find((u) => u.email === EMAIL);
if (!user) {
  console.error(`There's no ${EMAIL} yet. Run npm run create-test-user first.`);
  process.exit(1);
}
const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ password }),
});
if (!res.ok) {
  const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
  console.error(`Supabase didn't accept it (HTTP ${res.status}): ${body.msg ?? body.message ?? 'no details'}. Nothing was changed.`);
  process.exit(1);
}

// Keep .env in step, so the PC scripts keep working.
const envFile = join(ROOT, '.env');
const text = readFileSync(envFile, 'utf8');
const line = /^TEST_USER_PASSWORD=.*$/m;
writeFileSync(
  envFile,
  line.test(text) ? text.replace(line, `TEST_USER_PASSWORD=${password}`) : `${text.replace(/\s*$/, '')}\nTEST_USER_PASSWORD=${password}\n`,
);
console.log(`Done. ${EMAIL} has the new password, and .env has it too (not shown here).`);
