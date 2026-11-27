import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = join(root, 'test/fixtures/root-transit');
const outDir = join(root, 'node_modules/.hagilight-variants/root-transit-logo');
const astroCli = join(root, 'node_modules/astro/bin/astro.mjs');

rmSync(outDir, { recursive: true, force: true });
execFileSync(process.execPath, [astroCli, 'build', '--root', fixture, '--outDir', outDir], {
  cwd: root,
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  stdio: 'pipe',
  timeout: 600000,
  killSignal: 'SIGKILL',
});

const page = (file) => readFileSync(join(outDir, file), 'utf8');
const brand = (html) => html.match(/<span class="brand"[^>]*>(.*?)<\/span>/su)?.[1] ?? '';
const HAGICODE_ICON = /\/_astro\/logo\.[^"]+\.png/u;

test('a page without a logo prop keeps the HagiCode icon with an empty alternative text', () => {
  const html = page('index.html');
  assert.match(brand(html), /^<img src="\/_astro\/logo\.[^"]+\.png" width="28" height="28" alt(?:=""){0,1}[^>]*>Minimal consumer$/u);
  assert.match(html, HAGICODE_ICON);
});

test('a custom logo replaces the HagiCode icon in the brand area and keeps its alternative text', () => {
  const html = page('logo-custom/index.html');
  assert.match(brand(html), /^<img src="\/brand\/mark\.svg" width="28" height="28" alt="Acme"[^>]*>Minimal consumer$/u);
  assert.doesNotMatch(html, HAGICODE_ICON);
  assert.match(html, /href="\/en-US\/"[^>]*data-transit-continue/u);
});

test('logo={false} renders the site name alone with no icon image anywhere on the page', () => {
  const html = page('logo-hidden/index.html');
  assert.equal(brand(html).replace(/\s+data-astro-cid-\w+/gu, ''), 'Minimal consumer');
  assert.doesNotMatch(brand(html), /<img/u);
  assert.doesNotMatch(html, HAGICODE_ICON);
  assert.match(html, /href="\/en-US\/"[^>]*data-transit-continue/u);
  assert.match(html, /href="\/zh-CN\/"[^>]*lang="zh-CN"/u);
});
