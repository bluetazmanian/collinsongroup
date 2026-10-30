# Airport Trip Planner: Worked Examples

These six examples show what a traveller would receive and why. The venues, offers and times are illustrative; the calculations use the rules in the [AWS design](aws-deployment.md). Displayed times are local to the airport, and comparisons use UTC.

The example airport has three venues:

| Venue | Brand keywords | Concepts after AI reading | Visit length |
| --- | --- | --- | --- |
| Burger Stop | "fast food, cheap, takeaway" | quick food, affordable, takeaway | 15 min (default for quick food) |
| The Terrace | "bistro, relaxed, wine list" | sit-down dining, drinks | 45 min (default for sit-down) |
| Northwind Fashion | "luxury, fashion, service" | fashion, premium | 20 min (default for shopping) |

## 1. A good match

Asha likes **budget food**. It's 14:00, her flight leaves at 15:30, and no gate data is supplied.

- Usable time: 90 min − 30 min boarding estimate − 15 min walk estimate = **45 minutes**.
- Her preference "budget" maps to the **affordable** concept — the same concept Burger Stop's "cheap" was mapped to during the last refresh. No AI call happens now.
- Burger Stop (15 min) fits and matches, scoring 10 with 30 minutes to spare. The Terrace (45 min) would just fit, but matches none of her likes, so it's left out ([ranking rule](concepts-and-ranking.md#the-ranking-rule)).

**She sees:** Burger Stop first — "Matches: affordable, quick food, takeaway" — with a note that boarding and walking times are estimates.

## 2. Not enough time

Ben likes **sit-down dining**. It's 14:50 and his flight leaves at 15:40.

- Usable time: 50 − 30 − 15 = **5 minutes**.
- That's under the 10-minute floor, so no list is returned.

**He sees:** "You're close to boarding — head to your gate." The planner doesn't suggest The Terrace just because it matches.

## 3. An ambiguous keyword

Chloe likes **good service**. Northwind's brand wrote "service", which could mean customer service or a tailoring service.

- During the refresh, Nova Micro returned "premium" for Northwind. The app checked it was an allowed concept and saved it, alongside the original keywords.
- Chloe's "good service" maps to **premium**, so Northwind matches — but only on that concept.

**She sees:** Northwind, "matches: premium". This is a category match, not a verified claim about the quality of the shop's service.

## 4. A sale that has ended

Dev likes **fashion**. Northwind has an offer that ran until 14:00. It's now 14:05, and the catalogue was refreshed at 13:55, while the offer was still live.

- The offer is still stored in the current version, but at response time `endsAt` (14:00) is before now.
- It's dropped. Northwind still matches on fashion.

**He sees:** Northwind, with no offer. An expired sale is never shown, even if the last refresh picked it up.

## 5. The venue service has been down for an hour

Erin asks for suggestions. The last successful refresh was 70 minutes ago.

- Retries ran at 1, 2, 4 and 8 minutes after the failure, then the job went to the dead-letter queue. An alarm fired when the catalogue reached 20 minutes old.
- At 70 minutes the catalogue is **stale** (30 minutes to 4 hours): venues are still used, offers are left out.

**She sees:** her usual suggestions, with "details may be out of date" and no offers. If the outage lasted over 4 hours, she'd see "no reliable data" instead.

## 6. Nothing fits

Femi only wants **vegan food** and treats it as a hard rule. None of the three venues has a supplied fact confirming vegan food, and the AI never decides dietary safety.

**He sees:** "No suitable places found." The planner doesn't loosen his rule to show something.

## Requirement coverage

| Requirement | Example |
| --- | --- |
| Recommendations based on preferences | 1, 3 |
| Taking flight time into account | 1, 2 |
| Taking sales into account | 4, 5 |
| Handling inconsistent keywords | 1, 3 |
| Behaving well when data is missing | 2, 5, 6 |
