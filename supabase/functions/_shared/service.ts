// Helpers for backend functions that act on the caller's own data with the service key
// (reset-test-user, delete-account). The service key bypasses row-level security, so these
// functions always check who's calling first and only ever touch that caller's rows.

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// Provided automatically by Supabase. If the project's legacy keys are ever turned off, add the
// secret key as the DIDREAD_SECRET_KEY secret.
export const SERVICE_KEY = Deno.env.get('DIDREAD_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { apikey: SERVICE_KEY, ...extra };
  // Older-style keys are JWTs and also go in Authorization; new sb_secret_ keys go only in apikey.
  if (SERVICE_KEY.startsWith('eyJ')) headers.authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}

/** The signed-in caller, or null. Supabase Auth checks the token. */
export async function signedInUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(auth)) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, authorization: auth } });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string };
  return typeof user.id === 'string' ? { id: user.id, email: user.email ?? null } : null;
}

/** Deletes every row of `table` belonging to `userId`. Returns how many went. */
export async function deleteOwnRows(table: string, userId: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: serviceHeaders({ prefer: 'return=representation' }),
  });
  if (!res.ok) throw new Error(`Deleting from ${table} failed: HTTP ${res.status}`);
  return ((await res.json()) as unknown[]).length;
}
