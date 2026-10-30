// Checks a Cognito access token (RS256) against the user pool's published keys.
// Used locally, where cognito-local stands in for Cognito and there is no API Gateway
// authorizer. In AWS the Cognito authorizer does this before the Lambda runs.
// No imports, so the local traveller service can use this file directly.
import { createPublicKey, createVerify, type JsonWebKey } from 'node:crypto';

export class TokenInvalid extends Error {}

export interface TokenCheck {
  /** URL of the pool's jwks.json. */
  jwksUrl: string;
  /** Expected `iss` claim. */
  issuer: string;
  /** Expected `client_id` claim (the web app's client). */
  clientId: string;
  /** Seconds to keep the keys. */
  keyCacheSeconds?: number;
  fetchImpl?: typeof fetch;
  clock?: () => number;
}

export interface TokenClaims {
  sub: string;
  [claim: string]: unknown;
}

const part = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

export function looksLikeJwt(token: string): boolean {
  return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token);
}

export function tokenVerifier(o: TokenCheck): (token: string) => Promise<TokenClaims> {
  const fetchImpl = o.fetchImpl ?? fetch;
  const clock = o.clock ?? Date.now;
  let keys: { at: number; byKid: Map<string, JsonWebKey> } | null = null;

  async function key(kid: string): Promise<JsonWebKey> {
    const now = clock();
    if (!keys || now - keys.at > (o.keyCacheSeconds ?? 3600) * 1000 || !keys.byKid.has(kid)) {
      const res = await fetchImpl(o.jwksUrl, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new TokenInvalid(`keys unavailable: ${res.status}`);
      const body = (await res.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
      keys = { at: now, byKid: new Map((body.keys ?? []).map((k) => [String(k.kid), k])) };
    }
    const k = keys.byKid.get(kid);
    if (!k) throw new TokenInvalid('unknown key');
    return k;
  }

  return async (token) => {
    if (!looksLikeJwt(token)) throw new TokenInvalid('not a JWT');
    const [h, p, sig] = token.split('.') as [string, string, string];
    let header: { alg?: string; kid?: string };
    let claims: Record<string, unknown>;
    try {
      header = part(h);
      claims = part(p);
    } catch {
      throw new TokenInvalid('unreadable');
    }
    if (header.alg !== 'RS256' || !header.kid) throw new TokenInvalid('wrong algorithm');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    const publicKey = createPublicKey({ key: await key(header.kid), format: 'jwk' });
    if (!verifier.verify(publicKey, Buffer.from(sig, 'base64url'))) throw new TokenInvalid('bad signature');
    if (claims.iss !== o.issuer) throw new TokenInvalid('wrong issuer');
    if (claims.token_use !== 'access') throw new TokenInvalid('not an access token');
    if (claims.client_id !== o.clientId) throw new TokenInvalid('wrong client');
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= clock()) throw new TokenInvalid('expired');
    if (typeof claims.sub !== 'string' || !claims.sub) throw new TokenInvalid('no subject');
    return claims as TokenClaims;
  };
}
