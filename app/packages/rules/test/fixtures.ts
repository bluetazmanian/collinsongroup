import type { AirportProfile, Catalogue, Flight, TravellerContext, Venue } from '../src/index.js';

// The example airport from worked-examples.md. Times are 30 Oct 2026, London (UTC+0 after the clock change).
export const airport: AirportProfile = {
  airportId: 'LHR', timeZone: 'Europe/London', boardingBufferMinutes: 30, walkBufferMinutes: 15,
};

export const burgerStop: Venue = {
  venueId: 'v-burger', name: 'Burger Stop', kind: 'restaurant',
  keywords: ['fast food', 'cheap', 'takeaway'], concepts: ['affordable', 'quick-food', 'takeaway'],
  enrichment: 'done', dietary: [], terminal: '5', locationDescription: 'Near gate A10',
};

export const terrace: Venue = {
  venueId: 'v-terrace', name: 'The Terrace', kind: 'restaurant',
  keywords: ['bistro', 'relaxed', 'wine list'], concepts: ['sit-down', 'bar'],
  enrichment: 'done', dietary: [],
};

export const northwind: Venue = {
  venueId: 'v-northwind', name: 'Northwind Fashion', kind: 'shop',
  keywords: ['luxury', 'fashion', 'service'], concepts: ['premium', 'fashion'],
  enrichment: 'done', dietary: [],
};

export const at = (hhmm: string) => new Date(`2026-10-30T${hhmm}:00Z`);

export function catalogue(refreshedAt: string, extra: Partial<Catalogue> = {}): Catalogue {
  return {
    version: 7, lastSuccessfulFetchAt: refreshedAt,
    venues: [burgerStop, terrace, northwind], offers: [], ...extra,
  };
}

export function traveller(likes: string[], departure: string, more: Partial<TravellerContext> = {}, flight: Partial<Flight> = {}): TravellerContext {
  return {
    likes, hardRules: [],
    flight: { flightNumber: 'BA123', departureAirport: 'LHR', scheduledDepartureAt: `2026-10-30T${departure}:00Z`, ...flight },
    ...more,
  };
}
