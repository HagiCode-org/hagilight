import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hagilight } from '@hagicode/hagilight/integration';
import { DEFAULT_POSTHOG_API_KEY } from '@hagicode/hagilight-core/posthog';

const root = fileURLToPath(new URL('../', import.meta.url));
const variants = join(root, 'node_modules/.hagilight-variants/astro-posthog');
const astroCli = join(root, 'node_modules/astro/bin/astro.mjs');

const PAGE = `---
---
<html lang="en-US">
  <head><meta charset="utf-8" /><title>PostHog</title></head>
  <body><h1>PostHog</h1></body>
</html>
`;

function config(options) {
  return `import { defineConfig } from 'astro/config';
import { hagilight } from '@hagicode/hagilight/integration';

export default defineConfig({ site: 'https://posthog.example.com', integrations: [hagilight(${options})] });
`;
}

function buildFixture(name, options) {
  const dir = join(variants, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'src/pages'), { recursive: true });
  writeFileSync(join(dir, 'astro.config.mjs'), config(options));
  writeFileSync(join(dir, 'src/pages/index.astro'), PAGE);
  execFileSync(process.execPath, [astroCli, 'build', '--root', dir], {
    cwd: root,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    stdio: 'pipe',
  });
  return readFileSync(join(dir, 'dist/index.html'), 'utf8');
}

const count = (text, needle) => text.split(needle).length - 1;

function runSetup(integration, { command, integrations = [] }) {
  const scripts = [];
  const setup = integration.hooks['astro:config:setup'];
  try {
    setup({
      command,
      config: { root: new URL('../', import.meta.url), site: 'https://posthog.example.com', integrations },
      injectRoute() {},
      injectScript: (stage, code) => scripts.push({ stage, code }),
      addMiddleware() {},
      updateConfig() {},
      logger: { warn() {}, info() {}, error() {} },
    });
  } catch {
    // Unrelated setup steps may need a full Astro config; only the injected scripts matter here.
  }
  return scripts;
}

test('a plain Astro site gets PostHog in its production head without any options', () => {
  const html = buildFixture('default', '');
  assert.equal(count(html, '__hagilightPosthogInitialized = true'), 1);
  assert.ok(html.includes(DEFAULT_POSTHOG_API_KEY));
  assert.ok(html.indexOf('posthog.init') < html.indexOf('</head>'), 'the loader is in the head');
});

test('posthog enabled false leaves the page without a loader', () => {
  const html = buildFixture('disabled', `{ analytics: { posthog: { enabled: false } } }`);
  assert.ok(!html.includes('__hagilightPosthogInitialized'));
});

test('an empty posthog object disables it like the other plugins', () => {
  const html = buildFixture('empty', `{ analytics: { posthog: {} } }`);
  assert.ok(!html.includes('__hagilightPosthogInitialized'));
});

test('a custom apiKey replaces the default key', () => {
  const html = buildFixture('custom', `{ analytics: { posthog: { apiKey: 'phc_Custom123' } } }`);
  assert.ok(html.includes('phc_Custom123'));
  assert.ok(!html.includes(DEFAULT_POSTHOG_API_KEY));
});

test('analytics injection does not depend on the sitemap and robots enabled option', () => {
  const html = buildFixture('integration-disabled', `{ enabled: false }`);
  assert.equal(count(html, '__hagilightPosthogInitialized = true'), 1);
});

test('only production builds inject the script', () => {
  const integration = hagilight();
  assert.equal(runSetup(integration, { command: 'build' }).length, 1);
  assert.equal(runSetup(integration, { command: 'dev' }).length, 0);
  assert.equal(runSetup(integration, { command: 'preview' }).length, 0);
});

test('a registered Starlight integration owns PostHog', () => {
  const scripts = runSetup(hagilight(), { command: 'build', integrations: [{ name: '@astrojs/starlight' }] });
  assert.equal(scripts.length, 0);
});

test('invalid analytics options fail when the integration is created', () => {
  assert.throws(() => hagilight({ analytics: { posthog: { enabled: true } } }), /apiKey is missing/u);
  assert.throws(() => hagilight({ analytics: { posthog: { apiKey: 'bad key' } } }), /invalid format/u);
  assert.throws(() => hagilight({ analytics: { posthog: { enabled: 'yes' } } }), /must be a boolean/u);
  assert.throws(() => hagilight({ analytics: { posthog: true } }), /must be an object/u);
  assert.throws(() => hagilight({ analytics: 'on' }), /must be an object/u);
});
