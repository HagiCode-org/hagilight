// Layout check for the consent popup and the footer's consent entries on a built site, at 320, 360, 390, 768, 1024, 1280 and
// 1920 px. Usage:
//   node test/browser/consent-layout.mjs [distDir] [startPath]
// A required visitor (trace loc=DE) sees the popup: it does not overlap the PromotoBanner, nothing covers its buttons, it
// stays inside the viewport, and every visible footer link can be scrolled clear of it. On a regional build the settings
// entry is shown to that visitor.
// On a regional build a not-required visitor (trace loc=US) gets the settings entry hidden by default, the Replay entry
// shown, and the replay panel opens clear of the banner with reachable buttons and footer links that clear it.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'examples/demo-starlight-web/dist'));
const startPath = process.argv[3] ?? '/';
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright');
const CHROMIUM = process.env.HAGILIGHT_CHROMIUM_EXECUTABLE || undefined;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const WIDTHS = [320, 360, 390, 768, 1024, 1280, 1920];

const server = http.createServer(async (request, response) => {
  try {
    let file = path.join(distDir, decodeURIComponent(new URL(request.url, 'http://x').pathname));
    if (!file.startsWith(distDir)) throw new Error('outside');
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
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
const browser = await chromium.launch({ executablePath: CHROMIUM });
const results = [];
let failed = false;

/** One visitor at one width. `trace` is the body /cdn-cgi/trace answers, which decides the region. */
async function openVisitor(width, trace) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, timezoneId: 'UTC' });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(`${base}/cdn-cgi/trace`)) return route.fulfill({ status: 200, contentType: 'text/plain', body: trace });
    if (url.startsWith(base) || url.includes('t.hagicode.com/static/array.js')) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(`${base}${startPath}`, { waitUntil: 'load' });
  return { context, page };
}

/** Footer links that are visible and overlap the popup, measured after the page is scrolled to its end. */
async function footerLinksCoveredByPanel(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const panel = document.querySelector('[data-hagilight-consent]').getBoundingClientRect();
    const links = [...document.querySelectorAll('footer a[href], footer button[data-consent-preferences]')].filter((el) => el.offsetParent !== null);
    return links
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return !(r.bottom <= panel.top + 1 || r.top >= panel.bottom - 1 || r.right <= panel.left || r.left >= panel.right);
      })
      .map((el) => el.textContent.trim());
  });
}

/** Waits until the popup's entrance animations have finished, so the geometry is the settled layout. */
async function settled(page) {
  // The promotion banner stays hidden at the top of the page, so scroll into the page and measure it shown.
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForFunction(() => {
    const shell = document.querySelector('.hagilight-promoto__shell');
    if (!shell) return true;
    const style = getComputedStyle(shell);
    return style.visibility === 'visible' && Number(style.opacity) > 0.99;
  }, null, { timeout: 5000 }).catch(() => {});
  // The banner rises into place over 0.62 s; wait for that before the geometry is read.
  await page.waitForTimeout(800);
  return page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'
    || !animation.effect?.target?.closest?.('[data-hagilight-consent]')), null, { timeout: 5000 });
}

/** Every problem found for one visitor at one width, so one failing width reports all of them. */
async function checkRequired(page) {
  await page.waitForSelector('[data-hagilight-consent]:not([hidden])', { timeout: 10000 });
  await settled(page);
  const geometry = await page.evaluate(() => {
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const popup = rect(document.querySelector('[data-hagilight-consent]'));
    const banner = [...document.querySelectorAll('.hagilight-promoto__shell')].find((el) => !el.hidden && getComputedStyle(el).display !== 'none'
      && getComputedStyle(el).visibility === 'visible' && Number(getComputedStyle(el).opacity) > 0.99);
    const bannerRect = rect(banner);
    const overlap = (a, b) => Boolean(a && b) && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const btn = document.querySelector('[data-consent-accept]');
    const b = btn.getBoundingClientRect();
    const topAtButton = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    const settings = document.querySelector('[data-consent-entry="settings"]');
    return {
      popupVisible: Boolean(popup) && popup.width > 0,
      bannerPresent: Boolean(bannerRect),
      bannerOverlaps: overlap(popup, bannerRect),
      bannerHidden: Boolean(document.querySelector('.hagilight-promoto__shell')) && !bannerRect,
      bannerGap: bannerRect && popup ? Math.round((popup.top - bannerRect.bottom) * 10) / 10 : null,
      buttonCovered: !(topAtButton && btn.contains(topAtButton)),
      coveredBy: topAtButton ? `${topAtButton.tagName.toLowerCase()}.${String(topAtButton.className).slice(0, 60)}` : 'nothing at the button centre',
      inViewport: popup.left >= 0 && popup.right <= window.innerWidth + 0.5,
      settingsShown: settings ? !settings.hidden : null,
    };
  });
  const problems = [];
  if (!geometry.popupVisible) problems.push('the popup is not shown');
  if (geometry.bannerHidden) problems.push('the promotion banner is not shown, so its clearance cannot be checked');
  if (geometry.bannerOverlaps) problems.push(`the popup overlaps the banner by ${-geometry.bannerGap} px`);
  if (geometry.buttonCovered) problems.push(`${geometry.coveredBy} covers the popup buttons`);
  if (!geometry.inViewport) problems.push('the popup exceeds the viewport width');
  if (geometry.settingsShown === false) problems.push('the settings entry is hidden for a required visitor');
  const covered = await footerLinksCoveredByPanel(page);
  if (covered.length > 0) problems.push(`footer links covered by the popup at the page end: ${covered.join(', ')}`);
  return problems;
}

async function checkNotRequired(page) {
  await page.waitForFunction(() => {
    const replay = document.querySelector('[data-consent-entry="replay"]');
    return Boolean(replay) && !replay.hidden;
  }, null, { timeout: 10000 });
  const problems = [];
  const settings = await page.evaluate(() => {
    const el = document.querySelector('[data-consent-entry="settings"]');
    return el ? { hidden: el.hidden, display: getComputedStyle(el).display } : null;
  });
  if (!settings) problems.push('the regional build has no settings entry');
  else if (!settings.hidden || settings.display !== 'none') problems.push('the settings entry is shown to a not-required visitor');
  if (await page.locator('[data-hagilight-consent]').isVisible()) problems.push('the popup is shown to a not-required visitor');

  await page.locator('[data-consent-entry="replay"]').click();
  await page.waitForSelector('[data-hagilight-consent-replay]:not([hidden])', { timeout: 10000 });
  await settled(page);
  const geometry = await page.evaluate(() => {
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const panel = rect(document.querySelector('[data-hagilight-consent]'));
    const banner = [...document.querySelectorAll('.hagilight-promoto__shell')].find((el) => !el.hidden && getComputedStyle(el).display !== 'none'
      && getComputedStyle(el).visibility === 'visible' && Number(getComputedStyle(el).opacity) > 0.99);
    const bannerRect = rect(banner);
    const overlap = (a, b) => Boolean(a && b) && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const buttons = [...document.querySelectorAll('[data-consent-replay-allow], [data-consent-replay-decline]')];
    const uncovered = buttons.filter((btn) => {
      const b = btn.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !(top && btn.contains(top)) || b.width === 0;
    }).map((btn) => btn.textContent.trim());
    return {
      panelVisible: Boolean(panel) && panel.width > 0,
      bannerOverlaps: overlap(panel, bannerRect),
      bannerHidden: Boolean(document.querySelector('.hagilight-promoto__shell')) && !bannerRect,
      bannerGap: bannerRect && panel ? Math.round((panel.top - bannerRect.bottom) * 10) / 10 : null,
      uncovered,
      inViewport: panel.left >= 0 && panel.right <= window.innerWidth + 0.5,
      buttons: buttons.length,
    };
  });
  if (!geometry.panelVisible) problems.push('the replay panel is not shown');
  if (geometry.buttons !== 2) problems.push(`the replay panel has ${geometry.buttons} buttons, expected 2`);
  if (geometry.uncovered.length > 0) problems.push(`something covers the replay buttons: ${geometry.uncovered.join(', ')}`);
  if (geometry.bannerHidden) problems.push('the promotion banner is not shown, so its clearance cannot be checked');
  if (geometry.bannerOverlaps) problems.push(`the replay panel overlaps the banner by ${-geometry.bannerGap} px`);
  if (!geometry.inViewport) problems.push('the replay panel exceeds the viewport width');
  const covered = await footerLinksCoveredByPanel(page);
  if (covered.length > 0) problems.push(`footer links covered by the replay panel at the page end: ${covered.join(', ')}`);
  return problems;
}

for (const width of WIDTHS) {
  const label = `${width}px`;
  const required = await openVisitor(width, 'loc=DE\n');
  try {
    const problems = await checkRequired(required.page);
    if (problems.length === 0) results.push(`ok   ${label} required: popup clear of banner, buttons and footer; settings entry shown`);
    else {
      failed = true;
      results.push(`FAIL ${label} required: ${problems.join('; ')}`);
    }
  } catch (error) {
    failed = true;
    results.push(`FAIL ${label} required: ${error.message.split('\n')[0]}`);
  } finally {
    await required.context.close();
  }

  const notRequired = await openVisitor(width, 'loc=US\n');
  try {
    // Only a regional build renders the Replay entry, so a global build has nothing to check here.
    const hasReplay = await notRequired.page.evaluate(() => Boolean(document.querySelector('[data-consent-entry="replay"]')));
    if (hasReplay) {
      const problems = await checkNotRequired(notRequired.page);
      if (problems.length === 0) results.push(`ok   ${label} not required: settings entry hidden; replay panel clear of banner, buttons and footer`);
      else {
        failed = true;
        results.push(`FAIL ${label} not required: ${problems.join('; ')}`);
      }
    }
  } catch (error) {
    failed = true;
    results.push(`FAIL ${label} not required: ${error.message.split('\n')[0]}`);
  } finally {
    await notRequired.context.close();
  }
}

await browser.close();
server.close();
console.log(results.join('\n'));
if (failed) process.exitCode = 1;
