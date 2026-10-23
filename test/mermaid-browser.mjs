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
        toolbar: Boolean(section.querySelector('.mermaid-toolbar')),
        // The trace graph reads `g.nodes > g.node`, so only those count as traceable nodes.
        nodes: section.querySelectorAll('.mermaid-diagram-container svg g.nodes > g.node').length,
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
    await check('the trace toolbar appears exactly for diagrams with traceable nodes', async () => {
      const mismatched = outcomes.filter((item) => item.svg && item.toolbar !== item.nodes > 0).map((item) => item.type);
      if (mismatched.length) throw new Error(mismatched.join(', '));
    });
    await check('graph types show the trace toolbar and pie, sequence and gantt do not', async () => {
      const byType = Object.fromEntries(outcomes.map((item) => [item.type, item]));
      for (const type of ['flowchart-v2', 'stateDiagram', 'class', 'er']) {
        if (!byType[type]?.toolbar) throw new Error(`${type} has no toolbar`);
      }
      for (const type of ['pie', 'sequence', 'gantt']) {
        if (byType[type]?.toolbar) throw new Error(`${type} shows a toolbar`);
      }
    });
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
    fail('demo', 'built demo present', 'run npm run build:core-footer-example before the browser checks');
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
