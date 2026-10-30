// The fixed concept list, preference mapping and keyword synonyms.
// Source of truth: concepts-and-ranking.md. Change both together, and keep
// AI_CONCEPTS in step with the prompt in ai-keyword-reading.md.

export type ConceptGroup = 'price' | 'pace' | 'food' | 'shopping' | 'dietary';

export interface Concept {
  id: string;
  label: string;
  group: ConceptGroup;
  /** Lower-case keywords that match this concept when AI enrichment is missing. */
  synonyms: string[];
}

export const CONCEPTS: readonly Concept[] = [
  { id: 'affordable', label: 'affordable', group: 'price', synonyms: ['cheap', 'budget', 'value', 'low-cost', 'affordable'] },
  { id: 'mid-range', label: 'mid-range', group: 'price', synonyms: ['mid-range', 'moderate'] },
  { id: 'premium', label: 'premium', group: 'price', synonyms: ['luxury', 'premium', 'exclusive', 'designer'] },
  { id: 'quick-food', label: 'quick food', group: 'pace', synonyms: ['fast food', 'quick', 'grab and go', 'snacks'] },
  { id: 'sit-down', label: 'sit-down dining', group: 'pace', synonyms: ['bistro', 'restaurant', 'table service', 'dining'] },
  { id: 'takeaway', label: 'takeaway', group: 'pace', synonyms: ['takeaway', 'take away', 'to go'] },
  { id: 'coffee', label: 'coffee', group: 'food', synonyms: ['coffee', 'espresso', 'cafe', 'café'] },
  { id: 'bakery', label: 'bakery', group: 'food', synonyms: ['bakery', 'pastries', 'bread'] },
  { id: 'burgers', label: 'burgers', group: 'food', synonyms: ['burgers', 'burger'] },
  { id: 'asian', label: 'Asian food', group: 'food', synonyms: ['asian', 'sushi', 'noodles', 'ramen', 'dim sum'] },
  { id: 'fresh-light', label: 'fresh and light', group: 'food', synonyms: ['salads', 'fresh', 'light', 'juice'] },
  { id: 'bar', label: 'drinks', group: 'food', synonyms: ['bar', 'wine list', 'cocktails', 'pub', 'beer'] },
  { id: 'fashion', label: 'fashion', group: 'shopping', synonyms: ['fashion', 'clothing', 'apparel'] },
  { id: 'beauty', label: 'beauty', group: 'shopping', synonyms: ['beauty', 'cosmetics', 'fragrance', 'skincare'] },
  { id: 'electronics', label: 'electronics', group: 'shopping', synonyms: ['electronics', 'tech', 'gadgets'] },
  { id: 'books-news', label: 'books and news', group: 'shopping', synonyms: ['books', 'newsagent', 'magazines'] },
  { id: 'gifts', label: 'gifts and souvenirs', group: 'shopping', synonyms: ['gifts', 'souvenirs'] },
  { id: 'duty-free', label: 'duty free', group: 'shopping', synonyms: ['duty free', 'tax free'] },
  { id: 'travel-essentials', label: 'travel essentials', group: 'shopping', synonyms: ['travel essentials', 'adapters', 'toiletries'] },
  { id: 'vegan', label: 'vegan options', group: 'dietary', synonyms: [] },
  { id: 'vegetarian', label: 'vegetarian options', group: 'dietary', synonyms: [] },
  { id: 'halal', label: 'halal options', group: 'dietary', synonyms: [] },
  { id: 'gluten-free', label: 'gluten-free options', group: 'dietary', synonyms: [] },
];

const BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));

/** Concepts the AI may return. Dietary concepts come only from venue-supplied facts. */
export const AI_CONCEPTS: readonly string[] = CONCEPTS.filter((c) => c.group !== 'dietary').map((c) => c.id);

export const DIETARY_CONCEPTS: readonly string[] = CONCEPTS.filter((c) => c.group === 'dietary').map((c) => c.id);

export function getConcept(id: string): Concept | undefined {
  return BY_ID.get(id);
}

export function isFoodConcept(id: string): boolean {
  const g = BY_ID.get(id)?.group;
  return g === 'pace' || g === 'food';
}

export function isShoppingConcept(id: string): boolean {
  return BY_ID.get(id)?.group === 'shopping';
}

/** Order concept IDs as they appear in the concept list. */
export function sortByListOrder(ids: Iterable<string>): string[] {
  const order = new Map(CONCEPTS.map((c, i) => [c.id, i]));
  return [...new Set(ids)].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

/**
 * A like is satisfied when the venue has every concept in `all`, and at least
 * one concept from `anyOf` when present.
 */
export interface LikeRule {
  all: string[];
  anyOf?: 'food' | 'shopping';
}

export type PreferenceMapping =
  | { type: 'like'; rule: LikeRule }
  | { type: 'hard'; concept: string };

/** Traveller-service preference IDs mapped to concepts. Extend once the real list is known. */
export const PREFERENCES: Readonly<Record<string, PreferenceMapping>> = {
  'budget-food': { type: 'like', rule: { all: ['affordable'], anyOf: 'food' } },
  coffee: { type: 'like', rule: { all: ['coffee'] } },
  'fine-dining': { type: 'like', rule: { all: ['premium', 'sit-down'] } },
  'quick-bite': { type: 'like', rule: { all: ['quick-food'] } },
  'sit-down-dining': { type: 'like', rule: { all: ['sit-down'] } },
  fashion: { type: 'like', rule: { all: ['fashion'] } },
  'luxury-shopping': { type: 'like', rule: { all: ['premium'], anyOf: 'shopping' } },
  'good-service': { type: 'like', rule: { all: ['premium'] } },
  vegan: { type: 'hard', concept: 'vegan' },
  vegetarian: { type: 'hard', concept: 'vegetarian' },
  halal: { type: 'hard', concept: 'halal' },
  'gluten-free': { type: 'hard', concept: 'gluten-free' },
};

/** Concepts a venue gets from its original keywords alone (fallback when AI enrichment is missing). */
export function conceptsFromKeywords(keywords: readonly string[]): string[] {
  const words = keywords.map((k) => k.trim().toLowerCase());
  const found = CONCEPTS.filter((c) => c.synonyms.some((s) => words.includes(s))).map((c) => c.id);
  return sortByListOrder(found);
}
