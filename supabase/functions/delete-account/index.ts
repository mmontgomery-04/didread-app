// delete-account (batch 11b; SPEC section 8, Settings, and Apple's account-deletion rule).
// Deletes the signed-in caller's own account, and only theirs: the user to delete comes from the
// caller's own sign-in, never from the request. Every table's user_id is set to
// "on delete cascade", so their profile, attempts, daily assignments, skill state and free-writes
// go with the account.
//
// Apple token cleanup (SPEC section 9, batch 12): for a Sign in with Apple account, the app sends
// `apple_code`, a one-time code from Apple's sheet, and DidRead's access to their Apple ID is
// revoked first (_shared/appleRevoke.ts). Whatever Apple says, or with no code (an older app),
// the account is still deleted; the outcome is logged. Secrets (Supabase only, never the app):
// APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (the .p8 file's contents), APPLE_CLIENT_ID.
// Deploy:  npx supabase functions deploy delete-account --project-ref <ref> --use-api --no-verify-jwt
import { revokeAppleAccess, type AppleKey } from '../_shared/appleRevoke.ts';
import { reply, SERVICE_KEY, serviceHeaders, signedInUser, SUPABASE_URL } from '../_shared/service.ts';

function appleKey(): AppleKey | null {
  const key = {
    teamId: Deno.env.get('APPLE_TEAM_ID') ?? '',
    keyId: Deno.env.get('APPLE_KEY_ID') ?? '',
    privateKey: Deno.env.get('APPLE_PRIVATE_KEY') ?? '',
    clientId: Deno.env.get('APPLE_CLIENT_ID') ?? '',
  };
  return Object.values(key).every((v) => v !== '') ? key : null;
}

/** The account's Apple user id (its Sign in with Apple identity), or null if it has none. */
async function appleUserIdOf(userId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { identities?: { provider?: string; identity_data?: { sub?: unknown } }[] };
  const sub = user.identities?.find((i) => i.provider === 'apple')?.identity_data?.sub;
  return typeof sub === 'string' ? sub : null;
}

/** Revokes DidRead's Apple access when it can; never stops the deletion. Returns what happened, for the log. */
async function cleanUpApple(userId: string, code: unknown): Promise<string> {
  const appleUserId = await appleUserIdOf(userId);
  if (!appleUserId) return 'not_an_apple_account';
  if (typeof code !== 'string' || code === '') return 'no_code';
  const key = appleKey();
  if (!key) return 'apple_secrets_missing';
  return await revokeAppleAccess(key, code, appleUserId, Math.floor(Date.now() / 1000));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(500, { error: 'server_error' });
  try {
    const user = await signedInUser(req);
    if (!user) return reply(401, { error: 'not_signed_in' });

    const body = (await req.json().catch(() => ({}))) as { apple_code?: unknown };
    const apple = await cleanUpApple(user.id, body?.apple_code).catch(() => 'failed');
    console.log(`delete-account: Apple cleanup ${apple}`);

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new Error(`Deleting the account failed: HTTP ${res.status}`);
    return reply(200, { deleted: true });
  } catch (error) {
    console.error(`delete-account failed: ${(error as Error).message}`);
    return reply(500, { error: 'server_error' });
  }
});
