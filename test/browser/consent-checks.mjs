// Request-recording consent check against a built site (no stubs of analytics code). Usage:
//   node test/browser/consent-checks.mjs [distDir]   (default: examples/demo-web/dist)
// Undecided and denied visitors must make no request to a provider host and write no provider storage; a grant loads
// PostHog; a withdrawal after a grant stops capture and clears ph_ storage. Only the PostHog loader script
// (t.hagicode.com/static/array.js) is allowed through; every other provider request is aborted and recorded.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'examples/demo-web/dist'));
const START = process.env.CONSENT_START ?? '/en-US/';
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
const PROVIDER_HOSTS = ['googletagmanager.com', 'google-analytics.com', 'sdk.51.la', 't.hagicode.com', 'us.posthog.com'];
const ALLOWED_PROVIDER_URL = /^https:\/\/t\.hagicode\.com\/static\/array\.js/u;

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://local');
    let file = path.join(distDir, decodeURIComponent(url.pathname));
    if (!file.startsWith(distDir)) throw new Error('outside dist');
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = [];

async function openSite(pathname = '/en-US/', { storage } = {}) {
  const context = await browser.newContext();
  const seen = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (ALLOWED_PROVIDER_URL.test(url)) {
      seen.push(`allowed ${url}`);
      return route.continue();
    }
    if (PROVIDER_HOSTS.some((host) => url.includes(host))) seen.push(`blocked ${url.slice(0, 120)}`);
    return route.abort();
  });
  const page = await context.newPage();
  if (storage) {
    await page.goto(`${base}${START}`);
    await page.evaluate((entries) => { for (const [key, value] of entries) localStorage.setItem(key, value); }, storage);
  }
  await page.goto(`${base}${pathname}`, { waitUntil: 'load' });
  return { context, page, seen };
}

const providerRequests = (seen) => seen.filter((entry) => PROVIDER_HOSTS.some((host) => entry.includes(host)));
const providerStorage = (page) => page.evaluate(() => [
  ...Object.keys(localStorage).filter((key) => key.startsWith('ph_') || key.startsWith('__ph_') || key === 'hagicode:consent'),
].filter((key) => !key.startsWith('hagicode:consent')));
const providerCookies = async (context) => (await context.cookies()).map((cookie) => cookie.name).filter((name) => name.startsWith('ph_') || name === '_ga' || name.startsWith('_ga_'));

async function check(name, fn) {
  try {
    await fn();
    results.push(`ok   ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

await check('undecided visitor: one popup, no provider request, no provider storage', async () => {
  const { context, page, seen } = await openSite(START);
  try {
    await page.waitForTimeout(3000);
    assert.equal(await page.locator('[data-hagilight-consent]').count(), 1, 'one popup');
    assert.equal(await page.locator('[data-hagilight-consent]').isVisible(), true, 'the popup asks');
    assert.deepEqual(providerRequests(seen), [], 'no provider request before a choice');
    assert.deepEqual(await providerStorage(page), [], 'no provider localStorage');
    assert.deepEqual(await providerCookies(context), [], 'no provider cookie');
  } finally {
    await context.close();
  }
});

await check('denied visitor (stored): no provider request and no provider storage', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { context, page, seen } = await openSite(START, { storage: [['hagicode:consent', `1|denied|${now}|1`]] });
  try {
    await page.waitForTimeout(3000);
    assert.equal(await page.locator('[data-hagilight-consent]').isHidden(), true, 'a decided visitor sees no popup');
    assert.deepEqual(providerRequests(seen), []);
    assert.deepEqual(await providerStorage(page), []);
  } finally {
    await context.close();
  }
});

await check('reject on the popup: no provider request afterwards', async () => {
  const { context, page, seen } = await openSite(START);
  try {
    await page.click('[data-consent-reject]');
    await page.waitForTimeout(3000);
    assert.deepEqual(providerRequests(seen), []);
    assert.deepEqual(await providerStorage(page), []);
  } finally {
    await context.close();
  }
});

await check('accept loads PostHog on the same page, without a reload', async () => {
  const { context, page, seen } = await openSite(START);
  try {
    await page.click('[data-consent-accept]');
    await page.waitForFunction(() => window.posthog && window.posthog.__loaded === true, null, { timeout: 30000 });
    assert.ok(seen.some((entry) => entry.startsWith('allowed https://t.hagicode.com/static/array.js')), 'the loader is requested after the grant');
  } finally {
    await context.close();
  }
});

await check('withdrawal after a grant stops capture and clears ph_ storage', async () => {
  const { context, page, seen } = await openSite(START);
  try {
    await page.click('[data-consent-accept]');
    await page.waitForFunction(() => window.posthog && window.posthog.__loaded === true, null, { timeout: 30000 });
    await page.evaluate(() => window.posthog.capture('consent_probe_in'));
    await page.waitForTimeout(1000);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('hagilight:consent-preferences')));
    await page.click('[data-consent-reject]');
    await page.waitForTimeout(1000);
    const before = seen.length;
    await page.evaluate(() => window.posthog?.capture?.('consent_probe_out'));
    await page.waitForTimeout(4000);
    const after = seen.slice(before).filter((entry) => entry.startsWith('blocked') && /\/(?:e|i\/v0\/e|batch)\b/u.test(entry));
    assert.deepEqual(after, [], 'no capture request after rejecting');
    // The __ph_opt_in_out_ marker is kept on purpose: it keeps capture off on later loads until a re-grant clears it.
    const leftover = (await providerStorage(page)).filter((key) => key.startsWith('ph_'));
    assert.deepEqual(leftover, [], 'ph_ storage is cleared');
    assert.deepEqual(await providerCookies(context), [], 'ph_ cookies are cleared');
  } finally {
    await context.close();
  }
});

await browser.close();
server.close();
console.log(results.join('\n'));
if (process.exitCode) process.exit(process.exitCode);
