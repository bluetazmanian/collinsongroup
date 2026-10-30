# Airport Trip Planner: Decisions

The main choices behind the design, and the points that still need agreement.

## D-001: Read the keywords in the background, not on every request

AI interprets the brand keywords when the catalogue refreshes, and stores the result. When a traveller asks for suggestions, the planner reads that prepared catalogue. This keeps model inference out of the request path and keeps personal flight data out of the model input. Request time still depends on reading the catalogue and the traveller service. The [application structure](diagrams/airport-trip-planner-diagram-2.excalidraw) keeps the planner rules separate from the interface, data connections and background refresh.

## D-002: Run it on serverless AWS

The [AWS diagram](diagrams/airport-trip-planner-aws-deployment.excalidraw) and [notes](aws-deployment.md) map the design to managed AWS services: CloudFront and S3 for the web app, API Gateway (REST) and Lambda for the API, DynamoDB for the catalogue, EventBridge Scheduler and SQS for the refresh, Bedrock for the keywords, and Cognito, IAM, Secrets Manager and CloudWatch around them.

Serverless fits because traffic follows flight schedules, so it comes in peaks and quiet spells, and there are no servers to look after. The trade-offs (cold starts, Lambda time limits, duplicate queue deliveries) are covered in the notes. The [answer](answer.md#technology-choices) lists the alternatives considered for each part.

## D-003: Dietary needs are met only by venue-supplied facts

A dietary need is a hard filter. A place is shown only when the venue service itself says it meets the need. An AI-generated label can never satisfy it, because a wrong guess could harm someone.

## D-004: Design for failure from the start

Each part has a defined behaviour when something it depends on fails. The details are in the [AWS design](aws-deployment.md); the [request](diagrams/airport-trip-planner-request-sequence.excalidraw) and [refresh](diagrams/airport-trip-planner-catalogue-refresh-sequence.excalidraw) sequences show the failure paths.

- **Freshness:** three states — fresh (under 30 minutes), stale with a warning (up to 4 hours), then no reliable data — so a short outage no longer blanks the app. Failed refreshes retry after 1, 2, 4 and 8 minutes instead of waiting 30.
- **Load:** the catalogue is cached in Lambda memory by version, so DynamoDB isn't hit on every request. Stage throttling, a WAF rate rule, reserved concurrency, a 60-second cache and a circuit breaker protect the traveller service.
- **Time:** all times in UTC, labelled boarding and walking estimates, default visit lengths, and a "head to your gate" answer when time is short.
- **Sales:** offers stored with start and end times, checked at response time, and hidden when the catalogue is stale.
- **AI:** venues whose interpretation failed are retried on later runs, up to 200 a job.
- **Sign-in:** the traveller service should decide whose record to return; a verified link is the fallback; a test proves one traveller can't read another's record.
- **Running it:** old versions expire after 24 hours, six alarms, a runbook, and single-region recovery stated as an accepted risk.
- **Safety:** reasons use only the controlled vocabulary; brand text is shown as plain text; a Content Security Policy backs this up.

## D-005: Write build specs, leave outside services as proposals

The design comes with [build specs](documents.md#implementation-specifications): the API, the concept list and ranking rule, the AI prompt and checks, screens, IAM policies, a test plan and developer setup. These are fixed choices a team can build against.

The formats of the traveller service, venue service, offers feed and travel facts are written as [proposals](upstream-contracts.md), because only their owners can confirm them. Adapters absorb any difference, so the planner's rules don't change.

Key choices made in the specs: one endpoint whose `status` drives the screen; venues matching none of the traveller's likes are left out rather than shown low down; dietary needs are only ever met by venue-supplied facts, never by AI; scoring is a simple points table so results are explainable and repeatable.

## Still to agree

| Point | Current position |
| --- | --- |
| Which airport | London Heathrow (LHR) is the worked example; the design works per airport |
| How travellers sign in | Federate the traveller service's existing sign-in if it has one; to agree with its owner |
| Sales and timing data | No source is supplied; the design states its assumptions and plays safe rather than making data up |
| Model quality | Nova Micro must clearly beat the keyword list on at least 200 hand-labelled venues; the pass mark is set with the owner |
| Traffic and budget | Not given; the [rough cost](answer.md#rough-monthly-cost) assumes 1 million requests a month |
