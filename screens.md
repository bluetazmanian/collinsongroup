# Airport Trip Planner: Screens

What the traveller sees, screen by screen, and which [API](api.md) answer leads to each. These describe content and behaviour, not visual design. A designer can style them freely as long as every state below exists.

## Ground rules

- **Phone first.** Most travellers use a phone at the airport. Lay everything out for a 390-pixel-wide screen first, then widen.
- **One job per screen.** The traveller should see suggestions within one tap of opening the app.
- **Times in airport local time**, using `airportTimeZone` from the API, with the time zone shown if it differs from the phone's.
- **Plain words.** "About 45 minutes before you need to head to your gate", not "usable minutes: 45".
- **Accessible.** Meets WCAG 2.2 AA: text contrast at least 4.5:1, every control reachable by keyboard and screen reader, nothing shown by colour alone, tap targets at least 44 by 44 pixels.
- **Brand text as plain text.** Venue names, offer titles and keywords are always rendered as text, never as HTML.

## 1. Sign in

Shown when there's no valid token.

- App name and one line: "Find places to eat and shop before your flight."
- One button: **Sign in**, which starts the Cognito sign-in (authorization code with PKCE).
- After sign-in, go straight to screen 2.

**In the local version** there's no Cognito sign-in page to send people to, so the app shows its own pages (a large headline on a dark band, a magenta button):

- **Starting page:** the headline, a short line, and a sign-in box (email and password) with **Create an account**.
- **Create your account:** email, password and an optional mobile number. With a mobile number the code comes by text message, otherwise by email, as Cognito does when it checks both.
- **Check your email / Check your phone:** where the code went, a box for it and **Send a new code**. Locally it links to where the code landed (Mailpit, or LocalStack's text messages).
- **My trip:** what you like, any dietary needs, the airport, and the flight's date and time (airport local time), with optional flight number and gate. Shown after a first sign-in, and from **My trip** in the header. In AWS this comes from the traveller service; locally the person types it in.

Every page has a **Light mode / Dark mode** switch in the header. With no choice made, it follows the device setting.

## 2. Loading

Shown while `POST /recommendations` runs.

- "Finding places for you…" with a progress indicator.
- If it takes over 3 seconds, add "Still working…". The API's own limit is 10 seconds.

## 3. Suggestions (`status: ok`)

**Top bar**

- Departure time: "Departs 14:30".
- Time available: "About **45 minutes** before you need to head to your gate."
- If `time.estimates` isn't empty, a small line under it: "Boarding and walking times are estimates." with an info button that explains the 30- and 15-minute assumptions.

**Warnings**, one line each, above the list:

| Warning | Text |
| --- | --- |
| `catalogue-stale` | "Shop details may be out of date. Offers are hidden for now." |
| `offers-unavailable` | "Offers aren't available right now." |
| `facts-missing` | "Some opening hours aren't known." |

**Result cards**, in the order the API gives, up to 10. Each card shows:

- venue name and kind (restaurant, café, shop, bar);
- the reason: "Matches: affordable, quick food";
- visit length: "About 15 minutes" (add "estimate" if `visitIsEstimate`);
- location, if known: "Terminal 5 · near gate A10";
- offer, if any: title and "until 15:00", visually set apart as an offer.

**Bottom:** a **Refresh** button. Pull-to-refresh does the same.

## 4. Head to your gate (`status: head-to-gate`)

- Large message: "You're close to boarding — head to your gate."
- Flight and departure time, and the gate if known.
- No list, and deliberately no "show me anyway" link: the point is not to make anyone late.

## 5. Nothing suitable (`status: no-suitable`)

- "No places match your preferences in the time you have."
- If the traveller has hard rules: "We only show places that confirm your dietary needs."
- A link to edit preferences, if the traveller service offers one.

## 6. No reliable data (`status: no-reliable-data`)

- "We can't get up-to-date shop information right now. Please check the airport's own signs and app."
- **Try again** button.

## 7. Errors

| API answer | Screen |
| --- | --- |
| `401` | Back to Sign in, keeping no data |
| `404 unknown-airport` | "We don't cover this airport yet." |
| `409 airport-mismatch` | "That isn't your flight's departure airport." |
| `429` or `503` | "We couldn't load your trip details. Trying again…", retrying automatically after `Retry-After`, up to 3 times; then a **Try again** button |
| `500`, network error | "Something went wrong." with **Try again** |

## Privacy on screen

- The app stores only the Cognito tokens (in memory, with the refresh token handled by the Cognito library) and the last answer for the current screen. Nothing is written to local storage.
- Signing out clears everything.

## What's not on these screens

Booking, payment, maps and turn-by-turn directions are out of scope.
