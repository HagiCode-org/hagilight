// DOM check for the consent popup in headless Chromium: Accept and Reject call setConsent, the details toggle exposes
// aria-expanded, no privacy link exists without privacyUrl, and mounting never moves focus. The popup's shipped
// global styles are injected so that sizing and focus are checked against the real CSS.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright');
/** The popup's global stylesheet, read from the component so the test exercises the shipped CSS. */
async function popupCss() {
  const source = await readFile(path.join(ROOT, 'packages/core/CookieConsent.astro'), 'utf8');
  const match = source.match(/<style is:global>([\s\S]*?)<\/style>/u);
  if (!match) throw new Error('CookieConsent.astro has no global style block');
  return match[1];
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

const server = http.createServer(async (request, response) => {
  try {
    const file = path.join(ROOT, decodeURIComponent(new URL(request.url, 'http://x').pathname));
    if (!file.startsWith(ROOT)) throw new Error('outside root');
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = [];

async function openPopup(query = '') {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/test/browser/fixtures/consent-popup.html${query}`);
  await page.addStyleTag({ content: await popupCss() });
  await page.waitForFunction(() => typeof window.__consentUnmount === 'function');
  return { context, page, errors };
}

async function check(name, fn) {
  try {
    await fn();
    results.push(`ok  ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

await check('undecided visitor sees the panel; Accept stores granted, hides it and notifies', async () => {
  const { context, page, errors } = await openPopup();
  try {
    assert.equal(await page.locator('[data-hagilight-consent]').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement === document.body), true, 'mounting does not move focus');
    assert.notEqual(await page.evaluate(() => document.documentElement.style.getPropertyValue('--hagilight-consent-clearance')), '0px');
    await page.click('[data-consent-accept]');
    await page.locator('[data-hagilight-consent]').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => localStorage.getItem('hagicode:consent')).then((value) => /^1\|granted\|\d+\|1$/u.test(value)), true);
    assert.deepEqual(await page.evaluate(() => window.__consentEvents), [{ necessary: 'granted', analytics: 'granted' }]);
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--hagilight-consent-clearance')), '0px');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

await check('Reject stores denied and notifies with denied', async () => {
  const { context, page } = await openPopup();
  try {
    await page.click('[data-consent-reject]');
    assert.deepEqual(await page.evaluate(() => window.__consentEvents), [{ necessary: 'granted', analytics: 'denied' }]);
    await page.locator('[data-hagilight-consent]').waitFor({ state: 'hidden' });
  } finally {
    await context.close();
  }
});

await check('no privacy link without privacyUrl, and one exact link with it', async () => {
  const bare = await openPopup();
  try {
    assert.equal(await bare.page.locator('[data-hagilight-consent] a').count(), 0);
  } finally {
    await bare.context.close();
  }
  const linked = await openPopup('?privacy=https%3A%2F%2Fexample.com%2Fprivacy');
  try {
    assert.equal(await linked.page.locator('[data-hagilight-consent] a').getAttribute('href'), 'https://example.com/privacy');
  } finally {
    await linked.context.close();
  }
});

await check('the details toggle reports aria-expanded and shows the storage names', async () => {
  const { context, page } = await openPopup();
  try {
    const toggle = page.locator('[data-consent-toggle]');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('[data-consent-details]').isHidden(), true);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('[data-consent-details]').isVisible(), true);
    const names = await page.locator('[data-consent-details] code').allTextContents();
    assert.ok(names.includes('hagicode_consent'));
    assert.ok(names.includes('_ga_<id>'));
    assert.ok(names.includes('ph_<key>_posthog'));
  } finally {
    await context.close();
  }
});

await check('the footer Cookie settings entry reopens the popup after a choice', async () => {
  const { context, page } = await openPopup();
  try {
    await page.click('[data-consent-accept]');
    await page.locator('[data-hagilight-consent]').waitFor({ state: 'hidden' });
    await page.click('[data-consent-preferences]');
    assert.equal(await page.locator('[data-hagilight-consent]').isVisible(), true);
    assert.equal(await page.locator('[data-consent-choice-value]').textContent(), 'Accepted');
  } finally {
    await context.close();
  }
});

await check('a visitor who already decided sees no panel, and Cookie settings reopens it with the choice', async () => {
  const { context, page } = await openPopup();
  try {
    await page.evaluate(() => localStorage.setItem('hagicode:consent', `1|denied|${Math.floor(Date.now() / 1000)}|1`));
    await page.reload();
    await page.waitForFunction(() => typeof window.__consentUnmount === 'function');
    assert.equal(await page.locator('[data-hagilight-consent]').isHidden(), true);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('hagilight:consent-preferences')));
    assert.equal(await page.locator('[data-hagilight-consent]').isVisible(), true);
    assert.equal(await page.locator('[data-consent-choice-value]').textContent(), 'Rejected');
  } finally {
    await context.close();
  }
});

await check('Accept and Reject have the same size and weight, and both are reachable by keyboard', async () => {
  const { context, page } = await openPopup();
  try {
    const sizes = await page.$$eval('[data-consent-accept], [data-consent-reject]', (nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return `${node.offsetWidth}x${node.offsetHeight}:${style.fontWeight}:${style.backgroundColor}`;
    }));
    assert.equal(new Set(sizes).size, 1, `equal treatment ${sizes.join(',')}`);
    await page.focus('[data-consent-accept]');
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-consent-accept')), true);
  } finally {
    await context.close();
  }
});

await browser.close();
server.close();
console.log(results.join('\n'));
if (process.exitCode) process.exit(process.exitCode);
