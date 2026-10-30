# Airport Trip Planner: Test Plan

Use unit tests for the recommendation rules and contract tests for the adapters. After deployment, check the integrations on staging. Load, failure and model-quality tests are required before production use; local results do not establish those outcomes.

## 1. Unit tests (every commit, no network)

| Area | Tests | Rule |
| --- | --- | --- |
| Time | Usable minutes with all facts supplied; with boarding estimated; with walk estimated; both estimated; a delayed flight; under 10 minutes gives `head-to-gate`; times across midnight and a clock change (late March, late October) | [Time](aws-deployment.md#time) |
| Filtering | Hard rule removes venues without the supplied dietary fact; AI concepts never satisfy a hard rule; closed venue removed; venue that closes mid-visit removed; visit longer than usable time removed; no matching like removed | [Ranking step 1](concepts-and-ranking.md#1-remove-what-can-t-work) |
| Scoring | +10 per like; two-concept likes need both; offer bonus only when fresh; over-80% penalty; missing-enrichment penalty; ties by spare time then name; `limit` respected | [Ranking steps 2–3](concepts-and-ranking.md#the-ranking-rule) |
| Offers | Shown only when `startsAt ≤ now < endsAt`; dropped one second after `endsAt`; hidden when stale | [Sales](aws-deployment.md#sales) |
| Freshness | 29 min → fresh; 31 min → stale; 4 h 1 min → no reliable data | [Freshness](aws-deployment.md#failures-and-freshness) |
| Reasons | Built only from concept labels; a keyword like `<script>` never reaches a reason | [Brand text](aws-deployment.md#keeping-brand-text-safe) |
| AI reply checks | Invalid JSON; unknown venue ID; repeated ID; unknown concept; dietary concept; more than 3 concepts; venue missing from reply | [AI checks](ai-keyword-reading.md#checking-the-reply) |
| Retry timing | Receive count 1–4 gives 1, 2, 4, 8 minutes | [Retries](aws-deployment.md#retries-without-waiting-30-minutes) |
| Circuit breaker | Opens after 5 failures in a row; stays open 30 s; one trial call; closes on success | [Protection](aws-deployment.md#protecting-the-traveller-service) |
| Request validation | Every row of the [API](api.md) errors table | API |

The six [worked examples](worked-examples.md) are also unit tests, with the same inputs and expected answers.

**Target:** every rule above covered; at least 90% line coverage on the planner rules package (rules code only, not adapters).

## 2. Contract tests (every commit, against stubs)

Stubs of the traveller service, venue service, offers feed and Bedrock return the shapes in [Outside services](upstream-contracts.md) and [AI keyword reading](ai-keyword-reading.md). Each adapter is tested for: the normal answer, missing optional fields, a `404`, a `500`, a slow answer past the deadline, and malformed JSON. When a real service's owners confirm their format, their example responses replace the stub's.

## 3. Staging tests (after every deploy to staging)

Run against the real staging stack, with stub upstream services.

| Test | Pass when |
| --- | --- |
| Sign in and get suggestions | A test traveller signs in and gets `200` with results |
| Sign up as a new user | A new account signs up, gets its code by email (Mailpit) or by text (LocalStack SMS), confirms, saves a trip and gets suggestions for that trip; one account can't read another's trip; a changed token is refused |
| **One traveller can't read another** | Traveller A's token never returns B's data, whatever `airportId` or body is sent |
| Wrong airport | Returns `409` |
| No token, expired token, token without scope | `401`, `401`, `403` |
| CORS | Another origin is refused |
| No caching | Responses carry `Cache-Control: private, no-store`; CloudFront never serves `/recommendations` |
| Refresh runs | A scheduled job publishes a new version; the pointer moves; the old version gets `expiresAt` |
| Duplicate job | The same job delivered twice publishes one version |
| Venue service down | Fast retries happen at roughly 1, 2, 4, 8 minutes; then the job is in the DLQ; the alarm fires |
| Stale state | With refresh stopped, at 31 minutes responses are `stale` with no offers |
| Brand text | A venue named `<img src=x onerror=alert(1)>` shows as plain text |
| Restore | Point-in-time restore to a new table, switch staging to it, suggestions still work |

## 4. Load and failure tests (before go-live, on staging)

Targets are starting assumptions, to be confirmed with the owner.

| Test | Load | Pass when |
| --- | --- | --- |
| Steady traffic | 50 requests/second for 30 minutes | p95 under 1 second; no errors; DynamoDB not throttled |
| Delay surge | Ramp to 200/second over 2 minutes, hold 10 minutes | p95 under 3 seconds; excess gets `429`, not `500`; refresh still runs on time |
| Above the limit | 400/second | Throttling returns `429`; nothing else breaks |
| Traveller service slow | Stub adds 3 seconds | `503` within about 2 seconds; circuit opens; recovers within a minute of the stub recovering |
| Bedrock throttled | Stub returns throttling | Refresh still publishes, with enrichment missing; next run retries those venues |
| Cold start | First request after 30 minutes idle | Under the 10-second timeout; record the time |

## 5. AI quality (before go-live)

The labelled-set comparison in [AI keyword reading](ai-keyword-reading.md#measuring-quality): the model must clearly beat keyword-synonym matching on at least 200 hand-labelled venues.

## 6. Accessibility (before go-live)

Automated checks (axe) on every screen state in [Screens](screens.md), plus a manual pass with a screen reader (VoiceOver on iOS, TalkBack on Android) and keyboard only.

## Done means

All unit and contract tests pass in CI; every staging test passes after the release candidate's deploy; load, failure, AI quality and accessibility results are written down with their dates. Real measurements replace the assumed targets in the [AWS design](aws-deployment.md).
