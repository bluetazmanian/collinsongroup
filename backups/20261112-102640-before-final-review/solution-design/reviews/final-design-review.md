# Airport Trip Planner: final design review

**Date:** 12 November 2026
**Reviewed:** the brief; `solution-design.md` (584 words); `solution-design.pdf`, rendered and inspected page by page; the AWS, backend and frontend views with their Excalidraw sources; the round-two review and the latest sections of the response. No application code was needed for this review.

## A. Final verdict

**Ready with minor changes.**

The answer to the final question is yes: an interviewer can understand this proposal in a few minutes and has clear decisions to discuss. The three pages are upright, in order and readable at screen and printed size. The AWS view, the weakest part last time, is now the clearest. The shortened text reads like plain documentation.

It is not "ready to share" as it stands because the shortening left four small faults in the text: an awkward opening sentence, three technology entries whose stated trade-off is missing or is not a trade-off, one term used but never introduced, and one missing sentence about who reads the traveller's trip. All four are wording edits. No diagram change is required.

## B. Score: 88 / 100 (previously 82)

| Area | Weight | Round 2 | Final | Reason |
| --- | ---: | ---: | ---: | --- |
| Coverage of the brief | 20 | 17 | 17 | Problem, four inputs, AI role, three technology areas and trade-offs are all present and easier to read. No gain in score because the sales feed is no longer stated as an assumption and "gate advice" lost its explanation. |
| Technical coherence and technology reasoning | 25 | 21 | 21 | The three views describe one system. Sign-in, the Cognito authorizer, shared catalogue and Bedrock during refresh are consistent. Offsetting this, the explanation of browser and backend trip access was removed, and three trade-off statements do not match their technology. |
| Diagram clarity and consistency | 20 | 16 | 19 | AWS view redrawn with clear global, regional, user-device and external areas, no crossed labels and a complete legend. Backend and frontend views have room to breathe. |
| Language and readability | 20 | 15 | 17 | Short, natural sentences. No em dashes, no author notes, no undefined shorthand apart from the items in D. |
| Three-page focus and completeness | 15 | 13 | 14 | One view and one purpose per page. The 10 and 9.5 point text is comfortable. Pages 2 and 3 have spare space, which is acceptable and gives room for the two small additions below. |

The six-point rise comes from the diagrams and plainer wording, not from the number of edits made.

## C. Previous findings

| Round-two finding | Status |
| --- | --- |
| D1 AWS view connectors | Closed. Redrawn; no label is crossed and CloudWatch no longer needs arrows. |
| D2 Updating the trip is unstated | Closed. Frontend footnote: "Preference edits depend on traveller service support." |
| D3 Compressed sentences | Superseded. The sentences were rewritten or removed in the deliberate shortening. Remaining wording points are new and listed in D. |
| D4 Refresh interval | Closed. "15-minute schedule" appears on the AWS view. |
| D5 Why two monitoring tools | Still relevant. See N2. |
| D6, D7 Diagram labels | Closed. |
| Font option B | Adopted and readable. |

The removal of the freshness and failure rules and the security, testing and improvement section is accepted as a scope decision. Nothing in this review asks for them back.

## D. Remaining findings

### Necessary corrections

**N1. Priority 1. The opening's key sentence is tentative and awkward (page 1, opening paragraph)**

- **Problem:** "Prepared venue information could then be reused for fast recommendations, even when AI is unavailable. But incorrect venue information and estimated visit times can affect the results." "Could then be" reads as a possibility, not the design. This is the sentence that explains why AI runs in the background.
- **Replacement** for the whole paragraph:
  > The planner recommends airport restaurants and shops using a traveller's preferences, flight time and current sales. A pre-built AI model interprets shop descriptions in the background, when venue data is updated. Recommendations then use the prepared data, so they are fast and still work when the model is unavailable. Results depend on the accuracy of venue information and on estimated visit times.
- **Space:** same three lines.

**N2. Priority 1. Three technology entries state a trade-off that is missing or mismatched (page 1, "Technology choices and trade-offs")**

Bold marks the trade-off in every entry, so the reader expects one in each.

| Entry | Problem | Replacement |
| --- | --- | --- |
| Private S3 + CloudFront | The regional-outage limit is not a property of S3 or CloudFront. | "Static hosting without servers. **The rest of the system runs in one region, so a regional outage interrupts recommendations.**" |
| Lambda + DynamoDB | "Each reads a complete version" is true of one function only; the other writes it. | "Functions scale separately. Recommendations always read a complete version of the venue data. **Starting a new function instance adds delay.**" |
| EventBridge Scheduler + SQS | The bold text is a benefit. The real trade-off is absent. | "Schedules venue updates and buffers them when they take longer. **Venue changes appear only after the next update.**" |
| CloudWatch + Datadog | No trade-off, and no reason for two tools. | "CloudWatch collects logs, metrics and alarms. Datadog tracks availability, response time and how current venue information is. **Datadog adds cost and sends metrics outside AWS.**" |

- **Space:** the first and last entries grow by about one line each. The grid row height is set by the tallest entry in each row, which is already three lines, so the page does not grow.

**N3. Priority 2. "Gate advice" is used but never introduced, and the sales source is no longer an assumption (page 2)**

- **Problem:** the Availability target counts "gate advice" as a good response. After the shortening, nothing explains it. The brief supplies no sales data, and the proposal no longer says the sales feed is assumed.
- **Replacements** in "Recommendation rules":
  - Flight time: "Recommend places the traveller has time to visit before boarding. With too little time, advise going to the gate."
  - Sales: "Promote valid offers among suitable places. Without preferences, places with offers appear first. A sales feed is assumed; the brief does not provide one."
- **Space:** one extra line in each row. Page 2 has about four spare lines at the bottom.

**N4. Priority 2. The proposal no longer says why both the browser and the backend read the trip (pages 1 and 3)**

- **Problem:** the AWS view shows only the Recommendations function reading the traveller service. The frontend view shows the browser reading and updating it. Both are valid, and a view need not show everything, but no sentence connects them. An interviewer comparing pages 1 and 3 will see two different answers to "who calls the traveller service".
- **Addition:** one sentence directly under the frontend view, before "Browser technology choices":
  > The browser reads the trip to display it. The backend reads it again for each recommendation and does not rely on values sent by the browser.
- **Space:** two lines. Page 3 has about five spare lines.

### Optional polish

- **Page 2 heading and TypeScript sentence.** "Technology and quality objectives" covers one short sentence about TypeScript and then the targets. Rename the heading to "Quality targets" and move the TypeScript point into the "Lambda + DynamoDB" entry only if space allows; otherwise leave it.
- **Bedrock entry.** If one more fact is wanted for discussion, add "Only shop names and descriptions are sent to it." It answers the first privacy question an interviewer is likely to ask. Not required.
- **Frontend legend.** The HTTPS arrows are two-headed in the view and one-headed in the legend. Harmless.

### Checked and found sound

- Three A4 landscape pages, zero rotation, correct order. SVG, PNG and PDF agree.
- Browser to CloudFront to private S3; browser sign-in to Cognito; browser to API Gateway; the dashed "Token authorizer" dependency from API Gateway to Cognito; both functions sharing DynamoDB; Bedrock reached only from the refresh function. All consistent across the views and with the text.
- The three targets are labelled as 30-day design targets, define a meaningful outcome each, and connect to the design: the 15-minute schedule supports the 30-minute freshness target with room for one missed update, and the response-time row names its dependence on the traveller service.
- No em dashes, no claims of measured or achieved results, no instructions to the author.

## E. Final action list

1. Replace the opening paragraph with the text in N1.
2. Replace the four technology entries listed in N2.
3. Extend the Flight time and Sales rows as in N3.
4. Add the trip-access sentence under the frontend view (N4).

A fifth action is not justified. After these four text edits the proposal is ready to share.
