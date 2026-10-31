# Airport Trip Planner: API

The planner has one endpoint. This page gives its exact request, response and errors, so the web app and the `recommendations` function can be built separately against the same contract. The services the planner calls are covered in [Outside services](upstream-contracts.md).

## The endpoint

```
POST https://api.<domain>/recommendations
Authorization: Bearer <Cognito access token with scope planner/recommendations.read>
Content-Type: application/json
```

The traveller is identified only by the token. The body never carries a traveller ID.

## Request body

```json
{
  "airportId": "LHR",
  "limit": 10
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `airportId` | string | yes | IATA airport code, 3 capital letters. Must match the departure airport of the traveller's flight, otherwise `409`. |
| `limit` | integer | no | 1 to 10; default 10. |

Any other field is rejected with `400`. API Gateway validates the body against this shape before the function runs.

## Successful response: `200`

Every successful answer has the same outer shape. `status` tells the web app which screen to show.

```json
{
  "status": "ok",
  "generatedAt": "2026-10-30T13:00:05Z",
  "catalogue": {
    "state": "fresh",
    "refreshedAt": "2026-10-30T12:52:10Z"
  },
  "time": {
    "departureAt": "2026-10-30T14:30:00Z",
    "airportTimeZone": "Europe/London",
    "usableMinutes": 45,
    "estimates": ["boarding", "walk"]
  },
  "results": [
    {
      "venueId": "v-0192",
      "name": "Burger Stop",
      "kind": "restaurant",
      "matched": ["affordable", "quick-food", "takeaway"],
      "reasons": ["Matches: affordable, quick food, takeaway"],
      "visitMinutes": 15,
      "visitIsEstimate": true,
      "location": { "terminal": "5", "description": "Near gate A10" },
      "offer": {
        "offerId": "o-77",
        "title": "20% off meal deals",
        "endsAt": "2026-10-30T15:00:00Z"
      }
    }
  ],
  "warnings": ["timing-estimated"]
}
```

| Field | Meaning |
| --- | --- |
| `status` | `ok` (there are results), `head-to-gate` (under 10 usable minutes), `no-suitable` (nothing passes the rules), `no-reliable-data` (catalogue over 4 hours old) |
| `catalogue.state` | `fresh` (under 30 minutes) or `stale` (30 minutes to 4 hours). Absent when `status` is `no-reliable-data`. |
| `time.estimates` | Which parts of the time sum are estimates: any of `boarding`, `walk`. Empty when every part was supplied. |
| `results` | Ranked best first; empty unless `status` is `ok`. `location` and `offer` appear only when known. `offer` never appears when the catalogue is `stale`. |
| `reasons` | Built only from [concept](concepts-and-ranking.md) labels. Never contains brand text. |
| `warnings` | Any of `timing-estimated`, `catalogue-stale`, `offers-unavailable`, `facts-missing`. The web app shows a line for each. |

All times are UTC in ISO 8601 with a `Z`. `airportTimeZone` is for display only. The response header is `Cache-Control: private, no-store`.

## Errors

Every error uses one shape:

```json
{ "error": { "code": "traveller-service-unavailable", "message": "We couldn't load your trip details. Try again in a few seconds." } }
```

`message` is safe to show to the traveller. `code` is for the web app and logs.

| HTTP | `code` | When | Web app does |
| --- | --- | --- | --- |
| 400 | `invalid-request` | Body fails validation | Shows a generic error; logs it (it's a bug) |
| 401 | `unauthorised` | Missing, expired or invalid token | Starts sign-in again |
| 403 | `forbidden` | Token lacks the scope | Shows a generic error |
| 404 | `unknown-airport` | No catalogue exists for this airport | "We don't cover this airport yet" |
| 409 | `airport-mismatch` | `airportId` isn't the flight's departure airport | Shows the message; the traveller is at the wrong airport for this flight |
| 409 | `flight-departed` | The flight's departure time has passed | Shows the message and "Change my trip" |
| 409 | `flight-not-today` | The flight leaves more than 24 hours from now | Shows the message and "Change my trip" |
| 409 | `flight-time-unreadable` | The traveller service sent no readable departure time | Shows the message and "Change my trip" |
| 429 | `too-many-requests` | Throttling or WAF rate rule | Waits for `Retry-After`, then retries |
| 503 | `traveller-service-unavailable` | Deadline hit or circuit breaker open | Waits for `Retry-After` (10 seconds), retries up to 3 times with jitter |
| 500 | `internal-error` | Anything unexpected | Shows a generic error with a retry button |

## CORS and caching

- Allowed origin: the web app's own HTTPS origin only. Allowed method: `POST`. Allowed headers: `Authorization`, `Content-Type`.
- No response is cached by CloudFront or any shared cache.

## How the function builds the answer

1. Read the token subject; get preferences and flight ([Outside services](upstream-contracts.md)).
2. Check `airportId` against the flight's departure airport, then the flight itself: departed, more than 24 hours away or no readable departure time each give a `409`.
3. Get the active catalogue version and its age ([AWS design](aws-deployment.md#reading-the-catalogue-without-a-hot-partition)). Over 4 hours: `no-reliable-data`.
4. Work out usable minutes ([Time](aws-deployment.md#time)). Under 10: `head-to-gate`.
5. Filter and rank ([Concepts and ranking](concepts-and-ranking.md)). Nothing left: `no-suitable`.
6. Attach valid offers if the catalogue is fresh; build reasons and warnings; return.
