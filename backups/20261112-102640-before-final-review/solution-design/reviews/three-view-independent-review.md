# Airport Trip Planner: three-view independent review

**Date:** 12 November 2026
**Reviewed:** the brief, `solution-design.md` (727 words), `solution-design.pdf` (three A4 landscape pages, rendered and inspected), and the three views `aws-overview`, `solution-components` and `frontend-design` with their Excalidraw sources. Application code was read only to check one behaviour (who reads the traveller's trip). Earlier reviews and `supporting-detail.md` were treated as background.

## A. Overall verdict

**Not ready to share. One focused revision is needed.**

The three pages are readable and the architecture behind them is sound. The problem is what the compaction removed. The document now opens at "1. AWS infrastructure" with no title, no statement of the problem and no statement of the idea that makes the design work: a pre-built model interprets brand keywords in the background, and requests use a prepared catalogue and plain rules. The reader gets three annotated diagrams and has to infer the proposal. The brief's third output, strengths and trade-offs, has trade-offs scattered through five tables and no stated strengths. The prose has been shortened until several sentences are hard to parse.

## B. Score: 68 / 100

| Area | Weight | Score | Reason |
| --- | ---: | ---: | --- |
| Coverage of the brief | 20 | 13 | Frontend, backend and infrastructure choices are all shown with reasons. Missing: the problem, what is recommended, how brand keywords are handled, the assumed sales source, and any statement of strengths. |
| Technical coherence and technology reasoning | 25 | 19 | Separate request and refresh paths, complete catalogue versions and an honest "model must beat synonyms" position are coherent. The traveller's trip is read by both the browser and the backend, and only one view shows it. |
| Diagram clarity and consistency | 20 | 15 | All three views are legible at page size and have distinct levels. The AWS view has a misplaced label, an unexplained dashed arrow, unlabelled arrows and unmarked external services. The component view repeats «component» nine times. |
| Language and readability | 20 | 11 | No em dashes. Many clipped or coined phrases, three "needs agreement" statements, a standards sentence with no concrete control, and system-wide content filed under "Frontend design". |
| Three-page focus and completeness | 15 | 10 | Three pages hold. Space goes to five technology tables that repeat each other, while the recommendation logic, the core of the brief, gets one 80-word paragraph. |

## C. Prioritised findings

### Material weaknesses

**C1. Priority 1. No opening statement of the problem, the solution or its strengths**

- **Where:** `solution-design.md` line 1; PDF page 1, top.
- **Problem:** the document has no title and no summary. The pre-built AI appears only as "Bedrock / Nova Micro", "Interpret" and "Managed inference". Nothing says requests never call the model. No strengths are stated anywhere.
- **Why it matters:** an interviewer cannot tell what the system does or why it is built this way without reading all three pages. The brief asks for strengths and trade-offs.
- **Action: add.** Insert above the AWS view:
  > **Airport Trip Planner: solution design.** The planner recommends airport restaurants and shops that suit a traveller's preferences, the time left before boarding and current sales. Brands describe themselves with inconsistent keywords, so a pre-built AI model maps those keywords to a fixed set of concepts in the background. Requests use that prepared catalogue and plain rules, and never call the model. Strengths: fast, explainable results that keep working if the model is unavailable. Limits: results are only as accurate as the source feeds, visit times are estimates, and a changed venue is matched by keywords alone until the next refresh.
- **Page space:** about four lines on page 1. Recover them by applying C4 to the page 1 table (saves two lines), deleting the limits sentence on page 3 (it moves here) and using the two free lines at the bottom of page 1.

**C2. Priority 1. The recommendation logic is one telegraphic paragraph, and keywords are not explained**

- **Where:** `solution-design.md` line 23; PDF page 2, paragraph under the component view.
- **Problem:** eight clipped sentences such as "short visits get gate advice" and "Valid sales boost matches, or rank first without preferences". Brand keywords, one of the four things the brief asks about, are absent from it. The sales feed is not identified as an assumption.
- **Why it matters:** this paragraph is the answer to the brief's main question and is the hardest text in the document to read.
- **Action: replace** the paragraph with this table:

  | Input | Effect on recommendations |
  | --- | --- |
  | Flight time | Usable time is the time to boarding close, less walking time. A venue must fit in it and must not be known to close during the visit. With too little time, the traveller is advised to go to the gate. |
  | Preferences | Matching venues are listed first. Other suitable venues follow, labelled as alternatives. A dietary requirement removes a food venue unless source data confirms it. |
  | Sales | A valid offer raises a matching venue, and leads the list when the traveller has no preferences. Offers are hidden when catalogue data is more than 30 minutes old. The sales feed is an assumed third source. |
  | Brand keywords | A synonym list and the pre-built model map words such as "cheap", "budget" and "value" to one concept, "affordable". Model output is accepted only if it uses the fixed concept list. |

- **Page space:** about three lines more than the paragraph. Recover them by deleting the DynamoDB row in the page 2 table (it repeats page 1) and moving the sentence "Gateway and handler records feed..." into page 3 (C7).

**C3. Priority 2. Two readers of the traveller's trip, shown in only one view**

- **Where:** `frontend-design` ("Traveller client", "Read own trip"); `aws-overview` (only the Recommendation Lambda reaches the Traveller service); page 3 table, "Fetch API" row.
- **Problem:** the browser calls the traveller service directly and the backend reads the same record again. The AWS view shows no browser connection to that service. The text never says why both exist.
- **Why it matters:** it looks like a contradiction, and it raises an identity question: the browser sends a Cognito token to another team's service.
- **Action: replace**, choosing one:
  - Preferred: remove "Traveller client" from the frontend view and state "The recommendation response includes the trip summary shown on screen." One trust path, one caller.
  - Otherwise: add a blue arrow in `aws-overview` from "Traveller browser" to "Traveller service" labelled "Show own trip", and add to page 3: "The browser reads the trip only to display it. The backend reads it again and never trusts values sent by the browser."
- **Page space:** none, or one line on page 3 paid for by C5.

**C4. Priority 2. Vague "needs agreement" and "need testing" statements in the technology tables**

- **Where:** page 1 table, all five rows; page 3 table, last row.
- **Problem:** "Single-region recovery needs agreement", "issuer and scopes require agreement", "cost and external data handling need agreement", "publication need testing". None states a decision, an assumption or a limit.
- **Why it matters:** they read as notes to the author, and the reader cannot tell what was decided.
- **Action: replace** the page 1 table with:

  | Technology | Why it fits and what it costs |
  | --- | --- |
  | Private S3 + CloudFront | Static hosting with no servers to run. One region (eu-west-2): a regional outage stops the service. |
  | API Gateway REST, Cognito, WAF | Managed sign-in, request validation and protection. Assumes the traveller service accepts Cognito-issued tokens. |
  | Lambda + DynamoDB | Request and refresh scale separately. A refresh replaces the catalogue as one complete version. Cold starts slow the first request. |
  | EventBridge Scheduler + SQS | One buffered refresh job per airport on a schedule. A job can run twice, so publishing is conditional. |
  | Bedrock (Nova Micro) | Pre-built model, no training. Used only during refresh, and kept only if it beats the synonym list at acceptable cost. |
  | CloudWatch + Datadog | CloudWatch holds logs, metrics and alarms. Datadog, used only if the organisation already has it, tracks the three objectives and receives metrics and redacted logs only. |

- **Page space:** six one- or two-line rows replace five rows with three wrapped lines. Net saving of about one line. CDK stays as the diagram note.

**C5. Priority 2. The standards sentence adds no design information**

- **Where:** `solution-design.md` line 70; PDF page 3, bottom left.
- **Problem:** "Validation draws on AWS Well-Architected, selected OWASP ASVS and WCAG 2.2 AA" names frameworks without saying which control or check results. "Selected" is unspecified. The second sentence holds the design's real limits, hidden under the frontend table.
- **Why it matters:** it reads as assurance by association. The limits belong with the trade-offs.
- **Action: remove** the first sentence. **Move** the limits into the opening (C1). Keep one concrete use: change the page 3 "DOM + semantic HTML" row to end "Controls, focus and status messages are tested against WCAG 2.2 AA."
- **Page space:** frees two lines on page 3.

**C6. Priority 2. AWS view: misplaced label, unexplained arrow, unmarked external services**

- **Where:** `diagrams/aws-overview`.
- **Problem and exact change:**
  1. Label "Logs + metrics" sits beside "Traveller service" and reads as its output. Move it to just above the top edge of "CloudWatch", next to the two grey arrowheads.
  2. Dashed arrow "JWT" from "API Gateway REST" to "Cognito" is not in the legend. Relabel it "Validates tokens" and add "Dashed arrow = checks against" to the legend, or delete the arrow and change the gateway subtitle to "Validates Cognito tokens · WAF".
  3. The two-headed arrow between "Traveller browser" and "Cognito" has no label. Add "Sign-in".
  4. The arrow from "Recommendation Lambda" to "Traveller service" has no label. Add "Read trip".
  5. Rename "Run" to "Invoke" and "Save" to "Publish version".
  6. "Traveller service" and "Venue + offers" look like AWS services. Add a second line "External" to each, as "Datadog" already has, or draw a dashed outline titled "EXTERNAL SERVICES" around the right-hand column.
  7. Rename "Venue + offers" to "Venue + sales feeds", subtitle "Keywords, facts, offers".
- **Page space:** none.

### Optional polish

**C7. Priority 3. System-wide content sits under "3. Frontend design"**

- **Where:** page 3, "Security, validation and improvement"; page 2, sentence after the table.
- **Action: replace** the heading with "Security and validation (whole system)". **Move** the page 2 monitoring sentence here and reword it (see D). No space change.

**C8. Priority 3. Component view repeats «component» in all nine boxes**

- **Where:** `diagrams/solution-components`.
- **Exact change:** delete «component» from every box and add one legend entry "Rounded box = component". Label the two unlabelled arrows: "Request handler" to "Traveller adapter" as "read trip", "Refresh coordinator" to "Feed adapters" as "fetch". Change the "Request handler" subtitle from "Identity + orchestration" to "Checks claims, coordinates reads", since the gateway validates identity. Apply the same «component» change to `frontend-design`.
- **Page space:** each box loses a line, so both diagrams can be about 10% shorter at the same font size.

**C9. Priority 3. Technology rows that repeat other rows or state the obvious**

- **Where:** page 2 "DynamoDB" and "Bedrock + synonyms" rows (repeat page 1); page 3 "Fetch API" row.
- **Action: remove** the page 2 DynamoDB row and the page 3 Fetch API row. Keep "Bedrock + synonyms" on page 2 only if the Bedrock row on page 1 is shortened to "Pre-built model, no training; see page 2."
- **Page space:** frees three lines on page 2 and two on page 3.

## D. Wording changes

| Before | After | Change |
| --- | --- | --- |
| "Datadog assumes organisational use; cost and external data handling need agreement." | "Datadog is used only if the organisation already has it. It receives metrics and redacted logs only." | Replace. States the condition and the control. |
| "Validation draws on AWS Well-Architected, selected OWASP ASVS and WCAG 2.2 AA." | Delete. Add "tested against WCAG 2.2 AA" to the accessibility row. | Remove. Names no control. |
| "Source accuracy, timing estimates and enrichment delay remain limits." | "Limits: results are only as accurate as the source feeds, visit times are estimates, and a changed venue is matched by keywords alone until the next refresh." | Move to the opening. |
| "Single-region recovery needs agreement." | "One region: a regional outage stops the service." | Replace. States the limit. |
| "The traveller service's issuer and scopes require agreement." | "Assumes the traveller service accepts Cognito-issued tokens." | Replace. States the assumption. |
| "Upstream commitments must support the objective." | "This target depends on the traveller service's own availability." | Replace. |
| "Missing outcomes have unknown freshness." | "Requests that fail before this point are counted under availability." | Replace. |
| "Gateway and handler records feed CloudWatch and Datadog. Gaps or duplicates trigger review; monitoring stays outside the request path." | "API Gateway and the request handler each log one record per request. CloudWatch turns these into counts and alarms. A monitoring failure never blocks a request." | Replace and move to page 3. |
| "An authenticated synthetic checks the browser." | "A scheduled test signs in and requests a recommendation." | Replace. Incomplete noun. |
| "People approve tested improvements from service measures, AI spend and reports, then compare the same SLIs after release." | "The team reviews the three objectives, model spend and traveller reports, tests a change, and compares the same measures after release." | Replace. |
| "HTML, CSS and JavaScript group screen rendering, in-memory state and Fetch clients." | "The browser application renders screens, holds the session in memory and calls the APIs." | Replace. |
| "Adoption needs better results at acceptable cost than synonyms alone." | "The model is kept only if it beats the synonym list at acceptable cost." | Replace. |
| "Fenced publication exposes complete snapshots" | "A refresh replaces the catalogue as one complete version" | Replace. Unexplained jargon. |

## E. Page-by-page proposal

**Page 1: what it is and where it runs.**
Add the title and opening paragraph (C1). Keep the AWS view with the seven changes in C6. Replace the technology table with the six-row version (C4). Remove nothing else.

**Page 2: how a recommendation is made.**
Keep the component view, simplified (C8). Replace the rules paragraph with the four-row "Input and effect" table (C2). Keep "Quality objectives" with the two reworded cells from D. Reduce the left-hand table to "TypeScript / Node.js" and "Bedrock + synonyms". Move the monitoring sentence to page 3.

**Page 3: the traveller's side, and how the system is protected and checked.**
Shorten the opening sentence (D). Keep the frontend view, resolved per C3 and C8. Remove the "Fetch API" row. Rename the right-hand section (C7), reword the second paragraph (D) and add the monitoring sentences. Delete the standards sentence (C5).

Net effect: page 1 gains about three lines and loses one; page 2 gains three and loses four; page 3 gains two and loses four. All three pages stay within their current length without a smaller font.

## F. Five highest-value improvements

1. Add the title and the five-sentence opening paragraph from C1 at the top of page 1.
2. Replace the page 2 rules paragraph with the four-row "Input and effect" table from C2, and delete the page 2 DynamoDB row.
3. Replace the page 1 technology table with the six rows in C4, and apply the remaining before-and-after edits in D.
4. Decide who reads the traveller's trip (C3) and make the AWS and frontend views agree. Then apply the seven AWS view changes in C6.
5. Delete the standards sentence, move the limits to the opening, rename the page 3 section to "Security and validation (whole system)" and remove the "Fetch API" row.
