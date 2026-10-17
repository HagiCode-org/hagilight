import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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

async function newPage(browser, options = {}) {
  const context = await browser.newContext({ colorScheme: 'dark', ...options });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/u, (route) => route.abort());
  const page = await context.newPage();
  if (options.javaScriptEnabled !== false) {
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
