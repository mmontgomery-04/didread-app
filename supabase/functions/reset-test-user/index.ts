// reset-test-user: development only (SPEC decision log, batch 9, decision (f)). The test panel's
// "Reset progress" calls it to wipe the test user's progress: attempts, daily assignments, skill
// state and free-writes. The profile stays, so onboarding doesn't come back.
//
// Only the test user (test@didread.test) can use it, checked here from the sign-in; everyone
// else is refused and nothing is touched. It only ever deletes the caller's own rows.
// Deploy:  npx supabase functions deploy reset-test-user --project-ref <ref> --use-api --no-verify-jwt
import { TEST_USER_EMAIL } from '../_shared/contract.ts';
import { deleteOwnRows, reply, SERVICE_KEY, signedInUser, SUPABASE_URL } from '../_shared/service.ts';

const TABLES = ['attempts', 'daily_assignments', 'skill_state', 'free_writes'];

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(500, { error: 'server_error' });
  try {
    const user = await signedInUser(req);
    if (!user) return reply(401, { error: 'not_signed_in' });
    if (user.email !== TEST_USER_EMAIL) return reply(403, { error: 'test_user_only' });

    const deleted: Record<string, number> = {};
    for (const table of TABLES) deleted[table] = await deleteOwnRows(table, user.id);
    return reply(200, { deleted });
  } catch (error) {
    console.error(`reset-test-user failed: ${(error as Error).message}`);
    return reply(500, { error: 'server_error' });
  }
});
