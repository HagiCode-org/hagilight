import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import { ROOT_TRANSIT_DELAY_MS } from '@hagicode/hagilight-core/root-transit';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = join(root, 'test/fixtures/root-transit');
const astro = join(root, 'node_modules/astro/bin/astro.mjs');
const artifacts = process.env.HAGILIGHT_ARTIFACT_DIR ?? '/tmp/hagilight-root-transit';
const servers = [];
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon' };

function build(directory, env = {}) {
  execFileSync(process.execPath, [astro, 'build', '--root', directory], {
    cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', ...env }, stdio: 'pipe',
  });
}

async function serve(directory, base = '/') {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith(base)) return res.writeHead(404).end();
    const file = resolve(directory, `.${path.slice(base.length - 1)}${path.endsWith('/') ? 'index.html' : ''}`);
    if (!file.startsWith(`${resolve(directory)}${sep}`)) return res.writeHead(403).end();
    try {
      const content = await readFile(file);
      res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' }).end(content);
    }
    catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}${base}`;
}

async function newPage(browser, { clock = true, ...options } = {}) {
  const context = await browser.newContext({ colorScheme: 'dark', ...options });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  const page = await context.newPage();
  if (options.javaScriptEnabled !== false && clock) {
    const time = new Date('2026-10-16T00:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
  }
  return page;
}

async function assertReadable(page, viewport) {
  assert.equal(await page.locator('h1').count(), 1);
  assert.ok(await page.locator('h1').isVisible());
  assert.ok(await page.locator('.brand img').evaluate((img) => img.complete && img.naturalWidth > 0));
  const link = page.locator('[data-transit-continue]');
  assert.ok(await link.isVisible());
  const box = await link.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1);
  assert.ok(box.y >= 0 && box.y + box.height <= viewport.height + 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const selector of ['.headline', '.status', '.chip-label', '.chip-filled']) {
    const ratio = await page.locator(selector).evaluate((element) => {
      const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number).map((n) => n / 255);
      const luminance = (color) => rgb(color).map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
      const style = getComputedStyle(element);
      const bg = element.classList.contains('chip-filled') ? getComputedStyle(document.documentElement).getPropertyValue('--accent') : getComputedStyle(document.body).backgroundColor;
      const probe = document.createElement('span');
      probe.style.color = bg;
      document.body.append(probe);
      const a = luminance(style.color), b = luminance(getComputedStyle(probe).color);
      probe.remove();
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    assert.ok(ratio >= (selector === '.headline' ? 3 : 4.5), `${selector} contrast ${ratio}`);
  }
}

async function freezePresentation(page, elapsed = 1570) {
  await page.evaluate((time) => {
    for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = time; }
  }, elapsed);
}

async function appearance(browser, url, label) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 320, height: 740 }]) {
    for (const colorScheme of ['dark', 'light']) {
      const page = await newPage(browser, { viewport, colorScheme });
      await page.goto(url);
      await freezePresentation(page);
      await assertReadable(page, viewport);
      await page.keyboard.press('Tab');
      const outline = await page.locator('[data-transit-continue]').evaluate((a) => getComputedStyle(a).outlineStyle);
      assert.equal(outline, 'solid');
      await page.screenshot({ path: join(artifacts, `${label}-${viewport.width}-${colorScheme}.png`) });
      await page.context().close();
    }
  }
  for (const mode of ['no-script', 'failed-script', 'reduced-motion', 'failed-effects']) {
    const page = await newPage(browser, { viewport: { width: 375, height: 812 }, javaScriptEnabled: mode !== 'no-script', reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
    if (mode === 'failed-script') await page.route(url, async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "script-src 'none'" } });
    });
    if (mode === 'failed-effects') await page.route('**/*.png', (route) => route.abort());
    await page.goto(url);
    if (mode === 'reduced-motion' || mode === 'failed-effects') {
      if (mode === 'reduced-motion') assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      else await page.addStyleTag({ content: '* { animation: none !important; }' });
      await page.clock.runFor(1570);
      await page.waitForURL('**/en-US/');
      assert.ok(page.url().includes('/en-US/'));
    } else {
      await assertReadable(page, { width: 375, height: 812 });
      await page.locator('[data-transit-continue]').click();
      await page.waitForURL('**/en-US/');
    }
    await page.context().close();
  }
}

async function routing(browser, url, base) {
  const page = await newPage(browser);
  await page.goto(`${url}before/`);
  await page.getByRole('link', { name: 'Open root' }).click();
  await page.waitForURL(url);
  await page.clock.runFor(1569);
  assert.equal(page.url(), url);
  await page.clock.runFor(1);
  await page.waitForURL(`${url}en-US/`);
  assert.equal(await page.locator('h1').textContent(), 'Landing content');
  await page.goBack();
  assert.equal(page.url(), `${url}before/`);

  await page.goto(`${url}?lang=zh-CN&next=https://other.example#deep`);
  const target = `${base}en-US/?lang=zh-CN&next=https://other.example#deep`;
  assert.equal(await page.locator('[data-transit-continue]').getAttribute('href'), target);
  await page.locator('[data-transit-continue]').click();
  await page.waitForURL(`${url}en-US/?lang=zh-CN&next=https://other.example#deep`);

  await page.goto(url);
  await page.evaluate(() => document.dispatchEvent(new Event('astro:before-swap')));
  await page.clock.runFor(2000);
  assert.equal(page.url(), url);
  await page.context().close();
}

async function compareReference(browser, reference, consumers) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    const ref = await newPage(browser, { viewport });
    await ref.goto(reference);
    const styles = (page) => page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const route = getComputedStyle(document.querySelector('.route'));
      const root = getComputedStyle(document.documentElement);
      return { background: body.backgroundColor, color: body.color, font: body.fontFamily, routeSize: route.fontSize, routeWeight: route.fontWeight, accent: root.getPropertyValue('--accent').trim(), beam: getComputedStyle(document.querySelector('.run-beam')).backgroundImage };
    });
    const expected = await styles(ref);
    for (const [name, url] of consumers) {
      const page = await newPage(browser, { viewport });
      await page.goto(url);
      assert.deepEqual(await styles(page), expected, `${name} reference typography/colors/beam @ ${viewport.width}`);
      for (const elapsed of [625, 1250]) {
        await freezePresentation(ref, elapsed);
        await freezePresentation(page, elapsed);
        await ref.screenshot({ path: join(artifacts, `reference-${viewport.width}-${elapsed}.png`) });
        await page.screenshot({ path: join(artifacts, `${name}-${viewport.width}-${elapsed}.png`) });
      }
      await page.context().close();
    }
    await ref.context().close();
  }
}

// ── Splash image (task 3.3 to 3.5). The image host is routed; the AVIF is replaced by a generated bright PNG.
const IMAGE_HOST = 'https://img-gen.hagicode.com';
const IMAGE_ROUTE = `${IMAGE_HOST}/**`;
const CACHE_NAME = 'hagilight.rootTransit.splash';
const BRIGHT = [255, 250, 230];
const TOLERANCE_MS = 250;
const desktop = { width: 1440, height: 900 };
const phone = { width: 375, height: 812 };

function solidPng(width, height, [red, green, blue]) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) row.set([red, green, blue], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const bright = solidPng(1232, 704, BRIGHT);
const serveBright = (route) => route.fulfill({
  status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: bright,
});
const hang = () => new Promise(() => {});

/** Records every request to the image host; `respond` decides what each one gets. */
async function imageHost(page, respond) {
  const hits = [];
  await page.route(IMAGE_ROUTE, async (route) => {
    hits.push(route.request().url());
    await respond(route);
  });
  return hits;
}

async function splashImageShown(browser, url) {
  for (const viewport of [desktop, phone]) {
    const page = await newPage(browser, { viewport });
    const hits = await imageHost(page, serveBright);
    await page.goto(url);
    assert.equal(hits.length, 0, 'nothing is requested before the forward timer exists');
    await page.clock.runFor(1);
    await page.waitForFunction(() => document.querySelector('[data-splash]')?.dataset.state === 'shown');
    assert.equal(hits.length, 1);
    await freezePresentation(page);
    const figure = await page.locator('[data-splash]').evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { opacity: getComputedStyle(element).opacity, width: box.width, height: box.height, natural: element.querySelector('img').naturalWidth };
    });
    assert.equal(figure.opacity, '1');
    assert.equal(figure.width, viewport.width);
    assert.equal(figure.height, viewport.height);
    assert.ok(figure.natural > 0);
    await assertReadable(page, viewport);
    await page.screenshot({ path: join(artifacts, `splash-shown-${viewport.width}.png`) });
    await page.context().close();
  }
}

async function splashRetry(browser, url) {
  const page = await newPage(browser, { viewport: desktop });
  let attempts = 0;
  const hits = await imageHost(page, (route) => {
    attempts += 1;
    return attempts === 1 ? route.abort() : serveBright(route);
  });
  await page.goto(url);
  await page.clock.runFor(1);
  await page.waitForFunction(() => document.querySelector('[data-splash]')?.dataset.state === 'shown');
  assert.equal(hits.length, 2);
  assert.notEqual(hits[0], hits[1], 'the retry asks for another key');
  await page.context().close();
}

async function splashFailure(browser, url) {
  const page = await newPage(browser, { viewport: phone });
  const hits = await imageHost(page, (route) => route.abort());
  await page.goto(url);
  await page.clock.runFor(1);
  await page.waitForFunction(() => !document.querySelector('[data-splash]'));
  assert.equal(hits.length, 2);
  await assertReadable(page, phone);
  await page.context().close();
}

/** Cache lookups are real-time, so a request issued after the mount may arrive a few milliseconds later. */
async function until(predicate, timeout = 5000) {
  const started = Date.now();
  while (!(await predicate())) {
    if (Date.now() - started > timeout) throw new Error('timed out waiting for the splash request');
    await new Promise((done) => setTimeout(done, 20));
  }
}

async function splashHung(browser, minimal) {
  const page = await newPage(browser, { viewport: phone });
  const hits = await imageHost(page, hang);
  await page.goto(minimal);
  await page.clock.runFor(1);
  await until(() => hits.length === 1);
  await page.clock.runFor(ROOT_TRANSIT_DELAY_MS - 2);
  assert.equal(page.url(), minimal);
  await page.clock.runFor(1);
  await page.waitForURL(`${minimal}en-US/`);
  await page.context().close();
}

async function splashContinue(browser, minimal) {
  const page = await newPage(browser, { viewport: phone });
  await imageHost(page, hang);
  await page.goto(minimal);
  await page.clock.runFor(1);
  await page.locator('[data-transit-continue]').click();
  await page.waitForURL(`${minimal}en-US/`);
  await page.context().close();
}

async function splashOptOut(browser, minimal) {
  const page = await newPage(browser, { viewport: phone });
  const hits = await imageHost(page, serveBright);
  await page.goto(`${minimal}no-splash/`);
  await page.clock.runFor(1);
  assert.equal(await page.locator('[data-splash]').count(), 0);
  await page.clock.runFor(ROOT_TRANSIT_DELAY_MS);
  await page.waitForURL(`${minimal}en-US/`);
  assert.deepEqual(hits, []);
  await page.context().close();
}

async function splashNoScript(browser, demo) {
  const page = await newPage(browser, { viewport: phone, javaScriptEnabled: false });
  const hits = await imageHost(page, serveBright);
  await page.goto(demo);
  assert.equal(await page.locator('[data-splash] img').getAttribute('src'), null);
  assert.equal(await page.locator('[data-splash]').evaluate((element) => getComputedStyle(element).opacity), '0');
  await new Promise((done) => setTimeout(done, 500));
  assert.deepEqual(hits, []);
  await page.context().close();
}

async function splashReducedMotion(browser, demo) {
  const page = await newPage(browser, { viewport: phone, reducedMotion: 'reduce' });
  await imageHost(page, serveBright);
  await page.goto(demo);
  await page.clock.runFor(1);
  await page.waitForFunction(() => document.querySelector('[data-splash]')?.dataset.state === 'shown');
  const figure = await page.locator('[data-splash]').evaluate((element) => ({
    transition: getComputedStyle(element).transitionDuration,
    animations: element.getAnimations().length,
    opacity: getComputedStyle(element).opacity,
  }));
  assert.deepEqual(figure, { transition: '0s', animations: 0, opacity: '1' });
  await page.context().close();
}

async function splashContrast(browser, demo) {
  for (const viewport of [phone, desktop]) {
    for (const colorScheme of ['dark', 'light']) {
      const page = await newPage(browser, { viewport, colorScheme });
      await imageHost(page, serveBright);
      await page.goto(demo);
      await page.clock.runFor(1);
      await page.waitForFunction(() => document.querySelector('[data-splash]')?.dataset.state === 'shown');
      await freezePresentation(page);
      const ratios = await page.evaluate((image) => {
        const parse = (value) => value.match(/[\d.]+/gu).slice(0, 3).map(Number);
        const luminance = (rgb) => rgb
          .map((n) => (n / 255 <= 0.04045 ? n / 255 / 12.92 : ((n / 255 + 0.055) / 1.055) ** 2.4))
          .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a, b) => {
          const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
          return (hi + 0.05) / (lo + 0.05);
        };
        // The scrim (a share of the page background) is laid over the splash image, so text sits on that blend.
        const alpha = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--splash-scrim')) / 100;
        const page = parse(getComputedStyle(document.body).backgroundColor);
        const backdrop = page.map((channel, i) => alpha * channel + (1 - alpha) * image[i]);
        const text = (selector) => [...document.querySelectorAll(selector)].map((element) => ratio(parse(getComputedStyle(element).color), backdrop));
        return { headline: Math.min(...text('.headline')), status: Math.min(...text('.status')), trace: Math.min(...text('.trace-value')) };
      }, BRIGHT);
      for (const [selector, value] of Object.entries(ratios)) {
        assert.ok(value >= 4.5, `${viewport.width}px ${colorScheme} ${selector} contrast ${value}`);
      }
      await page.context().close();
    }
  }
}

const layout = (page) => page.evaluate(() => [...document.querySelectorAll('.headline, .trace-row, .locales a')].map((element) => {
  const box = element.getBoundingClientRect();
  return [box.x, box.y, box.width, box.height].map((value) => Math.round(value * 100) / 100);
}));

async function pageFlow(browser, minimal) {
  const runs = [
    ['no splash', `${minimal}no-splash/`, null],
    ['image loads', minimal, serveBright],
    ['image fails', minimal, (route) => route.abort()],
    ['image hangs', minimal, hang],
  ];
  for (const viewport of [phone, desktop]) {
    const results = [];
    for (const [name, url, respond] of runs) {
      const page = await newPage(browser, { viewport });
      const hits = respond ? await imageHost(page, respond) : [];
      await page.goto(url);
      const samples = [];
      await freezePresentation(page, 1250);
      samples.push(await layout(page));
      await page.clock.runFor(1);
      if (respond && name !== 'image hangs') {
        await page.waitForFunction(() => { const figure = document.querySelector('[data-splash]'); return !figure || figure.dataset.state === 'shown'; });
      }
      await freezePresentation(page, 1250);
      samples.push(await layout(page));
      await page.clock.runFor(1000);
      await freezePresentation(page, 1250);
      samples.push(await layout(page));
      if (respond && name === 'image hangs') assert.equal(hits.length, 1);
      results.push([name, samples]);
      await page.context().close();
    }
    const [, expected] = results[0];
    for (const [name, samples] of results) assert.deepEqual(samples, expected, `${name} keeps the heading, trace and links in place at ${viewport.width}px`);
  }
}

async function splashTimings(browser, minimal) {
  const measure = async (url, respond) => {
    const page = await newPage(browser, { viewport: phone, clock: false });
    await page.addInitScript(() => {
      window.__timing = {};
      new PerformanceObserver((list) => {
        for (const entry of list.getEntriesByName('first-contentful-paint')) window.__timing.paint ??= entry.startTime;
      }).observe({ type: 'paint', buffered: true });
      document.addEventListener('animationstart', (event) => {
        if (event.animationName === 'routeRun') window.__timing.sweep ??= performance.now();
      }, true);
    });
    if (respond) await imageHost(page, respond);
    // A hung image request keeps the load event open, so the page is read once the parser is done.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__timing.sweep !== undefined && window.__timing.paint !== undefined);
    const timing = await page.evaluate(() => window.__timing);
    await page.context().close();
    return timing;
  };
  const baseline = await measure(`${minimal}no-splash/`, null);
  for (const [name, respond] of [['image loads', serveBright], ['image fails', (route) => route.abort()], ['image hangs', hang]]) {
    const timing = await measure(minimal, respond);
    assert.ok(timing.paint <= baseline.paint + TOLERANCE_MS, `${name}: heading paints no later than without a splash (${timing.paint} vs ${baseline.paint})`);
    assert.ok(timing.sweep <= baseline.sweep + TOLERANCE_MS, `${name}: sweep starts no later than without a splash (${timing.sweep} vs ${baseline.sweep})`);
  }
}

async function splashCache(browser, minimal) {
  const page = await newPage(browser, { viewport: desktop });
  await page.addInitScript(() => { Math.random = () => 0; });
  const hits = await imageHost(page, serveBright);
  await page.goto(minimal);
  await page.clock.runFor(1);
  await page.waitForFunction(() => document.querySelector('[data-splash]')?.dataset.state === 'shown');
  const url = `${IMAGE_HOST}/startup-splash/hagicode-splash-001.avif`;
  const stored = () => page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((request) => request.url), CACHE_NAME);
  // The store waits for idle time, bounded by its 1,000 ms timeout, and then downloads the image. Playwright routes
  // that download too, so the first load sees the display request and the store request, both for this key.
  await page.clock.runFor(1000);
  await until(async () => (await stored()).length > 0);
  assert.deepEqual(await stored(), [url]);
  assert.ok(hits.length >= 1 && hits.every((hit) => hit === url), `only the chosen key is requested: ${hits}`);

  await page.unroute(IMAGE_ROUTE);
  const blocked = await imageHost(page, (route) => route.abort());
  await page.goto(minimal);
  await page.clock.runFor(1);
  await page.waitForFunction(() => document.querySelector('[data-splash]')?.dataset.state === 'shown');
  assert.equal(blocked.length, 0, 'the second load reads the image from the cache');
  assert.match(await page.locator('[data-splash] img').getAttribute('src'), /^blob:/u);
  await page.context().close();
}

async function splashChecks(browser, demo, minimal) {
  await splashImageShown(browser, demo);
  await splashRetry(browser, demo);
  await splashFailure(browser, demo);
  await splashHung(browser, minimal);
  await splashContinue(browser, minimal);
  await splashOptOut(browser, minimal);
  await splashNoScript(browser, demo);
  await splashReducedMotion(browser, demo);
  await splashContrast(browser, demo);
  await pageFlow(browser, minimal);
  await splashTimings(browser, minimal);
  await splashCache(browser, minimal);
}

await mkdir(artifacts, { recursive: true });
build(join(root, 'examples/demo-web'), { HAGILIGHT_DEMO_BASE: '/' });
build(fixture, { HAGILIGHT_TRANSIT_BASE: '/' });
const browser = await chromium.launch({ headless: true });
try {
  const demo = await serve(join(root, 'examples/demo-web/dist'));
  const minimal = await serve(join(fixture, 'dist'));
  await appearance(browser, demo, 'hagilight');
  await appearance(browser, minimal, 'minimal');
  await routing(browser, minimal, '/');
  await splashChecks(browser, demo, minimal);
  const deep = await newPage(browser);
  await deep.goto(`${demo}zh-CN/`);
  assert.equal(await deep.locator('[data-root-transit]').count(), 0);
  assert.equal(await deep.locator('html').getAttribute('lang'), 'zh-CN');
  await deep.context().close();
  const selection = await newPage(browser, { locale: 'zh-CN' });
  await selection.goto(`${demo}en-US/`);
  await selection.goto(`${demo}?utm=test#features`);
  assert.equal(await selection.locator('[data-transit-continue]').getAttribute('href'), '/en-US/?utm=test#features');
  await selection.locator('[data-transit-alternative]').click();
  await selection.waitForURL(`${demo}zh-CN/?utm=test#features`);
  assert.equal(await selection.locator('html').getAttribute('lang'), 'zh-CN');
  await selection.goBack();
  assert.equal(selection.url(), `${demo}en-US/`);
  await selection.context().close();
  if (process.env.HAGILIGHT_TRANSIT_REFERENCE_DIR) {
    const reference = await serve(process.env.HAGILIGHT_TRANSIT_REFERENCE_DIR);
    await compareReference(browser, reference, [['hagilight', demo], ['minimal', minimal]]);
  }
  build(fixture, { HAGILIGHT_TRANSIT_BASE: '/manual/' });
  const based = await serve(join(fixture, 'dist'), '/manual/');
  await appearance(browser, based, 'based');
  await routing(browser, based, '/manual/');
  console.log(`Root transit browser checks passed. Screenshots: ${artifacts}`);
} finally {
  await browser.close();
  await Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
}
