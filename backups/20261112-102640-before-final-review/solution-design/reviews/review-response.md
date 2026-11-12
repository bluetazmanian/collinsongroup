# Architecture review: response

This response records changes to the proposal following the [11 November review](architecture-adversarial-review.md). It does not replace the independent review or assign a new score. The documents describe a proposed design, not deployed software.

| Finding | Change | Evidence |
| --- | --- | --- |
| F1: Length and wording | Main proposal reduced from about 5,700 to about 1,000 words and two complementary primary views. Deep material moved to a separate document. Descriptive wording replaces instructions and repeated definitions. | [Main proposal](../solution-design.md), [supporting detail](../supporting-detail.md) |
| F2: Opening view | The main proposal pairs a logical overview with a simplified AWS view showing frontend, hosting, access, compute, catalogue, background AI and monitoring. | [System overview](../diagrams/solution-design.svg), [AWS overview](../diagrams/aws-overview.svg) |
| F3: Visit time | Current airport visit is explicit; advance planning removed from scope. Overnight example distinguishes visiting now from arriving tomorrow. | [Scope](../solution-design.md), [time rules](../supporting-detail.md#time-preferences-and-source-facts) |
| F4: Timing and capacity | 600 ms dependency deadline inside a 1.5-second application budget; bounded worker and aggregate AI time; explicit visibility timeout and per-airport fenced lease. Removed conflicting retry ladder and per-job completion SLO. Availability depends on agreed upstream commitments. | [Settings](../supporting-detail.md#timing-and-capacity-settings) |
| F5: Interpretation misses | Synonyms are always included; preferences rank rather than exclude. Empty concepts and no-preference behaviour are explicit. | [Decision rules](../supporting-detail.md#recommendation-decisions) |
| F6: Dietary scope | Optional source fields are named assumptions. Restrictions apply to food only; missing-feed behaviour preserves shops. | [Time and source facts](../supporting-detail.md#time-preferences-and-source-facts) |
| F7: Extra scope | Brief inputs and design assumptions are separated. Cognito and Datadog have an explicit integration/organisational rationale. Security and quality remain concise in the main proposal. | [Scope](../solution-design.md), [technology choices](../solution-design.md#technology-choices-and-trade-offs) |
| F8: Deployment | Removed settings from nodes, connected identity and source credentials, used Scheduler for both schedules, and rerouted communications. | [Deployment](../diagrams/solution-deployment.svg) |
| F9: Consistency | A shared palette and legend apply across native views. Gateway access checks, handler responsibilities and profile-first order agree. Shared contracts now have dependencies. Sequences use neutral standard notation. | [Components](../diagrams/solution-components.svg), [request sequence](../diagrams/recommendation-sequence.svg) |
| F10: SLI source | Named Gateway and handler terminal records, CloudWatch metric filters and Datadog collection. No hidden joining/deduplication service. Duplicate/gap limitations and independent synthetics are explicit. | [Measurement](../supporting-detail.md#measurement-and-monitoring) |
| F11: Identity | Named REST API, token issuer, access scopes, token-use/app-client checks and the traveller-service trust contract. Different issuers require a separately agreed exchange/mapping. | [Identity](../supporting-detail.md#deployment-and-identity) |
| F12: Evaluation | Compare with synonyms on an independent labelled set; agree improvement margin/confidence and derive sample size. Removed the arbitrary 200-case minimum and unsupported precision claim. | [Validation](../supporting-detail.md#validation-and-standards) |

The main proposal retains quality-to-design mapping, three service objectives, an AI release gate, security controls and the CloudWatch/Datadog feedback loop. Detailed definitions and standards checks are supporting material.

## Compact presentation pass

The main document now pairs a logical system overview with a simplified AWS deployment. The decision flow, scoring and freshness rules are in supporting detail. Repeated component descriptions and detailed deadlines were removed from the main reading route; the quality-to-design mapping, three service objectives, security and monitoring remain visible.

The original review is unchanged. A [second-review prompt](round-2-review-prompt.md) asks an independent reviewer to assess the main proposal first, then check supporting consistency and closure of the earlier findings.

## Validation of the compact pass

- Main proposal: 1,005 words and five A4 PDF pages, including two diagram pages.
- Main views: logical system overview and simplified AWS deployment. Supporting detail contains six deeper views and a 16-page reference PDF.
- All eight rendered views were checked for canvas overflow, crossed connector labels and text clipping. No issues were found by those checks.
- Main PDF pages were visually inspected; the quality/security discussion stays together. PDF text checks found no page overflow.
- Contents anchors, local links, diagram loading and canonical Mermaid/source agreement passed. Revised wording contains no em dashes.
- Existing supporting diagrams, application files and the original independent review were preserved.

## Single-proposal consolidation

This revision follows approval to combine the essential content into one proposal. The earlier independent review is unchanged. Its compactness finding is superseded by an actual two-page export, rather than by a word-count assertion.

| Requested decision | Applied decision |
| --- | --- |
| Is supporting detail needed? | No separate supporting document is needed for the proposal. Essential behaviour, publication, identity, measurement and validation are in `solution-design.md`. Earlier supporting files remain unchanged as consolidation references. |
| What happens to System overview text? | Removed the box-by-box narration. Retained suitability, food-only dietary rules, preference tiers, sales and freshness as recommendation behaviour. Complete publication, fallback and scheduling rationale sit in the technology-choice table. |
| Two views or one? | One combined view shows logical responsibilities with technology labels. Traveller requests and preparation have distinct arrow colours. Cognito sign-in, regional workloads, global delivery, external services and telemetry are identified. It replaces the two primary figures in the reading route. |
| What is the page layout? | Page 1 contains scope, the combined view and recommendation behaviour. Page 2 contains technology choices, quality objectives, security, validation and trade-offs. No cover, contents page or mandatory appendix. |
| Is it ready within the limit? | The exported proposal is two A4 landscape pages and meets the three-page maximum. It is ready for the next design discussion, with source, identity, recovery and budget agreements still explicitly open. It remains a proposed design; completed implementation or validation is not claimed. |

### Useful technical findings retained

- Sales boost matching venues within their tier; with no preferences, valid sales rank first. They never override suitability.
- Missing or over-age data produces a temporary failure, distinct from a valid result with no suitable venues.
- A complete version is published atomically under per-airport ownership. Failed refreshes preserve the previous version. AI failure preserves keyword matching.
- The next schedule provides another refresh opportunity. SQS buffers and limits work and exposes failed deliveries; repeated delivery requires safe publication.
- Cognito sign-in is explicit, API protection is labelled, and the combined legend contains only used symbols. Earlier detailed views are preserved outside the proposal.
- Gateway outcomes and application freshness records have separate roles. Dependency failures count against availability; telemetry gaps or duplicates require investigation. Monitoring remains outside the request dependency path.
- AI evaluation compares model-plus-synonyms with an independent synonym baseline. Sample size and improvement margin require agreement; safety and access failures block release.

The published proposal contains the assumptions needed to understand the architecture. Exact ranking weights, per-call budgets, detailed HTTP contracts, full sequences and extended standards tables are omitted from the short reading route. They are not additional requirements or hidden prerequisites for understanding the proposal.

### Consolidation checks

The main PDF was exported and inspected as two pages, with 10.5-point body text and 10-point tables. The combined diagram has Excalidraw, SVG and PNG versions. Original supporting documents, deeper views, the exercise brief and independent reviews are preserved. Application code is unchanged. This response records authoring changes; it is not an independent new score.

## Three-view proposal

Following approval, the current proposal uses three pages and three complementary views. This replaces the two-page combined-view layout described in the earlier consolidation record. The exercise still has one self-contained proposal, with no mandatory supporting document.

| Page | View and explanation |
| --- | --- |
| 1. AWS infrastructure | Retains and refines the AWS overview. Explicit Cognito sign-in, API protection, regional services, global CloudFront, separate request and refresh functions, buffered jobs, catalogue storage, managed AI and monitoring. A table explains the infrastructure choices and trade-offs. |
| 2. Backend components | Simplifies the existing component view into recommendation and refresh responsibilities with shared contracts and UML usage dependencies. Names TypeScript/Node.js, DynamoDB, Bedrock and synonyms; retains suitability, sales, freshness, publication and quality objectives. |
| 3. Frontend design | Adds a component view for the browser application: screen control, session/trip state, authentication and service clients. Names HTML/CSS/JavaScript, Cognito/PKCE, Fetch and DOM rendering. Includes security, validation and post-release improvement. |

The frontend responsibilities are grouped within the existing browser application; the view does not imply separately deployed services or separate JavaScript modules. Relevant source inputs were `app/web/app.js`, `app/web/index.html`, `app/web/styles.css` and `app/web/theme.js`. Backend inputs were the API, rules, concepts, adapters and refresh packages; infrastructure inputs were `app/infra/lib/planner-stack.ts`. These sources informed the design. No application or infrastructure code was changed, and the proposal does not claim a production deployment.

The current editable assets are `aws-overview.excalidraw`, `solution-components.excalidraw` and `frontend-design.excalidraw`, with SVG and PNG exports. The earlier combined architecture view, deeper reference views and supporting files remain available outside the three-page reading route. Independent reviews and the exercise brief are unchanged.

The export was checked for three A4 landscape pages, with one view on each page and technology reasons alongside it. Diagram checks cover clipping, crossed labels and canvas bounds; document checks cover links, loaded images, page content and browser overflow. The current version meets the approved three-page presentation limit. Source contracts, traffic, recovery needs and AI budget remain design decisions to agree; numerical targets remain assumptions.

### Infrastructure readability and typography

The infrastructure page now opens with the AWS view, without a repeated document title or introductory paragraph. Larger service nodes and labels use the released space. Visit scope remains in the backend explanation; the numerical-assumption statement is beside the quality objectives. CloudWatch/Datadog measurement context stays with those objectives, while recovery and external-data concerns remain in the technology trade-offs.

Space Grotesk headings and component names and Inter body text match the presentation typography. Licensed font files are included locally and embedded in HTML and SVG exports for offline PNG and PDF rendering. Excalidraw scenes retain editable native text. Backend spacing was tightened without reducing font sizes; the three-page proposal retains its scope, quality, security and validation content.

## Independent review revision

This revision addresses the [three-view independent review](three-view-independent-review.md). It supersedes the opening and layout decisions recorded above. The independent review and its 68/100 score are unchanged; this response records the changes, not a new independent assessment.

| Finding | Change and evidence |
| --- | --- |
| C1: Missing problem, approach and strengths | Restored a title and short opening. It explains the recommendation problem, background AI, request-time rules, strengths and practical limits. See the [proposal opening](../solution-design.md#airport-trip-planner-solution-design). |
| C2: Compressed recommendation logic | Added an input-and-effect table for flight time, preferences, sales and keywords, including an example of a shared concept and the assumed sales source. Preserved freshness, warning and temporary-failure rules. See [recommendation rules](../solution-design.md#recommendation-rules). |
| C3: Inconsistent trip access | Kept both callers. The browser displays and updates its own trip; the backend reads trusted trip data independently. The [AWS view](../diagrams/aws-overview.svg) now shows both paths, and the [frontend view](../diagrams/frontend-design.svg) includes read/update behaviour. See [frontend explanation](../solution-design.md#3-frontend-design). |
| C4: Vague technology caveats | Replaced unresolved notes with explicit design choices, assumptions and limits: one region, external token compatibility, conditional catalogue publication, cold-start latency, AI cost drivers and Datadog data boundaries. See [technology choices](../solution-design.md#technology-choices-and-trade-offs). |
| C5: General standards sentence | Removed the list of frameworks. The browser choices now name concrete accessibility checks against WCAG 2.2 AA. Practical limitations sit in the opening. See [browser choices](../solution-design.md#browser-technology-choices). |
| C6: AWS diagram ambiguity | Marked external services and feeds, labelled sign-in and trip access, removed the unexplained token dependency, and put token checks inside API Gateway. CloudWatch names its logs/metrics/alarms role; the misplaced label was removed. Publication is labelled explicitly. See [AWS view](../diagrams/aws-overview.svg). |
| C7: System-wide material under frontend | Renamed page 3 and its controls section. Monitoring, testing, security and the improvement loop are explicitly system-wide. See [proposal](../solution-design.md). |
| C8: Repeated component notation | Replaced repeated stereotypes with UML component rectangles and icons. Kept dashed open-arrow usage dependencies and legends. Added trip and feed dependency labels and clarified the request handler's claims/reads responsibility. See [backend](../diagrams/solution-components.svg) and [frontend](../diagrams/frontend-design.svg). |
| C9: Repeated technology explanations | Removed the backend DynamoDB/Bedrock table and the separate Fetch row. Infrastructure choices have one home; the backend explains rules, TypeScript and quality, while the browser section explains UI choices. |

Several suggested edits were adapted to preserve meaning. Removing the browser trip client would change the chosen design, so both paths remain explicit. Missing freshness outcomes still count as unknown; they are not silently recategorised as availability failures. Component icons preserve UML notation rather than treating any rounded box as a UML component. No new percentage improvement, deployment result or policy was invented.

Technical cross-checks included AWS documentation on [Cognito authorizers for REST APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html) and [SQS delivery and Lambda processing](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html). External traveller token compatibility remains an explicit design assumption. The proposal describes duplicate-safe publication rather than assuming queue deliveries happen once.

The PDF remains three A4 landscape pages, with one view per page, 10.5-point body text and 10-point technology/quality text. Checks found no diagram text outside the canvas, clipped labels, arrows crossing text or browser overflow at 1440, 900 and 390 pixels. Excalidraw, SVG and PNG assets were regenerated. Application code, the brief, independent reviews and earlier supporting documents are unchanged.

## Round 2 revision

This revision addresses the [second independent review](three-view-independent-review-round-2.md) and the approved request to simplify the AWS view and reduce fonts in all three diagrams. It supersedes the typography and diagram-scope descriptions above. The independent review's 82/100 score is unchanged; this is a record of authoring changes.

| Finding or request | Change |
| --- | --- |
| D1: Busy AWS connections | Rebuilt the view around deployment responsibilities. Removed the browser box, its long routes and the individual function-to-CloudWatch arrows. The recommendation path runs straight to the external traveller service; DynamoDB sits between the recommendation and refresh functions. CloudWatch and Datadog share a monitoring strip. The grouped-services border has a legend entry. See the [AWS view](../diagrams/aws-overview.svg). |
| D2: Trip-update assumption | The browser explanation now makes preference edits conditional on the traveller service accepting updates. The [frontend view](../diagrams/frontend-design.svg) marks this condition next to the trip operation. Backend trip reads remain independent of browser values. |
| D3: Compressed wording | The opening explains why brand keywords need interpretation. The rules now describe usable time, matching alternatives, sales and data failures in direct language. Security names HTTPS, the private bucket, function permissions and Secrets Manager. Monitoring names request outcomes, CloudWatch counts/alarms and Datadog reporting. See the [proposal](../solution-design.md). |
| Unhelpful SLI/SLO explanation | Removed the explanatory paragraph. The table heading now reads “Measure and 30-day design target”, retaining both the measurement window and the design status of the numbers. Missing outcome records still have unknown freshness. See [quality objectives](../solution-design.md#technology-and-quality-objectives). |
| D4: Refresh interval | The infrastructure choices identify a 15-minute interval as a design setting, consistent with the current infrastructure source. Failed refreshes retaining the previous version remain explicit beneath the recommendation rules. |
| D5: Monitoring-tool roles | CloudWatch holds logs, metrics and alarms. Datadog tracks SLOs where already used, receiving metrics and redacted logs. The monitoring path cannot block requests. |
| D6: Backend labels | Replaced “Scoped context lookup” with “Reads the signed-in trip” and shortened the dependency legend to “Uses”. |
| D7: Frontend labels | Shortened and repositioned the trip and recommendation labels so they clear boxes and zone borders. Added a short note identifying the update-API assumption. |
| Smaller document and diagram fonts | Body text is 10 points; tables and technology entries are 9.5 points. Headings use 15/13/10.5 points. All three diagrams use smaller fonts. AWS service names are 34 source pixels, descriptions 29 and the smallest labels 28; component text in the other views is 28. |

The AWS canvas is now 2400 by 1020, about 116 mm tall at the PDF's 273 mm image width, compared with about 101 mm previously. The extra height separates responsibilities rather than adding content. Website delivery remains global; regional services remain inside eu-west-2; the traveller service, feeds and Datadog remain outside that boundary. Omitting browser journeys from this deployment view does not remove them from the design: their calls and the backend's independent read are explicit on page 3.

Earlier checks missed text overlapping a box edge. The revised checks cover rectangle-edge intersections as well as connector crossings, containment and canvas bounds. The three PDF pages were rendered and visually inspected. No crossed or clipped labels, box-edge overlaps, missing images or horizontal browser overflow were found at widths of 1440, 900 and 390 pixels. Excalidraw, SVG, PNG, HTML and PDF assets were regenerated. The brief, independent reviews, application code and older supporting documents remain unchanged.

### AWS labels and Cognito connection

Removed the region identifier from the AWS boundary. Expanded AWS CDK to “Cloud Development Kit” and labelled its role as “Infrastructure as code”. Connected API Gateway to Cognito with a dashed configuration dependency labelled “Token authorizer”; the legend distinguishes this dependency from API calls. Cognito provides sign-in tokens and API Gateway validates access using the configured Cognito authorizer, as described in the [AWS authorizer documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html). The AWS CDK expansion follows the [AWS CDK guide](https://docs.aws.amazon.com/cdk/v2/guide/home.html).

Regenerated the AWS Excalidraw, SVG and PNG assets and the document exports. The PDF remains three pages. Diagram bounds, connector crossings and box-edge overlaps passed validation; the first PDF page was visually inspected.


## Content simplification

The approved content revision removes the standalone security, validation and improvement section and the detailed freshness/failure paragraph. Page 3 is now “Frontend design”. Earlier review responses above record the previous drafts; their section placements and claims about retained testing material are superseded by this revision. Independent reviews and their scores are unchanged.

| Change | Current location |
| --- | --- |
| Explained Bedrock in ordinary language: a pre-built model interprets brands’ different shop descriptions, avoiding training while adding running costs. Removed model-versus-keyword evaluation language from the main proposal. | [Technology choices](../solution-design.md#technology-choices-and-trade-offs) |
| Replaced the four recommendation rows with the approved business explanations for flight time, preferences, sales and brand descriptions. | [Recommendation rules](../solution-design.md#recommendation-rules) |
| Removed the 30-minute/four-hour freshness policy, previous-version and temporary-failure paragraph. The 30-minute freshness objective remains only as a measurable design target. | [Quality targets](../solution-design.md#technology-and-quality-objectives) |
| Removed the standalone security, testing and continuous-improvement section. Kept access to the traveller’s own trip beside Cognito, and availability, response time and current venue information beside monitoring. | [Browser choices](../solution-design.md#browser-technology-choices) and infrastructure choices |
| Removed the two AWS row headings. Resource names and the remaining connections describe the activities. | [AWS view](../diagrams/aws-overview.svg) |
| Replaced diagram shorthand such as “Bedrock + synonyms” and “Per-airport ownership” with “Bedrock + keyword list” and “Coordinates venue updates”. Kept UML notation, component boundaries, positions and connections. | [Backend view](../diagrams/solution-components.svg) |
| Simplified the opening, TypeScript rationale, quality-target wording and browser choices. The frontend note now explains that preference edits depend on traveller service support. | [Proposal](../solution-design.md), [frontend view](../diagrams/frontend-design.svg) |

The infrastructure choices use three columns to fit the clearer descriptions beneath the AWS view without reducing fonts again. The backend still pairs rules and quality targets. The frontend has one technology table, with no replacement essay. Existing detailed supporting material remains outside the main reading route and was not changed. No application or infrastructure code was changed.

The main proposal decreased from 881 to 634 words. The exported PDF remains three pages, one view per page. All pages were visually inspected. Diagram checks found no clipped text, connector crossings through labels or box-edge overlaps; browser checks passed at 1440, 900 and 390 pixels. Local links and editable-source IDs were checked.

## Diagram spacing revision

The approved layout revision uses the space released by the content cuts. The main proposal text remains unchanged at 634 words; the three-page structure and reduced fonts are retained.

| View | Layout change |
| --- | --- |
| [AWS deployment](../diagrams/aws-overview.svg) | Moved API Gateway directly beneath Cognito and shortened the authorizer dependency. Moved the recommendation Lambda to the right and adjusted its trip and catalogue connections. Moved Bedrock above and to the right of the refresh Lambda, leaving a straight connection from that function to the external feeds. Regional and external boundaries remain explicit. |
| [Backend components](../diagrams/solution-components.svg) | Increased the canvas from 2200 by 630 to 2200 by 850. Added height to component boxes and space between rows, dependencies and shared types. At the PDF's 273 mm image width this adds about 27 mm of diagram height, moving both supporting sections lower on page 2. They remain side by side. |
| [Frontend components](../diagrams/frontend-design.svg) | Increased the canvas from 2200 by 710 to 2200 by 1000. Separated the authentication, trip and recommendation rows, enlarged boxes vertically and repositioned connectors, the legend and the preference-editing note. This adds about 36 mm of diagram height, moving the technology table lower on page 3. |

Regenerated all three Excalidraw, SVG and PNG views and the HTML/PDF exports. All three PDF pages were visually inspected. Checks passed for clipping, connector/text intersections, box-edge overlaps, image loading and browser widths of 1440, 900 and 390 pixels. The PDF remains three A4 landscape pages. The proposal wording, brief, independent reviews, supporting documents and application code were not changed.

## Frontend wording and PDF viewer

Removed the “Views: results + warnings / Gate advice / Retry” list from the frontend component view. It described possible screen outcomes rather than components or connections. Replaced “More complex interactions would favour a framework” with “A framework would make a larger website easier to organise and maintain”.

CloudFront remains connected to private S3. The deployment configuration uses S3 as its website origin; the browser calls Cognito and API Gateway directly, as shown by the authentication and recommendation clients in the frontend view. No CloudFront-to-API or CloudFront-to-Cognito connection was added.

The reported upside-down view was identified as vscode-pdf. Checks on the generated PDF found three landscape pages, each with zero page rotation and upright text transforms. The independently rendered pages are upright. This points to viewer rotation or preview state; it does not establish an export defect. The extension's [viewer toolbar source](https://github.com/tomoki1207/vscode-pdfviewer/blob/main/src/pdfPreview.ts) provides Rotate Clockwise and Rotate Counterclockwise controls. Reopening the preview or rotating an upside-down view twice can correct the displayed orientation. The viewer itself was not controlled by this session.

Regenerated the frontend Excalidraw, SVG and PNG plus the HTML/PDF exports. The PDF remains three pages. Diagram, browser overflow and orientation checks passed. The AWS and backend diagrams, application code, exercise brief and independent reviews were unchanged.

## Browser entry points

Added the browser to the AWS view under a user-device label, outside the AWS regional boundary. Moved API Gateway to the adjacent regional position, with a short direct connection from the browser. The recommendation Lambda follows the gateway; its catalogue read and traveller-service connection remain explicit. Bedrock retains its position above and to the right of the refresh Lambda.

The browser's main entry points now have separate paths: website files through CloudFront, sign-in through Cognito, and recommendation requests through API Gateway. Its direct own-trip reads and optional preference updates remain detailed in the frontend component view. CloudFront's S3 origin remains explicit. The configured API Gateway-to-Cognito authorizer dependency remains dashed, distinct from the browser's sign-in request. No API or Cognito origin was added to CloudFront.

Updated the deployment legend, accessible image description and entry-point documentation. Regenerated AWS Excalidraw, SVG, PNG and document exports. The PDF remains three upright landscape pages, with no label overlaps or browser overflow. The backend and frontend views, application code, exercise brief and independent reviews remain unchanged.

## Browser and gateway placement

Moved the browser and API Gateway down together by 110 source pixels, about 12.5 mm in the PDF. They remain horizontally aligned, with the browser outside the regional boundary and the gateway inside it. Repositioned the user-device label and the website-files and API labels. Adjusted the browser's CloudFront and Cognito paths, the gateway's authorizer dependency and its connection to the recommendation Lambda. Other resource positions, fonts and proposal wording are unchanged.

Regenerated the AWS Excalidraw, SVG and PNG and the document exports. The updated first PDF page was visually inspected. The PDF remains three pages; diagram clipping, label/connector intersections, box-edge overlap and responsive-browser checks passed. The backend and frontend views, application code, brief, independent reviews and earlier supporting documents were not changed.
