import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const viewports = [
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];
const routes = [
  { site: 'core', path: '/', kind: 'core' },
  { site: 'core', path: '/zh-CN/', kind: 'core' },
  { site: 'starlight', path: '/zh-CN/', kind: 'starlight' },
  { site: 'starlight', path: '/zh-Hant/', kind: 'starlight' },
];
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
};
const failures = [];
const servers = [];
const artifactDir = resolve(
  root,
  process.env.HAGILIGHT_ARTIFACT_DIR ?? '/tmp/hagilight-viewport-artifacts',
);

function buildExamples() {
  execFileSync(npm, ['run', 'build'], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  for (const workspace of ['hagilight-core-footer-example', 'hagilight-example']) {
    execFileSync(npm, ['run', 'build', `--workspace=${workspace}`], {
      cwd: root,
      env: { ...process.env, HAGILIGHT_VIEWPORT_TEST: 'true' },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
  }
}

function serve(directory) {
  const documentRoot = resolve(directory);
  const server = createServer(async (request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }

    let filePath = resolve(documentRoot, `.${normalize(pathname)}`);
    if (pathname.endsWith('/')) filePath = join(filePath, 'index.html');
    if (filePath !== documentRoot && !filePath.startsWith(`${documentRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    try {
      await access(filePath);
    } catch {
      response.writeHead(404).end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  });

  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      servers.push(server);
      resolveServer(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

function check(condition, route, viewport, region, detail) {
  assert.ok(
    condition,
    `[${route} @ ${viewport.width}x${viewport.height}] ${region}: ${detail}`,
  );
}

async function bounds(page, selector, route, viewport, region) {
  const locator = page.locator(selector).first();
  check(await locator.count() > 0, route, viewport, region, `expected ${selector} to exist`);
  check(await locator.isVisible(), route, viewport, region, `expected ${selector} to be visible`);
  const box = await locator.boundingBox();
  check(Boolean(box), route, viewport, region, `could not measure ${selector}`);
  return box;
}

async function assertInside(parentBox, childBox, route, viewport, region) {
  check(
    childBox.x >= parentBox.x - 1
      && childBox.y >= parentBox.y - 1
      && childBox.x + childBox.width <= parentBox.x + parentBox.width + 1,
    route,
    viewport,
    region,
    `child bounds ${JSON.stringify(childBox)} exceed container ${JSON.stringify(parentBox)}`,
  );
}

async function assertNoPageOverflow(page, route, viewport, region = 'document') {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  check(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    route,
    viewport,
    region,
    `document width ${dimensions.scrollWidth}px exceeds viewport ${dimensions.clientWidth}px`,
  );
}

async function assertFooter(page, route, viewport, kind) {
  const attributionSelector = kind === 'core'
    ? '.hagilight-footer__attribution'
    : '.hagilight-copyright__attribution';
  const copyrightSelector = kind === 'core'
    ? '.hagilight-footer__copyright'
    : '.hagilight-copyright';
  const linksSelector = kind === 'core' ? '.hagilight-footer a' : '.hagilight-site-links a';
  const attribution = page.locator(attributionSelector);
  check(await attribution.count() === 1, route, viewport, 'footer attribution', 'expected one provider attribution');

  const provider = kind === 'core' ? 'hagilight' : 'hagilight-starlight';
  const longText = `Powered By ${provider}@1.2.3-preview.${'1234567890'.repeat(8)}+build.metadata`;
  const wrapMode = await attribution.evaluate((element, text) => {
    element.textContent = text;
    return getComputedStyle(element).overflowWrap;
  }, longText);
  check(wrapMode === 'anywhere', route, viewport, 'footer attribution', `expected wrapping, got ${wrapMode}`);

  if (kind === 'starlight') {
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const color = await attribution.evaluate((element) => getComputedStyle(element).color);
      check(color !== 'rgba(0, 0, 0, 0)', route, viewport, `footer ${theme} theme`, 'attribution is transparent');
    }
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
    });
  }

  const copyright = page.locator(copyrightSelector).first();
  const [copyrightBox, attributionBox] = await Promise.all([
    copyright.boundingBox(),
    attribution.boundingBox(),
  ]);
  check(Boolean(copyrightBox && attributionBox), route, viewport, 'footer attribution', 'could not measure copyright content');
  check(
    attributionBox.x >= copyrightBox.x - 1
      && attributionBox.x + attributionBox.width <= copyrightBox.x + copyrightBox.width + 1,
    route,
    viewport,
    'footer attribution',
    'attribution exceeds the copyright container',
  );
  if (viewport.width <= 640) {
    check(
      await attribution.evaluate((element) => element.getClientRects().length > 1),
      route,
      viewport,
      'footer attribution',
      'long prerelease token did not wrap onto multiple lines',
    );
  }
  await assertNoPageOverflow(page, route, viewport, 'long footer attribution');

  const firstLink = page.locator(linksSelector).first();
  check(await firstLink.count() === 1, route, viewport, 'footer links', 'no keyboard-operable footer link exists');
  await firstLink.focus();
  await page.keyboard.press('Tab');
  check(await page.locator(':focus-visible').count() === 1, route, viewport, 'footer links', 'keyboard focus is not visible');
}

async function assertCorePage(page, route, viewport) {
  const header = await bounds(page, '.site-header', route, viewport, 'core header');
  const brand = await bounds(page, '.site-header .brand', route, viewport, 'core brand');
  const actions = await bounds(page, '.site-header .header-actions', route, viewport, 'core header controls');
  const main = await bounds(page, 'main', route, viewport, 'core main content');
  check(
    brand.x + brand.width <= actions.x + 1,
    route,
    viewport,
    'core header controls',
    'brand overlaps the feed or language navigation',
  );
  await assertInside(header, brand, route, viewport, 'core brand bounds');
  await assertInside(header, actions, route, viewport, 'core header controls bounds');
  check(
    main.width <= 1217,
    route,
    viewport,
    'core content width',
    `main content is ${main.width}px wide; expected at most 1216px`,
  );

  const cards = page.locator('.feature-card');
  check(
    await cards.count() >= 7,
    route,
    viewport,
    'feature cards',
    `expected the core feature-card UI; found ${await cards.count()} cards`,
  );
  const grids = page.locator('.feature-grid');
  check(
    await grids.count() >= 1,
    route,
    viewport,
    'feature cards',
    'expected at least one feature-card grid',
  );
  for (let index = 0; index < await cards.count(); index += 1) {
    const card = cards.nth(index);
    const cardBox = await card.boundingBox();
    const gridBox = await card.locator('xpath=..').boundingBox();
    check(Boolean(cardBox && gridBox), route, viewport, `feature card ${index + 1}`, 'could not measure card');
    await assertInside(gridBox, cardBox, route, viewport, `feature card ${index + 1}`);
  }

  const codeBlocks = page.locator('.feature-card pre');
  check(
    await codeBlocks.count() > 0,
    route,
    viewport,
    'code examples',
    'expected internally scrollable code examples',
  );
  for (let index = 0; index < await codeBlocks.count(); index += 1) {
    const isScrollable = await codeBlocks.nth(index).evaluate(
      (element) => ['auto', 'scroll'].includes(getComputedStyle(element).overflowX),
    );
    check(isScrollable, route, viewport, `code example ${index + 1}`, 'horizontal scrolling is not enabled');
  }
  await assertNoPageOverflow(page, route, viewport);
}

async function measureStarlightRails(page, route, viewport) {
  const sidebar = await bounds(page, '#starlight__sidebar', route, viewport, 'Starlight sidebar');
  const content = await bounds(page, '.main-pane .sl-container', route, viewport, 'Starlight reading column');
  const toc = await bounds(page, 'starlight-toc', route, viewport, 'Starlight page outline');
  const tocLinks = await page.locator('starlight-toc a').count();
  check(
    tocLinks >= 3,
    route,
    viewport,
    'Starlight page outline',
    `expected a populated outline, found ${tocLinks} links`,
  );
  check(
    sidebar.x + sidebar.width <= content.x + 1,
    route,
    viewport,
    'Starlight sidebar and reading column',
    `sidebar ${JSON.stringify(sidebar)} overlaps reading column ${JSON.stringify(content)}`,
  );
  check(
    content.x + content.width <= toc.x + 1,
    route,
    viewport,
    'Starlight reading column and page outline',
    `reading column ${JSON.stringify(content)} overlaps outline ${JSON.stringify(toc)}`,
  );
  check(
    content.x >= 0 && content.x + content.width <= viewport.width + 1,
    route,
    viewport,
    'Starlight reading column',
    `reading column extends beyond viewport: ${JSON.stringify(content)}`,
  );
  return content;
}

async function assertStarlightPage(page, route, viewport) {
  await bounds(page, '.page > header.header', route, viewport, 'Starlight header');
  await bounds(page, '.right-group', route, viewport, 'Starlight header controls');
  const wideButton = page.locator('[data-hagilight-content-width-choice="wide"]');
  const narrowButton = page.locator('[data-hagilight-content-width-choice="narrow"]');
  check(await wideButton.count() === 1, route, viewport, 'content-width control', 'wide-width control is missing');
  check(await narrowButton.count() === 1, route, viewport, 'content-width control', 'narrow-width control is missing');

  await page.evaluate(() => {
    localStorage.setItem('hagilight-content-width', 'wide');
    document.documentElement.dataset.hagilightContentWidth = 'wide';
  });
  const wideContent = await measureStarlightRails(page, route, viewport);
  check(
    wideContent.width <= 1082,
    route,
    viewport,
    'wide reading column',
    `wide content is ${wideContent.width}px; expected at most 1080px`,
  );

  await narrowButton.click();
  await page.locator('html[data-hagilight-content-width="narrow"]').waitFor();
  const narrowContent = await measureStarlightRails(page, route, viewport);
  check(
    narrowContent.width < wideContent.width - 40,
    route,
    viewport,
    'narrow reading column',
    `narrow width ${narrowContent.width}px did not reduce wide width ${wideContent.width}px`,
  );
  await assertNoPageOverflow(page, route, viewport, 'narrow reading layout');

  await wideButton.click();
  await page.locator('html[data-hagilight-content-width="wide"]').waitFor();
  await measureStarlightRails(page, route, viewport);

  const trigger = page.locator('.language-trigger');
  check(await trigger.count() === 1, route, viewport, 'language chooser', 'expected language chooser trigger');
  await trigger.click();
  const dialog = page.locator('#hagilight-language-dialog');
  await dialog.waitFor({ state: 'visible' });
  const dialogBox = await dialog.boundingBox();
  check(Boolean(dialogBox), route, viewport, 'language chooser dialog', 'could not measure open dialog');
  check(
    dialogBox.x >= -1
      && dialogBox.y >= -1
      && dialogBox.x + dialogBox.width <= viewport.width + 1
      && dialogBox.y + dialogBox.height <= viewport.height + 1,
    route,
    viewport,
    'language chooser dialog',
    `dialog bounds ${JSON.stringify(dialogBox)} exceed viewport`,
  );
  await assertNoPageOverflow(page, route, viewport, 'open language chooser');
  await page.locator('.dialog-close').click();
}

async function runCase(browser, origins, route, viewport) {
  const label = `${route.site}${route.path}`;
  const viewportLabel = `${viewport.width}x${viewport.height}`;
  const artifactName = `${route.site}-${route.path.replaceAll('/', '_') || 'root'}-${viewportLabel}.png`;
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const localErrors = [];
  let region = 'page load';
  const origin = origins[route.site];

  page.on('pageerror', (error) => localErrors.push(error.message));
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).origin === origin) {
      localErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'request failed'}`);
    }
  });
  await page.route('**/*', (requestRoute) => (
    new URL(requestRoute.request().url()).origin === origin
      ? requestRoute.continue()
      : requestRoute.abort()
  ));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  try {
    const response = await page.goto(`${origin}${route.path}`, { waitUntil: 'networkidle' });
    check(
      response?.status() === 200,
      label,
      viewport,
      'route',
      `expected HTTP 200, received ${response?.status() ?? 'no response'}`,
    );
    await page.addStyleTag({
      content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}',
    });
    await page.evaluate(() => document.fonts.ready);
    await assertNoPageOverflow(page, label, viewport);
    region = route.kind === 'core' ? 'core layout' : 'Starlight layout';
    if (route.kind === 'core') await assertCorePage(page, label, viewport);
    else await assertStarlightPage(page, label, viewport);
    region = 'footer presentation';
    await assertFooter(page, label, viewport, route.kind);
    await page.setViewportSize({ width: 375, height: 812 });
    await assertFooter(page, label, { width: 375, height: 812 }, route.kind);

    check(
      localErrors.length === 0,
      label,
      viewport,
      'browser requests and scripts',
      localErrors.join('; '),
    );
    console.log(`PASS ${label} @ ${viewportLabel}`);
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    const screenshotPath = join(artifactDir, artifactName);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
    } catch (screenshotError) {
      localErrors.push(`screenshot capture failed: ${screenshotError.message}`);
    }
    failures.push({ label, viewportLabel, region, diagnostic, screenshotPath, localErrors });
    console.error(`FAIL ${label} @ ${viewportLabel} (${region})`);
    console.error(`  ${diagnostic}`);
    console.error(`  Screenshot: ${screenshotPath}`);
  } finally {
    await page.close();
  }
}

async function main() {
  buildExamples();
  await mkdir(artifactDir, { recursive: true });
  const coreDist = join(root, 'examples/demo-web/dist');
  const starlightDist = join(root, 'examples/demo-starlight-web/dist');
  const origins = {
    core: await serve(coreDist),
    starlight: await serve(starlightDist),
  };
  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewport of viewports) {
      for (const route of routes) await runCase(browser, origins, route, viewport);
    }
  } finally {
    await browser.close();
    await Promise.all(servers.map((server) => new Promise((resolveServer, reject) => {
      server.close((error) => (error ? reject(error) : resolveServer()));
    })));
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} viewport case(s) failed:`);
    for (const failure of failures) {
      console.error(
        `- ${failure.label} @ ${failure.viewportLabel}, ${failure.region}: ${failure.diagnostic}`
          + ` (screenshot: ${failure.screenshotPath})`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${viewports.length * routes.length} route/viewport cases passed.`);
}

main().catch(async (error) => {
  await Promise.all(servers.map((server) => new Promise((resolveServer) => server.close(resolveServer))));
  console.error(error);
  process.exitCode = 1;
});
