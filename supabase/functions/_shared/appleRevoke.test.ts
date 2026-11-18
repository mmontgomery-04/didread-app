/// <reference types="node" />
// Apple token cleanup on account deletion: the client secret and the revoke flow.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { appleClientSecret, revokeAppleAccess, type AppleKey } from './appleRevoke.ts';

const NOW_S = 1_791_000_000;

const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (text: string) => new Uint8Array(Buffer.from(text, 'base64url'));
const json = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

/** A throwaway P-256 key, as a .p8 file would hold it, and its public half. */
async function testKey(lineBreaks = '\n'): Promise<{ key: AppleKey; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64');
  const pem = ['-----BEGIN PRIVATE KEY-----', ...der.match(/.{1,64}/g)!, '-----END PRIVATE KEY-----'].join(lineBreaks);
  return {
    key: { teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: pem, clientId: 'com.didread.app' },
    publicKey: pair.publicKey,
  };
}

/** An id_token like Apple's (only the payload matters here). */
const idToken = (sub: string) => `x.${b64url(new TextEncoder().encode(JSON.stringify({ sub })))}.y`;

/** A stand-in for Apple: records each request and answers from `replies`. */
function fakeApple(replies: Record<string, { status: number; body?: unknown }>) {
  const calls: { url: string; form: URLSearchParams }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, form: new URLSearchParams(String(init.body)) });
    const reply = replies[url] ?? { status: 404 };
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

test('the client secret is an ES256 JWT that Apple can check', async () => {
  const { key, publicKey } = await testKey();
  const [header, claims, signature] = (await appleClientSecret(key, NOW_S)).split('.');
  assert.deepEqual(json(header), { alg: 'ES256', kid: 'KEY1234567' });
  assert.deepEqual(json(claims), {
    iss: 'TEAM123456',
    iat: NOW_S,
    exp: NOW_S + 300,
    aud: 'https://appleid.apple.com',
    sub: 'com.didread.app',
  });
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    fromB64url(signature),
    new TextEncoder().encode(`${header}.${claims}`),
  );
  assert.ok(valid);
});

test('a key pasted with its line breaks lost, or typed as \\n, still works', async () => {
  for (const breaks of [' ', '\\n']) {
    const { key } = await testKey(breaks);
    assert.equal((await appleClientSecret(key, NOW_S)).split('.').length, 3);
  }
});

test('trades the code for a refresh token, then revokes it', async () => {
  const { key } = await testKey();
  const apple = fakeApple({
    'https://appleid.apple.com/auth/token': { status: 200, body: { refresh_token: 'r-1', id_token: idToken('apple-user-1') } },
    'https://appleid.apple.com/auth/revoke': { status: 200 },
  });
  assert.equal(await revokeAppleAccess(key, 'code-1', 'apple-user-1', NOW_S, apple.fetchFn), 'revoked');
  assert.deepEqual(apple.calls.map((c) => c.url), ['https://appleid.apple.com/auth/token', 'https://appleid.apple.com/auth/revoke']);
  assert.equal(apple.calls[0].form.get('code'), 'code-1');
  assert.equal(apple.calls[0].form.get('grant_type'), 'authorization_code');
  assert.equal(apple.calls[0].form.get('client_id'), 'com.didread.app');
  assert.equal(apple.calls[1].form.get('token'), 'r-1');
  assert.equal(apple.calls[1].form.get('token_type_hint'), 'refresh_token');
});

test("a code from a different Apple ID revokes nothing", async () => {
  const { key } = await testKey();
  const apple = fakeApple({
    'https://appleid.apple.com/auth/token': { status: 200, body: { refresh_token: 'r-2', id_token: idToken('someone-else') } },
  });
  assert.equal(await revokeAppleAccess(key, 'code-2', 'apple-user-1', NOW_S, apple.fetchFn), 'other_apple_id');
  assert.equal(apple.calls.length, 1);
});

test('Apple refusing, or not answering, is "failed" and never throws', async () => {
  const { key } = await testKey();
  const refused = fakeApple({ 'https://appleid.apple.com/auth/token': { status: 400, body: { error: 'invalid_grant' } } });
  assert.equal(await revokeAppleAccess(key, 'old-code', 'apple-user-1', NOW_S, refused.fetchFn), 'failed');
  const offline = (async () => {
    throw new TypeError('network down');
  }) as unknown as typeof fetch;
  assert.equal(await revokeAppleAccess(key, 'code', 'apple-user-1', NOW_S, offline), 'failed');
  const badKey = { ...key, privateKey: 'not a key' };
  assert.equal(await revokeAppleAccess(badKey, 'code', 'apple-user-1', NOW_S, refused.fetchFn), 'failed');
});
