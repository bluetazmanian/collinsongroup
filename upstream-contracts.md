# Airport Trip Planner: Outside Services

The planner depends on services it doesn't own. This page sets out exactly what it needs from each, in the shape it expects. **These are proposals to agree with each service's owners**: the requirements say the traveller and venue services exist, but not how they work. Where a real service differs, an adapter translates; the planner's rules don't change ([application structure](diagrams/airport-trip-planner-diagram-2.excalidraw)).

## Traveller service (supplied)

Used on every traveller request, through a 2-second deadline, a 60-second cache and a circuit breaker ([details](aws-deployment.md#protecting-the-traveller-service)).

**Preferred call** — the service decides whose record to return from the traveller's own token:

```
GET https://<traveller-service>/travellers/me
Authorization: Bearer <the traveller's access token, forwarded>
```

**Fallback call** — only if the service can't accept that token. The planner uses its own credential and the verified link record ([Who the traveller is](aws-deployment.md#who-the-traveller-is)):

```
GET https://<traveller-service>/travellers/{travellerId}
Authorization: Bearer <planner service credential from Secrets Manager>
```

**Expected response:**

```json
{
  "travellerId": "t-48213",
  "preferences": {
    "likes": ["budget-food", "coffee", "fashion"],
    "hardRules": ["vegan"]
  },
  "flight": {
    "flightNumber": "BA123",
    "departureAirport": "LHR",
    "scheduledDepartureAt": "2026-10-30T14:30:00Z",
    "estimatedDepartureAt": "2026-10-30T14:30:00Z",
    "gate": "A10",
    "boardingClosesAt": null
  },
  "updatedAt": "2026-10-30T12:40:00Z"
}
```

| What we need | Why | If it's missing |
| --- | --- | --- |
| Preference IDs from a fixed list | They map to [concepts](concepts-and-ranking.md#preference-mapping) without AI | Free text can't be matched safely; the adapter would need a mapping table |
| Hard rules kept separate from likes | A hard rule removes venues; a like only ranks them | Everything is treated as a like |
| Departure airport as an IATA code | Picks the catalogue and checks the request | `409` can't be detected |
| Estimated departure, not just scheduled | Delays change the usable time | Scheduled time is used, with a warning |
| Gate and boarding-close time | Replace the estimates | 30-minute boarding and 15-minute walk estimates are used |
| UTC timestamps | Time maths | A time without an offset is read in the airport's time zone. An unreadable departure gives `409 flight-time-unreadable`; an unreadable estimate or boarding time is ignored |

**Errors the planner expects:** `401` or `403` → the planner returns `401` to the browser; `404` (no record) → `503` with a "no trip found" message; `5xx` or no answer within 2 seconds → counts towards the circuit breaker and returns `503`.

**Questions for the owners:** Can you accept our Cognito tokens, or federate yours into our pool? Is the preference list fixed, and can we have it? Do you publish delay updates?

## Venue service (supplied)

Used only by the refresh job, never on a traveller request.

```
GET https://<venue-service>/airports/{airportId}/venues?pageToken=<token>
Authorization: Bearer <planner service credential from Secrets Manager>
```

**Expected response:**

```json
{
  "venues": [
    {
      "venueId": "v-0192",
      "name": "Burger Stop",
      "kind": "restaurant",
      "keywords": ["fast food", "cheap", "takeaway"],
      "terminal": "5",
      "locationDescription": "Near gate A10",
      "openingHours": [{ "day": "MON", "opens": "05:00", "closes": "22:00" }],
      "serviceMinutes": null,
      "dietary": [],
      "updatedAt": "2026-10-29T08:00:00Z"
    }
  ],
  "nextPageToken": null
}
```

Only `venueId`, `name` and `keywords` are essential. Everything else improves the answer when present: opening hours let the planner drop closed venues; `serviceMinutes` replaces the default visit length; location appears on the result card; `dietary` (for example `["vegan", "halal"]`), supplied by the venue, is the only thing that can satisfy a dietary hard rule. Opening hours are in airport local time; the planner converts them using the airport's time zone.

The refresh job cleans what it receives before publishing. Days may be written in any case, short or full (`MON`, `mon`, `Monday`); times must be `HH:MM`, up to `24:00`. Unreadable opening-hours entries are dropped, and a venue with none left counts as "hours unknown", not closed. Dietary facts are lower-cased. A venue listed twice keeps its first entry. Offers without readable start and end times, or ending before they start, are dropped.

**Questions for the owners:** How big is a typical airport listing? How many requests per minute can we make? Do you have a "changed since" filter? Is `venueId` stable over time?

## Offers feed (not supplied yet)

Nothing in the requirements provides offers. When a source is found, the refresh job needs:

```
GET https://<offers-source>/airports/{airportId}/offers
```

```json
{
  "offers": [
    {
      "offerId": "o-77",
      "venueId": "v-0192",
      "title": "20% off meal deals",
      "conditions": "Show boarding pass",
      "startsAt": "2026-10-30T06:00:00Z",
      "endsAt": "2026-10-30T15:00:00Z"
    }
  ]
}
```

`venueId` must match the venue service's IDs. `startsAt` and `endsAt` are required; an offer without them is ignored. Until a source exists, no offers are shown.

## Travel facts (not supplied yet)

Gate-closing and walking times improve the time sum. If an airport can supply them, the planner reads:

```json
{ "airportId": "LHR", "walkMinutes": [{ "fromVenueId": "v-0192", "toGate": "A10", "minutes": 6 }] }
```

Until then, the [labelled estimates](aws-deployment.md#time) are used.

## Credentials

Each service credential is stored in Secrets Manager as `airport-planner/<service>`, read at function start and cached for 5 minutes. No credential is ever sent to the browser or written to logs.
