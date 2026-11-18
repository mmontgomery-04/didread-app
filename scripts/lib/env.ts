// Shared helpers for the PC scripts: read settings from the git-ignored .env file and build the
// headers Supabase expects. Never prints a key.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..', '..');
const ENV_FILE = join(ROOT, '.env');

/** Loads .env once. Exits with plain-English help if it's missing or a setting isn't filled in. */
export function requireEnv(...names: string[]): Record<string, string> {
  if (!existsSync(ENV_FILE)) {
    console.error('There is no .env file in the DidRead folder yet. See docs/BATCH7-SETUP.md, step 2.');
    process.exit(1);
  }
  process.loadEnvFile(ENV_FILE);
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) values[name] = value;
    else missing.push(name);
  }
  if (missing.length > 0) {
    console.error(`These settings are empty or missing in .env: ${missing.join(', ')}. See docs/BATCH7-SETUP.md.`);
    process.exit(1);
  }
  if (values.SUPABASE_URL) {
    // Keep only https://<ref>.supabase.co, in case a longer URL (e.g. ending /rest/v1/) was pasted.
    try {
      const url = new URL(values.SUPABASE_URL);
      if (url.pathname !== '/') console.log('(Using only the start of SUPABASE_URL, up to .supabase.co.)');
      values.SUPABASE_URL = url.origin;
    } catch {
      console.error('SUPABASE_URL in .env should look like https://abcd1234.supabase.co');
      process.exit(1);
    }
  }
  return values;
}

/** Headers for a Supabase key. New-style keys (sb_...) go only in apikey; older JWT keys also in Authorization. */
export function keyHeaders(key: string): Record<string, string> {
  return key.startsWith('eyJ') ? { apikey: key, authorization: `Bearer ${key}` } : { apikey: key };
}
