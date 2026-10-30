import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, catalogueState, openForVisit, recommend, usableTime, type Venue } from '../src/index.js';
import { airport, at, burgerStop, catalogue, northwind, terrace, traveller } from './fixtures.js';

describe('usable time', () => {
  const flight = { departureAirport: 'LHR', scheduledDepartureAt: '2026-10-30T15:30:00Z' };

  it('uses supplied boarding and walk times instead of estimates', () => {
    const t = usableTime({ ...flight, boardingClosesAt: '2026-10-30T15:10:00Z' }, airport, at('14:00'), 5);
    expect(t.usableMinutes).toBe(65);
    expect(t.estimates).toEqual([]);
  });

  it('uses the estimated departure when the flight is delayed', () => {
    const t = usableTime({ ...flight, estimatedDepartureAt: '2026-10-30T16:30:00Z' }, airport, at('14:00'));
    expect(t.departureAt).toBe('2026-10-30T16:30:00.000Z');
    expect(t.usableMinutes).toBe(105);
  });

  it('never goes below zero', () => {
    expect(usableTime(flight, airport, at('15:20')).usableMinutes).toBe(0);
  });
});

describe('catalogue freshness', () => {
  const now = at('14:00');
  it.each([
    ['2026-10-30T13:31:00Z', 'fresh'],
    ['2026-10-30T13:29:00Z', 'stale'],
    ['2026-10-30T10:00:00Z', 'stale'],
    ['2026-10-30T09:59:00Z', 'too-old'],
  ])('refreshed at %s is %s', (refreshed, state) => {
    expect(catalogueState(refreshed, now, DEFAULT_SETTINGS)).toBe(state);
  });

  it('too old gives no reliable data', () => {
    const r = recommend({ traveller: traveller(['quick-bite'], '16:00'), airport, catalogue: catalogue('2026-10-30T09:00:00Z'), now: at('14:00') });
    expect(r.status).toBe('no-reliable-data');
    expect(r.catalogue).toBeUndefined();
  });

  it('no catalogue at all gives no reliable data', () => {
    const r = recommend({ traveller: traveller(['quick-bite'], '16:00'), airport, catalogue: null, now: at('14:00') });
    expect(r.status).toBe('no-reliable-data');
  });
});

describe('opening hours', () => {
  const hours = [{ day: 'FRI', opens: '06:00', closes: '14:10' }];
  it('open for the whole visit', () => expect(openForVisit(hours, at('13:00'), 15, 'Europe/London')).toBe(true));
  it('closes mid-visit', () => expect(openForVisit(hours, at('14:00'), 15, 'Europe/London')).toBe(false));
  it('unknown when not supplied', () => expect(openForVisit(null, at('14:00'), 15, 'Europe/London')).toBeNull());
  it('handles a window past midnight from the day before', () => {
    expect(openForVisit([{ day: 'THU', opens: '18:00', closes: '02:00' }], new Date('2026-10-30T00:30:00Z'), 20, 'Europe/London')).toBe(true);
  });
  it('uses local time across the clock change (BST on 24 Oct)', () => {
    // 12:30 UTC on Saturday 24 Oct is 13:30 BST.
    const sat = [{ day: 'SAT', opens: '13:00', closes: '14:00' }];
    expect(openForVisit(sat, new Date('2026-10-24T12:30:00Z'), 15, 'Europe/London')).toBe(true);
    expect(openForVisit(sat, new Date('2026-10-24T11:30:00Z'), 15, 'Europe/London')).toBe(false);
  });
});

describe('filtering and scoring', () => {
  const fresh = '2026-10-30T13:55:00Z';
  const run = (likes: string[], venues: Venue[], extra = {}) =>
    recommend({ traveller: traveller(likes, '16:00', extra), airport, catalogue: catalogue(fresh, { venues }), now: at('14:00') });

  it('AI concepts never satisfy a dietary hard rule; supplied facts do', () => {
    const veganByAi: Venue = { ...burgerStop, venueId: 'a', concepts: [...burgerStop.concepts, 'vegan'] };
    const veganByFact: Venue = { ...burgerStop, venueId: 'b', name: 'Green Bowl', dietary: ['vegan'] };
    const r = run(['quick-bite'], [veganByAi, veganByFact], { hardRules: ['vegan'] });
    expect(r.results.map((x) => x.name)).toEqual(['Green Bowl']);
  });

  it('a two-concept like needs both concepts', () => {
    const premiumShop: Venue = { ...northwind };
    const fineDining: Venue = { ...terrace, venueId: 'fd', name: 'Le Ciel', concepts: ['premium', 'sit-down'] };
    expect(run(['fine-dining'], [premiumShop, fineDining]).results.map((x) => x.name)).toEqual(['Le Ciel']);
  });

  it('a valid offer adds 5 points and is attached', () => {
    const a: Venue = { ...burgerStop, venueId: 'a', name: 'A Burgers' };
    const b: Venue = { ...burgerStop, venueId: 'b', name: 'B Burgers' };
    const offers = [{ offerId: 'o', venueId: 'b', title: 'Half price', startsAt: '2026-10-30T08:00:00Z', endsAt: '2026-10-30T20:00:00Z' }];
    const r = recommend({ traveller: traveller(['quick-bite'], '16:00'), airport, catalogue: catalogue(fresh, { venues: [a, b], offers }), now: at('14:00') });
    expect(r.results.map((x) => x.name)).toEqual(['B Burgers', 'A Burgers']);
    expect(r.results[0]?.offer?.title).toBe('Half price');
  });

  it('missing enrichment matches on keyword synonyms, with 2 points off', () => {
    const missing: Venue = { ...burgerStop, venueId: 'm', name: 'A Missing', concepts: [], enrichment: 'missing' };
    const r = run(['budget-food'], [missing, burgerStop]);
    expect(r.results.map((x) => x.name)).toEqual(['Burger Stop', 'A Missing']);
  });

  it('ties break by spare time, then name', () => {
    const quick: Venue = { ...burgerStop, venueId: 'q', name: 'Zed', serviceMinutes: 10 };
    const slow: Venue = { ...burgerStop, venueId: 's', name: 'Alpha', serviceMinutes: 20 };
    const same: Venue = { ...burgerStop, venueId: 't', name: 'Beta', serviceMinutes: 20 };
    expect(run(['quick-bite'], [slow, same, quick]).results.map((x) => x.name)).toEqual(['Zed', 'Alpha', 'Beta']);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ ...burgerStop, venueId: `v${i}`, name: `V${String(i).padStart(2, '0')}` }));
    expect(recommend({ traveller: traveller(['quick-bite'], '16:00'), airport, catalogue: catalogue(fresh, { venues: many }), now: at('14:00'), limit: 3 }).results).toHaveLength(3);
    expect(run(['quick-bite'], many).results).toHaveLength(10);
  });

  it('never puts brand text in a reason', () => {
    const nasty: Venue = { ...burgerStop, name: '<img src=x onerror=alert(1)>', keywords: ['<script>alert(1)</script>', 'cheap', 'fast food'], concepts: [], enrichment: 'missing' };
    const r = run(['budget-food'], [nasty]);
    expect(r.results).toHaveLength(1);
    expect(r.results[0]!.reasons.join(' ')).not.toMatch(/[<>]/);
  });

  it('flags missing opening hours', () => {
    expect(run(['quick-bite'], [burgerStop]).warnings).toContain('facts-missing');
  });
});
