# Airport Trip Planner: Assumptions

The requirements leave a lot unsaid. This page lists each gap, what we do know, and how the design deals with it.

| ID | Topic | What we know | What the design does about it | Why it matters |
| --- | --- | --- | --- | --- |
| Q-01 | What we produce | A high-level architecture document | Keep it short enough to walk through in one sitting | Keeps the effort in proportion |
| Q-02 | Which airport | The shops and restaurants are in an airport | Start with one terminal; design so more terminals or airports can be added | Decides what "reachable" means |
| Q-03 | Time available | We get the flight time | Usable time = departure − now − boarding buffer (30 min unless supplied) − walk buffer (15 min unless supplied); all times in UTC; estimates shown as estimates ([Time](aws-deployment.md#time)) | Avoids false confidence about catching the flight |
| Q-04 | Where the traveller is | Not supplied | Use location and walking time only when a source provides them | You can't tell what's nearby from keywords |
| Q-05 | Is the place open | We get the listing and keywords | Use opening hours and locations when a source provides them; otherwise flag it | A good match might be closed or too slow |
| Q-06 | Sales | Recommendations should consider them | Store offers with start and end times in each catalogue version; show only offers live right now and only while the catalogue is fresh; no feed, no offers ([Sales](aws-deployment.md#sales)) | Never invent or show stale promotions |
| Q-07 | Preferences | We get the traveller's chosen preferences | Treat things like dietary needs as hard rules and likes as soft ones | A preference and a constraint aren't the same |
| Q-08 | Quality of suggestions | Keywords are inconsistent | Judge the approach against a set of written examples | Lets us assess it without training a model |
| Q-09 | Scale and speed | No targets given | Validate the chosen 10-second API timeout, 300-second refresh deadline, 15-minute refresh and 30-minute catalogue freshness assumptions against load and catalogue size | Backs up the infrastructure choice |
| Q-10 | When services fail | The services are assumed to exist | Fresh under 30 min, stale with a warning up to 4 h, then no reliable data; fast retries; circuit breaker on the traveller service | Keeps things useful when something breaks |
| Q-11 | Privacy | Preferences and flights can be personal | Store the minimum; never send personal flight data to the AI provider | Shapes the architecture and its trade-offs |
| Q-12 | Technology | Pre-built AI is preferred; AWS is the platform | Use London, Node.js 24 and Nova Micro as the [specified design](aws-deployment.md); validate classification quality against a keyword-only baseline | Grounds the choices in the requirements |

## How an assumption gets settled

Write down the answer, where it came from, and which documents it affects. Keep three things apart: what the existing services supply, what we assume, and what we've checked against an outside source.

Numbers such as a boarding buffer, a response-time target or a monthly cost only appear with a source, or clearly marked as an assumption. No real traveller data is needed.
