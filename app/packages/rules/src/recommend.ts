import {
  PREFERENCES, conceptsFromKeywords, getConcept, isFoodConcept, isShoppingConcept, sortByListOrder,
  type LikeRule,
} from '@atp/concepts';
import { catalogueState, openForVisit, usableTime, visitLength } from './time.js';
import type {
  AirportProfile, Catalogue, Offer, Recommendation, Result, Settings, TravellerContext, Venue, Warning,
} from './types.js';
import { DEFAULT_SETTINGS } from './types.js';

export interface RecommendInput {
  traveller: TravellerContext;
  airport: AirportProfile;
  /** Null when the airport has no published catalogue yet. */
  catalogue: Catalogue | null;
  now: Date;
  limit?: number;
  walkMinutes?: number | null;
  settings?: Settings;
}

/** The concepts a venue is matched on: validated AI concepts, or keyword synonyms when enrichment is missing. */
export function venueConcepts(venue: Venue): string[] {
  return venue.enrichment === 'done' ? venue.concepts : conceptsFromKeywords(venue.keywords);
}

function likeMatches(rule: LikeRule, concepts: ReadonlySet<string>): boolean {
  if (!rule.all.every((c) => concepts.has(c))) return false;
  if (rule.anyOf === 'food') return [...concepts].some(isFoodConcept);
  if (rule.anyOf === 'shopping') return [...concepts].some(isShoppingConcept);
  return true;
}

export function offerIsLive(offer: Offer, now: Date): boolean {
  const t = now.getTime();
  return new Date(offer.startsAt).getTime() <= t && t < new Date(offer.endsAt).getTime();
}

interface Candidate {
  venue: Venue;
  matched: string[];
  score: number;
  visit: { minutes: number; estimate: boolean };
  spare: number;
  offer?: Offer;
  hoursKnown: boolean;
}

export function recommend(input: RecommendInput): Recommendation {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const { traveller, airport, now } = input;
  const limit = Math.min(Math.max(input.limit ?? settings.defaultLimit, 1), 10);
  const time = usableTime(traveller.flight, airport, now, input.walkMinutes);
  const base = {
    generatedAt: now.toISOString(),
    time: { ...time, airportTimeZone: airport.timeZone },
  };
  const timingWarnings: Warning[] = time.estimates.length ? ['timing-estimated'] : [];

  const state = input.catalogue ? catalogueState(input.catalogue.lastSuccessfulFetchAt, now, settings) : 'too-old';
  if (!input.catalogue || state === 'too-old') {
    return { ...base, status: 'no-reliable-data', results: [], warnings: timingWarnings };
  }
  const catalogue = input.catalogue;
  const catalogueInfo = { state, refreshedAt: catalogue.lastSuccessfulFetchAt } as const;
  const stateWarnings: Warning[] = state === 'stale' ? ['catalogue-stale', 'offers-unavailable'] : [];

  if (time.usableMinutes < settings.headToGateMinutes) {
    return { ...base, status: 'head-to-gate', catalogue: catalogueInfo, results: [], warnings: [...timingWarnings, ...stateWarnings] };
  }

  const likes = traveller.likes.flatMap((id) => {
    const m = PREFERENCES[id];
    return m?.type === 'like' ? [m.rule] : [];
  });
  // A hard rule the planner doesn't know is still a rule: only a venue that states the same fact can meet it.
  const hardRules = traveller.hardRules.map((id) => {
    const key = id.trim().toLowerCase();
    const m = PREFERENCES[key];
    return m?.type === 'hard' ? m.concept : key;
  });

  const liveOffers = new Map<string, Offer[]>();
  if (state === 'fresh') {
    for (const o of catalogue.offers) {
      if (offerIsLive(o, now)) liveOffers.set(o.venueId, [...(liveOffers.get(o.venueId) ?? []), o]);
    }
  }

  const candidates: Candidate[] = [];
  for (const venue of catalogue.venues) {
    // 1. Remove what can't work.
    const dietary = venue.dietary.map((d) => d.trim().toLowerCase());
    if (!hardRules.every((c) => dietary.includes(c))) continue;
    const concepts = venueConcepts(venue);
    const set = new Set(concepts);
    const visit = visitLength(venue, concepts);
    if (visit.minutes > time.usableMinutes) continue;
    const open = openForVisit(venue.openingHours, now, visit.minutes, airport.timeZone);
    if (open === false) continue;
    const matchedRules = likes.filter((r) => likeMatches(r, set));
    if (matchedRules.length === 0) continue;

    // 2. Score.
    let score = 10 * matchedRules.length;
    // Only an offer that still runs when the visit ends counts.
    const visitEnds = now.getTime() + visit.minutes * 60_000;
    const offer = liveOffers.get(venue.venueId)?.find((o) => new Date(o.endsAt).getTime() >= visitEnds);
    if (offer) score += 5;
    if (visit.minutes > 0.8 * time.usableMinutes) score -= 5;
    if (venue.enrichment === 'missing') score -= 2;

    const matched = sortByListOrder(
      matchedRules.flatMap((r) => [
        ...r.all,
        ...(r.anyOf === 'food' ? concepts.filter(isFoodConcept) : []),
        ...(r.anyOf === 'shopping' ? concepts.filter(isShoppingConcept) : []),
      ]),
    );
    candidates.push({ venue, matched, score, visit, spare: time.usableMinutes - visit.minutes, offer, hoursKnown: open !== null });
  }

  if (candidates.length === 0) {
    return { ...base, status: 'no-suitable', catalogue: catalogueInfo, results: [], warnings: [...timingWarnings, ...stateWarnings] };
  }

  // 3. Order and trim: score, then spare time, then name, so the same inputs always give the same order.
  candidates.sort((a, b) => b.score - a.score || b.spare - a.spare || a.venue.name.localeCompare(b.venue.name, 'en'));
  const top = candidates.slice(0, limit);

  // 4. Explain, using concept labels only.
  const results: Result[] = top.map((c) => {
    const labels = c.matched.map((id) => getConcept(id)?.label ?? id);
    const r: Result = {
      venueId: c.venue.venueId,
      name: c.venue.name,
      kind: c.venue.kind,
      matched: c.matched,
      reasons: [`Matches: ${labels.join(', ')}`],
      visitMinutes: c.visit.minutes,
      visitIsEstimate: c.visit.estimate,
    };
    if (c.venue.terminal || c.venue.locationDescription) {
      r.location = { terminal: c.venue.terminal ?? null, description: c.venue.locationDescription ?? null };
    }
    if (c.offer) r.offer = { offerId: c.offer.offerId, title: c.offer.title, endsAt: c.offer.endsAt };
    return r;
  });

  const warnings: Warning[] = [...timingWarnings, ...stateWarnings];
  if (top.some((c) => !c.hoursKnown)) warnings.push('facts-missing');
  return { ...base, status: 'ok', catalogue: catalogueInfo, results, warnings };
}
