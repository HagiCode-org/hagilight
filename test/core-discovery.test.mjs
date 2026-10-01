import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hagilight } from '@hagicode/hagilight/integration';

function runSetup({ site, integrations = [], enabled = true, rss, consumerPolicy } = {}) {
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
  const middlewares = [];
  hagilight({ enabled, rss }).hooks['astro:config:setup']({
    config: {
      site,
      integrations,
      srcDir: pathToFileURL(`${srcDir}/`),
      publicDir: pathToFileURL(`${publicDir}/`),
    },
    injectRoute: (route) => routes.push(route),
    addMiddleware: (middleware) => middlewares.push(middleware),
    updateConfig: (config) => updated.push(config),
  });
  return { root, updated, routes, middlewares };
}

const rssRoutes = (routes) => routes
  .filter(({ pattern }) => pattern.startsWith('/rss'))
  .map(({ pattern }) => pattern)
  .sort();

test('registers sitemap, robots, and RSS feeds by default', (t) => {
  const result = runSetup({ site: new URL('https://example.test') });
  t.after(() => rmSync(result.root, { recursive: true, force: true }));

  assert.equal(result.updated.filter((entry) => entry.integrations).length, 1);
  assert.equal(result.updated[0].integrations[0].name, '@astrojs/sitemap');
  assert.ok(result.routes.some((route) => route.pattern === '/robots.txt' && route.prerender));
  assert.deepEqual(rssRoutes(result.routes), ['/rss.[language].xml', '/rss.xml']);
  assert.equal(result.middlewares.length, 1);
  assert.equal(result.middlewares[0].order, 'pre');
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
      addMiddleware: () => {},
      updateConfig: () => {},
    }), /absolute HTTP\(S\) Astro site URL.*Set `site` in astro\.config\.mjs/u);
  }
});

test('disables both generated outputs without requiring a site', (t) => {
  const result = runSetup({ enabled: false });
  t.after(() => rmSync(result.root, { recursive: true, force: true }));

  assert.deepEqual(result.updated, []);
  assert.deepEqual(result.routes, []);
  assert.deepEqual(result.middlewares, []);
});

test('leaves sitemap generation to existing sitemap and Starlight integrations while still generating RSS', (t) => {
  for (const name of ['@astrojs/sitemap', '@astrojs/starlight']) {
    const result = runSetup({
      site: 'https://example.test',
      integrations: [{ name }],
    });
    t.after(() => rmSync(result.root, { recursive: true, force: true }));

    assert.ok(!result.updated.some((entry) => entry.integrations));
    assert.ok(result.routes.some((route) => route.pattern === '/robots.txt'));
    assert.deepEqual(rssRoutes(result.routes), ['/rss.[language].xml', '/rss.xml']);
  }
});

test('preserves consumer-owned robots routes and public files', (t) => {
  for (const consumerPolicy of ['page', 'public']) {
    const result = runSetup({
      site: 'https://example.test',
      consumerPolicy,
    });
    t.after(() => rmSync(result.root, { recursive: true, force: true }));

    assert.equal(result.updated.filter((entry) => entry.integrations).length, 1);
    assert.ok(!result.routes.some((route) => route.pattern === '/robots.txt'));
    assert.deepEqual(rssRoutes(result.routes), ['/rss.[language].xml', '/rss.xml']);
  }
});

test('disables RSS when rss: false', (t) => {
  const result = runSetup({ site: 'https://example.test', rss: false });
  t.after(() => rmSync(result.root, { recursive: true, force: true }));

  assert.equal(result.updated.filter((entry) => entry.integrations).length, 1);
  assert.ok(result.routes.some((route) => route.pattern === '/robots.txt'));
  assert.deepEqual(rssRoutes(result.routes), []);
  assert.deepEqual(result.middlewares, []);
});
