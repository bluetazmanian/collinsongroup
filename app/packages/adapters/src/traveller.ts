// Traveller service client: 2-second deadline, 60-second cache per subject and a
// circuit breaker (aws-deployment.md, "Protecting the traveller service").
import type { TravellerContext } from '@atp/rules';

export class TravellerUnavailable extends Error {}
export class TravellerUnauthorised extends Error {}
export class TravellerNotFound extends Error {}

export interface TravellerRecord extends TravellerContext {
  travellerId: string;
}

export interface TravellerClientOptions {
  baseUrl: string;
  /** forward-token: send the traveller's own token. service-credential: our credential + a linked traveller ID. */
  mode: 'forward-token' | 'service-credential';
  serviceCredential?: () => Promise<string>;
  deadlineMs?: number;
  cacheSeconds?: number;
  breakerFailures?: number;
  breakerOpenSeconds?: number;
  fetchImpl?: typeof fetch;
  clock?: () => number;
}

interface Breaker {
  failures: number;
  openUntil: number;
  trialInFlight: boolean;
}

export class TravellerClient {
  private cache = new Map<string, { at: number; value: TravellerRecord }>();
  private breaker: Breaker = { failures: 0, openUntil: 0, trialInFlight: false };
  private readonly o: Required<Omit<TravellerClientOptions, 'serviceCredential'>> & Pick<TravellerClientOptions, 'serviceCredential'>;

  constructor(options: TravellerClientOptions) {
    this.o = {
      deadlineMs: 2000, cacheSeconds: 60, breakerFailures: 5, breakerOpenSeconds: 30,
      fetchImpl: fetch, clock: Date.now, ...options,
    };
  }

  /** `subject` is the token subject (cache key); `credential` is the traveller's token or the linked traveller ID. */
  async get(subject: string, credential: { token?: string; travellerId?: string }): Promise<TravellerRecord> {
    const now = this.o.clock();
    const hit = this.cache.get(subject);
    if (hit && now - hit.at < this.o.cacheSeconds * 1000) return hit.value;

    const b = this.breaker;
    if (now < b.openUntil) throw new TravellerUnavailable('circuit open');
    const halfOpen = b.failures >= this.o.breakerFailures;
    if (halfOpen && b.trialInFlight) throw new TravellerUnavailable('circuit half-open, trial in flight');
    if (halfOpen) b.trialInFlight = true;

    try {
      const value = await this.fetchRecord(credential);
      b.failures = 0;
      b.openUntil = 0;
      this.cache.set(subject, { at: now, value });
      return value;
    } catch (err) {
      if (err instanceof TravellerUnavailable) {
        b.failures += 1;
        if (b.failures >= this.o.breakerFailures) b.openUntil = this.o.clock() + this.o.breakerOpenSeconds * 1000;
      }
      throw err;
    } finally {
      b.trialInFlight = false;
    }
  }

  get circuitOpen(): boolean {
    return this.o.clock() < this.breaker.openUntil;
  }

  private async fetchRecord(credential: { token?: string; travellerId?: string }): Promise<TravellerRecord> {
    let url: string;
    let bearer: string;
    if (this.o.mode === 'forward-token') {
      if (!credential.token) throw new TravellerUnauthorised('no token');
      url = `${this.o.baseUrl}/travellers/me`;
      bearer = credential.token;
    } else {
      if (!credential.travellerId || !this.o.serviceCredential) throw new TravellerNotFound('no linked traveller');
      url = `${this.o.baseUrl}/travellers/${encodeURIComponent(credential.travellerId)}`;
      bearer = await this.o.serviceCredential();
    }

    let res: Response;
    try {
      res = await this.o.fetchImpl(url, {
        headers: { authorization: `Bearer ${bearer}`, accept: 'application/json' },
        signal: AbortSignal.timeout(this.o.deadlineMs),
      });
    } catch {
      throw new TravellerUnavailable('no answer within the deadline');
    }
    if (res.status === 401 || res.status === 403) throw new TravellerUnauthorised(`status ${res.status}`);
    if (res.status === 404) throw new TravellerNotFound('no record');
    if (!res.ok) throw new TravellerUnavailable(`status ${res.status}`);

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new TravellerUnavailable('malformed JSON');
    }
    return parseTraveller(body);
  }
}

function parseTraveller(body: unknown): TravellerRecord {
  const b = body as Record<string, any>;
  const f = b?.flight;
  if (typeof b?.travellerId !== 'string' || typeof f?.departureAirport !== 'string' || typeof f?.scheduledDepartureAt !== 'string') {
    throw new TravellerUnavailable('unexpected response shape');
  }
  const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
  return {
    travellerId: b.travellerId,
    likes: strings(b.preferences?.likes),
    hardRules: strings(b.preferences?.hardRules),
    flight: {
      flightNumber: typeof f.flightNumber === 'string' ? f.flightNumber : undefined,
      departureAirport: f.departureAirport,
      scheduledDepartureAt: f.scheduledDepartureAt,
      estimatedDepartureAt: f.estimatedDepartureAt ?? null,
      gate: f.gate ?? null,
      boardingClosesAt: f.boardingClosesAt ?? null,
    },
  };
}
