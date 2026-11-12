# Airport Trip Planner: three-view independent review, round 2

**Date:** 12 November 2026
**Reviewed:** the brief; `solution-design.md` (868 words); `solution-design.pdf` (three A4 landscape pages, rendered at 120 dpi and inspected); the AWS, backend and frontend views with their Excalidraw sources; the round-one review and the "Independent review revision" response. Code was read once, to confirm that the browser both reads and updates the traveller's trip.

**Measured and estimated:** figures in section E marked "measured" come from rendering a temporary copy of the HTML outside the project with alternative print sizes. Everything else there is an estimate.

## A. Verdict

**Ready with minor changes.**

The proposal now explains itself. The opening states the problem, the idea (a pre-built model interprets keywords during refresh; requests use prepared data and rules) and the strengths and limits. The "Input and effect" table answers the brief's main question directly. The three views sit at distinct levels and agree with each other. What remains is one diagram that is harder to read than it should be, one unstated assumption, and about ten sentences that are still compressed.

## B. Score: 82 / 100 (previously 68)

| Area | Weight | Round 1 | Round 2 | Reason |
| --- | ---: | ---: | ---: | --- |
| Coverage of the brief | 20 | 13 | 17 | Problem, approach, strengths, limits, all four inputs and the assumed sales feed are now stated. The opening does not say why keywords need interpreting, and the refresh interval is never given. |
| Technical coherence and technology reasoning | 25 | 19 | 21 | Trip access by browser and backend is explicit and justified. Technology entries state limits and assumptions. Updating the trip through the traveller service is a new, unstated assumption. |
| Diagram clarity and consistency | 20 | 15 | 16 | Backend and frontend views are clean. The AWS view fixed its labelling but gained crossings: one label is struck through and three connector colours cross in one narrow gap. |
| Language and readability | 20 | 11 | 15 | No vague "needs agreement" text, no standards list, no em dashes. Around ten sentences are still clipped or use undefined terms. |
| Three-page focus and completeness | 15 | 10 | 13 | Each page has a clear purpose. Duplicate tables are gone. Page 1 has no spare room, which is why the AWS view is cramped. |

The rise reflects a document that can now be understood from page 1. It is not higher because the page an interviewer sees first carries the least comfortable diagram.

## C. Previous findings

| Finding | Status | Evidence |
| --- | --- | --- |
| C1 No opening | Closed | Title and four-sentence opening with approach, strengths and limits. |
| C2 Rules paragraph | Closed | Four-row "Input and effect" table with a keyword example and the assumed sales feed. Remaining wording issues are in D3. |
| C3 Two readers of the trip | Closed | Both paths are drawn in the AWS and frontend views and explained on page 3. See D2 for the new "update" assumption. |
| C4 Vague caveats | Closed | Entries state a limit or an assumption. |
| C5 Standards sentence | Closed | Removed. WCAG 2.2 AA is tied to named accessibility tests. |
| C6 AWS view ambiguity | Partly addressed | External services, sign-in, trip read and publish are labelled. New crossings and one struck-through label (D1). The response's statement that no arrows cross text is not correct for "Read feeds". |
| C7 System content under "Frontend" | Closed | Page 3 retitled; section named "across the system". |
| C8 Repeated «component» | Closed | UML component icons replace the stereotypes; arrows are labelled. |
| C9 Repeated technology rows | Closed | One home per technology. |

## D. Remaining findings

### Material

**D1. AWS view: connectors are harder to follow than the boxes (page 1, `diagrams/aws-overview`)**

- **Problem:** the right-centre of the diagram carries blue, green and grey lines through one gap about one label high.
  - The label "Read feeds" is struck through by the grey line from "Recommendations" to "CloudWatch".
  - Two grey lines (from "Recommendations" and "Refresh Lambda" to "CloudWatch") cross the green "Read feeds" line and run beside the blue "Read trip" line.
  - "Read" and "Read trip" leave the bottom of "Recommendations" side by side and are easy to confuse.
  - "Show / edit own trip" runs from "Browser" over the top of the whole diagram and down the right edge. Its label sits inside the region outline, beside the region title.
  - "Sign in" touches the edge of the "Browser" box.
  - The dashed border of "Scheduler + SQS" has no legend entry.
- **Reader impact:** this is the first thing an interviewer sees. The boxes are clear; working out what connects to what takes effort.
- **Concrete changes:**
  1. Delete both grey arrows into "CloudWatch". Change the "CloudWatch" subtitle to "Logs + metrics from API and Lambdas". This removes every grey crossing.
  2. Move "Read feeds" onto the vertical segment below "Venue / sales feeds", clear of other lines.
  3. Route "Read trip" from the right edge of "Recommendations" straight to the left edge of "Traveller service" (they are on the same row). Keep "Read" below the box for DynamoDB only.
  4. Move the "Show / edit own trip" label outside the region outline, above its top edge, so it reads as a path around the region.
  5. Shift "Sign in" to sit centred above its arrow with clear space from "Browser".
  6. Add to the legend: "Dashed box = grouped services".
  7. Rename "Call" to "Invoke".
- **Room needed:** changes 1 to 3 need no space. Changes 4 and 5 are easier with the extra canvas height in section E.

**D2. Updating the trip is an unstated assumption (page 3 opening; frontend view "Own trip: read / update"; AWS view "Show / edit own trip")**

- **Problem:** the brief provides "a service that will provide you with my selected preferences and flight time". The design also writes to it. Nothing says the service is assumed to accept updates, or what the planner does if it does not.
- **Reader impact:** an interviewer will ask whether editing preferences is in scope, and how soon an edit affects recommendations.
- **Replacement** for the page 3 opening: "The browser shows the traveller's own trip and, if the traveller service allows updates, lets them edit preferences. The backend reads the trip itself for each recommendation and never trusts flight or preference values sent by the browser."
- **Room needed:** the same two lines.

**D3. About ten sentences are still compressed or use undefined terms (pages 1 to 3)**

| Location | Before | After |
| --- | --- | --- |
| Opening | "A pre-built model interprets brand keywords during catalogue refresh;" | "Brands describe themselves inconsistently, so a pre-built model maps their keywords to shared concepts during catalogue refresh;" |
| Flight time row | "Boarding close minus walking time sets the limit; absent values use labelled estimates." | "Usable time runs from now to boarding close, less walking time. Missing values are estimated and labelled." |
| Preferences row | "Matches precede labelled alternatives." | "Venues that match come first; other suitable venues follow, labelled as alternatives." |
| Sales row | "Offers valid through the visit boost matching venues, or lead without preferences." | "An offer valid for the whole visit raises a matching venue. With no preferences, venues with offers come first." |
| Under the rules table | "Missing or older data returns temporary failure, distinct from no suitable venues." | "With no data, or data older than four hours, the service reports a temporary failure. This is kept distinct from finding no suitable venue." |
| Page 2, right | "TypeScript / Node.js separates decision rules from network and storage adapters for testing." | "Decision rules are kept separate from network and storage adapters, so they can be tested alone. Both are TypeScript on Node.js." |
| Page 2, right | "Service-level indicators (SLIs) measure these objectives (SLOs) over 30 days." | "Each objective is measured over 30 days." |
| Fresh information row | "Missing outcomes remain unknown; telemetry gaps trigger investigation." | "Requests with no recorded outcome are not counted as fresh." |
| Page 3, security | "HTTPS, private storage, least-privilege roles and managed secrets protect boundaries." | "All traffic uses HTTPS. The S3 bucket is private, each function has only the permissions it needs, and feed credentials are held in Secrets Manager." |
| Page 3, monitoring | "Gateway and handler records feed CloudWatch counts and alarms and Datadog SLOs." | "API Gateway and the request handler each log one record per request. CloudWatch turns these into counts and alarms; Datadog tracks the three objectives." |

- **Room needed:** the replacements are within a few words of the originals. The security sentence is one line longer; delete "Duplicate or missing records trigger investigation;" from the monitoring paragraph to pay for it.

### Optional polish

**D4. State the refresh interval once.** Freshness is judged against 30 minutes but the schedule is never given. In the "EventBridge Scheduler + SQS" entry change "Buffered refresh jobs per airport." to "A buffered refresh job per airport every N minutes (assumption)." Use the project's chosen value; background material does not agree on it.

**D5. Say why there are two monitoring tools.** In "CloudWatch + Datadog" append "Datadog is included where it is already the organisation's monitoring tool." Remove "collects" detail if a line is needed: "CloudWatch holds logs, metrics and alarms;".

**D6. Backend view labels.** Change "Scoped context lookup" to "Reads the signed-in traveller's trip" and the legend entry "Uses dependency" to "Uses".

**D7. Frontend view.** The labels "Own trip: read / update" and "Airport + access token" touch the boxes on both sides. Widen the gap between the two columns by about 40 source pixels, or shorten to "Read / update trip" and "Recommendation request".

## E. Font and layout recommendation

**Measured, current layout (10.5 pt body, 10 pt tables, headings 16 / 14 / 11 pt).** Printable area is 273 mm by 188 mm. Page 1 content is 186.8 mm tall, leaving 1.3 mm. The AWS view is 273 mm wide and 101 mm tall. It already spans the full page width, so it cannot be scaled up. Its labels print at about 10.3 to 13.5 pt, as large as or larger than the body text.

That changes the question. Smaller text cannot make the AWS labels bigger. It can only make the diagram **taller**, which gives connectors and labels room to separate. That is exactly what D1 needs.

| Option | Body / tables / headings (pt) | Page 1 height released (measured) | AWS view height possible | Pages (measured) |
| --- | --- | --- | --- | --- |
| Current | 10.5 / 10 / 16, 14, 11 | 0 mm (1.3 mm spare) | 101 mm | 3 |
| B | 10 / 9.5 / 15, 13, 10.5 | 7.4 mm (8.7 mm with spare) | about 110 mm (+9%) | 3 |
| C | 9.5 / 9 / 14, 12.5, 10 | 10.6 mm (11.9 mm with spare) | about 113 mm (+12%) | 3 |

Pages 2 and 3 release 4.5 mm each under option B and about 12 mm each under option C (measured). They do not need it.

**Recommendation: option B, plus one text trim.**

- **Sizes:** body 10 pt, tables and technology entries 9.5 pt, title 15 pt, section headings 13 pt, sub-headings 10.5 pt. Line heights unchanged.
- **Text trim:** in "Lambda + DynamoDB", delete "failed refreshes keep the previous version" (already covered by "Complete catalogue versions prevent partial reads" and by the freshness rules on page 2). The entry drops from three lines to two and releases about 4 mm more (estimate).
- **Space released on page 1:** about 12 to 13 mm in total (8.7 mm measured plus about 4 mm estimated).
- **AWS view:** raise the canvas from 2400 by 890 to about 2400 by 1000 source pixels, which prints at about 114 mm tall. Keep every label at its current size. Spend the height on a wider gap between the three rows (for "Read", "Publish", "Job", "Interpret" and "Read feeds") and a clear lane above the top row for "Show / edit own trip".
- **Readability:** 10 pt body and 9.5 pt tables in Inter remain comfortable on a printed A4 page and at fit-to-width on a laptop. The half-point change is hard to notice. Diagram labels stay larger than the text, which keeps the hierarchy.
- **Why not option C:** it releases only about 3 mm more on page 1. 9 pt tables are still legible in print but become tight when the PDF is shown at reduced size on a shared screen, and pages 2 and 3 would gain empty space they do not need.
- **Why not keep the current sizes:** D1 changes 1 to 3 can be done without more height, and they remove most of the clutter. If only those are applied, the current typography can stay. Option B is worth it if the trip path and row labels are to be given clear space as well.

Reducing text further to fit more content is not recommended. The proposal is at the right length.

## F. Highest-value next actions

1. In `aws-overview`, delete the two grey arrows into "CloudWatch" and change its subtitle to "Logs + metrics from API and Lambdas". Move "Read feeds" clear of other lines and route "Read trip" directly from the right edge of "Recommendations" to "Traveller service".
2. Apply option B print sizes (10 / 9.5 / 15 / 13 / 10.5 pt), trim the "Lambda + DynamoDB" entry, and make the AWS canvas about 2400 by 1000 with wider row gaps. Then apply D1 changes 4 to 7.
3. Replace the page 3 opening with the sentence in D2 so that editing the trip is a stated assumption.
4. Apply the ten wording replacements in D3.
5. Apply D4 and D5: state the refresh interval as an assumption, and say when Datadog is included.

No further changes are justified. D6 and D7 are optional.
