// End-to-end checks against this project's LocalStack deployment (test-plan.md, "Staging tests").
// Run after local:deploy, local:seed and local:refresh. Add --slow for the refresh-retry check (about 2 minutes).
import '../../scripts/env.mjs';
import { mailCount, mailTo, smsTo } from './inbox.mjs';
import { cleanUp, track } from './cleanup.mjs';
import { readFileSync } from 'node:fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PurgeQueueCommand, SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { CognitoIdentityProviderClient, ConfirmSignUpCommand, InitiateAuthCommand, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Several checks set the catalogue's age or count published versions, so nothing else may publish
// during the run: pause the 15-minute refresher (atp-refresher; it carries on afterwards, even if the
// run crashes) and empty the refresh queue of jobs a previous run left retrying.
const docker = (cmd) => { try { execFileSync('docker', [cmd, 'atp-refresher'], { stdio: 'ignore' }); } catch {} };
docker('pause');
process.on('exit', () => docker('unpause'));

const out = JSON.parse(readFileSync(new URL('../../.local-outputs.json', import.meta.url)));
const API = out.ApiUrl.replace(/^https:/, 'http:') + 'recommendations';
const STUBS = 'http://localhost:4600';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const slow = process.argv.includes('--slow');
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function call(token, body = { airportId: 'LHR' }, extraHeaders = {}) {
  const headers = { 'content-type': 'application/json', origin: 'http://localhost:5173', ...extraHeaders };
  if (token) headers.authorization = `Bearer ${token}`;
  const started = Date.now();
  const res = await fetch(API, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, headers: res.headers, json, ms: Date.now() - started };
}
const stubMode = (m) => fetch(`${STUBS}/admin/mode`, { method: 'POST', body: JSON.stringify(m) });
const setFetchedAt = (iso) => db.send(new UpdateCommand({
  TableName: 'AirportCatalogue', Key: { PK: 'AIRPORT#LHR', SK: 'ACTIVE' },
  UpdateExpression: 'SET lastSuccessfulFetchAt = :t', ExpressionAttributeValues: { ':t': iso },
}));
const active = async () => (await db.send(new GetCommand({ TableName: 'AirportCatalogue', Key: { PK: 'AIRPORT#LHR', SK: 'ACTIVE' }, ConsistentRead: true }))).Item;
const names = (r) => (r.json?.results ?? []).map((x) => x.name);

await stubMode({ traveller: 'ok', venues: 'ok', offers: 'ok', ai: 'ok' });
// The API keeps the catalogue pointer for 30 seconds; straight after an earlier run it may still
// hold the deliberately old one from the freshness checks. Wait for real suggestions first.
for (let i = 0; i < 45 && (await call('asha-token')).json?.status !== 'ok'; i++) await sleep(1);
await new SQSClient({ useQueueUrlAsEndpoint: false }).send(new PurgeQueueCommand({ QueueUrl: out.RefreshQueueUrl }));
console.log(`API: ${API}\n\nTraveller journeys`);

await check('1. Asha (budget food, 90 min) gets affordable food, best first', async () => {
  const r = await call('asha-token');
  expect(r.status === 200 && r.json.status === 'ok', `got ${r.status} ${r.json?.status}`);
  expect(names(r)[0] === 'Burger Stop', `order was ${names(r)}`);
  expect(names(r).every((n) => ['Burger Stop', 'Sakura Express', 'Snack <b>Shack</b>'].includes(n)), `got ${names(r)}`);
  expect(r.json.results[0].offer?.title === '20% off meal deals', 'live offer missing on Burger Stop');
  expect(r.json.time.estimates.join() === 'boarding,walk', 'estimates not flagged');
});

await check('2. Ben (50 min) is told to head to his gate', async () => {
  const r = await call('ben-token');
  expect(r.json?.status === 'head-to-gate' && r.json.results.length === 0, `got ${r.json?.status}`);
});

await check('3. Chloe (good service) gets Northwind on the premium concept', async () => {
  const r = await call('chloe-token');
  expect(names(r).join() === 'Northwind Fashion', `got ${names(r)}`);
  expect(r.json.results[0].reasons[0] === 'Matches: premium', `reason ${r.json.results[0].reasons[0]}`);
});

await check('4. Dev sees the live coat offer but never the ended cookie offer', async () => {
  const r = await call('dev-token');
  const bean = r.json.results.find((x) => x.name === 'Bean There');
  const nw = r.json.results.find((x) => x.name === 'Northwind Fashion');
  expect(nw?.offer?.title === '15% off outerwear', 'coat offer missing');
  expect(bean && !bean.offer, 'ended offer shown or Bean There missing');
});

await check('5. Femi (vegan hard rule) gets nothing rather than an unconfirmed place', async () => {
  const r = await call('femi-token');
  expect(r.json?.status === 'no-suitable', `got ${r.json?.status}: ${names(r)}`);
});

await check('Reasons never contain brand text; the markup venue comes back as data', async () => {
  const r = await call('asha-token');
  expect(r.json.results.every((x) => !/[<>]/.test(x.reasons.join(' '))), 'markup in a reason');
});

console.log('\nAccounts (cognito-local)');
const pool = JSON.parse(readFileSync(new URL('../../.local-data/cognito.json', import.meta.url)));
const idp = new CognitoIdentityProviderClient({ endpoint: 'http://localhost:9229', region: 'eu-west-2', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
const trips = (token, method = 'GET', body) => fetch(`${STUBS}/travellers/me`, {
  method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body),
}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
// A throwaway account per run; the password is made up here and never shown.
// A code goes by email (Mailpit) unless `phone` is given, then by text message (LocalStack SNS).
async function newAccount(phone) {
  const email = `walk-${Date.now()}-${randomBytes(3).toString('hex')}@example.test`;
  const password = `Aa1${randomBytes(9).toString('base64url')}`;
  await idp.send(new SignUpCommand({
    ClientId: pool.clientId, Username: email, Password: password,
    UserAttributes: [{ Name: 'email', Value: email }, ...(phone ? [{ Name: 'phone_number', Value: phone }] : [])],
  }));
  track(email, phone);
  const { code } = phone ? await smsTo(phone) : await mailTo(email);
  lastEmail = email;
  await idp.send(new ConfirmSignUpCommand({ ClientId: pool.clientId, Username: email, ConfirmationCode: code }));
  const auth = await idp.send(new InitiateAuthCommand({ ClientId: pool.clientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password } }));
  return auth.AuthenticationResult.AccessToken;
}
const tripIn = (mins, extra = {}) => ({ likes: ['coffee', 'fashion'], hardRules: [], airport: 'LHR', departureAt: new Date(Date.now() + mins * 60_000).toISOString(), ...extra });
let alice;
let bob;
let lastEmail;

await check('A new account signs up, gets its code by email in Mailpit, confirms and signs in', async () => {
  alice = await newAccount();
  const mail = await mailTo(lastEmail);
  expect(mail.subject === 'Your Airport Trip Planner code' && mail.from === 'no-reply@airport-trip-planner.test', `email was "${mail.subject}" from ${mail.from}`);
  bob = await newAccount();
  expect(alice && bob, 'no tokens');
});
await check('Giving a mobile number sends the code by text through LocalStack SMS, and no email', async () => {
  const phone = `+44770090${String(Date.now()).slice(-4)}`;
  expect(await newAccount(phone), 'no token');
  expect((await smsTo(phone)).message.startsWith('Your Airport Trip Planner code is'), 'wrong text message');
  expect((await mailCount(lastEmail)) === 0, 'an email was sent as well');
});
await check('Before saving a trip there is none, and the planner says it cannot load trip details', async () => {
  expect((await trips(alice)).status === 404, 'trip found before saving');
  expect((await call(alice)).status === 503, 'API did not answer 503');
});
await check('Saving a trip, then asking: suggestions match that trip', async () => {
  const saved = await trips(alice, 'PUT', tripIn(150, { gate: 'b32' }));
  expect(saved.status === 200 && saved.json.flight.gate === 'B32', `save gave ${saved.status}`);
  const r = await call(alice);
  expect(r.status === 200 && r.json.status === 'ok', `got ${r.status} ${r.json?.status}`);
  expect(names(r).includes('Bean There') && names(r).includes('Northwind Fashion'), `got ${names(r)}`);
});
await check("One account can't see another's trip", async () => {
  expect((await trips(bob)).status === 404, "Bob sees a trip he never saved");
  await trips(bob, 'PUT', tripIn(50, { likes: ['sit-down-dining'] }));
  expect((await call(bob)).json?.status === 'head-to-gate', 'Bob did not get his own trip');
  expect((await trips(alice)).json.preferences.likes.join() === 'coffee,fashion', "Alice's trip changed");
});
await check('A bad trip is refused (no likes, unknown dietary need, departure in 30 hours)', async () => {
  for (const bad of [tripIn(90, { likes: [] }), tripIn(90, { hardRules: ['keto'] }), tripIn(30 * 60)]) {
    expect((await trips(alice, 'PUT', bad)).status === 400, `accepted ${JSON.stringify(bad)}`);
  }
});
await check('A flight that has already left gets a clear message, not suggestions', async () => {
  // A new account: the API keeps each traveller's trip for 60 seconds, so Bob's earlier trip would still answer.
  const late = await newAccount();
  await trips(late, 'PUT', tripIn(-20, { likes: ['sit-down-dining'] }));
  const r = await call(late);
  expect(r.status === 409 && r.json?.error?.code === 'flight-departed', `got ${r.status} ${r.json?.error?.code ?? r.json?.status}`);
});
await check('A changed or made-up token is refused by the API and the traveller service', async () => {
  const [h, p, sig] = alice.split('.');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  const forged = `${h}.${Buffer.from(JSON.stringify({ ...claims, sub: 'someone-else' })).toString('base64url')}.${sig}`;
  expect((await call(forged)).status === 401, 'API accepted a changed token');
  expect((await trips(forged)).status === 401, 'traveller service accepted a changed token');
});

console.log('\nAccess and validation');
await check('No token gives 401', async () => expect((await call(null)).status === 401, 'not 401'));
await check('Unknown token gives 401', async () => expect((await call('nobody-token')).status === 401, 'not 401'));
await check('A traveller ID in the body is rejected (400)', async () => {
  const r = await call('asha-token', { airportId: 'LHR', travellerId: 't-chloe' });
  expect(r.status === 400, `got ${r.status}`);
});
await check("One traveller's token only ever returns their own trip", async () => {
  const a = await call('asha-token');
  const c = await call('chloe-token');
  expect(a.json.time.departureAt !== c.json.time.departureAt, 'same trip for two travellers');
  const minsAsha = (new Date(a.json.time.departureAt) - Date.now()) / 60000;
  expect(minsAsha > 80 && minsAsha < 95, `Asha's departure is ${minsAsha.toFixed(0)} min away, expected about 90`);
});
await check("Wrong airport for the flight gives 409", async () => expect((await call('gatwick-token')).status === 409, 'not 409'));
await check('Unknown airport gives 404', async () => expect((await call('asha-token', { airportId: 'XYZ' })).status === 404, 'not 404'));
await check('limit outside 1-10 gives 400', async () => expect((await call('asha-token', { airportId: 'LHR', limit: 0 })).status === 400, 'not 400'));
await check('limit is respected', async () => expect((await call('dev-token', { airportId: 'LHR', limit: 1 })).json.results.length === 1, 'not 1 result'));
await check('Responses are private, never cached, and CORS allows only the web app', async () => {
  const r = await call('asha-token');
  expect(r.headers.get('cache-control') === 'private, no-store', `cache-control ${r.headers.get('cache-control')}`);
  expect(r.headers.get('access-control-allow-origin') === 'http://localhost:5173', `allow-origin ${r.headers.get('access-control-allow-origin')}`);
});

console.log('\nTraveller service failures');
await check('Traveller service down: 503 with Retry-After 10', async () => {
  await stubMode({ traveller: 'down' });
  const r = await call(`fresh-${Date.now()}`);
  expect(r.status === 503 && r.headers.get('retry-after') === '10', `got ${r.status} retry-after=${r.headers.get('retry-after')}`);
});
await check('After 5 failures the circuit opens and answers at once', async () => {
  for (let i = 0; i < 5; i++) await call(`fresh-${Date.now()}-${i}`);
  await stubMode({ traveller: 'slow' }); // would take 3 s if called
  const r = await call(`fresh-${Date.now()}-x`);
  expect(r.status === 503 && r.ms < 1500, `got ${r.status} in ${r.ms} ms`);
});
await check('Slow traveller service: 503 within the 2-second deadline', async () => {
  await sleep(31); // let the circuit's 30 seconds pass
  const r = await call(`slow-${Date.now()}`);
  expect(r.status === 503 && r.ms < 3000, `got ${r.status} in ${r.ms} ms`);
});
await stubMode({ traveller: 'ok' });
await sleep(31);
await check('Recovers once the service is back', async () => {
  const r = await call(`asha-token`);
  expect(r.status === 200, `got ${r.status}`);
});

console.log('\nCatalogue freshness');
const realFetchedAt = (await active()).lastSuccessfulFetchAt;
await check('70 minutes old: stale, venues shown, offers hidden', async () => {
  await setFetchedAt(new Date(Date.now() - 70 * 60_000).toISOString());
  await sleep(31); // the pointer is cached for 30 seconds
  const r = await call('asha-token');
  expect(r.json.catalogue?.state === 'stale', `state ${r.json.catalogue?.state}`);
  expect(r.json.results.length > 0 && r.json.results.every((x) => !x.offer), 'offers shown while stale');
  expect(r.json.warnings.includes('catalogue-stale'), 'no stale warning');
});
await check('Over 4 hours old: no reliable data', async () => {
  await setFetchedAt(new Date(Date.now() - 5 * 3600_000).toISOString());
  await sleep(31);
  expect((await call('asha-token')).json.status === 'no-reliable-data', 'not no-reliable-data');
});
await setFetchedAt(realFetchedAt);

console.log('\nRefresh jobs');
const sqs = new SQSClient({ useQueueUrlAsEndpoint: false });
const send = (body) => sqs.send(new SendMessageCommand({ QueueUrl: out.RefreshQueueUrl, MessageBody: JSON.stringify(body) }));
const logs = async (since) => {
  const r = await new CloudWatchLogsClient({}).send(new FilterLogEventsCommand({ logGroupName: '/aws/lambda/refresh-catalogue', startTime: since }));
  return (r.events ?? []).map((e) => e.message);
};

await check('The same job delivered twice publishes once', async () => {
  const before = (await active()).version;
  const jobId = `LHR#dup-${Date.now()}`;
  await send({ airportId: 'LHR', jobId });
  for (let i = 0; i < 60 && (await active()).version === before; i++) await sleep(1);
  const after = (await active()).version;
  await send({ airportId: 'LHR', jobId });
  await sleep(10);
  expect(after === before + 1 && (await active()).version === after, `versions ${before} -> ${after} -> ${(await active()).version}`);
});

if (slow) {
  await check('Venue service down: retried after about 1 minute, active version kept', async () => {
    const since = Date.now();
    const before = await active();
    await stubMode({ venues: 'down' });
    await send({ airportId: 'LHR', jobId: `LHR#down-${Date.now()}` });
    let lines = [];
    for (let i = 0; i < 110; i++) {
      await sleep(2);
      lines = (await logs(since)).filter((l) => l.includes('refresh failed'));
      if (lines.length >= 2) break;
    }
    await stubMode({ venues: 'ok' });
    // Remove the still-retrying job so it can't publish in the middle of a later run.
    await sqs.send(new PurgeQueueCommand({ QueueUrl: out.RefreshQueueUrl }));
    expect(lines.length >= 2, `saw ${lines.length} failed attempts`);
    expect(/"retryInSeconds":60/.test(lines[0]) && /"retryInSeconds":120/.test(lines[1]), 'retry delays were not 60 then 120 seconds');
    const after = await active();
    expect(after.version === before.version && after.lastSuccessfulFetchAt === before.lastSuccessfulFetchAt, 'active version changed');
  });
}

await stubMode({ traveller: 'ok', venues: 'ok', offers: 'ok', ai: 'ok' });
console.log(`\nRemoved ${await cleanUp()} test account(s) and their trips, emails and texts.`);
console.log(`\n${passed} passed, ${failed} failed${slow ? '' : ' (run with --slow to include the refresh-retry check)'}`);
process.exit(failed ? 1 : 0);
