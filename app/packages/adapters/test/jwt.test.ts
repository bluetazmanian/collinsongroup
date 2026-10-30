import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { TokenInvalid, looksLikeJwt, tokenVerifier } from '../src/jwt.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const NOW = 1_800_000_000_000;
const ISS = 'http://0.0.0.0:9229/local_pool';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(claims: Record<string, unknown>, opts: { kid?: string; alg?: string; key?: typeof privateKey } = {}) {
  const head = b64({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'k1' });
  const body = b64(claims);
  const s = createSign('RSA-SHA256').update(`${head}.${body}`).sign(opts.key ?? privateKey).toString('base64url');
  return `${head}.${body}.${s}`;
}
const good = { sub: 'u-1', iss: ISS, token_use: 'access', client_id: 'web', exp: NOW / 1000 + 600 };

let fetches = 0;
const verify = tokenVerifier({
  jwksUrl: 'http://x/jwks.json', issuer: ISS, clientId: 'web', clock: () => NOW,
  fetchImpl: (async () => { fetches++; return new Response(JSON.stringify({ keys: [jwk] })); }) as typeof fetch,
});

describe('token checks', () => {
  it('accepts a valid access token and returns its subject', async () => {
    expect((await verify(sign(good))).sub).toBe('u-1');
  });

  it('keeps the keys between calls', async () => {
    const before = fetches;
    await verify(sign(good));
    expect(fetches).toBe(before);
  });

  it.each([
    ['another key signed it', () => sign(good, { key: other.privateKey })],
    ['the issuer is wrong', () => sign({ ...good, iss: 'http://elsewhere/pool' })],
    ['it is an ID token', () => sign({ ...good, token_use: 'id' })],
    ['it is for another client', () => sign({ ...good, client_id: 'other' })],
    ['it has expired', () => sign({ ...good, exp: NOW / 1000 - 1 })],
    ['the key is unknown', () => sign(good, { kid: 'nope' })],
    ['the algorithm is not RS256', () => sign(good, { alg: 'none' })],
    ['it has no subject', () => sign({ ...good, sub: '' })],
    ['the claims were changed after signing', () => {
      const [h, , s] = sign(good).split('.');
      return `${h}.${b64({ ...good, sub: 'u-2' })}.${s}`;
    }],
  ])('refuses a token when %s', async (_name, make) => {
    await expect(verify(make())).rejects.toBeInstanceOf(TokenInvalid);
  });

  it('tells a JWT from a local test token', () => {
    expect(looksLikeJwt(sign(good))).toBe(true);
    expect(looksLikeJwt('asha-token')).toBe(false);
  });
});
