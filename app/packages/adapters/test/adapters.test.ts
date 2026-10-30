import { describe, expect, it } from 'vitest';
import { AI_CONCEPTS } from '@atp/concepts';
import {
  SYSTEM_PROMPT, TravellerClient, TravellerUnavailable, retryDelaySeconds, validateReply,
} from '../src/index.js';

describe('AI reply checks', () => {
  const ids = ['v1', 'v2', 'v3'];

  it('accepts a valid reply', () => {
    const r = validateReply('{"venues":[{"id":"v1","concepts":["affordable","quick-food"]}]}', ids);
    expect(r.concepts.get('v1')).toEqual(['affordable', 'quick-food']);
    expect(r.concepts.has('v2')).toBe(false); // missing from the reply: enrichment missing
  });

  it('rejects invalid JSON entirely', () => {
    expect(validateReply('Sure! Here you go: {', ids).concepts.size).toBe(0);
  });

  it('discards unknown and repeated IDs', () => {
    const r = validateReply('{"venues":[{"id":"zz","concepts":["coffee"]},{"id":"v1","concepts":["coffee"]},{"id":"v1","concepts":["bar"]}]}', ids);
    expect(r.concepts.has('zz')).toBe(false);
    expect(r.concepts.has('v1')).toBe(false);
  });

  it('drops unknown and dietary concepts, and keeps at most 3', () => {
    const r = validateReply('{"venues":[{"id":"v2","concepts":["vegan","made-up","coffee","bakery","bar","fresh-light"]}]}', ids);
    expect(r.concepts.get('v2')).toEqual(['coffee', 'bakery', 'bar']);
    expect(r.warnings.some((w) => w.includes('dietary'))).toBe(true);
  });

  it('the prompt lists exactly the AI concepts', () => {
    const listed = SYSTEM_PROMPT.split('Allowed concepts:\n')[1]!.split('\n')[0]!.split(', ');
    expect(listed).toEqual([...AI_CONCEPTS]);
  });
});

describe('retry timing', () => {
  it.each([[1, 60], [2, 120], [3, 240], [4, 480], [5, 480]])('receive %i waits %i s', (n, s) => {
    expect(retryDelaySeconds(n)).toBe(s);
  });
});

describe('traveller client', () => {
  const record = {
    travellerId: 't1', preferences: { likes: ['coffee'], hardRules: [] },
    flight: { departureAirport: 'LHR', scheduledDepartureAt: '2026-10-30T15:00:00Z' },
  };

  function client(responses: Array<() => Promise<Response>>, clock: { t: number }) {
    let i = 0;
    const calls = { n: 0 };
    const c = new TravellerClient({
      baseUrl: 'http://stub', mode: 'forward-token', clock: () => clock.t,
      fetchImpl: (async () => { calls.n++; return responses[Math.min(i++, responses.length - 1)]!(); }) as typeof fetch,
    });
    return { c, calls };
  }
  const ok = () => Promise.resolve(new Response(JSON.stringify(record), { status: 200 }));
  const fail = () => Promise.resolve(new Response('', { status: 500 }));

  it('caches a traveller for 60 seconds', async () => {
    const clock = { t: 0 };
    const { c, calls } = client([ok], clock);
    await c.get('sub', { token: 'x' });
    clock.t = 59_000;
    await c.get('sub', { token: 'x' });
    expect(calls.n).toBe(1);
    clock.t = 61_000;
    await c.get('sub', { token: 'x' });
    expect(calls.n).toBe(2);
  });

  it('opens the circuit after 5 failures, then tries once after 30 seconds', async () => {
    const clock = { t: 0 };
    const { c, calls } = client([fail, fail, fail, fail, fail, ok], clock);
    for (let i = 0; i < 5; i++) await expect(c.get(`s${i}`, { token: 'x' })).rejects.toBeInstanceOf(TravellerUnavailable);
    expect(c.circuitOpen).toBe(true);
    await expect(c.get('s9', { token: 'x' })).rejects.toThrow('circuit open');
    expect(calls.n).toBe(5);
    clock.t = 31_000;
    await expect(c.get('s9', { token: 'x' })).resolves.toMatchObject({ travellerId: 't1' });
    expect(c.circuitOpen).toBe(false);
  });

  it('treats a slow answer as unavailable', async () => {
    const c = new TravellerClient({
      baseUrl: 'http://stub', mode: 'forward-token', deadlineMs: 50,
      fetchImpl: ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch,
    });
    await expect(c.get('s', { token: 'x' })).rejects.toBeInstanceOf(TravellerUnavailable);
  });
});
