# Airport Trip Planner: Developer Setup

The application is in `app/`. This guide covers its packages, local services and configuration, followed by the intended AWS release process. For the shortest route to a running app, use the [README](README.md).

## Tools

| Tool | Version | For |
| --- | --- | --- |
| Node.js | 22.18 or later locally (type stripping); the Lambdas run on Node.js 24 | Everything |
| npm workspaces | comes with Node.js | One repository, several packages |
| TypeScript | 5.9 | All code |
| AWS CDK | v2 (2.275), with `cdklocal` for LocalStack | Infrastructure |
| Docker | any recent | The project's own LocalStack and the fake services |
| Vitest | 5 | Unit tests |
| Playwright (core) | 1.64 | Browser walk-through of the web app |
| k6 | current | Load tests (not written yet; they need a real AWS staging account) |

## Repository layout

The code lives in its own folder, `app/`, next to these documents, so it stays separate from them.

```
airport-trip-planner/
  *.md, diagrams/            these design documents
  app/
    packages/
      concepts/              the concept list, labels, synonyms, preference mapping
      rules/                 the planner rules: time, freshness, filtering, scoring,
                             reasons (no AWS, no HTTP, no AI code; unit-tested)
      adapters/              traveller service, venue service, offers feed,
                             Bedrock, DynamoDB, retries, metrics, secrets
      api/                   the recommendations Lambda handler
      refresh/               the refresh-catalogue and age-check Lambda handlers
    web/                     the web app (plain HTML, CSS and JavaScript)
    infra/                   CDK app: one stack, with a "local" and an "aws" target
    stubs/                   fake traveller service, venue service, offers feed
                             and Bedrock, for local runs
    scripts/                 deploy, seed, refresh, logs and web-server helpers
    tests/e2e/               end-to-end and browser checks against LocalStack
    docker-compose.local.yml this project's own LocalStack and the fakes
```

`rules` depends only on `concepts`. Adapters depend on `rules`, never the other way round. That keeps the planner's logic separate from the services around it, as the [application structure](diagrams/airport-trip-planner-diagram-2.excalidraw) shows.

## Running locally

Everything runs on the project's **own** setup, separate from anything else on the machine: its own containers (all named `atp-…`), its own Docker network (`atp-net`) and its own ports. Nothing local talks to real AWS or real outside services.

| Container | What it does | Address |
|---|---|---|
| `atp-web` | The web app, with CloudFront's security headers | http://localhost:5173 |
| `atp-localstack` | This project's LocalStack | http://localhost:4568 |
| `atp-cognito` | cognito-local: sign-up, codes, sign-in | http://localhost:9229 |
| `atp-mailpit` | Catches the emails | http://localhost:8026 |
| `atp-stubs` | Fake traveller, venue, offers and AI services | http://localhost:4600 |
| `atp-dozzle` | Live logs of the containers above | http://localhost:9998 |
| `atp-refresher` | Sends a catalogue refresh job every 15 minutes, in place of the AWS schedule | none |

From `app/`:

1. `npm install`
2. `npm run local:start` starts all the containers, deploys the local CDK stack, loads the example airport and publishes its first catalogue. It's safe to run again. (Step by step, it runs `local:up`, `local:deploy`, `local:seed` and `local:refresh`.)
3. Open http://localhost:5173. Create an account with any email address. The code arrives in this project's Mailpit inbox at http://localhost:8026. If you add a mobile number, it comes by text instead, and LocalStack keeps the message at http://localhost:4568/_aws/sns/sms-messages?region=eu-west-2. Then fill in **My trip**: what you like, any dietary needs, the airport and your flight time.
4. `npm test` runs the unit tests; `npm run local:e2e` runs the end-to-end checks (add `-- --slow` for the retry check); `npm run local:browser <folder>` walks the web app at 390 and 1440 pixels and saves screenshots. Both end-to-end runs delete the test accounts they create.
5. `npm run local:logs refresh-catalogue` prints a function's recent logs. `npm run local:down` stops everything.

The free LocalStack keeps nothing between restarts, so run `npm run local:start` again after a restart. Accounts and saved trips are kept in `app/.local-data/`.

### What's different locally

| In AWS | Locally | Why |
| --- | --- | --- |
| Cognito sign-in and the API authorizer | cognito-local (container `atp-cognito`, port 9229) handles sign-up, confirm and sign-in. It's built from `app/local/cognito` so that it supports **Send a new code** (cognito-local lacks it) and delivers codes: emails to Mailpit (container `atp-mailpit`, inbox on port 8026), text messages to LocalStack SNS (people who give a mobile number get a text, as Cognito does when it verifies both). Its own encrypted-sender hook crashes in this release, which is why delivery is added where it prints the code. The API Lambda checks its tokens itself, and the fake traveller service stores each account's trip in `.local-data/`. Test-traveller tokens (`asha-token`…) still work for the automated checks | Cognito isn't in the free LocalStack. cognito-local has no hosted sign-in page, so locally the web app uses the email-and-password calls instead of the PKCE redirect it uses in AWS |
| CloudFront and the private S3 bucket | `scripts/serve-web.mjs` on port 5173, sending the same security headers | CloudFront isn't in the free LocalStack |
| WAF rate rule | Left out | WAF isn't in the free LocalStack |
| Amazon Nova Micro on Bedrock | The fake Bedrock in `stubs/`, which classifies by keyword synonyms and deliberately returns a forbidden dietary concept for "healthy" so the reply checks are exercised | Bedrock isn't in the free LocalStack |
| IAM permissions enforced | Not enforced | The free LocalStack doesn't check IAM |
| Reserved concurrency, point-in-time recovery | Off | Not meaningful locally |
| EventBridge Scheduler runs the refresh every 15 minutes | The schedule is created but never fires. The `atp-refresher` container (`app/scripts/local-refresher.mjs`) sends the same refresh job to the queue every 15 minutes instead. `npm run local:refresh` still refreshes at once | The free LocalStack's Scheduler doesn't appear to trigger targets. Without a refresh, the catalogue is too old after 4 hours and the planner answers "no reliable data" |

### LocalStack version

The project pins **LocalStack 4.12**, the free Community image, with no account or token. From March 2026 LocalStack moved to a single image that needs a sign-in token; the 4.14 image on this machine only answered SNS without one. LocalStack's own advice for free use is to pin an older Community version, which is what `docker-compose.local.yml` does. `cdklocal` still works but prints a deprecation notice in favour of LocalStack's new `lstk` tool.

## Configuration

Read from environment variables, set by CDK in both AWS and LocalStack.

| Variable | Example | Used by |
| --- | --- | --- |
| `TABLE_NAME` | `AirportCatalogue` | both functions |
| `TRAVELLER_SERVICE_URL` | `https://traveller.example.com` | api |
| `TRAVELLER_AUTH_MODE` | `forward-token` or `service-credential` | api |
| `VENUE_SERVICE_URL` | `https://venues.example.com` | refresh |
| `OFFERS_SOURCE_URL` | empty when there's no feed | refresh |
| `BEDROCK_MODEL_ID` | `amazon.nova-micro-v1:0` | refresh |
| `FRESH_MINUTES` / `STALE_LIMIT_MINUTES` | `30` / `240` | api |
| `POINTER_CACHE_SECONDS` / `TRAVELLER_CACHE_SECONDS` | `30` / `60` | api |
| `ENRICH_PER_JOB` | `200` | refresh |
| `BEDROCK_ENDPOINT` | local only: the fake Bedrock | refresh |
| `AUTH_MODE` | local only: `local` (check cognito-local tokens) | api |
| `LOCAL_TEST_TOKENS` | local only: `on` lets test-traveller tokens in | api |
| `COGNITO_JWKS_URL`, `COGNITO_ISSUER`, `COGNITO_CLIENT_ID` | local only: the cognito-local pool the API checks tokens against | api |
| `QUEUE_URL` | the refresh queue, for shortening retries | refresh |
| `AIRPORTS` | `LHR` | age check |

The CDK stack supplies these environment variables. Check both the stack configuration and the function code when changing a setting from the [AWS design](aws-deployment.md).

## Environments

| Environment | Account | Deployed by | Upstream services |
| --- | --- | --- | --- |
| Local | the project's own LocalStack | the developer | fakes in `app/stubs` |
| Staging | its own AWS account | CI, on every merge to main | stubs, then real services' test environments when available |
| Production | its own AWS account | CI, by promoting a staging build after approval | real services |

## From commit to production

1. Pull request: lint, type-check, unit and contract tests, `cdk synth`, and a CDK diff posted on the pull request.
2. Merge to main: build once, deploy that build to staging, run the [staging tests](test-plan.md#3-staging-tests-after-every-deploy-to-staging).
3. Promote: the same build deploys to production. Smoke tests run; on failure, roll back to the previous Lambda version and static build.

## What's built, and what's next

Built and passing locally: the concepts and rules with their unit tests (the six worked examples included), the adapters, both Lambda handlers and the age check, the fakes, the CDK stack for both targets, the web app, and the end-to-end and browser checks against the project's own LocalStack. The `aws` target synthesises but has never been deployed.

Still to do before real use:

1. Agree the open points in [Outside services](upstream-contracts.md) with the service owners, and replace the fakes' formats with theirs.
2. Deploy the `aws` target to a staging account; test Cognito sign-in, WAF, CloudFront, IAM permissions and real Bedrock there.
3. Write and run the load tests, and run the AI quality comparison on real venues.
4. Replace the assumed numbers in the [AWS design](aws-deployment.md) with measured ones.
