// Lambda "recommendations": POST /recommendations (api.md).
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CatalogueReader, TravellerClient, TravellerNotFound, TravellerUnauthorised, TravellerUnavailable,
  documentClient, emitMetric, looksLikeJwt, secretReader, tokenVerifier,
} from '@atp/adapters';
import { DEFAULT_SETTINGS, recommend, type Settings } from '@atp/rules';

const env = process.env;
const num = (v: string | undefined, d: number) => (v ? Number(v) : d);

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  freshMinutes: num(env.FRESH_MINUTES, 30),
  staleLimitMinutes: num(env.STALE_LIMIT_MINUTES, 240),
};
const reader = new CatalogueReader(documentClient(), env.TABLE_NAME ?? 'AirportCatalogue', num(env.POINTER_CACHE_SECONDS, 30));
const traveller = new TravellerClient({
  baseUrl: env.TRAVELLER_SERVICE_URL ?? 'http://localhost:4601',
  mode: env.TRAVELLER_AUTH_MODE === 'service-credential' ? 'service-credential' : 'forward-token',
  serviceCredential: secretReader(env.TRAVELLER_SECRET_ID),
  cacheSeconds: num(env.TRAVELLER_CACHE_SECONDS, 60),
});

type Code = 'invalid-request' | 'unauthorised' | 'forbidden' | 'unknown-airport' | 'airport-mismatch'
  | 'too-many-requests' | 'traveller-service-unavailable' | 'internal-error';

const MESSAGES: Record<Code, string> = {
  'invalid-request': 'Something went wrong with that request.',
  unauthorised: 'Please sign in again.',
  forbidden: "You don't have access to this.",
  'unknown-airport': "We don't cover this airport yet.",
  'airport-mismatch': "That isn't your flight's departure airport.",
  'too-many-requests': 'Too many requests. Try again in a few seconds.',
  'traveller-service-unavailable': "We couldn't load your trip details. Try again in a few seconds.",
  'internal-error': 'Something went wrong.',
};

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    'cache-control': 'private, no-store',
    'access-control-allow-origin': env.ALLOWED_ORIGIN ?? '',
    vary: 'Origin',
    ...extra,
  };
}

function error(status: number, code: Code, extra: Record<string, string> = {}): APIGatewayProxyResult {
  return { statusCode: status, headers: headers(extra), body: JSON.stringify({ error: { code, message: MESSAGES[code] } }) };
}

interface Body { airportId: string; limit?: number }

function parseBody(raw: string | null): Body | null {
  let b: unknown;
  try {
    b = JSON.parse(raw ?? '');
  } catch {
    return null;
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const o = b as Record<string, unknown>;
  if (Object.keys(o).some((k) => k !== 'airportId' && k !== 'limit')) return null;
  if (typeof o.airportId !== 'string' || !/^[A-Z]{3}$/.test(o.airportId)) return null;
  if (o.limit !== undefined && (!Number.isInteger(o.limit) || (o.limit as number) < 1 || (o.limit as number) > 10)) return null;
  return { airportId: o.airportId, limit: o.limit as number | undefined };
}

// Locally there is no API Gateway authorizer, so the Lambda checks cognito-local's tokens itself.
const verifyToken = env.AUTH_MODE === 'local' && env.COGNITO_JWKS_URL
  ? tokenVerifier({ jwksUrl: env.COGNITO_JWKS_URL, issuer: env.COGNITO_ISSUER ?? '', clientId: env.COGNITO_CLIENT_ID ?? '' })
  : null;

/**
 * Who is asking. In AWS, the Cognito authorizer's subject. Locally, a checked cognito-local
 * token, or (when LOCAL_TEST_TOKENS is on) a test token that names a test traveller.
 */
async function identify(event: APIGatewayProxyEvent): Promise<{ subject: string; token: string } | null> {
  const token = (event.headers?.Authorization ?? event.headers?.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  if (env.AUTH_MODE === 'local') {
    if (verifyToken && looksLikeJwt(token)) {
      try {
        return { subject: (await verifyToken(token)).sub, token };
      } catch {
        return null;
      }
    }
    return env.LOCAL_TEST_TOKENS === 'on' ? { subject: token, token } : null;
  }
  const sub = event.requestContext?.authorizer?.claims?.sub;
  return typeof sub === 'string' ? { subject: sub, token } : null;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const who = await identify(event);
  if (!who) return error(401, 'unauthorised');
  const body = parseBody(event.body);
  if (!body) return error(400, 'invalid-request');

  try {
    const airport = await reader.airport(body.airportId);
    if (!airport) return error(404, 'unknown-airport');

    let record;
    try {
      record = await traveller.get(who.subject, { token: who.token, travellerId: who.subject });
    } catch (e) {
      if (e instanceof TravellerUnauthorised) return error(401, 'unauthorised');
      if (traveller.circuitOpen) emitMetric('TravellerCircuitOpen', 1, 'Count');
      if (e instanceof TravellerUnavailable || e instanceof TravellerNotFound) {
        return error(503, 'traveller-service-unavailable', { 'retry-after': '10' });
      }
      throw e;
    }
    if (record.flight.departureAirport !== body.airportId) return error(409, 'airport-mismatch');

    const catalogue = await reader.catalogue(body.airportId);
    const result = recommend({ traveller: record, airport, catalogue, now: new Date(), limit: body.limit, settings });
    return { statusCode: 200, headers: headers(), body: JSON.stringify(result) };
  } catch (e) {
    console.error(JSON.stringify({ msg: 'recommendations failed', error: (e as Error)?.name, requestId: event.requestContext?.requestId }));
    return error(500, 'internal-error');
  }
}
