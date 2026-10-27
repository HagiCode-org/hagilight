// Layout check for the consent popup on a built site, at 320, 390, 768, 1280 and 1920 px. Usage:
//   node test/browser/consent-layout.mjs [distDir] [startPath]
// With the popup visible: it does not overlap the PromotoBanner; the page's last footer link can be scrolled clear of it;
// and the popup is on top at its own button (nothing from the page covers it).
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const WIDTHS = [320, 390, 768, 1280, 1920];

const server = http.createServer(async (request, response) => {
  try {
    let file = path.join(distDir, decodeURIComponent(new URL(request.url, 'http://x').pathname));
    if (!file.startsWith(distDir)) throw new Error('outside');
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = [];
let failed = false;

for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: 760 } });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || url.includes('t.hagicode.com/static/array.js')) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  try {
    await page.goto(`${base}${startPath}`, { waitUntil: 'load' });
    await page.waitForSelector('[data-hagilight-consent]:not([hidden])', { timeout: 10000 });
    const geometry = await page.evaluate(() => {
      const rect = (el) => (el ? el.getBoundingClientRect() : null);
      const popup = rect(document.querySelector('[data-hagilight-consent]'));
      const banner = [...document.querySelectorAll('.hagilight-promoto__shell')].find((el) => !el.hidden && getComputedStyle(el).display !== 'none');
      const bannerRect = rect(banner);
      const overlap = (a, b) => Boolean(a && b) && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const btn = document.querySelector('[data-consent-accept]');
      const b = btn.getBoundingClientRect();
      const topAtButton = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return {
        popupVisible: Boolean(popup) && popup.width > 0,
        bannerPresent: Boolean(bannerRect),
        bannerOverlaps: overlap(popup, bannerRect),
        buttonCovered: !(topAtButton && btn.contains(topAtButton)),
        inViewport: popup.left >= 0 && popup.right <= window.innerWidth + 0.5,
      };
    });
    assert.equal(geometry.popupVisible, true, 'the popup is shown');
    assert.equal(geometry.bannerOverlaps, false, 'the popup and the banner do not overlap');
    assert.equal(geometry.buttonCovered, false, 'nothing covers the popup buttons');
    assert.equal(geometry.inViewport, true, 'the popup stays inside the viewport width');
    // The page's last link must be scrollable clear of the popup.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const lastLinkClear = await page.evaluate(() => {
      const popup = document.querySelector('[data-hagilight-consent]').getBoundingClientRect();
      const links = [...document.querySelectorAll('footer a[href], footer button[data-consent-preferences]')].filter((el) => el.offsetParent !== null);
      const last = links.at(-1);
      if (!last) return true;
      const r = last.getBoundingClientRect();
      return r.bottom <= popup.top + 1 || r.top >= popup.bottom - 1 || r.right <= popup.left || r.left >= popup.right;
    });
    assert.equal(lastLinkClear, true, 'the last footer link is clear of the popup at the page end');
    results.push(`ok   ${width}px: popup, banner and footer clear`);
  } catch (error) {
    failed = true;
    results.push(`FAIL ${width}px: ${error.message.split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

await browser.close();
server.close();
console.log(results.join('\n'));
if (failed) process.exitCode = 1;
