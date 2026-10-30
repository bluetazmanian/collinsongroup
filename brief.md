# Airport Trip Planner: Requirements

## What it has to do

The planner suggests restaurants and shops to a traveller at the airport. Suggestions must suit the traveller's preferences, fit the time before their flight and take relevant sales into account. The inputs and required behaviour are set out below.

## What we're given

| Input | What we get | What we don't get |
| --- | --- | --- |
| Traveller service | The traveller's chosen preferences and their flight time | Where they are, their gate, when boarding closes, how they sign in, or how often the data changes |
| Airport business service | Shops and restaurants, each with keywords the brand wrote | The exact format, opening hours, locations, prices or how long service takes |
| Sales | Recommendations should take sales into account | Any source for offers, their dates, conditions or how fresh they are |

Two examples show the keyword problem: a fast-food chain might list "fast food, cheap, takeaway", while a fashion brand lists "luxury, fashion, service". Every brand writes its own words, so nothing lines up.

## What the design covers, and where

| Requirement | Where it's covered | How you'll know it's covered |
| --- | --- | --- |
| Recommendations based on preferences | [How it works](answer.md#how-it-works); [examples 1 and 3](worked-examples.md) | A worked example linking preferences to a suggestion |
| Taking flight time into account | [Preferences and available time](answer.md#preferences-and-available-time); [examples 1 and 2](worked-examples.md), [time rules](aws-deployment.md#time) | Clear time assumptions, what we don't know, and a "not enough time" example |
| Taking sales into account | [Where offers come from](answer.md#where-offers-come-from); [examples 4 and 5](worked-examples.md), [sales rules](aws-deployment.md#sales) | Where offers come from, and what happens when they're missing or expired |
| Handling inconsistent keywords | [How it works](answer.md#how-it-works); [examples 1 and 3](worked-examples.md), plus the [refresh sequence](diagrams/airport-trip-planner-catalogue-refresh-sequence.excalidraw) | The approach explained, with an ambiguous-keyword example |
| A diagram of the front end, back end and infrastructure | [Architecture](answer.md#architecture), plus the [AWS diagram](diagrams/airport-trip-planner-aws-deployment.excalidraw) | Labelled boxes, what each one does, and how data moves |
| A short reason for each technology | [Technology choices](answer.md#technology-choices), plus the [AWS notes](aws-deployment.md) | For each part: the choice, why, the alternative, and the cost of choosing it |
| Strengths and trade-offs | [What this approach gives us](answer.md#what-this-approach-gives-us) and [Trade-offs](answer.md#trade-offs) | Concrete trade-offs that matter for this planner |
| Using pre-built AI rather than training a model | [Choosing the AI approach](answer.md#choosing-the-ai-approach) | Existing AI services weighed up; no training |

## What's in and what's out

The design covers recommendations, data preparation and AWS deployment. A local application is available for trying the behaviour. Production deployment, booking and payments are outside the current implementation.

The open points — how long the document should be, which airport, how many users, and any technology constraints — are covered in [Assumptions](questions-and-assumptions.md).
