# Airport Trip Planner: solution design

The [proposal](solution-design.md) explains the recommendation problem, the architecture, technology choices and trade-offs. Three views cover AWS infrastructure, backend components and the frontend. Quality targets and access controls appear beside the relevant design choices.

The PDF is three A4 landscape pages, one for each view with its technology choices and trade-offs.

The opening explains why AI prepares venue information in the background. The backend page shows how each input affects recommendations. The frontend page explains the browser, sign-in and service calls. Space Grotesk headings and Inter text are embedded in the browser document and diagram exports.

| Document | Markdown | Browser | PDF |
| --- | --- | --- | --- |
| Three-view proposal | [Read](solution-design.md) | [Open](solution-design.html) | [Open](solution-design.pdf) |

The [original exercise brief](brief/principal-test-collisiongroup.pdf) remains the requirements source. The [review and response](reviews/) are separate from the proposal.

The [change record](reviews/review-response.md#browser-and-gateway-placement) describes the latest diagram changes. Earlier decisions remain as history; independent reviews are unchanged.

The AWS view shows the browser's connections to website delivery, sign-in and the API, alongside the deployed resources. The frontend view explains the browser's components and service calls in more detail. Smaller diagram fonts and more space between resources keep the three-page layout readable.

| Page | View | Editable source | PNG |
| --- | --- | --- | --- |
| 1 | [AWS overview](diagrams/aws-overview.svg) | [Excalidraw](diagrams/aws-overview.excalidraw) | [Preview](diagrams/aws-overview.png) |
| 2 | [Backend components](diagrams/solution-components.svg) | [Excalidraw](diagrams/solution-components.excalidraw) | [Preview](diagrams/solution-components.png) |
| 3 | [Frontend design](diagrams/frontend-design.svg) | [Excalidraw](diagrams/frontend-design.excalidraw) | [Preview](diagrams/frontend-design.png) |

The [document tools](design-tools/README.md) explain how to regenerate the views and export the proposal.

The earlier [supporting detail](supporting-detail.md), its exports and the deeper diagrams remain as references. The [combined architecture view](diagrams/solution-architecture.svg) is also retained outside the three-page reading route. None is required to understand the proposal.

This folder can be copied out of the project intact. Reading the documents requires no application code or access to the parent project.
