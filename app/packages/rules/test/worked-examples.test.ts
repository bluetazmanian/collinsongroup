// The six travellers from worked-examples.md, as tests.
import { describe, expect, it } from 'vitest';
import { recommend } from '../src/index.js';
import { airport, at, catalogue, northwind, traveller } from './fixtures.js';

describe('worked examples', () => {
  it('1. a good match: Asha, budget food, 45 usable minutes', () => {
    const r = recommend({ traveller: traveller(['budget-food'], '15:30'), airport, catalogue: catalogue('2026-10-30T13:55:00Z'), now: at('14:00') });
    expect(r.status).toBe('ok');
    expect(r.time.usableMinutes).toBe(45);
    expect(r.time.estimates).toEqual(['boarding', 'walk']);
    expect(r.results.map((x) => x.name)).toEqual(['Burger Stop']); // The Terrace matches no like
    expect(r.results[0]?.reasons[0]).toBe('Matches: affordable, quick food, takeaway');
    expect(r.warnings).toContain('timing-estimated');
  });

  it('2. not enough time: Ben, 5 usable minutes', () => {
    const r = recommend({ traveller: traveller(['sit-down-dining'], '15:40'), airport, catalogue: catalogue('2026-10-30T14:45:00Z'), now: at('14:50') });
    expect(r.time.usableMinutes).toBe(5);
    expect(r.status).toBe('head-to-gate');
    expect(r.results).toEqual([]);
  });

  it('3. an ambiguous keyword: Chloe, good service maps to premium', () => {
    const r = recommend({ traveller: traveller(['good-service'], '16:00'), airport, catalogue: catalogue('2026-10-30T13:55:00Z'), now: at('14:00') });
    expect(r.results.map((x) => x.name)).toEqual(['Northwind Fashion']);
    expect(r.results[0]?.reasons[0]).toBe('Matches: premium');
  });

  it('4. a sale that has ended: Dev, offer ended at 14:00', () => {
    const offers = [{ offerId: 'o-1', venueId: northwind.venueId, title: '10% off', startsAt: '2026-10-30T08:00:00Z', endsAt: '2026-10-30T14:00:00Z' }];
    const r = recommend({ traveller: traveller(['fashion'], '16:00'), airport, catalogue: catalogue('2026-10-30T13:55:00Z', { offers }), now: at('14:05') });
    expect(r.results.map((x) => x.name)).toEqual(['Northwind Fashion']);
    expect(r.results[0]?.offer).toBeUndefined();
  });

  it('5. venue service down for 70 minutes: stale, no offers', () => {
    const offers = [{ offerId: 'o-2', venueId: 'v-burger', title: 'Meal deal', startsAt: '2026-10-30T08:00:00Z', endsAt: '2026-10-30T20:00:00Z' }];
    const r = recommend({ traveller: traveller(['quick-bite'], '16:00'), airport, catalogue: catalogue('2026-10-30T12:50:00Z', { offers }), now: at('14:00') });
    expect(r.status).toBe('ok');
    expect(r.catalogue?.state).toBe('stale');
    expect(r.results[0]?.offer).toBeUndefined();
    expect(r.warnings).toEqual(expect.arrayContaining(['catalogue-stale', 'offers-unavailable']));
  });

  it('6. nothing fits: Femi, vegan as a hard rule', () => {
    const r = recommend({ traveller: traveller(['budget-food', 'quick-bite'], '16:00', { hardRules: ['vegan'] }), airport, catalogue: catalogue('2026-10-30T13:55:00Z'), now: at('14:00') });
    expect(r.status).toBe('no-suitable');
  });
});
