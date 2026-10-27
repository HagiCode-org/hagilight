import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import { hagilight } from '../packages/astro/dist/integration.js';
import { SITE_METADATA_PATH } from '@hagicode/hagilight-core/site-metadata';
import {
  completeSiteMetadataOwnerBuild,
  registerStarlightSiteMetadataOwner,
} from '@hagicode/hagilight-core/site-metadata-ownership';

const scratch = mkdtempSync(join(tmpdir(), 'hagilight-astro-metadata-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const html = ({ title, lang = 'en', description, head = '' }) => `<!doctype html><html lang="${lang}"><head>`
  + `<title>${title}</title>${description ? `<meta name="description" content="${description}">` : ''}${head}</head><body></body></html>`;

const FILES = {
  '': html({ title: 'Example', description: 'An example site.', head: '<meta property="og:site_name" content="Example Site"/>' }),
  guides: html({ title: 'Guides | Example', description: 'All guides.' }),
};

const GA_SNIPPET = '<script src="https://www.googletagmanager.com/gtag/js?id=G-TEST"></script>';

/** Run setup, the build hooks and any finalizer the integration appended, against a scratch site. */
function runBuild({ options, files = FILES, extraHtml = {}, publicFiles = {}, outFiles = {}, integrations = [], i18n, claimStarlight, owner }) {
  const dir = mkdtempSync(join(scratch, 'site-'));
  const publicDir = join(dir, 'public');
  mkdirSync(publicDir, { recursive: true });
  for (const [name, content] of Object.entries(publicFiles)) {
    mkdirSync(join(publicDir, name, '..'), { recursive: true });
    writeFileSync(join(publicDir, name), content);
  }
  const outDir = join(dir, 'dist');
  mkdirSync(outDir, { recursive: true });
  const pages = [];
  for (const [name, content] of Object.entries({ ...files, ...extraHtml })) {
    mkdirSync(join(outDir, name), { recursive: true });
    writeFileSync(join(outDir, name, 'index.html'), content);
    pages.push({ pathname: name === '' ? '/' : `/${name}/` });
  }
  // Astro copies public/ into the output before astro:build:done, so the harness does the same.
  for (const [name, content] of Object.entries({ ...publicFiles, ...outFiles })) {
    mkdirSync(join(outDir, name, '..'), { recursive: true });
    writeFileSync(join(outDir, name), content);
  }

  const messages = [];
  const logger = { info: (m) => messages.push(m), warn: (m) => messages.push(m) };
  const appended = [];
  const releaseClaim = claimStarlight === undefined ? undefined : registerStarlightSiteMetadataOwner(claimStarlight);
  try {
    const integration = hagilight(options);
    const config = {
      root: pathToFileURL(`${dir}/`),
      srcDir: pathToFileURL(`${dir}/src/`),
      publicDir: pathToFileURL(`${publicDir}/`),
      site: 'https://example.test/',
      base: '/',
      i18n,
      integrations: [{ name: '@astrojs/sitemap' }, ...integrations],
    };
    integration.hooks['astro:config:setup']({
      config,
      injectRoute() {},
      addMiddleware() {},
      updateConfig(next) {
        if (next.integrations) appended.push(...next.integrations);
      },
      logger,
    });
    integration.hooks['astro:config:done']({ config, logger });
    const dirUrl = pathToFileURL(`${outDir}/`);
    integration.hooks['astro:build:done']({ dir: dirUrl, pages, logger });
    for (const extra of appended) {
      extra.hooks?.['astro:build:done']?.({ dir: dirUrl, pages, logger });
    }
    if (owner) owner(outDir);
    const target = join(outDir, SITE_METADATA_PATH);
    return {
      outDir,
      messages,
      appended,
      file: existsSync(target) ? readFileSync(target, 'utf8') : undefined,
      metadata: existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : undefined,
    };
  } finally {
    releaseClaim?.();
  }
}

test('the integration writes the metadata file from a finalizer after the build', () => {
  const result = runBuild({});
  assert.ok(result.metadata, 'metadata file written');
  assert.equal(result.metadata.schemaVersion, 1);
  assert.equal(result.metadata.generator.name, '@hagicode/hagilight');
  assert.equal(result.metadata.site.name, 'Example Site');
  assert.equal(result.metadata.site.description, 'An example site.');
  assert.equal(result.metadata.site.url, 'https://example.test/');
  assert.deepEqual(result.metadata.languages, { default: 'en', locales: [{ code: 'en', lang: 'en', path: '/' }] });
  // llms.txt is on by default and the fixture pages are indexable, so the build produces it.
  assert.deepEqual(result.metadata.discovery, { llms: '/llms.txt' });
  // No analytics provider on these pages, so the popup is not mounted and the consent feature is false.
  assert.deepEqual(result.metadata.features, { consent: false });
  assert.equal(result.appended.length, 1, 'one finalizer is appended after the sitemap');
  assert.ok(result.messages.some((m) => /Generated \.well-known\/hagilight\.metadata\.json/u.test(m)));
});

test('analytics flags follow the loaders present in the built pages', () => {
  const withGa = runBuild({
    extraHtml: { gtag: html({ title: 'Gtag page', head: GA_SNIPPET }) },
  });
  assert.deepEqual(withGa.metadata.analytics, { googleAnalytics: true, fiftyOneLa: false, posthog: false });
  const bare = runBuild({});
  assert.deepEqual(bare.metadata.analytics, { googleAnalytics: false, fiftyOneLa: false, posthog: false });
});

test('discovery lists the artifacts already present in the build output', () => {
  const result = runBuild({
    outFiles: { 'llms.txt': '# Example\n', 'robots.txt': 'User-agent: *\n', 'sitemap-index.xml': '<sitemapindex/>' },
  });
  assert.deepEqual(result.metadata.discovery, { sitemap: '/sitemap-index.xml', robots: '/robots.txt', llms: '/llms.txt' });
});

test('metadata: false writes nothing and appends no finalizer', () => {
  const result = runBuild({ options: { metadata: false } });
  assert.equal(result.file, undefined);
  assert.equal(result.appended.length, 0);
});

test('metadata options override the name and description', () => {
  const result = runBuild({ options: { metadata: { name: 'HagiCode Docs', description: 'Manual docs' } } });
  assert.equal(result.metadata.site.name, 'HagiCode Docs');
  assert.equal(result.metadata.site.description, 'Manual docs');
});

test('an invalid metadata option fails with an error that names it', () => {
  assert.throws(() => hagilight({ metadata: 'yes' }), /metadata option must be a boolean or an options object/u);
  assert.throws(() => hagilight({ metadata: { name: '' } }), /metadata name must be a non-empty string/u);
});

test('a site-owned public file is copied by Astro and kept byte for byte', () => {
  const owned = '{"schemaVersion":1,"site":"owned"}\n';
  const result = runBuild({ publicFiles: { [SITE_METADATA_PATH]: owned } });
  assert.equal(result.file, owned);
  assert.ok(result.messages.some((m) => /already exists.*untouched/u.test(m)));
});

test('a site-owned file already in the build output is kept', () => {
  const owned = '{"site":"owned"}\n';
  const result = runBuild({ outFiles: { [SITE_METADATA_PATH]: owned } });
  assert.equal(result.file, owned);
  assert.ok(result.messages.some((m) => /already exists.*untouched/u.test(m)));
});

test('a missing site URL skips the file with a warning instead of failing the build', () => {
  const dir = mkdtempSync(join(scratch, 'nosite-'));
  const outDir = join(dir, 'dist');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), FILES['']);
  const messages = [];
  const logger = { info() {}, warn: (m) => messages.push(m) };
  const integration = hagilight({ enabled: false });
  const config = { root: pathToFileURL(`${dir}/`), srcDir: pathToFileURL(`${dir}/src/`), publicDir: pathToFileURL(`${dir}/public/`), site: undefined, base: '/', integrations: [] };
  const appended = [];
  integration.hooks['astro:config:setup']({ config, injectRoute() {}, addMiddleware() {}, updateConfig(next) { appended.push(...(next.integrations ?? [])); }, logger });
  integration.hooks['astro:config:done']({ config, logger });
  for (const extra of appended) extra.hooks['astro:build:done']({ dir: pathToFileURL(`${outDir}/`), pages: [{ pathname: '/' }], logger });
  assert.equal(existsSync(join(outDir, SITE_METADATA_PATH)), false);
  assert.ok(messages.some((m) => /requires an absolute Astro site URL/u.test(m)));
});

test('locales come from Astro i18n, with the default at the base path', () => {
  const result = runBuild({
    i18n: { defaultLocale: 'en', locales: ['en', { path: 'zh-cn', codes: ['zh-CN'] }] },
    extraHtml: {},
  });
  assert.deepEqual(result.metadata.languages, {
    default: 'en',
    locales: [
      { code: 'en', lang: 'en', path: '/' },
      { code: 'zh-cn', lang: 'zh-CN', path: '/zh-cn/' },
    ],
  });
});

test('when Starlight owns the file, the plain integration defers and writes nothing', () => {
  const writes = [];
  const result = runBuild({
    claimStarlight: true,
    owner: () => completeSiteMetadataOwnerBuild(() => writes.push('starlight')),
  });
  assert.equal(result.appended.length, 0, 'no plain finalizer is appended');
  assert.deepEqual(writes, ['starlight'], 'the owner write runs once, after the plain step reported');
  assert.equal(result.file, undefined, 'the plain integration did not write the file');
});

test('a Starlight owner with metadata disabled leaves the plain integration in charge', () => {
  const result = runBuild({ claimStarlight: false });
  assert.ok(result.metadata, 'plain integration writes when the Starlight claim is disabled');
});
