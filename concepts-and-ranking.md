# Airport Trip Planner: Concepts and Ranking

Brands describe themselves in their own words. Travellers pick preferences from a list. Both are translated into one fixed set of **concepts**, and the planner only ever compares concepts. This page lists them, says how each side is translated, and gives the exact ranking rule.

## The concept list

Concept IDs are lower-case with hyphens. The label is what travellers see in reasons.

| Group | Concept ID | Label | Set by |
| --- | --- | --- | --- |
| Price | `affordable` | affordable | AI from keywords |
| | `mid-range` | mid-range | AI from keywords |
| | `premium` | premium | AI from keywords |
| Pace | `quick-food` | quick food | AI from keywords |
| | `sit-down` | sit-down dining | AI from keywords |
| | `takeaway` | takeaway | AI from keywords |
| Food and drink | `coffee` | coffee | AI from keywords |
| | `bakery` | bakery | AI from keywords |
| | `burgers` | burgers | AI from keywords |
| | `asian` | Asian food | AI from keywords |
| | `fresh-light` | fresh and light | AI from keywords |
| | `bar` | drinks | AI from keywords |
| Shopping | `fashion` | fashion | AI from keywords |
| | `beauty` | beauty | AI from keywords |
| | `electronics` | electronics | AI from keywords |
| | `books-news` | books and news | AI from keywords |
| | `gifts` | gifts and souvenirs | AI from keywords |
| | `duty-free` | duty free | AI from keywords |
| | `travel-essentials` | travel essentials | AI from keywords |
| Dietary | `vegan` | vegan options | **Venue's supplied facts only** |
| | `vegetarian` | vegetarian options | **Venue's supplied facts only** |
| | `halal` | halal options | **Venue's supplied facts only** |
| | `gluten-free` | gluten-free options | **Venue's supplied facts only** |

The AI is never allowed to return a dietary concept. It reads marketing words, and "healthy" doesn't prove a dish is vegan or safe for someone with an allergy. Dietary concepts come only from the venue's `dietary` field ([Outside services](upstream-contracts.md#venue-service-supplied)).

The list lives in one file in the code (`concepts.ts`) and in the AI prompt. Adding a concept means updating both, then running a full re-read of keywords.

## Preference mapping

Traveller preferences come from the traveller service's fixed list. Each maps to concepts in a plain table, with no AI involved. "Any food concept" means any concept in the Pace or Food and drink groups; "any shopping concept" means any in the Shopping group. Example, to be completed once the real list is known:

| Preference ID | Concepts | Type |
| --- | --- | --- |
| `budget-food` | `affordable` + any food concept | like |
| `coffee` | `coffee` | like |
| `fine-dining` | `premium` + `sit-down` | like |
| `quick-bite` | `quick-food` | like |
| `sit-down-dining` | `sit-down` | like |
| `fashion` | `fashion` | like |
| `luxury-shopping` | `premium` + any shopping concept | like |
| `good-service` | `premium` | like |
| `vegan` | `vegan` | hard rule |
| `halal` | `halal` | hard rule |

A **like** raises a venue's score. A **hard rule** removes every venue that doesn't satisfy it.

## The ranking rule

For one request, with the traveller's likes, hard rules and usable minutes:

### 1. Remove what can't work

A venue is dropped if any of these is true:

- it fails a hard rule (its supplied `dietary` list doesn't include the rule's concept);
- its opening hours are known and it's closed now, or closes before now + visit length;
- its visit length is more than the usable minutes;
- it matches none of the traveller's likes.

Visit length is the venue's `serviceMinutes` if supplied; otherwise 15 minutes if it has `quick-food` or `takeaway` or `coffee`, 45 if `sit-down`, 20 for any shopping concept, and 20 for anything else.

### 2. Score what's left

| Part | Points |
| --- | --- |
| Each like it matches | +10 |
| A valid offer at this venue, and the catalogue is fresh | +5 |
| Visit uses more than 80% of the usable minutes | −5 |
| Enrichment missing (matched on original keywords only) | −2 |

A like that maps to two concepts (for example `fine-dining`) counts once, and only if the venue has both.

Matching on original keywords: when a venue's enrichment is missing, a like matches if one of the venue's keywords, lower-cased, equals a word in that concept's built-in synonym list in `concepts.ts` (for example `affordable`: cheap, budget, value, low-cost). This is less accurate, so it scores slightly lower.

### 3. Order and trim

Sort by score, highest first. Break ties by more spare time (usable minutes − visit length), then by venue name A to Z, so the same inputs always give the same order. Return the top `limit` (default 10).

### 4. Explain

Each result's reason lists the matched concept labels in concept-list order: "Matches: affordable, quick food, takeaway". For a like that accepts "any food concept" or "any shopping concept", every such concept the venue has is listed. If it has a valid offer, the offer title is shown separately, from the offers feed. No brand keyword is ever put into a reason.

## Worked through

The [worked examples](worked-examples.md) apply exactly these rules. In example 1, Burger Stop scores +10 (`budget-food` → `affordable` with a food concept) and has 30 spare minutes; The Terrace matches no like and is dropped in step 1.
