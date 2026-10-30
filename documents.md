# Documents

For local setup, use the [README](README.md). For the design, start with the [architecture overview](answer.md), then use the [AWS design](aws-deployment.md) for service settings and failure handling.

Editable diagrams and their PNG/SVG copies are in `diagrams/`.

| Diagram | What it shows | Editable | Preview |
| --- | --- | --- | --- |
| AWS deployment | The named AWS services, sign-in, both flows (requests and catalogue refresh), dead-letter queues and optional sources | [Excalidraw](diagrams/airport-trip-planner-aws-deployment.excalidraw) | [PNG](diagrams/airport-trip-planner-aws-deployment-preview.png), [SVG](diagrams/airport-trip-planner-aws-deployment.svg) |
| At a glance | Traveller, planner, input data and suggestions | [Excalidraw](diagrams/airport-trip-planner-diagram-1.excalidraw) | [PNG](diagrams/airport-trip-planner-diagram-1-preview.png), [SVG](diagrams/airport-trip-planner-diagram-1.svg) |
| Application structure | The planner's rules kept separate from the app, traveller service, catalogue, travel facts and AI | [Excalidraw](diagrams/airport-trip-planner-diagram-2.excalidraw) | [PNG](diagrams/airport-trip-planner-diagram-2-preview.png), [SVG](diagrams/airport-trip-planner-diagram-2.svg) |
| Traveller request | One request through context lookup, catalogue read and ranking, with the failure rules | [Excalidraw](diagrams/airport-trip-planner-request-sequence.excalidraw) | [PNG](diagrams/airport-trip-planner-request-sequence-preview.png), [SVG](diagrams/airport-trip-planner-request-sequence.svg) |
| Catalogue refresh | Read venue keywords, interpret them with AI, validate and publish | [Excalidraw](diagrams/airport-trip-planner-catalogue-refresh-sequence.excalidraw) | [PNG](diagrams/airport-trip-planner-catalogue-refresh-sequence-preview.png), [SVG](diagrams/airport-trip-planner-catalogue-refresh-sequence.svg) |

The [worked examples](worked-examples.md) cover preference matches, limited time, expired offers, stale data and dietary constraints.

## Other documents

| Document | What it covers |
| --- | --- |
| [Overview](overview.md) | The problem and the main design idea |
| [Requirements](brief.md) | What the planner must do and where each part is covered |
| [AWS design](aws-deployment.md) | Services, settings, data layout, failures, alarms, runbook and release path |
| [Worked examples](worked-examples.md) | Six travellers walked through the design, including failures |
| [Decisions](decisions.md) | Choices and trade-offs |
| [Assumptions](questions-and-assumptions.md) | Missing data and planning assumptions |

## Implementation specifications

These describe the API, rules and integration boundaries. The upstream formats still need agreement with the service owners.

| Spec | What it covers |
| --- | --- |
| [API](api.md) | The `POST /recommendations` request, every response state and every error |
| [Outside services](upstream-contracts.md) | What the planner needs from the traveller service, venue service, offers feed and travel facts, with questions for their owners |
| [Concepts and ranking](concepts-and-ranking.md) | The fixed concept list, preference mapping and the exact filtering and scoring rule |
| [AI keyword reading](ai-keyword-reading.md) | The Nova Micro prompt, reply format, checks and quality measurement |
| [Screens](screens.md) | Every screen and state the traveller can see |
| [Permissions](permissions.md) | The IAM policy for each role |
| [Test plan](test-plan.md) | Unit, contract, staging, load, failure, AI quality and accessibility tests |
| [Developer setup](developer-setup.md) | Repository layout, local running, configuration and environments |

## Reading copies

[index.html](index.html) is the linked HTML copy. Markdown is the editable source. Run `node render.mjs` from this folder to rebuild the HTML.
