import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { hagilight } from '@hagicode/hagilight/integration';

function runSetup({ site, integrations = [], enabled = true, consumerPolicy } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hagilight-discovery-'));
  const srcDir = join(root, 'src');
  const pageRoot = join(srcDir, 'pages');
  const publicDir = join(root, 'public');
  mkdirSync(pageRoot, { recursive: true });
  mkdirSync(publicDir, { recursive: true });
  if (consumerPolicy === 'page') writeFileSync(join(pageRoot, 'robots.txt.ts'), 'export const GET = () => new Response();');
  if (consumerPolicy === 'public') writeFileSync(join(publicDir, 'robots.txt'), 'User-agent: *\\nDisallow: /private/');

  const updated = [];
  const routes = [];
  hagilight({ enabled }).hooks['astro:config:setup']({
    config: {
      site,
      integrations,
      srcDir: pathToFileURL(`${srcDir}/`),
      publicDir: pathToFileURL(`${publicDir}/`),
    },
    injectRoute: (route) => routes.push(route),
    updateConfig: (config) => updated.push(config),
  });
  return { root, updated, routes };
}

test('registers sitemap and a prerendered robots route by default', (t) => {
  const result = runSetup({ site: new URL('https://example.test') });
  t.after(() => rmSync(result.root, { recursive: true, force: true }));

  assert.equal(result.updated.length, 1);
  assert.equal(result.updated[0].integrations.length, 1);
  assert.equal(result.updated[0].integrations[0].name, '@astrojs/sitemap');
  assert.equal(result.routes.length, 1);
  assert.deepEqual(result.routes[0], {
    pattern: '/robots.txt',
    entrypoint: resolve(new URL('../packages/astro/robots.txt.ts', import.meta.url).pathname),
    prerender: true,
  });
});

test('requires an absolute HTTP(S) Astro site when discovery is enabled', (t) => {
  for (const site of [undefined, 'example.test', 'ftp://example.test', 'https://user:pass@example.test']) {
    const root = mkdtempSync(join(tmpdir(), 'hagilight-discovery-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const srcDir = join(root, 'src');
    const publicDir = join(root, 'public');
    mkdirSync(join(srcDir, 'pages'), { recursive: true });
    mkdirSync(publicDir, { recursive: true });

    assert.throws(() => hagilight().hooks['astro:config:setup']({
      config: {
        site,
        srcDir: pathToFileURL(`${srcDir}/`),
        publicDir: pathToFileURL(`${publicDir}/`),
      },
      injectRoute: () => {},
      updateConfig: () => {},
    }), /absolute HTTP\(S\) Astro site URL.*Set `site` in astro\.config\.mjs/u);
  }
});

test('disables both generated outputs without requiring a site', (t) => {
  const result = runSetup({ enabled: false });
  t.after(() => rmSync(result.root, { recursive: true, force: true }));

  assert.deepEqual(result.updated, []);
  assert.deepEqual(result.routes, []);
});

test('leaves sitemap generation to existing sitemap and Starlight integrations', (t) => {
  for (const name of ['@astrojs/sitemap', '@astrojs/starlight']) {
    const result = runSetup({
      site: 'https://example.test',
      integrations: [{ name }],
    });
    t.after(() => rmSync(result.root, { recursive: true, force: true }));

    assert.deepEqual(result.updated, []);
    assert.equal(result.routes.length, 1);
  }
});

test('preserves consumer-owned robots routes and public files', (t) => {
  for (const consumerPolicy of ['page', 'public']) {
    const result = runSetup({
      site: 'https://example.test',
      consumerPolicy,
    });
    t.after(() => rmSync(result.root, { recursive: true, force: true }));

    assert.equal(result.updated.length, 1);
    assert.deepEqual(result.routes, []);
  }
});
