// Creates the dashboard test user for npm run test-score-response (batch 7), with a new random
// password, and writes the email and password into .env. Run it with:  npm run create-test-user
//
// Uses SUPABASE_URL and SUPABASE_SECRET_KEY from .env. Never prints the key or the password.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { keyHeaders, requireEnv, ROOT } from './lib/env.ts';

const EMAIL = 'test@didread.test';
const env = requireEnv('SUPABASE_URL', 'SUPABASE_SECRET_KEY');

if (process.env.TEST_USER_PASSWORD?.trim()) {
  console.error('.env already has a TEST_USER_PASSWORD, so no new user was made.');
  console.error('To start over, delete the test user in Authentication -> Users and empty that line in .env.');
  process.exit(1);
}

// 32 random bytes as letters, digits, - and _ (43 characters). Strong, and safe in a .env line.
const password = randomBytes(32).toString('base64url');

const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { ...keyHeaders(env.SUPABASE_SECRET_KEY), 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password, email_confirm: true }),
});
if (!res.ok) {
  const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string; error_code?: string };
  console.error(`Couldn't create ${EMAIL} (HTTP ${res.status}): ${body.msg ?? body.message ?? body.error_code ?? 'no details'}`);
  if (res.status === 422) console.error('It may already exist: check Authentication -> Users in the dashboard.');
  if (res.status === 401 || res.status === 403) console.error('Check SUPABASE_URL and SUPABASE_SECRET_KEY in .env.');
  process.exit(1);
}

// Fill in the two TEST_USER lines in .env (add them if they're missing). Other lines are untouched.
const envFile = join(ROOT, '.env');
let text = readFileSync(envFile, 'utf8');
const setLine = (name: string, value: string) => {
  const line = new RegExp(`^${name}=.*$`, 'm');
  text = line.test(text) ? text.replace(line, `${name}=${value}`) : `${text.replace(/\s*$/, '')}\n${name}=${value}\n`;
};
setLine('TEST_USER_EMAIL', EMAIL);
setLine('TEST_USER_PASSWORD', password);
writeFileSync(envFile, text);

console.log(`Created the test user ${EMAIL} (email already confirmed).`);
console.log('Its new password is saved in .env as TEST_USER_PASSWORD (not shown here).');
