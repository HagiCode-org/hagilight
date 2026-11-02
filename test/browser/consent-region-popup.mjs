// Headless Chromium check for the regional popup and replay opt-in (tasks 3.4 and 3.5). Each region decision is driven
// through a site hook, so no network is needed. It records every hidden-to-visible change of the panel and confirms:
// required and unknown show the popup exactly once (also after a deadline timeout), notRequired never shows it, a
// pending decision keeps it hidden, the replay section opens only through openConsentPreferences('replay'), Allow
// stores granted, and Not now stores nothing. Usage: node test/browser/consent-region-popup.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright');
const { renderConsentMarkup } = await import(path.join(ROOT, 'packages/core/dist/consent-markup.js'));

const TYPES = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  try {
    const file = path.join(ROOT, decodeURIComponent(new URL(request.url, 'http://local').pathname));
    if (!file.startsWith(ROOT)) throw new Error('outside root');
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/home/newbe36524/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome' });

const REGIONAL = { regions: 'default', settingsEntry: 'requiredOnly', sessionReplay: 'optIn' };
const markup = renderConsentMarkup({ locale: 'en-US', providers: ['googleAnalytics', 'posthog'], regional: REGIONAL });
const globalMarkup = renderConsentMarkup({ locale: 'en-US', providers: ['googleAnalytics', 'posthog'] });

/** The decision each case drives through the site hook. `pending` answers after 400 ms; `timeout` never answers. */
const DECISIONS = {
  required: "'required'",
  unknown: "'unknown'",
  notRequired: "'notRequired'",
  pending: "new Promise((resolve) => setTimeout(() => resolve('notRequired'), 400))",
  timeout: 'new Promise(() => {})',
};

async function openCase(decision, { html = markup } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  const body = `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><title>consent</title></head><body>${html}
<script type="module">
  import { configureConsent, openConsentPreferences } from '/packages/core/dist/consent.js';
  import { mountConsentPopup } from '/packages/core/dist/consent-popup.js';
  window.__openPreferences = openConsentPreferences;
  window.__hiddenChanges = [];
  const panel = document.querySelector('[data-hagilight-consent]');
  if (panel) {
    new MutationObserver((records) => {
      for (const record of records) window.__hiddenChanges.push(panel.hidden ? 'hidden' : 'visible');
    }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  }
  configureConsent({ regions: 'default', regionHook: () => (${DECISIONS[decision] ?? DECISIONS.required}) });
  mountConsentPopup(document);
</script></body></html>`;
  await page.route(`${base}/case`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body }));
  await page.goto(`${base}/case`, { waitUntil: 'load' });
  return { context, page };
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message.split('\n')[0] });
  }
}

const visibleChanges = (page) => page.evaluate(() => window.__hiddenChanges.filter((value) => value === 'visible').length);
const isHidden = (page) => page.evaluate(() => document.querySelector('[data-hagilight-consent]').hidden);
const stored = (page) => page.evaluate(() => localStorage.getItem('hagicode:consent'));

for (const decision of ['required', 'unknown', 'timeout']) {
  await check(`${decision}: popup shows exactly once`, async () => {
    const { context, page } = await openCase(decision);
    await page.waitForTimeout(decision === 'timeout' ? 2300 : 700);
    assert.equal(await isHidden(page), false, 'popup is visible');
    assert.equal(await visibleChanges(page), 1, 'exactly one hidden-to-visible change');
    await context.close();
  });
}

await check('notRequired: popup never shows', async () => {
  const { context, page } = await openCase('notRequired');
  await page.waitForTimeout(700);
  assert.equal(await isHidden(page), true);
  assert.equal(await visibleChanges(page), 0);
  await context.close();
});

await check('pending: popup stays hidden until the decision, then shows only if required', async () => {
  const { context, page } = await openCase('pending');
  assert.equal(await isHidden(page), true, 'hidden while pending');
  await page.waitForTimeout(900);
  assert.equal(await isHidden(page), true, 'notRequired after the wait keeps it hidden');
  assert.equal(await visibleChanges(page), 0);
  await context.close();
});

await check('openConsentPreferences() opens the main panel in a notRequired region', async () => {
  const { context, page } = await openCase('notRequired');
  await page.evaluate(() => window.__openPreferences());
  assert.equal(await isHidden(page), false);
  assert.equal(await page.evaluate(() => document.querySelector('[data-consent-main]').hidden), false);
  assert.equal(await page.evaluate(() => document.querySelector('[data-hagilight-consent-replay]').hidden), true);
  await context.close();
});

await check('replay opt-in: Allow stores granted and Not now stores nothing', async () => {
  const { context, page } = await openCase('notRequired');
  await page.evaluate(() => window.__openPreferences('replay'));
  assert.equal(await isHidden(page), false, 'replay panel opens');
  assert.equal(await page.evaluate(() => document.querySelector('[data-consent-main]').hidden), true, 'main content hidden');
  assert.equal(await page.evaluate(() => document.querySelector('[data-hagilight-consent-replay]').hidden), false);
  await page.click('[data-consent-replay-decline]');
  await page.waitForFunction(() => document.querySelector('[data-hagilight-consent]').hidden);
  assert.equal(await isHidden(page), true, 'Not now closes');
  assert.equal(await stored(page), null, 'Not now stores nothing');

  await page.evaluate(() => window.__openPreferences('replay'));
  await page.click('[data-consent-replay-allow]');
  assert.match(await stored(page), /^1\|granted\|\d+\|1$/u, 'Allow stores a granted record');
  await context.close();
});

await check('replay buttons have equal styling', async () => {
  const { context, page } = await openCase('notRequired');
  const classes = await page.evaluate(() => [
    document.querySelector('[data-consent-replay-allow]').className,
    document.querySelector('[data-consent-replay-decline]').className,
  ]);
  assert.equal(classes[0], classes[1]);
  await context.close();
});

await check('Accept on a required visitor stores granted; the popup then closes', async () => {
  const { context, page } = await openCase('required');
  await page.waitForTimeout(500);
  await page.click('[data-consent-accept]');
  await page.waitForFunction(() => document.querySelector('[data-hagilight-consent]').hidden);
  assert.match(await stored(page), /^1\|granted\|/u);
  assert.equal(await isHidden(page), true);
  await context.close();
});

await check('global markup: no replay section, popup behaves as before', async () => {
  const { context, page } = await openCase('required', { html: globalMarkup });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.querySelector('[data-hagilight-consent-replay]')), null);
  assert.equal(await page.evaluate(() => document.querySelector('[data-consent-main]')), null);
  assert.equal(await isHidden(page), false);
  await context.close();
});

const FOOTER = `<footer><button type="button" class="hagilight-footer__consent" data-consent-preferences data-consent-entry="settings" hidden>Cookie settings</button><button type="button" class="hagilight-footer__consent" data-consent-preferences data-consent-mode="replay" data-consent-entry="replay" hidden>Allow session replay</button></footer>`;
const entryHidden = (page, kind) => page.evaluate((name) => document.querySelector(`[data-consent-entry="${name}"]`).hidden, kind);

for (const [decision, settings, replay] of [['required', true, false], ['unknown', true, false], ['notRequired', false, true], ['pending', false, false]]) {
  await check(`footer entries for ${decision}: settings ${settings ? 'shown' : 'hidden'}, replay ${replay ? 'shown' : 'hidden'}`, async () => {
    const { context, page } = await openCase(decision, { html: markup + FOOTER });
    await page.waitForTimeout(decision === 'pending' ? 100 : 700);
    assert.equal(await entryHidden(page, 'settings'), !settings, 'settings entry');
    assert.equal(await entryHidden(page, 'replay'), !replay, 'replay entry');
    await context.close();
  });
}

await check('footer settings entry is hidden for notRequired unless settingsEntry is always', async () => {
  const alwaysMarkup = renderConsentMarkup({ locale: 'en-US', providers: ['posthog'], regional: { regions: 'default', settingsEntry: 'always', sessionReplay: 'optIn' } });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  await page.route(`${base}/always`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html lang="en-US"><body>${alwaysMarkup}${FOOTER}<script type="module">import { configureConsent } from '/packages/core/dist/consent.js'; import { mountConsentPopup } from '/packages/core/dist/consent-popup.js'; configureConsent({ regions: 'default', settingsEntry: 'always', sessionReplay: 'optIn', regionHook: () => 'notRequired' }); mountConsentPopup(document);</script></body></html>` }));
  await page.goto(`${base}/always`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  assert.equal(await entryHidden(page, 'settings'), false, 'always shows the settings entry');
  await context.close();
});

await browser.close();
server.close();
const failed = results.filter((result) => !result.ok);
for (const result of results) console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name}${result.ok ? '' : ` :: ${result.error}`}`);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
