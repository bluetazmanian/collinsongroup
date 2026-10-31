# Airport Trip Planner: AWS Design

[Editable diagram](diagrams/airport-trip-planner-aws-deployment.excalidraw) · [PNG](diagrams/airport-trip-planner-aws-deployment-preview.png) · [SVG](diagrams/airport-trip-planner-aws-deployment.svg)

Regional services run in **London (`eu-west-2`)**; CloudFront is global. There are two paths: a fast request path that recommends places, and a background path that prepares the catalogue. These are concrete design choices, not deployed resources. AWS documentation was checked on 28 October 2026.

Every number on this page — timeouts, limits, buffers, intervals — is a **starting setting to validate under load**, not a measured result.

## The AWS choices

| Responsibility | Chosen service and configuration | Why |
| --- | --- | --- |
| Web app code | **Plain JavaScript, HTML and CSS**, no framework and no build step; about 800 lines | A few screens only. Loads fast on airport Wi-Fi and phones, runs under a strict Content Security Policy with no inline scripts, and has nothing to upgrade. A framework becomes worth it if the screens grow a lot. |
| Serve the web app | A private **S3** bucket behind **CloudFront**, using Origin Access Control, with a response headers policy that sets a strict Content Security Policy | Deliver static assets without running web servers. Block public S3 access; use a normal bucket origin, not a website endpoint. |
| Domain and HTTPS | **Route 53** and **ACM**; CloudFront's certificate is in `us-east-1`, the regional API certificate in London | Give the app and API HTTPS addresses. The web and API are separate origins. |
| Sign in | **Cognito user pool**, a public browser client, authorization-code flow with PKCE. If the traveller service already has its own identity provider, federate it into this pool rather than create a second sign-in | The browser gets an access token without holding a client secret. See [Who the traveller is](#who-the-traveller-is). |
| Receive requests | **API Gateway REST API**, regional, stage throttling **200 requests/second, burst 400**, with **AWS WAF** on its stage and a **rate-based rule of 300 requests per IP per 5 minutes** | Expose `POST /recommendations`; use the Cognito authorizer and the `planner/recommendations.read` scope. Throttling and the WAF rule stop a surge or a misbehaving client from overloading what sits behind. |
| Recommend places | Lambda **`recommendations`**, TypeScript compiled to JavaScript, **`nodejs24.x`**, 1,024 MB, 10-second timeout, **reserved concurrency 200** | Read facts and the catalogue, apply constraints, rank matches and return reasons. No AI call in this function. |
| Store the catalogue | DynamoDB **`AirportCatalogue`**, on-demand capacity, point-in-time recovery, TTL on `expiresAt` | Keep immutable catalogue versions, offers and a small pointer to the active version. Reads are by airport and version. |
| Start refreshes | EventBridge Scheduler, **`rate(15 minutes)`**, one job per airport; its own dead-letter queue **`scheduler-dlq`** with 3 retries | A chosen starting refresh interval. Scheduler failures to deliver a job land in their own queue. |
| Buffer refresh work | SQS **`catalogue-refresh`**, batch size 1, visibility timeout 1,800 seconds | Each message is one bounded airport snapshot. The long default timeout covers a full 300-second run; failures shorten it (see [Retries](#retries-without-waiting-30-minutes)). |
| Handle failed refresh jobs | SQS **`catalogue-refresh-dlq`**, redrive after 5 receives, 14-day retention | Keep exhausted worker jobs for inspection and replay. |
| Refresh the catalogue | Lambda **`refresh-catalogue`**, **`nodejs24.x`**, 300-second timeout, **reserved concurrency 5** | Fetch listings and offers, interpret keywords, check results, then publish a complete snapshot. Its own reserved capacity means a traffic surge can't starve it. |
| Interpret keywords | Bedrock **Amazon Nova Micro**, model **`amazon.nova-micro-v1:0`**, through the **Converse API in London**, at most **200 venues per job** | A pre-built text model for keyword classification. Use the regional model directly; no cross-region inference or model training. |
| Operate it | IAM roles, Secrets Manager, CloudWatch alarms and a runbook | Separate permissions, store upstream credentials, and alert before travellers notice. See [Alarms](#alarms) and [Runbook](#runbook). |

Node.js 24 is a supported Lambda runtime. AWS lists Nova Micro as available for in-region inference in London and supports Converse for it. [Lambda runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html), [Nova Micro model and regional availability](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-micro.html).

## What happens when a traveller asks

1. CloudFront serves the web app from private S3. The browser signs in through Cognito.
2. The browser sends `POST /recommendations` with an access token and `airportId`. It does not choose someone else's preferences record.
3. WAF and stage throttling check the request. API Gateway validates the token and scope, then invokes `recommendations`.
4. The function reads the traveller's preferences and flight from the traveller service (see [Who the traveller is](#who-the-traveller-is) and [Protecting the traveller service](#protecting-the-traveller-service)).
5. It gets the active catalogue version and its venues and offers from memory, or from DynamoDB on a cache miss (see [Reading the catalogue](#reading-the-catalogue-without-a-hot-partition)). It uses gate and walking-time facts if a source supplies them.
6. It works out the usable time (see [Time](#time)), drops anything that doesn't fit or isn't open, drops expired offers, ranks what's left by preference match, and returns venue IDs, reasons, valid offers and any timing or data warnings. The response uses `Cache-Control: private, no-store`.

CORS allows the web app's origin. Personal recommendations go directly to the regional API and are not cached by CloudFront. WAF is associated with the REST API stage, so protection does not depend on requests passing through CloudFront. [Private S3 origins](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html), [Cognito code flow and PKCE](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html), [WAF for REST APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-control-access-aws-waf.html), [WAF rate-based rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html), [API Gateway throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html).

The custom resource scope must be configured in the user pool and required on the API method. An ID token is not used as a substitute for that scoped access token. [Cognito API authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html).

## Who the traveller is

The planner must never be able to read one traveller's record on behalf of another. Two ways to get there, in order of preference:

1. **Preferred: the traveller service decides.** The traveller service trusts this Cognito pool (or the pool federates the service's own identity provider). The planner forwards the traveller's access token, and the service returns the record for that token's subject. The planner holds no credential that can read every traveller's record.
2. **Fallback: a verified link.** If the service can't accept the token, the planner keeps a link record (`TRAVELLER#<sub>` → `travellerId`), written only once, at a step where the traveller proves they own that record. The planner's service credential is limited to the read-only preferences endpoint.

Either way, the build includes a test that traveller A's token can never return traveller B's preferences. Which option applies depends on what the traveller service supports, and must be settled before building.

## Protecting the traveller service

The traveller service is called on the request path, so a surge here would hit it directly. Four guards:

- **Throttling at the door:** stage throttling (200/second, burst 400) and the WAF rate rule cap what reaches the function. Reserved concurrency of 200 caps how many calls can be in flight at once.
- **A short cache:** each function instance keeps a traveller's preferences and flight for **60 seconds**, keyed by subject. Repeat requests from the same traveller don't call the service again. Flight changes still show up within a minute.
- **A circuit breaker:** after **5 failures in a row**, the instance stops calling the service for **30 seconds** and returns `503` straight away. Then it tries one call; if that works, normal calls resume.
- **A deadline and a polite retry:** each call has a **2-second** deadline. A `503` carries `Retry-After: 10`, and the web app retries with backoff and jitter, never in a tight loop.

## Reading the catalogue without a hot partition

All venues in one version share a partition key, and every request needs them. Reading them from DynamoDB each time would concentrate all traffic for an airport on one partition, which handles about 3,000 read units a second. A large catalogue would hit that at a modest request rate.

Versions never change once written, so they can be cached safely:

- Each function instance keeps the **active pointer for 30 seconds**, then re-reads it (one small, strongly consistent read).
- It keeps **each version's venues and offers in memory**, keyed by airport and version number. A version is read from DynamoDB once per instance, the first time it's needed.
- A new version therefore reaches travellers within 30 seconds of being published. DynamoDB sees roughly one pointer read per instance every 30 seconds, plus one version read per instance per refresh.

[DynamoDB partition throughput](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html).

## Time

All times are stored and compared in **UTC** (ISO 8601). Each airport's record has its IANA timezone (for example `Europe/London`), used only to show local times on screen.

Usable time = flight departure − now − boarding buffer − walk buffer.

- **Departure:** the latest time from the traveller service, re-read at least every 60 seconds. If the service reports a delay, the new time is used. The planner never assumes a delay it hasn't been told about.
- **Boarding buffer:** if a source gives the gate-closing time, use it. Otherwise assume **boarding closes 30 minutes before departure**. This is a per-airport setting, and the traveller sees that it's an estimate.
- **Walk buffer:** if a source gives walking time to the gate, use it. Otherwise assume **15 minutes**, again shown as an estimate.
- **Visit length:** supplied service time if known; otherwise a default per concept — **15 minutes** for quick food, **45 minutes** for sit-down dining, **20 minutes** for shopping.

A venue is suggested only if its visit length fits the usable time. If the usable time is under 10 minutes, the answer is "head to your gate" rather than a list. Every suggestion that relies on an estimate says so.

A flight that has already left, or leaves more than **24 hours** from now, gets a clear message instead of suggestions; suggestions are for the day of travel. A departure time without a UTC offset is read in the airport's time zone.

## What happens every 15 minutes

Scheduler puts an airport refresh job on SQS. Lambda polls the queue and invokes `refresh-catalogue`. The worker fetches that airport's listings and, if an offers feed is supplied, its offers. It compares the keywords with the previous version and sends Nova Micro **every venue whose keywords changed, plus every venue whose enrichment is still missing**, up to 200 per job. The first full load is spread over several runs; any venue not done yet is matched on its original keywords until then.

For example, the worker can turn "cheap", "budget" and "value" into the same affordability concept. Preferences use the same controlled vocabulary. The application checks the returned JSON and allowed concepts before saving them. Nova Micro does **not** provide native structured-output enforcement, so the model response is never trusted as already valid. It cannot establish opening hours, prices, sale validity or dietary safety. Personal flight information never goes to Bedrock. If Bedrock throttles, the worker stops sending for that run and leaves the rest marked missing, to be retried next time. [Nova Micro capabilities](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-micro.html).

The job is safe to repeat, using a stable job ID and version record. Already completed or superseded work is skipped. SQS may deliver it more than once. Batch size 1 keeps each delivery focused on one snapshot; report failed records if batching is expanded. [Lambda/SQS configuration](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html), [Scheduler targets](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-targets-templated.html).

### Retries without waiting 30 minutes

The queue's 1,800-second visibility timeout is six times the worker's 300-second limit, as AWS recommends, so a slow but healthy run is never handed to a second worker. But a failed job shouldn't wait 30 minutes for its retry.

So when a run fails — the venue service is down, say — the worker **shortens the message's visibility before giving up**, using the receive count: **1, 2, 4, then 8 minutes**. All five attempts happen within about 15 minutes, and the next scheduled job arrives anyway. Only then does the job go to `catalogue-refresh-dlq`. [ChangeMessageVisibility](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ChangeMessageVisibility.html).

## Exactly what DynamoDB holds

The table uses string keys named `PK` and `SK`:

| Record | PK | SK | Main fields |
| --- | --- | --- | --- |
| Airport | `AIRPORT#<airportId>` | `PROFILE` | IANA timezone, boarding buffer, default walk buffer |
| Active version | `AIRPORT#<airportId>` | `ACTIVE` | `version`, `lastSuccessfulFetchAt` |
| Venue in a version | `AIRPORT#<airportId>#VERSION#<version>` | `VENUE#<venueId>` | Original keywords, validated concepts, enrichment status, supplied facts and their timestamps, `expiresAt` once superseded |
| Offer in a version | `AIRPORT#<airportId>#VERSION#<version>` | `OFFER#<venueId>#<offerId>` | `startsAt`, `endsAt` (UTC), conditions, source, `fetchedAt`, `expiresAt` once superseded |
| Refresh job | `JOB#<jobId>` | `STATE` | Allocated version, completion state, retry and idempotency information, `expiresAt` |
| Traveller link (fallback only) | `TRAVELLER#<sub>` | `LINK` | `travellerId`, when and how the link was verified |

Write every venue and offer in a new immutable version before moving the active pointer. The pointer update is conditional: an older version cannot replace a newer one. This prevents a partially written refresh from becoming visible. It is application logic built on DynamoDB's conditional writes, not an automatic whole-catalogue transaction. [Conditional writes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html), [Read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html).

**Cleaning up:** when the pointer moves, the worker sets `expiresAt` on the version it replaced to **24 hours** later. DynamoDB's TTL deletes it some time after that (usually within a few days). Finished job records expire after 7 days. The active version is never given an expiry. [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html).

## Sales

The planner doesn't have a sales source yet; it needs an offers feed with, for each offer, the venue, start and end times, conditions and where it came from. When one is supplied:

- the refresh worker stores offers inside the catalogue version, as above;
- at response time, an offer is shown only if `startsAt ≤ now` and it still runs when the visit ends, so an offer that expires mid-visit or since the last refresh is dropped;
- offers are shown only while the catalogue is **fresh** (see below); a stale catalogue shows venues but no offers.

Without a feed, no offers are shown and nothing is invented.

## Failures and freshness

The catalogue has three states, based on the time since the last successful refresh:

| Age | What travellers get |
| --- | --- |
| Under 30 minutes | **Fresh:** venues and valid offers as normal |
| 30 minutes to 4 hours | **Stale:** venues still shown, with "details may be out of date"; offers left out; an alarm has already fired |
| Over 4 hours | **Too old:** a clear "no reliable data" answer |

A refresh time more than 5 minutes in the future means a clock is wrong, so the catalogue is treated as stale.

A short outage of the venue service therefore doesn't blank the app.

- **Traveller service unavailable:** the circuit breaker and 2-second deadline return `503` with `Retry-After` quickly. Optional sources can fail without blocking the whole response.
- **AI unavailable or invalid output:** use the original keywords and mark enrichment missing; those venues are retried next run. Explicit keyword matching still works, with lower semantic recall.
- **Venue service fails or the snapshot can't finish in time:** leave the active version unchanged and retry quickly, as above. Exhausted jobs go to the DLQ and raise an alarm.
- **Offers or gate facts missing:** omit unknown offers and use the labelled estimates for boarding and walking time.
- **No venue meets the known constraints:** return no suitable result rather than weakening those constraints.

The initial scope is one airport catalogue that fits a bounded refresh job. If larger catalogues can't fit the deadline, move refresh coordination to a multi-step workflow before increasing that scope.

## Keeping brand text safe

Brand keywords are untrusted input. The reasons shown to a traveller are built only from the controlled vocabulary (for example "matches: affordable, quick food"), never from raw brand text. Where original keywords are displayed, the web app renders them as plain text, never as HTML. The Content Security Policy blocks inline scripts as a second line of defence. The same rule applies to the model: brand text is passed to Nova Micro as data, never as instructions.

## Alarms

| Alarm | Fires when |
| --- | --- |
| Catalogue getting old | Any airport's catalogue is over **20 minutes** old (before it turns stale at 30) |
| Failed refresh jobs | Any message in `catalogue-refresh-dlq` or `scheduler-dlq` |
| API errors | `recommendations` 5xx above **2%** over 5 minutes |
| API slow | p95 latency above **3 seconds** over 5 minutes |
| Traveller service trouble | The circuit breaker opens more than **3 times** in 5 minutes |
| Capacity | Any Lambda throttle, or Bedrock throttling on 3 runs in a row |

The refresh worker publishes catalogue age as a custom metric each run, and a scheduled check publishes it even when the worker isn't running.

## Runbook

- **Catalogue getting old:** check the latest `refresh-catalogue` logs. If the venue service is down, nothing to do yet — travellers see the stale state, and retries continue. If the worker is failing on our side, roll back the function to the previous version.
- **Messages in a dead-letter queue:** read one message and its logs to find the cause. Once fixed, start an SQS redrive back to `catalogue-refresh`. Jobs are safe to repeat.
- **Traveller service trouble:** confirm with the service's owners. The circuit breaker is already shedding load; don't raise throttling limits while it's down.
- **API errors after a release:** roll back to the previous Lambda version and static build.
- **Region outage:** see below.

[SQS dead-letter redrive](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-configure-dead-letter-queue-redrive.html).

## One region, on purpose

Everything regional runs in London only. That's an accepted risk: if London is down, the planner is down. Recovery is simple because the catalogue can be rebuilt from upstream in one refresh, and point-in-time recovery covers the table. A second region would double the moving parts for an outage that's rare; it can be added later if the business needs it.

## How we build and release it

Use **TypeScript AWS CDK**, which generates **CloudFormation**. A CI runner tests and packages the static web build and both Lambda functions, then deploys a separate staging stack. Smoke checks cover sign-in, the one-traveller-can't-read-another test, recommendation examples, missing data, duplicate jobs, fast retries, stale catalogues and restoration. Promote the same application artifacts to a separate production stack. Roll back to the previous Lambda version and static build; catalogue versions remain independent of application releases. [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html).

The API role can read the catalogue and its required upstream secret. Only the refresh role can write catalogue versions and invoke the selected Bedrock model. Browser clients have no DynamoDB, SQS or Bedrock permissions. CloudWatch records operational information without personal flight details. The functions use standard managed networking; private upstream connectivity would require a separate network design.

## Why this choice, and what we give up

For each part: what was chosen, what else was considered, and what we give up. The reasons for each choice are in [The AWS choices](#the-aws-choices); [Decisions](decisions.md) records the main decisions.

| Part | Choice | Considered instead | What we give up |
| --- | --- | --- | --- |
| Web app | Plain HTML, CSS and JavaScript | React or another component framework | We write the page rendering and state handling ourselves. Worth revisiting if the screens grow |
| Web hosting | Private S3 bucket behind CloudFront | Amplify Hosting | More set-up than Amplify |
| Sign-in | Cognito user pool, code flow with PKCE | The traveller service's own sign-in, or a third-party provider | A second account system unless it is federated with the traveller service's identity provider, which has to be agreed with its owner |
| API | API Gateway REST API with WAF and throttling | HTTP API (about a third of the price per request) | Higher cost per request than an HTTP API |
| Compute | Two Lambda functions, TypeScript on Node.js 24 | Containers on ECS Fargate | Cold starts and Lambda's time limits; no always-on process |
| Ranking rules | A separate package with no AWS code | Logic inside the Lambda handler | A little more structure up front |
| Catalogue store | DynamoDB, on demand | Aurora Serverless (PostgreSQL) | Ad-hoc queries and reporting; versioning is our own logic, not a database feature |
| Refresh trigger | EventBridge Scheduler puts a job on SQS every 15 minutes | Step Functions | No visual workflow; retry rules live in our code |
| Keyword reading | Amazon Nova Micro on Bedrock | Keyword list, embeddings, Comprehend, a larger model: see [Choosing the AI approach](ai-keyword-reading.md#choosing-the-ai-approach) | Quality not yet proven against the keyword-list baseline |
| Infrastructure | CDK in TypeScript, IAM per function, Secrets Manager, CloudWatch | Terraform | Tied to AWS |

Serverless keeps the amount of infrastructure small and suits uncertain traffic. The cost is cold-start risk, managed-service limits and AWS-specific integrations. Per-instance caches are simple but not shared, so each new instance warms its own; a shared cache (ElastiCache) would be the next step if that proved costly. REST API is chosen for direct regional WAF support; an HTTP API would need a different protection design. DynamoDB fits keyed reads, but SQL would suit richer relational queries. Nova Micro is a concrete starting model, not a claim that its classification quality has been proven. The [worked examples](worked-examples.md) and a simple keyword-only baseline are the acceptance comparison.

Region, runtime, model and limits are specified. The traveller service's identity support, sales and travel-fact sources, measured capacity, operating budget and final quality acceptance remain open. The local application is implemented in `app/`. AWS deployment and production integration are still outstanding.

## Rough monthly cost

This is an estimate, not a quote. It uses AWS's published on-demand list prices for US East; London prices are usually slightly higher. Confirm it with the [AWS Pricing Calculator](https://calculator.aws/) once traffic is known.

It assumes one airport, about 200 venues, and 1 million suggestion requests a month (about 33,000 a day).

| Part | How it is charged | About a month |
| --- | --- | --- |
| API Gateway REST API | $3.50 per million requests | $3.50 |
| WAF | $5 per web ACL, $1 per rule, $0.60 per million requests | $8 |
| Suggestions Lambda | 1 million requests at 1,024 MB for about 200 ms | $3.50 |
| Refresh Lambda | Every 15 minutes, about 2,900 runs | $1 |
| Bedrock, Nova Micro | Only changed keywords are read again. Even re-reading every venue on every run would be about 60 million input and 30 million output tokens | Under $1 normally, about $6 at worst |
| DynamoDB | Each refresh writes a new version; reads are mostly served from Lambda memory | $1–3 |
| CloudFront, S3, Secrets Manager, CloudWatch | Static files, three secrets, logs and six alarms | $5–10 |
| **Total, before sign-in** | | **About $25–35** |

**Sign-in is the biggest unknown.** Cognito is free for the first 10,000 monthly active users, then charges per user on its paid tiers. At, say, 50,000 travellers a month that could be several hundred dollars, more than the rest put together. Federating the traveller service's existing sign-in changes this number, so it is the first thing to agree with that service's owner.
