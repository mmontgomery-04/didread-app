// Apple token cleanup on account deletion (SPEC section 9, batch 12; built Oct 7 with batch 14).
// When someone deletes their account, the app gets a one-time authorization code from Apple's
// sign-in sheet and sends it to delete-account, which uses it here: it trades the code with Apple
// for the user's refresh token, then asks Apple to revoke it, which removes DidRead's access to
// their Apple ID. Nothing is stored. The Sign in with Apple key (.p8) lives only in Supabase
// secrets; it signs a short-lived client secret (an ES256 JWT) for each request.
//
// Plain TypeScript (WebCrypto and fetch), so it runs in Deno (the function) and Node (npm test).

const APPLE = 'https://appleid.apple.com';
/** The client secret is used once, right away; Apple allows up to 6 months. */
const SECRET_LIFETIME_S = 300;

export interface AppleKey {
  /** Apple Developer Team ID. */
  teamId: string;
  /** The Sign in with Apple key's Key ID. */
  keyId: string;
  /** The .p8 file's contents (PEM, "-----BEGIN PRIVATE KEY-----" ...). */
  privateKey: string;
  /** The app's bundle ID, com.didread.app: the code was issued to the app. */
  clientId: string;
}

export type RevokeResult =
  /** Apple confirmed the revocation. */
  | 'revoked'
  /** The code belongs to a different Apple ID than the account's, so nothing was revoked. */
  | 'other_apple_id'
  /** Apple refused or couldn't be reached; the account is still deleted. */
  | 'failed';

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const base64urlJson = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)));

/** The DER bytes inside a PEM private key (whatever line breaks the secret kept, even typed "\n"). */
function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Apple's client secret: an ES256 JWT signed with the Sign in with Apple key. */
export async function appleClientSecret(key: AppleKey, nowS: number): Promise<string> {
  const header = base64urlJson({ alg: 'ES256', kid: key.keyId });
  const claims = base64urlJson({
    iss: key.teamId,
    iat: nowS,
    exp: nowS + SECRET_LIFETIME_S,
    aud: APPLE,
    sub: key.clientId,
  });
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(key.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  // WebCrypto gives the raw r||s signature, which is what JWS ES256 uses.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, encoder.encode(`${header}.${claims}`));
  return `${header}.${claims}.${base64url(new Uint8Array(signature))}`;
}

/** The `sub` (Apple user id) inside an id_token Apple just sent us directly over HTTPS. */
function subjectOf(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const sub = (JSON.parse(atob(payload)) as { sub?: unknown }).sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Trades the one-time `code` for the user's refresh token and revokes it. `appleUserId` is the
 * deleted account's Apple user id (from its Apple identity): if the code came from a different
 * Apple ID, nothing is revoked. Never throws: deletion goes ahead whatever Apple says.
 */
export async function revokeAppleAccess(
  key: AppleKey,
  code: string,
  appleUserId: string,
  nowS: number,
  fetchFn: typeof fetch = fetch,
): Promise<RevokeResult> {
  try {
    const clientSecret = await appleClientSecret(key, nowS);
    const form = (fields: Record<string, string>) =>
      new URLSearchParams({ client_id: key.clientId, client_secret: clientSecret, ...fields });
    const headers = { 'content-type': 'application/x-www-form-urlencoded' };

    const tokenRes = await fetchFn(`${APPLE}/auth/token`, {
      method: 'POST',
      headers,
      body: form({ code, grant_type: 'authorization_code' }),
    });
    if (!tokenRes.ok) return 'failed';
    const tokens = (await tokenRes.json()) as { refresh_token?: unknown; id_token?: unknown };
    if (subjectOf(tokens.id_token) !== appleUserId) return 'other_apple_id';
    if (typeof tokens.refresh_token !== 'string') return 'failed';

    const revokeRes = await fetchFn(`${APPLE}/auth/revoke`, {
      method: 'POST',
      headers,
      body: form({ token: tokens.refresh_token, token_type_hint: 'refresh_token' }),
    });
    return revokeRes.ok ? 'revoked' : 'failed';
  } catch {
    return 'failed';
  }
}
