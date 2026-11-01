import { createReadStream, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Browser checks for the Pele engine: serves the repository root, opens test/browser/mermaid-pele-page.html
// in headless Chromium and reports each check. Run with `node test/mermaid-pele-browser.mjs`. Pass
// PELE_CHROMIUM_PATH may name a Chromium binary when the Playwright default is missing. Pass
// `--record-snapshot` once, on the unchanged build, to write test/fixtures/pele/mermaid-postprocess-snapshot.json.

const root = fileURLToPath(new URL('../', import.meta.url));
const recordSnapshot = process.argv.includes('--record-snapshot');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serve(directory) {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = normalize(join(directory, path));
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

const server = await serve(root);
// PELE_CHROMIUM_PATH selects a local Chromium build when the Playwright default is not installed.
const browser = await chromium.launch({ executablePath: process.env.PELE_CHROMIUM_PATH || undefined });
let failed = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const query = recordSnapshot ? '?record=1' : '';
  await page.goto(`http://127.0.0.1:${server.address().port}/test/browser/mermaid-pele-page.html${query}`);
  await page.waitForFunction(() => window.__peleDone === true, null, { timeout: 120000 });
  const results = await page.evaluate(() => window.__peleResults);
  for (const result of results) {
    if (result.snapshot) {
      writeFileSync(join(root, 'test/fixtures/pele/mermaid-postprocess-snapshot.json'), `${JSON.stringify(result.snapshot, null, 2)}\n`);
      console.log(`recorded - ${join('test/fixtures/pele/mermaid-postprocess-snapshot.json')}`);
      continue;
    }
    if (result.ok) {
      console.log(`ok - ${result.name}`);
    } else {
      failed += 1;
      console.log(`not ok - ${result.name}: ${result.message}`);
    }
  }
  for (const error of pageErrors) {
    failed += 1;
    console.log(`not ok - page error: ${error}`);
  }
  console.log(`${results.length} checks, ${failed} failing`);
} finally {
  await browser.close();
  server.close();
}
process.exitCode = failed > 0 ? 1 : 0;
