// Request-recording consent check against a built site (no stubs of analytics code). Usage:
//   node test/browser/consent-checks.mjs [distDir] [regionalDistDir]
//     distDir          default: examples/demo-web/dist (a global build)
//     regionalDistDir  default: examples/demo-starlight-web/node_modules/.hagilight-variants/core-footer-regional
//                      (a build made with HAGILIGHT_EXAMPLE_CONSENT_REGIONS=DE,FR,GB)
// Undecided and denied visitors must make no request to a provider host and write no provider storage; a grant loads
// PostHog; a withdrawal after a grant stops capture and clears ph_ storage. Only the PostHog loader script
// (t.hagicode.com/static/array.js) is allowed through; every other provider request is aborted and recorded.
// The regional checks (5.1, 5.2) stub /cdn-cgi/trace on the regional build's origin and run a desktop-looking browser.
// Set HAGILIGHT_CHROMIUM_EXECUTABLE to a Chromium binary when Playwright's bundled browser is not installed.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'examples/demo-web/dist'));
const regionalDir = path.resolve(process.argv[3] ?? path.join(ROOT, 'examples/demo-starlight-web/node_modules/.hagilight-variants/core-footer-regional'));
const START = process.env.CONSENT_START ?? '/en-US/';
const CHROMIUM = process.env.HAGILIGHT_CHROMIUM_EXECUTABLE || undefined;
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
const PROVIDER_HOSTS = ['googletagmanager.com', 'google-analytics.com', 'sdk.51.la', 't.hagicode.com', 'us.posthog.com'];
const ALLOWED_PROVIDER_URL = /^https:\/\/t\.hagicode\.com\/static\/array\.js/u;

function startServer(directory) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://local');
      let file = path.join(directory, decodeURIComponent(url.pathname));
      if (!file.startsWith(directory)) throw new Error('outside dist');
      if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

const { server, base } = await startServer(distDir);
const { server: regionalServer, base: regionalBase } = await startServer(regionalDir);
const browser = await chromium.launch({ executablePath: CHROMIUM });
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
    const detail = await fn();
    results.push(`ok   ${name}${detail ? ` (${detail})` : ''}`);
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

// ---- Regional visitors (tasks 5.1 and 5.2). The regional build reads its regions from the page, so these checks use
// their own build (the second argument). The trace is stubbed on that origin. Every regional visitor has time zone UTC,
// so only the trace can identify a region. The browser looks like a desktop browser, because PostHog drops events from
// bot-looking browsers before any request is made.
const REGIONAL_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const POSTHOG_KEY = 'phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5';
const REMOTE_CONFIG = { token: POSTHOG_KEY, supportedCompression: ['gzip-js'], sessionRecording: { endpoint: '/s/', consoleLogRecordingEnabled: false, recorderVersion: 'v2' }, hasFeatureFlags: false, isAuthenticated: false, siteApps: [], surveys: false, heatmaps: false, toolbarParams: {}, defaultIdentifyEnabled: true };
const REMOTE_CONFIG_JS = `window._POSTHOG_REMOTE_CONFIG = window._POSTHOG_REMOTE_CONFIG || {}; window._POSTHOG_REMOTE_CONFIG[${JSON.stringify(POSTHOG_KEY)}] = { config: ${JSON.stringify(REMOTE_CONFIG)}, siteApps: [] };`;
const PROVIDER_HOST = (hostname) => PROVIDER_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = (promise) => promise.catch(() => {});

async function until(predicate, timeout, what) {
  const deadline = Date.now() + timeout;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error(`timed out after ${timeout} ms waiting for ${what}`);
    await sleep(100);
  }
}

/** A trace that never answers in time: the page gives up after its own timeout. The hold ends when the context closes. */
function holdTrace(context, route) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 8000);
    context.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  }).then(() => settle(route.fulfill({ status: 504, body: '' })));
}

/**
 * Opens the regional build as one visitor. `trace` answers /cdn-cgi/trace: `{ body, delayMs? }`, `'fail'` (a network
 * failure) or `'timeout'`. `storage` seeds hagicode:consent before any page script runs. `replayProbe` lets PostHog's
 * loader and recorder through and answers its capture endpoints (/e/, /s/) with 200, so a recording can be observed.
 * `seen` lists every provider-host request as "METHOD host/path", aborted or not: that is the attempt count.
 */
async function openRegional({ trace, storage, replayProbe = false, sample = false }) {
  const context = await browser.newContext({ userAgent: REGIONAL_UA, timezoneId: 'UTC' });
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
  });
  if (storage) {
    await context.addInitScript(([key, value]) => {
      try {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      } catch {
        // Storage blocked: nothing to seed.
      }
    }, storage);
  }
  if (sample) {
    // Samples the popup's visibility on every animation frame from the first frame of the document.
    await context.addInitScript(() => {
      window.__consentSamples = [];
      const tick = () => {
        const popup = document.querySelector('[data-hagilight-consent]');
        const visible = Boolean(popup) && !popup.hidden && getComputedStyle(popup).display !== 'none';
        window.__consentSamples.push([performance.now(), visible]);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  const seen = [];
  const traceLog = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === regionalBase) {
      if (url.pathname !== '/cdn-cgi/trace') return route.continue();
      const entry = { arrived: seen.length, answered: undefined };
      traceLog.push(entry);
      if (trace === 'fail') return settle(route.abort('failed'));
      if (trace === 'timeout') return holdTrace(context, route);
      if (trace.delayMs) await sleep(trace.delayMs);
      entry.answered = seen.length;
      return settle(route.fulfill({ status: 200, contentType: 'text/plain', body: trace.body }));
    }
    if (!PROVIDER_HOST(url.hostname)) return route.abort();
    seen.push(`${request.method()} ${url.hostname}${url.pathname}`);
    if (replayProbe) {
      if (request.method() === 'OPTIONS') return settle(route.fulfill({ status: 204, headers: CORS }));
      if (url.hostname === 't.hagicode.com' && url.pathname.startsWith('/static/')) return route.continue();
      // The project's remote config enables session recording, so only the consent gate keeps /s/ silent before opt-in.
      if (url.hostname === 't.hagicode.com' && url.pathname.startsWith('/array/') && url.pathname.endsWith('/config.js')) {
        return settle(route.fulfill({ status: 200, headers: CORS, contentType: 'application/javascript', body: REMOTE_CONFIG_JS }));
      }
      if (url.hostname === 't.hagicode.com' && url.pathname.startsWith('/array/') && url.pathname.endsWith('/config')) {
        return settle(route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(REMOTE_CONFIG) }));
      }
      if (url.hostname === 't.hagicode.com' && (url.pathname === '/e/' || url.pathname === '/s/')) {
        return settle(route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{"status":1}' }));
      }
      return route.abort();
    }
    if (ALLOWED_PROVIDER_URL.test(request.url())) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(`${regionalBase}${START}`, { waitUntil: 'load' });
  return { context, page, seen, traceLog };
}

const popupVisible = (page) => page.evaluate(() => {
  const popup = document.querySelector('[data-hagilight-consent]');
  return Boolean(popup) && !popup.hidden && getComputedStyle(popup).display !== 'none';
});
const posthogLoaded = (page) => page.evaluate(() => window.posthog?.__loaded === true);
const recordings = (seen) => seen.filter((entry) => /^\S+ t\.hagicode\.com\/s\/$/u.test(entry)).length;

/** Moves the pointer and changes the DOM, which is what makes PostHog's session recorder send /s/ requests. */
async function generateActivity(page, ms) {
  const end = Date.now() + ms;
  for (let step = 1; Date.now() < end; step += 1) {
    await page.mouse.move(40 + ((step * 97) % 900), 60 + ((step * 61) % 600));
    await page.evaluate((n) => {
      const mark = document.createElement('p');
      mark.dataset.activity = String(n);
      mark.textContent = `activity ${n}`;
      document.body.appendChild(mark);
    }, step);
    await sleep(150);
  }
  await page.evaluate(() => document.querySelectorAll('[data-activity]').forEach((node) => node.remove()));
}

async function visibilitySamples(page) {
  const { samples, paint } = await page.evaluate(() => ({
    samples: window.__consentSamples.slice(),
    paint: performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]),
  }));
  const transitions = [];
  let previous = false;
  for (const [time, visible] of samples) {
    if (visible !== previous) transitions.push({ time: Math.round(time), visible });
    previous = visible;
  }
  const fcp = paint.find(([name]) => name === 'first-contentful-paint')?.[1];
  return { samples, transitions, firstSample: samples[0]?.[0], fcp };
}

await check('pending region (5.1a): no provider request while the trace is in flight', async () => {
  const visitor = await openRegional({ trace: { body: 'loc=US\n', delayMs: 600 } });
  try {
    await until(() => visitor.traceLog.length > 0 && visitor.traceLog[0].answered !== undefined, 10000, 'the delayed trace answer');
    const [entry] = visitor.traceLog;
    assert.equal(entry.arrived, 0, 'no provider request when the trace arrived');
    assert.equal(entry.answered, 0, 'no provider request while the decision was pending');
    await until(() => visitor.seen.length > 0, 20000, 'providers to start after the decision');
    return `attempts while pending 0, after decision ${visitor.seen.length}`;
  } finally {
    await visitor.context.close();
  }
});

await check('regional loc=US (5.1b): providers load without a click, no popup', async () => {
  const visitor = await openRegional({ trace: { body: 'loc=US\n' } });
  try {
    await until(() => visitor.seen.length > 0, 20000, 'a provider request');
    await until(() => posthogLoaded(visitor.page), 30000, 'PostHog to load');
    assert.equal(await popupVisible(visitor.page), false, 'no popup for a not-required visitor');
    assert.ok(visitor.seen.includes('GET t.hagicode.com/static/array.js'), 'the PostHog loader is requested without a click');
    return `attempts ${visitor.seen.length}, PostHog loaded, popup hidden`;
  } finally {
    await visitor.context.close();
  }
});

await check('regional loc=DE (5.1c): no provider before Accept, providers after Accept', async () => {
  const visitor = await openRegional({ trace: { body: 'loc=DE\n' } });
  try {
    await until(() => popupVisible(visitor.page), 10000, 'the popup');
    await sleep(2000);
    assert.equal(visitor.seen.length, 0, 'no provider request before Accept');
    await visitor.page.click('[data-consent-accept]');
    await until(() => visitor.seen.length > 0, 20000, 'a provider request after Accept');
    await until(() => posthogLoaded(visitor.page), 30000, 'PostHog to load after Accept');
    return `popup visible, attempts before Accept 0, after Accept ${visitor.seen.length}`;
  } finally {
    await visitor.context.close();
  }
});

await check('regional loc=US with a stored denied record (5.1d): zero provider attempts', async () => {
  const now = Math.floor(Date.now() / 1000);
  const visitor = await openRegional({ trace: { body: 'loc=US\n' }, storage: ['hagicode:consent', `1|denied|${now}|1`] });
  try {
    await sleep(3000);
    assert.equal(visitor.seen.length, 0, 'no provider attempt for a denied visitor');
    assert.equal(await posthogLoaded(visitor.page), false, 'PostHog is not loaded');
    assert.equal(await popupVisible(visitor.page), false, 'a decided visitor sees no popup');
    return `attempts 0, trace requests ${visitor.traceLog.length}`;
  } finally {
    await visitor.context.close();
  }
});

for (const [label, trace] of [
  ['trace loc=XX', { body: 'loc=XX\n' }],
  ['failed trace', 'fail'],
  ['trace timeout', 'timeout'],
]) {
  await check(`unidentified region (5.1e), ${label}, time zone UTC: popup shown, no provider until Accept`, async () => {
    const visitor = await openRegional({ trace });
    try {
      await until(() => popupVisible(visitor.page), 10000, 'the popup');
      await sleep(1500);
      const before = visitor.seen.length;
      assert.equal(before, 0, 'no provider attempt before Accept');
      await visitor.page.click('[data-consent-accept]');
      await until(() => visitor.seen.length > 0, 20000, 'a provider request after Accept');
      return `popup shown, attempts before Accept ${before}, after Accept ${visitor.seen.length}`;
    } finally {
      await visitor.context.close();
    }
  });
}

await check('no-flash (5.2a) on a delayed trace (600 ms): required shows once, notRequired never', async () => {
  const required = await openRegional({ trace: { body: 'loc=DE\n', delayMs: 600 }, sample: true });
  let requiredSummary;
  try {
    await until(() => popupVisible(required.page), 10000, 'the popup for a required visitor');
    await sleep(500);
    requiredSummary = await visibilitySamples(required.page);
  } finally {
    await required.context.close();
  }
  const shownAt = requiredSummary.transitions.filter((t) => t.visible).map((t) => t.time);
  const hiddenAt = requiredSummary.transitions.filter((t) => !t.visible);
  assert.equal(shownAt.length, 1, `required: popup became visible ${shownAt.length} times (expected exactly once)`);
  assert.equal(hiddenAt.length, 0, 'required: popup was hidden again after it showed');
  assert.ok(shownAt[0] >= 600, `required: popup visible at ${shownAt[0]} ms, before the 600 ms trace could answer`);
  assert.ok(requiredSummary.fcp === undefined || requiredSummary.firstSample <= requiredSummary.fcp + 20,
    `required: sampling started at ${requiredSummary.firstSample} ms, after first contentful paint at ${requiredSummary.fcp} ms`);

  const notRequired = await openRegional({ trace: { body: 'loc=US\n', delayMs: 600 }, sample: true });
  let notRequiredSummary;
  try {
    await until(() => notRequired.seen.length > 0, 20000, 'the providers to start for a not-required visitor');
    await sleep(500);
    notRequiredSummary = await visibilitySamples(notRequired.page);
  } finally {
    await notRequired.context.close();
  }
  const visibleSamples = notRequiredSummary.samples.filter(([, visible]) => visible).length;
  assert.equal(visibleSamples, 0, `notRequired: popup visible in ${visibleSamples} samples`);
  const lastSample = notRequiredSummary.samples.at(-1)[0];
  assert.ok(lastSample > 600, `notRequired: sampling only reached ${lastSample} ms`);
  return `required: ${requiredSummary.samples.length} samples, shown once at ${shownAt[0]} ms, first sample ${Math.round(requiredSummary.firstSample)} ms, FCP ${requiredSummary.fcp === undefined ? 'n/a' : Math.round(requiredSummary.fcp)} ms; notRequired: ${notRequiredSummary.samples.length} samples, 0 visible`;
});

await check('replay (5.2b): no recording request before opt-in; recording after Replay entry and Allow', async () => {
  const visitor = await openRegional({ trace: { body: 'loc=US\n' }, replayProbe: true });
  const { page } = visitor;
  try {
    await until(() => posthogLoaded(page), 30000, 'PostHog to load');
    await until(() => visitor.seen.some((entry) => /\/array\/[^/]+\/config\.js$/u.test(entry.split(' ')[1] ?? '')), 15000, 'the remote config');
    await generateActivity(page, 6000);
    const before = recordings(visitor.seen);
    assert.equal(before, 0, 'no /s/ request before the opt-in');

    const entry = page.locator('[data-consent-entry="replay"]');
    assert.equal(await entry.isVisible(), true, 'the footer Replay entry is shown to a not-required visitor');
    await entry.click();
    await page.locator('[data-hagilight-consent-replay]:not([hidden])').waitFor({ timeout: 10000 });
    await page.click('[data-consent-replay-allow]');
    const stored = await page.evaluate(() => localStorage.getItem('hagicode:consent'));
    assert.equal(stored?.split('|')[1], 'granted', 'Allow stores a grant');

    const deadline = Date.now() + 40000;
    while (recordings(visitor.seen) === 0 && Date.now() < deadline) await generateActivity(page, 1000);
    const after = recordings(visitor.seen);
    assert.ok(after > 0, 'a /s/ recording request follows the opt-in');
    return `/s/ before opt-in ${before}, after opt-in ${after}`;
  } finally {
    await visitor.context.close();
  }
});

await browser.close();
server.close();
regionalServer.close();
console.log(results.join('\n'));
if (process.exitCode) process.exit(process.exitCode);
