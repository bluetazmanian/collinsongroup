export interface OpeningHours {
  /** MON..SUN */
  day: string;
  /** Local time, HH:MM. A closing time at or before the opening time means past midnight. */
  opens: string;
  closes: string;
}

export interface Venue {
  venueId: string;
  name: string;
  kind: string;
  keywords: string[];
  /** Validated AI concepts; empty when enrichment is missing. */
  concepts: string[];
  enrichment: 'done' | 'missing';
  /** Venue-supplied dietary facts, e.g. ["vegan"]. The only way to satisfy a dietary hard rule. */
  dietary: string[];
  terminal?: string | null;
  locationDescription?: string | null;
  openingHours?: OpeningHours[] | null;
  serviceMinutes?: number | null;
}

export interface Offer {
  offerId: string;
  venueId: string;
  title: string;
  conditions?: string | null;
  startsAt: string;
  endsAt: string;
}

export interface AirportProfile {
  airportId: string;
  timeZone: string;
  boardingBufferMinutes: number;
  walkBufferMinutes: number;
}

export interface Flight {
  flightNumber?: string;
  departureAirport: string;
  scheduledDepartureAt: string;
  estimatedDepartureAt?: string | null;
  gate?: string | null;
  boardingClosesAt?: string | null;
}

export interface TravellerContext {
  likes: string[];
  hardRules: string[];
  flight: Flight;
}

export interface Catalogue {
  version: number;
  lastSuccessfulFetchAt: string;
  venues: Venue[];
  offers: Offer[];
}

export type CatalogueState = 'fresh' | 'stale' | 'too-old';

export type Status = 'ok' | 'head-to-gate' | 'no-suitable' | 'no-reliable-data';

export type Warning = 'timing-estimated' | 'catalogue-stale' | 'offers-unavailable' | 'facts-missing';

export interface Result {
  venueId: string;
  name: string;
  kind: string;
  matched: string[];
  reasons: string[];
  visitMinutes: number;
  visitIsEstimate: boolean;
  location?: { terminal: string | null; description: string | null };
  offer?: { offerId: string; title: string; endsAt: string };
}

export interface Recommendation {
  status: Status;
  generatedAt: string;
  catalogue?: { state: 'fresh' | 'stale'; refreshedAt: string };
  time: {
    departureAt: string;
    airportTimeZone: string;
    usableMinutes: number;
    estimates: Array<'boarding' | 'walk'>;
  };
  results: Result[];
  warnings: Warning[];
}

export interface Settings {
  freshMinutes: number;
  staleLimitMinutes: number;
  headToGateMinutes: number;
  defaultLimit: number;
}

export const DEFAULT_SETTINGS: Settings = {
  freshMinutes: 30,
  staleLimitMinutes: 240,
  headToGateMinutes: 10,
  defaultLimit: 10,
};
