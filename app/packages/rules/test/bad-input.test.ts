import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, FlightTimeInvalid, catalogueState, checkFlight, cleanOpeningHours, openForVisit, parseInstant, recommend, usableTime,
} from '../src/index.js';
import { airport, at, burgerStop, catalogue, traveller } from './fixtures.js';

// Upstream data that is wrong or oddly written (the stress test of 31 Oct 2026). 30 Oct 2026 is a Friday.

describe('upstream times', () => {
  it('reads a time without a UTC offset in the airport time zone', () => {
    // 15 July: London is UTC+1, so 15:00 local is 14:00 UTC.
    expect(parseInstant('2026-07-15T15:00:00', 'Europe/London')?.toISOString()).toBe('2026-07-15T14:00:00.000Z');
    expect(parseInstant('2026-10-30T15:00', 'Europe/London')?.toISOString()).toBe('2026-10-30T15:00:00.000Z');
  });

  it('keeps a supplied offset', () => {
    expect(parseInstant('2026-07-15T15:00:00+02:00', 'Europe/London')?.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it.each([['TBC'], [''], ['2026-02-30T10:00:00Z'], ['2026-13-01T10:00:00'], [null], [undefined]])('refuses %j', (v) => {
    expect(parseInstant(v as string, 'Europe/London')).toBeNull();
  });

  it('falls back to the scheduled time when the estimate is unreadable', () => {
    const t = usableTime({ departureAirport: 'LHR', scheduledDepartureAt: '2026-10-30T15:30:00Z', estimatedDepartureAt: '' }, airport, at('14:00'));
    expect(t.usableMinutes).toBe(45);
  });

  it('estimates boarding when the boarding time is unreadable', () => {
    const t = usableTime({ departureAirport: 'LHR', scheduledDepartureAt: '2026-10-30T15:30:00Z', boardingClosesAt: 'garbage' }, airport, at('14:00'));
    expect(t.usableMinutes).toBe(45);
    expect(t.estimates).toContain('boarding');
  });

  it('refuses a flight with no readable departure', () => {
    expect(() => usableTime({ departureAirport: 'LHR', scheduledDepartureAt: 'TBC' }, airport, at('14:00'))).toThrow(FlightTimeInvalid);
  });
});

describe('flight check', () => {
  const flight = (scheduledDepartureAt: string, estimatedDepartureAt?: string) => ({ departureAirport: 'LHR', scheduledDepartureAt, estimatedDepartureAt });
  it.each([
    ['2026-10-30T15:00:00Z', undefined, 'ok'],
    ['2026-10-30T13:00:00Z', undefined, 'departed'],
    ['2026-10-30T13:00:00Z', '2026-10-30T15:00:00Z', 'ok'],
    ['2026-10-31T14:00:00Z', undefined, 'ok'],
    ['2026-10-31T14:01:00Z', undefined, 'not-today'],
    ['2029-10-30T15:00:00Z', undefined, 'not-today'],
    ['TBC', undefined, 'unreadable'],
  ])('scheduled %s, estimated %s is %s', (s, e, expected) => {
    expect(checkFlight(flight(s, e), airport, at('14:00'), DEFAULT_SETTINGS)).toBe(expected);
  });
});

describe('opening hours', () => {
  it('reads other ways of writing days and times', () => {
    expect(cleanOpeningHours([
      { day: 'fri', opens: '6:00', closes: '22:00' },
      { day: 'Saturday', opens: '00:00', closes: '24:00' },
    ])).toEqual([{ day: 'FRI', opens: '06:00', closes: '22:00' }, { day: 'SAT', opens: '00:00', closes: '24:00' }]);
  });

  it.each([
    ['a string', 'Mon-Sun 6-22'],
    ['null entries', [null]],
    ['a missing closing time', [{ day: 'FRI', opens: '06:00' }]],
    ['12-hour times', [{ day: 'FRI', opens: '6am', closes: '10pm' }]],
    ['impossible times', [{ day: 'FRI', opens: '25:00', closes: '22:60' }]],
    ['an unknown day', [{ day: 'Funday', opens: '06:00', closes: '22:00' }]],
  ])('treats %s as unknown hours, not a crash or "closed"', (_, raw) => {
    expect(cleanOpeningHours(raw)).toBeNull();
    expect(openForVisit(raw as never, at('14:00'), 15, 'Europe/London')).toBeNull();
  });

  it('treats an unknown airport time zone as unknown hours', () => {
    expect(openForVisit([{ day: 'FRI', opens: '06:00', closes: '22:00' }], at('14:00'), 15, 'Europe/Londn')).toBeNull();
  });

  it('suggests a venue with unreadable hours, with a facts-missing warning', () => {
    const odd = { ...burgerStop, openingHours: [{ day: 'FRI', opens: '06:00' }] as never };
    const r = recommend({ traveller: traveller(['quick-bite'], '16:00'), airport, catalogue: catalogue('2026-10-30T13:50:00Z', { venues: [odd] }), now: at('14:00') });
    expect(r.results.map((x) => x.venueId)).toEqual(['v-burger']);
    expect(r.warnings).toContain('facts-missing');
  });
});

describe('dietary rules', () => {
  const run = (hardRules: string[], dietary: string[]) => recommend({
    traveller: traveller(['quick-bite'], '16:00', { hardRules }), airport,
    catalogue: catalogue('2026-10-30T13:50:00Z', { venues: [{ ...burgerStop, dietary }] }), now: at('14:00'),
  }).results.length;

  it('never ignores a rule it does not know', () => {
    expect(run(['kosher'], [])).toBe(0);
    expect(run(['kosher'], ['kosher'])).toBe(1);
  });

  it('ignores letter case on both sides', () => {
    expect(run(['Vegan'], [])).toBe(0);
    expect(run(['Vegan'], ['vegan'])).toBe(1);
    expect(run(['vegan'], ['Vegan'])).toBe(1);
  });
});

describe('offers and freshness', () => {
  const offer = (endsAt: string) => ({ offerId: 'o1', venueId: 'v-burger', title: '2 for 1', startsAt: '2026-10-30T13:00:00Z', endsAt });
  const run = (endsAt: string) => recommend({
    traveller: traveller(['quick-bite'], '16:00'), airport,
    catalogue: catalogue('2026-10-30T13:50:00Z', { venues: [burgerStop], offers: [offer(endsAt)] }), now: at('14:00'),
  }).results[0];

  it('drops an offer that ends before the visit does', () => {
    expect(run('2026-10-30T14:05:00Z')?.offer).toBeUndefined(); // a 15-minute visit
    expect(run('2026-10-30T14:15:00Z')?.offer?.offerId).toBe('o1');
  });

  it('treats a refresh time well in the future as stale', () => {
    expect(catalogueState('2026-10-30T14:04:00Z', at('14:00'), DEFAULT_SETTINGS)).toBe('fresh');
    expect(catalogueState('2026-10-30T16:00:00Z', at('14:00'), DEFAULT_SETTINGS)).toBe('stale');
  });
});
