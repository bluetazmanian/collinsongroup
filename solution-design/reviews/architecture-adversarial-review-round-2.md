# Airport Trip Planner: adversarial architecture review, round 2

**Reviewer role:** independent Principal Engineer
**Date:** 11 November 2026
**Read in the requested order:** brief; main proposal (Markdown, HTML, five-page PDF) and its two views; supporting detail (Markdown, 16-page PDF) and its six views; round-one review and the response. Application code was not inspected.

## 1. Verdict

**Ready with minor changes.**

The main proposal can now be read once and explained: a pre-built model interprets brand keywords in the background, plain rules recommend from a prepared catalogue, and the two paths meet at a versioned store. It answers all three outputs of the brief in about 1,000 words. The remaining issues are one missing sentence on sales, two diagram groupings, a few small inconsistencies with the supporting document, and repetition. None needs new scope.

## 2. Weighted score

| Area | Weight | Round 1 | Round 2 | Reason |
| --- | ---: | ---: | ---: | --- |
| Coverage of the exercise brief | 20 | 15 | 18 | Diagram pair, reasons table and a named strengths section answer the three outputs. How sales affect ranking is not stated in the main text (R1). |
| Architectural correctness | 25 | 18 | 21 | Current-visit timing, ranking instead of exclusion, food-only dietary rule, deadline budgets, lease and fenced publication are coherent. Queue redelivery adds little (R4). |
| Diagram clarity and consistency | 20 | 14 | 16 | Logical and AWS views have distinct purposes and are readable on landscape PDF pages. Grouped nodes and unused legend entries remain (R2). |
| Technology choices and trade-offs | 15 | 11 | 12 | One-line reason and cost per choice. The AI choice is honestly conditional on beating synonyms. Datadog is still an assumption, not a reasoned choice. |
| Security, quality objectives and validation | 10 | 7 | 8 | Each goal links mechanism, measure and target. Availability is conditional on upstream commitments without excluding dependency failures. |
| Wording, tone and conciseness | 10 | 4 | 8 | Compact and descriptive. No em dashes found. Some repetition and a few awkward phrases (R5, R6). |
| **Total** | **100** | **69** | **83** | |

The 14-point rise comes mainly from the compact main document, the two-view pairing and the corrected time, ranking and capacity rules. It is not higher because the main text leaves one brief input under-explained and the main AWS view groups services in a way that invites questions.

## 3. Earlier findings

| Finding | Status | Verified by |
| --- | --- | --- |
| F1 Not a compact proposal | Closed | 1,005 words, five PDF pages, supporting detail separate. |
| F2 No diagram answering the brief | Closed | Logical overview plus AWS overview show frontend, backend, AI, data, hosting. |
| F3 Visit assumed to start now | Closed | Scope states a current visit; overnight example in supporting detail. |
| F4 Conflicting targets and settings | Closed | 600 ms dependency deadline inside 1.5 s; 120 s work in a 180 s worker; visibility 1,080 s; 240 s lease; ten-minute schedule against a 30-minute freshness limit. |
| F5 Interpretation miss removes a venue | Closed | Synonyms always combined; preferences rank; alternatives labelled. |
| F6 Dietary rule unclear | Closed | Food venues only, source fields only, shops unaffected. |
| F7 Scope beyond the brief | Partially closed | Brief inputs and assumptions are separated. Cognito and Datadog remain, described as assumptions. |
| F8 Deployment view defects | Closed | Settings removed, nodes connected, one scheduler. Minor line crossings remain in the full view. |
| F9 Colour and view consistency | Partially closed | One palette and legend. Some legend entries are unused in a given view (R2). |
| F10 SLI pipeline has no owner | Closed | One named source per indicator; duplicates and gaps stated as limits. |
| F11 Identity precision | Closed | REST API, issuer, scope, `token_use` and `client_id` checks, trust condition for forwarding. |
| F12 Evaluation gate | Closed | Baseline comparison with an agreed margin and derived sample size. |

## 4. Remaining findings

### R1. Medium, correctness of fit to the brief. The main text does not say how a sale affects ranking

- **Location:** `solution-design.md`, System overview, paragraphs 4 and 5.
- **Evidence:** the brief names "potential sales happening at shops" as one of three inputs. The main text says offers order results only "with no preferences", that sales never override constraints, and that fresh results "can include" offers. The rule for a traveller who has preferences (+5 for a matching venue) appears only in supporting detail.
- **Consequence:** a reader must open the supporting document to answer a question the brief asks directly.
- **Correction:** add one sentence, for example: "A valid sale raises a matching venue within its tier; it never moves an unsuitable venue into the results."
- **Resolution check:** the main document alone states the effect of preferences, time and sales on the order.

### R2. Medium, diagram accuracy. Grouped nodes in the AWS overview imply a topology that is not proposed

- **Location:** `diagrams/aws-overview.svg`, nodes "API Gateway REST API / Cognito scopes + WAF" and "Scheduler + SQS".
- **Evidence:** Cognito and WAF are separate services and appear separately in the technology table, yet the view draws them inside the gateway node, and the browser's sign-in path is absent. The legend lists "Decisions and review", which no node in this view uses; the overview legend lists a grey "Supporting flow" arrow it does not use. The CloudWatch arrow comes only from the refresh function, with API logs covered by a footnote.
- **Consequence:** an interviewer may ask where sign-in happens or whether WAF is part of the gateway. Unused legend entries make the reader search for something that is not there.
- **Correction:** label grouped nodes as groups (for example a «grouped services» stereotype or a dashed outline), or show Cognito as a small separate node with a sign-in arrow. Trim each legend to the entries used in that view.
- **Resolution check:** every legend entry appears in its view, and every technology in the table can be pointed to without explanation.

### R3. Low, consistency. Small disagreements between the two documents

- **Location and evidence:**
  - `supporting-detail.md`, "Time, preferences and source facts": "then uses the main proposal's scoring rules". The scoring rules now live in the supporting document.
  - Main text lists "no reliable data" as one of four things the rules return. Supporting detail treats it as a service failure with HTTP 503.
  - The overview annotation "Profile first; active snapshot after trip" is not understandable without the supporting sequence.
- **Correction:** fix the cross-reference; say in the main text that missing or over-age data is reported as a temporary failure; reword the annotation to "Reads airport profile, then the active catalogue" or remove it.
- **Resolution check:** no statement in one document needs the other to be interpreted correctly.

### R4. Low, architectural coherence. Queue redelivery does little work in the refresh design

- **Location:** `supporting-detail.md`, "Timing and capacity settings" and "Catalogue preparation and publication"; overview node "Refresh jobs: Retry failed preparation".
- **Evidence:** visibility is 1,080 seconds and the schedule is ten minutes. A failed delivery returns after the next scheduled job has already run, and is then skipped as superseded. Recovery therefore comes from the schedule, not from retry. The 60-second inference budget at 10 seconds per call also means the 200-venue cap cannot be reached in the worst case.
- **Consequence:** not a defect. The overview label overstates what retry provides, and an interviewer may ask why the queue is needed.
- **Correction:** say in one sentence that the schedule is the recovery mechanism and the queue provides buffering, concurrency control and a dead-letter signal. Change the overview label to "Periodic airport work, buffered".
- **Resolution check:** the stated purpose of the queue matches the settings.

### R5. Low, editorial. Repetition in the main text

- **Evidence:** the "no AI on the request path" point appears five times: opening paragraph, overview subtitle, key decision 1, quality table and strengths. Key decisions 1 and 3 restate sentences in System overview paragraphs 1 and 2.
- **Correction:** delete the last sentence of System overview paragraph 1 ("Unchanged interpretations are reused; inference failure leaves keyword matching available.") or the matching clause in key decision 2. Delete the last sentence of paragraph 2 and keep the "Complete catalogue versions" decision.

### R6. Low, editorial. Wording

| Original | Replacement | Why |
| --- | --- | --- |
| "Cognito assumes an agreed identity integration; Datadog assumes an organisational monitoring choice." | "Cognito is proposed if identity can be integrated with the traveller service. Datadog is included only if the organisation already uses it." | Services do not assume. |
| "Pure rules return results, head-to-gate guidance, no suitable places or no reliable data." | "Rules with no external calls return venues, advice to go to the gate, or a clear reason why nothing is shown." | "Pure rules" is unexplained jargon here. |
| "Verified identity scopes each traveller lookup." | "Each lookup is limited to the signed-in traveller." | Plainer. |
| "Load, failure and access-isolation tests validate the architecture." | "Load, failure and access-isolation tests would validate the architecture." | Nothing has been run. |
| "People combine these with quality samples..." | "The team reviews these with quality samples..." | More natural. |

The quality table would scan faster with three columns (mechanism, measure, assumed target) instead of one dense cell. This is a preference, not a defect.

## 5. Main-view decision

**Keep the logical and AWS pairing.** The logical view answers "how does it work" with no product names. The AWS view answers "where does it run and with what", and is what the brief's first output asks for. They do not duplicate each other: only five concepts appear in both, and the second view adds hosting, region boundary, external services and monitoring. Both are readable at the landscape page size used in the PDF. Apply R2 to the AWS view. No additional view is needed in the main document; the decision flow is correctly optional once R1 is fixed.

## 6. Most valuable improvements

1. Add the one sentence on how sales affect ranking (R1).
2. Make grouped nodes explicit in the AWS overview and trim legends to what each view uses (R2).
3. Fix the three small inconsistencies between the documents (R3).
4. Remove the repeated statements and apply the wording replacements (R5, R6).

A fifth change is not justified. One discussion point to prepare, not a change: the design keeps synonyms as the default if the model does not beat them. Be ready to explain why that is the right reading of "focus on pre-built AI" and what evidence would make the model the default.
