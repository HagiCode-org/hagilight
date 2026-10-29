import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Browser checks for @hagicode/hagilight-mermaid, run in Chromium against the built package and the
// real mermaid module (resolved through an import map). Each suite loads the same page with its own
// viewport and motion preference.

const root = fileURLToPath(new URL('../', import.meta.url));
const demoRoot = join(root, 'examples', 'demo-web', 'dist');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};
// Diagram types the demo may show as an error panel, each with a reason. The README lists the same set.
// Every type in the pinned Mermaid release renders today, so the list is empty.
const KNOWN_GAPS = {};
const suites = [
  { name: 'default', viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' },
  { name: 'reduced', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' },
  { name: 'phone', viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' },
];
// Mermaid logs its own render failures; the error panels are the expected output for bad source.
const EXPECTED_CONSOLE = /Mermaid rendering error|Mermaid block failed to mount/;

function serve(directory) {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = normalize(join(directory, path.endsWith('/') ? `${path}index.html` : path));
    let stat;
    try {
      stat = statSync(file);
    } catch {
      stat = null;
    }
    if (!file.startsWith(directory) || !stat?.isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const failures = [];
const report = (suite, results) => {
  for (const result of results) {
    if (result.ok) {
      console.log(`ok - [${suite}] ${result.name}`);
    } else {
      console.log(`not ok - [${suite}] ${result.name}: ${result.message}`);
      failures.push(`${suite}: ${result.name}`);
    }
  }
};
const fail = (suite, name, message) => report(suite, [{ name, ok: false, message }]);

async function openPage(browser, { viewport, reducedMotion }, url) {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !EXPECTED_CONSOLE.test(message.text())) consoleErrors.push(message.text());
  });
  await page.goto(url);
  return { context, page, consoleErrors };
}

/** The built demo page: outcome per section, toolbar presence, mode and preset switching, and overflow. */
async function demoChecks(browser, server) {
  const suite = 'demo';
  const { context, page, consoleErrors } = await openPage(browser, suites[0], `http://127.0.0.1:${server.address().port}/mermaid/`);
  const results = [];
  const check = async (name, run) => {
    try {
      await run();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({ name, ok: false, message: error.message });
    }
  };
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('section[data-mermaid-type] .mermaid-container').length === 36 && !document.querySelector('.mermaid-loading'),
      null,
      { timeout: 240000 },
    );
    const outcomes = await page.evaluate(() =>
      [...document.querySelectorAll('section[data-mermaid-type]')].map((section) => ({
        type: section.dataset.mermaidType,
        svg: Boolean(section.querySelector('.mermaid-diagram-container svg')),
        error: section.querySelector('.mermaid-error-message')?.textContent ?? null,
        expand: Boolean(section.querySelector('.mermaid-toolbar .mermaid-expand')),
        // A diagram is interactive when the graph model reads nodes from it, or when its parts can be focused.
        nodes: section.querySelectorAll('.mermaid-diagram-container svg .mermaid-node[role="button"], .mermaid-diagram-container svg .mermaid-node[role="group"][tabindex]').length,
        entities: section.querySelectorAll('.mermaid-diagram-container svg .mermaid-entity').length,
        mode: section.querySelector('.mermaid-container')?.dataset.mermaidMode ?? null,
      })),
    );
    await check('every section ends in an SVG or a known-gap error panel', async () => {
      const unexpected = outcomes.filter((item) => !item.svg && !(item.error && KNOWN_GAPS[item.type]));
      if (unexpected.length) throw new Error(unexpected.map((item) => `${item.type}: ${item.error ?? 'no output'}`).join('; '));
    });
    await check('every known gap has a reason and still shows an error panel', async () => {
      for (const [type, reason] of Object.entries(KNOWN_GAPS)) {
        if (!reason) throw new Error(`${type} has no reason`);
        const item = outcomes.find((candidate) => candidate.type === type);
        if (!item || item.svg) throw new Error(`${type} is expected to show an error panel`);
      }
    });
    await check('every diagram has the toolbar with its enlarge button', async () => {
      const missing = outcomes.filter((item) => item.svg && !item.expand).map((item) => item.type);
      if (missing.length) throw new Error(missing.join(', '));
    });
    await check('every diagram but the Info page can be hovered part by part', async () => {
      const idle = outcomes.filter((item) => item.svg && item.nodes === 0 && item.entities === 0).map((item) => item.type);
      if (idle.join() !== 'info') throw new Error(`diagrams with nothing to focus: ${idle.join(', ')}`);
    });
    await check('the tiles form a grid and the diagrams fit inside them', async () => {
      const layout = await page.evaluate(() => {
        const grid = document.querySelector('.grid');
        const tiles = [...grid.querySelectorAll('section[data-mermaid-type]')];
        const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        const outside = tiles.filter((tile) => {
          const svg = tile.querySelector('.mermaid-diagram-container svg');
          const stage = tile.querySelector('.stage');
          if (!svg || !stage) return true;
          const a = svg.getBoundingClientRect();
          const b = stage.getBoundingClientRect();
          return a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1 || a.bottom > b.bottom + 1;
        });
        return { columns, outside: outside.map((tile) => tile.dataset.mermaidType) };
      });
      if (layout.columns < 3) throw new Error(`${layout.columns} columns at 1280px`);
      if (layout.outside.length) throw new Error(`diagrams outside their tile: ${layout.outside.join(', ')}`);
    });
    await check('clicking a tile enlarges its diagram, and zoom, key and close work', async () => {
      const tile = page.locator('section[data-mermaid-type="pie"]');
      await tile.scrollIntoViewIfNeeded();
      await tile.locator('.stage').click({ position: { x: 20, y: 20 } });
      const dialog = page.locator('dialog.mermaid-viewer[open]');
      await dialog.waitFor({ timeout: 10000 });
      await page.waitForFunction(() => document.querySelector('dialog.mermaid-viewer')?.dataset.state === 'open', null, { timeout: 5000 });
      const percent = () => page.locator('.mermaid-viewer-percent').textContent();
      const fitted = Number.parseInt(await percent(), 10);
      await page.mouse.move(640, 450);
      await page.mouse.wheel(0, -300);
      await page.waitForFunction((from) => Number.parseInt(document.querySelector('.mermaid-viewer-percent').textContent, 10) > from, fitted, { timeout: 5000 });
      await page.keyboard.press('0');
      await page.waitForFunction((from) => Number.parseInt(document.querySelector('.mermaid-viewer-percent').textContent, 10) === from, fitted, { timeout: 5000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog.mermaid-viewer'), null, { timeout: 5000 });
    });
    for (const preset of ['Default', 'Archify']) {
      await check(`dark mode leaves no large light fills in any diagram (${preset})`, async () => {
        await page.getByRole('radio', { name: 'Dark' }).check();
        await page.getByRole('radio', { name: preset }).check();
        await page.waitForFunction(
          (want) => [...document.querySelectorAll('section[data-mermaid-type] .mermaid-container')].every((el) => el.dataset.mermaidMode === 'dark' && el.dataset.mermaidPreset === want) && !document.querySelector('.mermaid-loading'),
          preset.toLowerCase(),
          { timeout: 240000 },
        );
        await page.waitForTimeout(500);
        const light = await page.evaluate(() => {
          const luminance = (rgb) => {
            const [r, g, b] = rgb.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const found = {};
          for (const section of document.querySelectorAll('section[data-mermaid-type]')) {
            let area = 0;
            for (const shape of section.querySelectorAll('.mermaid-diagram-container svg :is(rect, circle, ellipse, polygon, path)')) {
              if (shape.closest('marker, defs, clipPath, .mermaid-trace-hop')) continue;
              const style = getComputedStyle(shape);
              const match = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(style.fill);
              if (!match || Number(match[4] ?? 1) * Number(style.fillOpacity) < 0.5 || Number(style.opacity) < 0.5) continue;
              // A brightness() filter darkens the fill the way it is drawn.
              const dim = Number(/brightness\(([\d.]+)\)/.exec(style.filter)?.[1] ?? 1);
              if (luminance([+match[1], +match[2], +match[3]].map((channel) => channel * dim)) < 0.5) continue;
              const box = shape.getBoundingClientRect();
              area += box.width * box.height;
            }
            const frame = section.querySelector('.mermaid-diagram-container svg').getBoundingClientRect();
            found[section.dataset.mermaidType] = area / Math.max(frame.width * frame.height, 1);
          }
          return found;
        });
        // Sticky notes (sequence, state) and the Info version text are yellow or white by design.
        const allowed = new Set(['sequence', 'stateDiagram', 'info']);
        const offenders = Object.entries(light).filter(([type, share]) => !allowed.has(type) && share > 0.08).map(([type, share]) => `${type} ${(share * 100).toFixed(0)}%`);
        if (offenders.length) throw new Error(offenders.join(', '));
      });
    }
    await check('switching mode and preset re-renders every diagram', async () => {
      await page.getByRole('radio', { name: 'Dark' }).check();
      await page.waitForFunction(() => [...document.querySelectorAll('section[data-mermaid-type] .mermaid-container')].every((el) => el.dataset.mermaidMode === 'dark'), null, { timeout: 240000 });
      await page.getByRole('radio', { name: 'Archify' }).check();
      await page.waitForFunction(() => [...document.querySelectorAll('section[data-mermaid-type] .mermaid-container')].every((el) => el.dataset.mermaidPreset === 'archify'), null, { timeout: 240000 });
      await page.waitForFunction(() => !document.querySelector('.mermaid-loading'), null, { timeout: 240000 });
      await page.getByRole('radio', { name: 'Light' }).check();
      await page.getByRole('radio', { name: 'Default' }).check();
    });
    for (const [label, width] of [['390px', 390], ['1280px', 1280]]) {
      await check(`no horizontal overflow at ${label}`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const wide = [...document.querySelectorAll('.mermaid-container')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.closest('section')?.dataset.mermaidType);
          return { page: doc.scrollWidth - doc.clientWidth, wide };
        });
        if (overflow.page > 1 || overflow.wide.length) throw new Error(JSON.stringify(overflow));
      });
    }
  } catch (error) {
    results.push({ name: 'demo page loads and renders', ok: false, message: error.message });
  }
  report(suite, results);
  for (const message of consoleErrors) fail(suite, 'console error', message);
  await context.close();
}

const browser = await chromium.launch();
const rootServer = await serve(root);
const demoServer = existsSync(demoRoot) ? await serve(demoRoot) : null;
try {
  for (const suite of suites) {
    const { context, page, consoleErrors } = await openPage(browser, suite, `http://127.0.0.1:${rootServer.address().port}/test/browser/mermaid-page.html?suite=${suite.name}`);
    await page.waitForFunction(() => window.__mermaidDone === true, null, { timeout: 300000 });
    const { results } = await page.evaluate(() => window.__mermaidResults);
    report(suite.name, results);
    for (const message of consoleErrors) fail(suite.name, 'console error', message);
    await context.close();
  }
  if (demoServer) {
    await demoChecks(browser, demoServer);
  } else {
    fail('demo', 'built demo present', 'run pnpm run build:core-footer-example before the browser checks');
  }
} finally {
  await browser.close();
  rootServer.close();
  demoServer?.close();
}

if (failures.length) {
  console.error(`${failures.length} Mermaid browser check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('All Mermaid browser checks passed');
}
