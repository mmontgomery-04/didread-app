// Sign in with Apple (batch 5b): Apple's own sign-in sheet, then Supabase checks Apple's token
// and signs the user in. src/state/auth.tsx follows the new session from there, as it does for
// the development-only test sign-in.
//
// Only the email scope is asked for, never the name (docs/PRIVACY.md: "A private ID from Apple,
// plus your email address if you choose to share it"). A one-time code (nonce) goes with each
// request: Apple puts its SHA-256 hash in the token and Supabase checks the original against it,
// so a token can't be reused.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

export type AppleSignInResult = 'signedIn' | 'cancelled' | 'failed';

/**
 * Apple token cleanup (batch 12, built with batch 14): before an Apple account is deleted, Apple's
 * sheet appears once more (Face ID) and returns a one-time code; delete-account trades it with
 * Apple to remove DidRead's access to the Apple ID. No scopes are asked for. 'cancelled' if the
 * sheet is closed (then nothing is deleted); null if Apple's sheet fails, since deleting still
 * goes ahead without the clean-up.
 */
export async function appleCodeForDeletion(): Promise<string | null | 'cancelled'> {
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    return credential.authorizationCode ?? null;
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    return null;
  }
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  try {
    const nonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return 'failed';
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce,
    });
    return error ? 'failed' : 'signedIn';
  } catch (error) {
    // Closing Apple's sheet isn't an error: nothing happens.
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    return 'failed';
  }
}
