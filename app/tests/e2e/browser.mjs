// Browser walk-through of the web app at phone (390 px) and desktop (1440 px) width, in light
// and dark: a new account from sign-up to suggestions.
// Usage: node tests/e2e/browser.mjs <screenshot-folder>
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { mailCount, mailTo, smsTo } from './inbox.mjs';
import { cleanUp, track } from './cleanup.mjs';

const outDir = process.argv[2] ?? 'screenshots';
mkdirSync(outDir, { recursive: true });
const exe = process.env.CHROME_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`;
const widths = [390, 1440];
const APP = 'http://localhost:5173/';

// The API keeps the catalogue pointer for 30 seconds; after the end-to-end run it may still
// hold a deliberately old one. Wait until a test traveller token gets real suggestions.
const apiUrl = JSON.parse(readFileSync(new URL('../../.local-outputs.json', import.meta.url))).ApiUrl.replace(/^https:/, 'http:');
for (let i = 0; i < 45; i++) {
  const r = await fetch(apiUrl + 'recommendations', { method: 'POST', headers: { authorization: 'Bearer asha-token', 'content-type': 'application/json' }, body: '{"airportId":"LHR"}' });
  if ((await r.json().catch(() => ({}))).status === 'ok') break;
  await new Promise((res) => setTimeout(res, 1000));
}

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let problems = 0;
const fail = (msg) => { problems++; console.log(`  PROBLEM ${msg}`); };

async function settle(page) {
  await page.waitForFunction(() => {
    const h = document.querySelector('main h1');
    return h && !/Finding places|Signing you in/.test(h.textContent);
  }, null, { timeout: 15000 });
  return (await page.textContent('main h1')).trim();
}

async function checkPage(page, label) {
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) fail(`${label} scrolls sideways`);
  // Brand markup must stay text: "Snack <b>Shack</b>" shows literally, with no <b> element created.
  if (await page.$$eval('.card b', (els) => els.length)) fail(`${label}: brand markup became HTML`);
  // Every button and form control is at least 44 px tall.
  const small = await page.$$eval('main button, main input, main select, header button', (els) =>
    els.filter((e) => e.offsetParent && e.type !== 'checkbox' && e.getBoundingClientRect().height < 44).map((e) => e.textContent || e.name));
  if (small.length) fail(`${label}: controls under 44 px: ${small.join(', ')}`);
}

for (const scheme of ['light', 'dark']) {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
    const page = await context.newPage();
    const consoleErrors = [];
    // Expected failures the browser logs anyway: the 404 before a new account saves a trip, and
    // the 400 for the wrong code the walk types on purpose.
    page.on('console', (m) => { if (m.type() === 'error' && !/status of (404|400)/.test(m.text())) consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    const tag = `${scheme}-${width}`;

    // ---- a new account, from sign-up to suggestions
    await page.goto(APP);
    const shownTheme = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.screenshot({ path: `${outDir}/signin-${tag}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Create an account' }).click();
    const email = `walk-${Date.now()}-${randomBytes(3).toString('hex')}@example.test`;
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(`Aa1${randomBytes(9).toString('base64url')}`);
    // Light runs get the code by email (Mailpit), dark runs by text message (LocalStack SMS).
    const phone = scheme === 'dark' ? `+44770091${String(Date.now()).slice(-4)}` : null;
    if (phone) await page.getByLabel('Mobile number (optional)').fill(phone.replace(/^(\+44)(\d{4})/, '$1 $2 '));
    await page.getByRole('button', { name: 'Create account' }).click();
    track(email, phone);
    await page.getByRole('heading', { name: phone ? 'Check your phone' : 'Check your email' }).waitFor();
    await page.screenshot({ path: `${outDir}/confirm-${tag}.png`, fullPage: true });
    await page.getByLabel('Code').fill('000000');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.getByText('That code is wrong').waitFor();
    if (!phone) {
      // "Send a new code" sends a second email, says so, and stays usable.
      await mailTo(email);
      await page.getByRole('button', { name: 'Send a new code' }).click();
      await page.getByRole('button', { name: 'New code sent' }).waitFor();
      if (!(await page.getByRole('button', { name: 'New code sent' }).isEnabled())) fail(`${tag}: resend button stayed disabled`);
      for (let i = 0; i < 60 && (await mailCount(email)) < 2; i++) await new Promise((r) => setTimeout(r, 500));
      if ((await mailCount(email)) < 2) fail(`${tag}: no second email after "Send a new code"`);
    }
    await page.getByLabel('Code').fill((phone ? await smsTo(phone) : await mailTo(email)).code);
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.getByRole('heading', { name: 'Tell us about your trip' }).waitFor({ timeout: 10000 }).catch(async (e) => {
      await page.screenshot({ path: `${outDir}/stuck-${tag}.png`, fullPage: true });
      throw new Error(`${tag}: stuck after the code, page says "${(await page.textContent('main h1'))?.trim()}" / "${await page.textContent('.form-error').catch(() => '')}"`);
    });
    await page.getByRole('button', { name: 'Show me places' }).click();
    await page.getByText('Choose at least one thing you like.').waitFor();
    await page.getByLabel('Coffee').check();
    await page.getByLabel('Fashion').check();
    await page.screenshot({ path: `${outDir}/trip-${tag}.png`, fullPage: true });
    await checkPage(page, `trip form ${tag}`);
    const saved = page.waitForResponse((r) => r.url().endsWith('/travellers/me') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Show me places' }).click();
    const save = await saved;
    if (save.status() !== 200) fail(`${tag}: saving the trip gave ${save.status()} ${await save.text()} · form says "${await page.textContent('.form-error')}"`);
    await page.getByRole('heading', { name: /Places for you|close to boarding|No places/ }).waitFor();
    const heading = await settle(page);
    const cards = await page.$$eval('.card h2', (els) => els.map((e) => e.textContent));
    if (heading !== 'Places for you' || !cards.includes('Bean There')) fail(`${tag} new account got "${heading}" ${cards.join(' | ')}`);
    await checkPage(page, `account results ${tag}`);
    await page.screenshot({ path: `${outDir}/account-${tag}.png`, fullPage: true });
    console.log(`${tag.padEnd(11)} new account    "${heading}" · ${cards.join(' | ')}`);

    // "My trip" shows the saved choices, and signing out returns to sign-in.
    await page.getByRole('button', { name: 'My trip', exact: true }).click();
    if (!(await page.getByLabel('Coffee').isChecked())) fail(`${tag}: My trip lost the saved likes`);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await settle(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Sign in' }).waitFor();
    // The sign-in page has no test-traveller shortcut.
    if (await page.getByText(/test traveller/i).count()) fail(`${tag}: sign-in page still offers test travellers`);

    // ---- the theme switch overrides the device setting and is remembered
    await page.goto(APP);
    const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (before !== shownTheme) fail(`${tag}: page colour changed without a choice`);
    await page.locator('#theme').click();
    await page.reload();
    const after = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, document.documentElement.dataset.theme]);
    const expected = scheme === 'light' ? 'dark' : 'light';
    if (after[1] !== expected || after[0] === before) fail(`${tag}: switch did not give ${expected} after reload (${after.join(' ')})`);
    await page.screenshot({ path: `${outDir}/switched-${tag}.png`, fullPage: true });

    // Tab order reaches the main controls.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent))) fail(`nothing focusable by keyboard at ${tag}`);

    if (consoleErrors.length) fail(`console errors at ${tag}: ${consoleErrors.slice(0, 3).join(' / ')}`);
    await context.close();
  }
}

await browser.close();
console.log(`Removed ${await cleanUp()} test account(s) and their trips, emails and texts.`);
console.log(problems ? `\n${problems} problem(s)` : '\nNo problems found.');
process.exit(problems ? 1 : 0);
