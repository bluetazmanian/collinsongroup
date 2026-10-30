// Airport Trip Planner web app (screens.md). No framework; every piece of brand text is set
// with textContent, never as HTML. Tokens are kept in memory only.
'use strict';

const cfg = window.PLANNER_CONFIG || {};
const LOCAL = cfg.authMode === 'local';
const view = document.getElementById('view');
const signoutBtn = document.getElementById('signout');
const mytripBtn = document.getElementById('mytrip');

// Who is signed in: their access token, held in memory only.
let session = null;
let trip = null; // the account's saved trip, as the traveller service returns it

// The preference IDs the traveller service accepts (packages/concepts, PREFERENCES).
const LIKES = [
  ['budget-food', 'Budget food'], ['quick-bite', 'A quick bite'], ['coffee', 'Coffee'],
  ['sit-down-dining', 'Sit-down meal'], ['fine-dining', 'Fine dining'], ['fashion', 'Fashion'],
  ['luxury-shopping', 'Luxury shopping'], ['good-service', 'Good service'],
];
const DIETARY = [['vegan', 'Vegan'], ['vegetarian', 'Vegetarian'], ['halal', 'Halal'], ['gluten-free', 'Gluten-free']];
const AIRPORTS = [['LHR', 'London Heathrow (LHR)'], ['LGW', 'London Gatwick (LGW): not covered yet']];
const AIRPORT_ZONE = 'Europe/London';

const WARNING_TEXT = {
  'catalogue-stale': 'Shop details may be out of date. Offers are hidden for now.',
  'offers-unavailable': "Offers aren't available right now.",
  'facts-missing': "Some opening hours aren't known.",
};

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'value') node[k] = v;
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

function show(...nodes) {
  view.classList.remove('landing');
  view.replaceChildren(...nodes);
  const h = view.querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  window.scrollTo(0, 0);
}

/** The starting and sign-up pages: a full-width band with a large headline. */
function showLanding(eyebrow, title, intro, ...content) {
  show(el('section', { class: 'landing-hero' }, el('div', { class: 'wrap landing-grid' },
    el('div', { class: 'landing-copy' },
      eyebrow && el('p', { class: 'eyebrow' }, eyebrow),
      el('h1', {}, title),
      intro && el('p', { class: 'intro' }, intro),
    ),
    el('div', { class: 'landing-body' }, ...content),
  )));
  view.classList.add('landing');
}

function signedInChrome() {
  signoutBtn.hidden = !session;
  mytripBtn.hidden = !session;
}

function localTime(iso, timeZone) {
  const opts = { hour: '2-digit', minute: '2-digit', timeZone };
  const text = new Intl.DateTimeFormat('en-GB', opts).format(new Date(iso));
  const phoneZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return phoneZone === timeZone ? text : `${text} (${timeZone})`;
}

function minutesText(n) {
  if (n < 60) return `${n} minutes`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m} min` : `${h} hours`;
}

/** A form's submit handler that shows `error` text under the form instead of throwing. */
function guarded(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const errorBox = form.querySelector('.form-error');
    errorBox.textContent = '';
    button.disabled = true;
    try {
      await fn(new FormData(form));
    } catch (err) {
      errorBox.textContent = err.message || 'Something went wrong.';
      button.disabled = false;
    }
  });
  return form;
}

function field(label, attrs, hint) {
  const id = attrs.id || attrs.name;
  return [
    el('label', { for: id }, label),
    el('input', { id, ...attrs, 'aria-describedby': hint ? `${id}-hint` : null }),
    hint && el('p', { class: 'hint', id: `${id}-hint` }, hint),
  ];
}

// ---------- Accounts (cognito-local locally; the same Cognito user-pool calls the AWS SDK makes)

const COGNITO_ERRORS = {
  UsernameExistsException: 'There is already an account with that email. Sign in instead.',
  InvalidPasswordException: 'That password is too weak, or the email and password don\'t match.',
  NotAuthorizedException: 'The email or password is wrong.',
  UserNotFoundException: 'The email or password is wrong.',
  CodeMismatchException: 'That code is wrong. Check it and try again.',
  ExpiredCodeException: 'That code has expired. Ask for a new one.',
  UserNotConfirmedException: 'Please confirm your email first.',
  InvalidParameterException: 'Please check what you entered.',
};

async function cognito(action, body) {
  let res;
  try {
    res = await fetch(cfg.cognitoEndpoint + '/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-amz-json-1.1', 'x-amz-target': `AWSCognitoIdentityProviderService.${action}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("We couldn't reach the sign-in service. Try again in a moment.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const type = String(json.__type || json.code || '').split('#').pop();
    const err = new Error(COGNITO_ERRORS[type] || json.message || 'Something went wrong.');
    err.type = type;
    throw err;
  }
  return json;
}

async function signIn(email, password) {
  const r = await cognito('InitiateAuth', {
    ClientId: cfg.clientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  session = { token: r.AuthenticationResult.AccessToken, email };
  signedInChrome();
}

function showSignIn(message) {
  session = null;
  trip = null;
  signedInChrome();
  if (!LOCAL) {
    return showLanding(...HERO, el('section', { class: 'panel' },
      el('div', { class: 'actions' }, el('button', { type: 'button', onclick: startCognitoSignIn }, 'Sign in')),
    ));
  }
  const form = guarded(el('form', { class: 'panel', novalidate: true },
    el('h2', {}, 'Sign in'),
    message && el('p', { class: 'muted' }, message),
    field('Email', { type: 'email', name: 'email', autocomplete: 'username', required: true }),
    field('Password', { type: 'password', name: 'password', autocomplete: 'current-password', required: true }),
    el('p', { class: 'form-error', role: 'alert' }),
    el('div', { class: 'actions' },
      el('button', { type: 'submit' }, 'Sign in'),
      el('button', { type: 'button', class: 'link', onclick: () => showSignUp() }, 'Create an account'),
    ),
  ), async (data) => {
    const email = String(data.get('email')).trim();
    try {
      await signIn(email, String(data.get('password')));
    } catch (err) {
      if (err.type === 'UserNotConfirmedException') return showConfirm(email, String(data.get('password')));
      throw err;
    }
    await afterSignIn();
  });
  showLanding(...HERO, form);
}

const HERO = [null, 'Find places to eat and shop before your flight.',
  "Tell us what you like and when you fly. We'll suggest places that fit the time you have."];

function showSignUp() {
  const form = guarded(el('form', { class: 'panel', novalidate: true },
    el('h2', {}, 'Your details'),
    field('Email', { type: 'email', name: 'email', autocomplete: 'username', required: true }),
    field('Password', { type: 'password', name: 'password', autocomplete: 'new-password', required: true, minlength: 8 },
      'At least 8 characters, with an upper-case letter, a lower-case letter and a number.'),
    field('Mobile number (optional)', { type: 'tel', name: 'phone', autocomplete: 'tel' },
      'With the country code, like +44 7700 900123. If you add one, we text your code instead of emailing it.'),
    el('p', { class: 'form-error', role: 'alert' }),
    el('div', { class: 'actions' },
      el('button', { type: 'submit' }, 'Create account'),
      el('button', { type: 'button', class: 'link', onclick: () => showSignIn() }, 'I already have an account'),
    ),
  ), async (data) => {
    const email = String(data.get('email')).trim();
    const password = String(data.get('password'));
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter your email address, like name@example.com.');
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      throw new Error('Your password needs at least 8 characters, with an upper-case letter, a lower-case letter and a number.');
    }
    const phone = String(data.get('phone') || '').replace(/[\s()-]/g, '');
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter your mobile number with the country code, like +44 7700 900123.');
    const r = await cognito('SignUp', {
      ClientId: cfg.clientId, Username: email, Password: password,
      UserAttributes: [{ Name: 'email', Value: email }, ...(phone ? [{ Name: 'phone_number', Value: phone }] : [])],
    });
    if (r.UserConfirmed) {
      await signIn(email, password);
      return afterSignIn();
    }
    showConfirm(email, password, r.CodeDeliveryDetails);
  });
  showLanding('New here?', 'Create your account', 'It takes a minute. Then tell us about your trip.', form);
}

// The password is held only until the code is confirmed, so the user goes straight in.
// `delivery` is Cognito's CodeDeliveryDetails: where the code went (email or text message).
function showConfirm(email, password, delivery = null) {
  const phone = delivery?.DeliveryMedium === 'SMS' ? delivery.Destination : null;
  const form = guarded(el('form', { class: 'panel', novalidate: true },
    el('p', {}, phone ? `We've sent a 6-digit code by text message to ${phone}.` : `We've sent a 6-digit code to ${email}.`),
    field('Code', { type: 'text', name: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', required: true, maxlength: 6 }),
    el('p', { class: 'form-error', role: 'alert' }),
    el('div', { class: 'actions' },
      el('button', { type: 'submit' }, 'Confirm'),
      el('button', { type: 'button', class: 'link', onclick: async (e) => {
        // Keep the button: e.currentTarget is null once the await below has run.
        const button = e.currentTarget;
        const error = form.querySelector('.form-error');
        button.disabled = true;
        try {
          await cognito('ResendConfirmationCode', { ClientId: cfg.clientId, Username: email });
          button.textContent = 'New code sent';
          error.textContent = '';
        } catch (err) {
          error.textContent = err.message;
        } finally {
          button.disabled = false;
        }
      } }, 'Send a new code'),
    ),
  ), async (data) => {
    await cognito('ConfirmSignUp', { ClientId: cfg.clientId, Username: email, ConfirmationCode: String(data.get('code')).trim() });
    if (!password) return showSignIn('Your email is confirmed. Please sign in.');
    await signIn(email, password);
    password = null;
    await afterSignIn();
  });
  showLanding('Almost there', phone ? 'Check your phone' : 'Check your email', null, form);
}

// ---------- The account's trip (local traveller service)

async function traveller(method, body) {
  const res = await fetch(cfg.travellerUrl + '/travellers/me', {
    method,
    headers: { authorization: `Bearer ${session.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function afterSignIn() {
  show(el('section', { class: 'panel', 'aria-busy': 'true' },
    el('div', { class: 'spinner', role: 'progressbar', 'aria-label': 'Loading' }),
    el('h1', {}, 'Signing you in…'),
  ));
  let r;
  try {
    r = await traveller('GET');
  } catch {
    return showError("We couldn't load your trip details.", true);
  }
  if (r.status === 404) return showTrip(true);
  if (r.status === 401) return showSignIn('Please sign in again.');
  if (r.status !== 200) return showError("We couldn't load your trip details.", true);
  trip = r.json;
  load();
}

/** "2026-10-30" + "14:30" in the airport's zone, as an ISO instant. */
function airportInstant(date, time) {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: AIRPORT_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(guess).reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (shown - guess.getTime())).toISOString();
}

function airportParts(iso) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: AIRPORT_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso)).reduce((o, x) => ({ ...o, [x.type]: x.value }), {});
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function showTrip(first) {
  const prefs = trip?.preferences || { likes: [], hardRules: [] };
  const flight = trip?.flight || {};
  const start = flight.scheduledDepartureAt || new Date(Math.ceil((Date.now() + 2 * 3600_000) / 300_000) * 300_000).toISOString();
  const when = airportParts(start);
  const boxes = (name, items, chosen) => el('div', { class: 'choices' }, items.map(([value, label]) =>
    el('label', { class: 'choice' }, el('input', { type: 'checkbox', name, value, checked: chosen.includes(value) }), label)));

  const form = guarded(el('form', { class: 'panel', novalidate: true },
    el('h1', {}, first ? 'Tell us about your trip' : 'My trip'),
    first && el('p', { class: 'muted' }, 'We use this to pick places that suit you and fit the time before your flight.'),
    el('fieldset', {}, el('legend', {}, 'What do you like?'), boxes('likes', LIKES, prefs.likes)),
    el('fieldset', {}, el('legend', {}, 'Dietary needs (optional)'),
      el('p', { class: 'hint' }, 'We only show places that confirm they meet these.'),
      boxes('hardRules', DIETARY, prefs.hardRules)),
    el('label', { for: 'airport' }, 'Departure airport'),
    el('select', { id: 'airport', name: 'airport' }, AIRPORTS.map(([value, label]) =>
      el('option', { value, selected: (flight.departureAirport || 'LHR') === value }, label))),
    el('div', { class: 'row' },
      el('div', {}, field('Departure date', { type: 'date', name: 'date', value: when.date, required: true })),
      el('div', {}, field('Departure time', { type: 'time', name: 'time', value: when.time, required: true })),
    ),
    el('p', { class: 'hint' }, 'Airport local time.'),
    el('div', { class: 'row' },
      el('div', {}, field('Flight number (optional)', { type: 'text', name: 'flightNumber', value: flight.flightNumber || '', autocomplete: 'off', maxlength: 8 })),
      el('div', {}, field('Gate (optional)', { type: 'text', name: 'gate', value: flight.gate || '', autocomplete: 'off', maxlength: 5 })),
    ),
    el('p', { class: 'form-error', role: 'alert' }),
    el('div', { class: 'actions' },
      el('button', { type: 'submit' }, first ? 'Show me places' : 'Save and show places'),
      !first && el('button', { type: 'button', class: 'secondary', onclick: () => load() }, 'Cancel'),
    ),
    !first && el('p', { class: 'hint' }, 'Changes can take up to a minute to show in your suggestions.'),
  ), async (data) => {
    const likes = data.getAll('likes');
    if (!likes.length) throw new Error('Choose at least one thing you like.');
    if (!data.get('date') || !data.get('time')) throw new Error('Enter your departure date and time.');
    const r = await traveller('PUT', {
      likes, hardRules: data.getAll('hardRules'), airport: data.get('airport'),
      departureAt: airportInstant(String(data.get('date')), String(data.get('time'))),
      flightNumber: String(data.get('flightNumber')), gate: String(data.get('gate')),
    });
    if (r.status === 401) return showSignIn('Please sign in again.');
    if (r.status === 400) throw new Error(r.json.error ? r.json.error.charAt(0).toUpperCase() + r.json.error.slice(1) + '.' : 'Please check your trip details.');
    if (r.status !== 200) throw new Error("We couldn't save your trip. Try again in a moment.");
    trip = r.json;
    load();
  });
  show(form);
}

// ---------- Cognito authorization code with PKCE (AWS mode)

async function startCognitoSignIn() {
  const verifier = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));
  sessionStorage.setItem('pkce', verifier); // removed straight after the code exchange
  const q = new URLSearchParams({
    response_type: 'code', client_id: cfg.clientId, redirect_uri: location.origin + '/',
    scope: 'openid planner/recommendations.read', code_challenge_method: 'S256', code_challenge: challenge,
  });
  location.assign(`${cfg.cognitoDomain}/oauth2/authorize?${q}`);
}

async function finishCognitoSignIn() {
  const code = new URLSearchParams(location.search).get('code');
  const verifier = sessionStorage.getItem('pkce');
  sessionStorage.removeItem('pkce');
  history.replaceState(null, '', location.pathname);
  if (!code || !verifier) return false;
  const res = await fetch(`${cfg.cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: cfg.clientId, code, redirect_uri: location.origin + '/', code_verifier: verifier }),
  });
  if (!res.ok) return false;
  session = { token: (await res.json()).access_token };
  signedInChrome();
  return true;
}

// ---------- Loading and calling the API

async function load(attempt = 0) {
  if (!session) return showSignIn();
  const slowTimer = setTimeout(() => {
    const extra = view.querySelector('.still');
    if (extra) extra.hidden = false;
  }, 3000);
  show(el('section', { class: 'panel', 'aria-busy': 'true' },
    el('div', { class: 'spinner', role: 'progressbar', 'aria-label': 'Loading' }),
    el('h1', {}, 'Finding places for you…'),
    el('p', { class: 'still muted', hidden: true }, 'Still working…'),
  ));

  const airportId = trip?.flight?.departureAirport || cfg.airportId;
  let res;
  let body;
  try {
    res = await fetch(cfg.apiUrl + 'recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ airportId }),
    });
    body = await res.json().catch(() => null);
  } catch {
    clearTimeout(slowTimer);
    return showError('Something went wrong.', true);
  }
  clearTimeout(slowTimer);

  if (res.status === 200 && body) return render(body);
  if (res.status === 401) return showSignIn('Please sign in again.');
  if ((res.status === 429 || res.status === 503) && attempt < 3) {
    const wait = Number(res.headers.get('retry-after') || 10) * 1000 + Math.random() * 1000;
    show(el('section', { class: 'panel' },
      el('h1', {}, body?.error?.message || "We couldn't load your trip details."),
      el('p', { class: 'muted' }, 'Trying again…'),
    ));
    setTimeout(() => load(attempt + 1), wait);
    return;
  }
  const message = body?.error?.message || 'Something went wrong.';
  return showError(message, res.status !== 404 && res.status !== 409);
}

function showError(message, canRetry) {
  const editTrip = session && el('button', { type: 'button', class: 'secondary', onclick: () => showTrip(false) }, 'Change my trip');
  show(el('section', { class: 'panel' },
    el('h1', {}, message),
    el('div', { class: 'actions' },
      canRetry && el('button', { type: 'button', onclick: () => load() }, 'Try again'),
      editTrip,
    ),
  ));
}

// ---------- Rendering an answer

function summary(r) {
  const t = r.time;
  return el('section', { class: 'panel summary' },
    el('p', { class: 'muted' }, `Departs ${localTime(t.departureAt, t.airportTimeZone)}`),
    r.status === 'ok' && el('p', { class: 'time' }, 'About ', el('strong', {}, minutesText(t.usableMinutes)), ' before you need to head to your gate.'),
    t.estimates.length > 0 && el('p', { class: 'muted' },
      'Boarding and walking times are estimates. ',
      el('button', { type: 'button', class: 'link', 'aria-expanded': 'false', onclick: (e) => {
        const note = e.currentTarget.parentElement.nextElementSibling;
        note.hidden = !note.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!note.hidden));
      } }, 'Why?'),
    ),
    t.estimates.length > 0 && el('p', { class: 'muted', hidden: true },
      "We don't know your gate's boarding time or the walk to it, so we assume boarding closes 30 minutes before departure and the walk takes 15 minutes."),
  );
}

function card(x, timeZone) {
  return el('li', { class: 'card' },
    el('h2', {}, x.name),
    el('p', { class: 'kind' }, x.kind),
    el('p', {}, x.reasons.join(' · ')),
    el('p', { class: 'muted' }, `About ${x.visitMinutes} minutes`, x.visitIsEstimate ? ' (estimate)' : ''),
    x.location && el('p', { class: 'muted' }, [x.location.terminal && `Terminal ${x.location.terminal}`, x.location.description].filter(Boolean).join(' · ')),
    x.offer && el('div', { class: 'offer' },
      el('span', { class: 'badge' }, 'Offer'),
      el('strong', {}, x.offer.title),
      el('span', { class: 'until' }, `Until ${localTime(x.offer.endsAt, timeZone)}`),
    ),
  );
}

function render(r) {
  const tz = r.time.airportTimeZone;
  const warnings = (r.warnings || []).filter((w) => WARNING_TEXT[w]).map((w) => el('p', { class: 'warning' }, WARNING_TEXT[w]));
  const refresh = el('div', { class: 'actions' },
    el('button', { type: 'button', class: 'secondary', onclick: () => load() }, 'Refresh'),
    session && el('button', { type: 'button', class: 'link', onclick: () => showTrip(false) }, 'Change my trip'),
  );

  if (r.status === 'ok') {
    return show(
      el('h1', {}, 'Places for you'),
      summary(r),
      ...warnings,
      el('ul', { class: 'cards' }, r.results.map((x) => card(x, tz))),
      refresh,
    );
  }
  if (r.status === 'head-to-gate') {
    return show(el('section', { class: 'panel' },
      el('h1', { class: 'big' }, "You're close to boarding — head to your gate."),
      el('p', { class: 'muted' }, `Departs ${localTime(r.time.departureAt, tz)}`),
    ));
  }
  if (r.status === 'no-suitable') {
    return show(
      el('section', { class: 'panel' },
        el('h1', {}, 'No places match your preferences in the time you have.'),
        el('p', { class: 'muted' }, 'If you have dietary needs, we only show places that confirm them.'),
      ),
      summary(r),
      ...warnings,
      refresh,
    );
  }
  return show(el('section', { class: 'panel' },
    el('h1', {}, "We can't get up-to-date shop information right now."),
    el('p', {}, "Please check the airport's own signs and app."),
    el('div', { class: 'actions' }, el('button', { type: 'button', onclick: () => load() }, 'Try again')),
  ));
}

signoutBtn.addEventListener('click', () => showSignIn());
mytripBtn.addEventListener('click', () => showTrip(false));

(async () => {
  if (!LOCAL && new URLSearchParams(location.search).has('code') && await finishCognitoSignIn()) return load();
  showSignIn();
})();
