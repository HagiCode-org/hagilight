import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import hagilight from '@hagicode/hagilight-starlight';

function configure(options = {}, components = {}) {
  const config = { components };
  const integrations = [];
  let updated;
  hagilight(options).hooks['config:setup']({
    astroConfig: { site: 'https://example.com/', base: '/' },
    config,
    updateConfig: (value) => { updated = value; },
    addIntegration: (integration) => integrations.push(integration),
  });
  return { updated, integrations };
}

function getVitePlugin(integration) {
  let config;
  integration.hooks['astro:config:setup']({
    injectRoute: () => {},
    updateConfig: (value) => { config = value; },
  });
  return config.vite.plugins[0];
}

function optionsModuleId(componentId) {
  return `${componentId.slice(0, componentId.lastIndexOf('/'))}/options`;
}

test('registers Header by default and forwards the existing links options', () => {
  const { updated, integrations } = configure({
    links: { siteId: 'example', extraLinks: {} },
  }, { Search: './Search.astro' });
  const vite = getVitePlugin(integrations[0]);
  const headerModule = vite.load(vite.resolveId(updated.components.Header));
  const optionsModule = vite.load(vite.resolveId(optionsModuleId(updated.components.Header)));

  assert.match(updated.components.Header, /\/Header\.astro$/);
  assert.match(updated.components.Footer, /\/Footer\.astro$/);
  assert.equal(updated.components.Search, './Search.astro');
  assert.match(headerModule, /Header links=\{options\.links\}/);
  assert.match(optionsModule, /"siteId":"example"/);
});

test('integrated header and footer resolve links from the configured route language', async () => {
  const [header, footer] = await Promise.all([
    readFile(new URL('../packages/starlight/Header.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/starlight/Footer.astro', import.meta.url), 'utf8'),
  ]);

  assert.match(header, /const locale = route\.lang \?\? route\.locale/);
  assert.match(footer, /resolveSiteLinks\(currentLanguage \?\? locale,/);
});

test('rejects a conflicting Header override but supports explicit opt-out', () => {
  assert.throws(
    () => configure({}, { Header: './CustomHeader.astro' }),
    /existing Starlight Header override.*header: \{ enabled: false \}/,
  );

  const { updated } = configure(
    { header: { enabled: false } },
    { Header: './CustomHeader.astro' },
  );
  assert.equal(updated.components.Header, './CustomHeader.astro');
  assert.match(updated.components.Footer, /\/Footer\.astro$/);
});

test('validates the header option shape', () => {
  assert.throws(() => configure({ header: false }), /header options must be an object/);
  assert.throws(
    () => configure({ header: { enabled: 'no' } }),
    /header enabled option must be a boolean/,
  );
});

test('publishes Header and its chooser implementation files', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../packages/starlight/package.json', import.meta.url), 'utf8'),
  );
  const chooser = await readFile(
    new URL('../packages/starlight/LanguageChooser.astro', import.meta.url),
    'utf8',
  );

  assert.equal(packageJson.exports['./Header'], './Header.astro');
  assert.ok(packageJson.files.includes('*.astro'));
  assert.ok(packageJson.files.includes('dist/**/*.js'));
  assert.ok(packageJson.files.includes('dist/**/*.d.ts'));
  assert.match(chooser, /import \{\s*getKeyboardTargetIndex/s);
  assert.match(chooser, /showModal\(\)/);
  assert.match(chooser, /addEventListener\('cancel'/);
  assert.match(chooser, /trigger\.focus\(\)/);
});


test('header, footer, and showcase tag only the tracked links for GA click events', async () => {
  const [header, footer, promotion, analytics] = await Promise.all([
    readFile(new URL('../packages/starlight/Header.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/starlight/Footer.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/starlight/ArticlePromotion.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/core/GoogleAnalytics.astro', import.meta.url), 'utf8'),
  ]);

  assert.equal(header.match(/siteLinkGaAttributes\(link, 'header'\)/g)?.length, 1);
  assert.equal(footer.match(/siteLinkGaAttributes\(link, 'footer'\)/g)?.length, 2, 'quick and community links');
  assert.doesNotMatch(footer, /siteLinkGaAttributes\(site\b/, 'related sites stay untagged');
  const filings = footer.match(/<nav class="hagilight-filings"[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.ok(filings.includes('resolvedLinks.filings.map'));
  assert.doesNotMatch(filings, /GaAttributes/, 'filings stay untagged');

  for (const expected of [
    /showcaseTag\('navigation', 'home'\)/,
    /showcaseTag\('navigation', 'productDocs'\)/,
    /showcaseTag\('download', 'downloadClient'\)/,
    /showcaseTag\('download', 'microsoftStore', storeHref\)/,
    /location: 'article_promotion'/,
  ]) assert.match(promotion, expected);
  const badge = promotion.match(/<ms-store-badge[\s\S]*?<\/ms-store-badge>/)?.[0] ?? '';
  const [badgeHost, fallbackLink] = badge.split('<a');
  assert.match(badgeHost, /showcaseTag\('download', 'microsoftStore', storeHref\)/, 'the host carries the tag');
  assert.doesNotMatch(fallbackLink, /showcaseTag/, 'the inner fallback link is not tagged twice');

  assert.match(analytics, /<script>\s*import \{ installGaEventTracking \} from '\.\/dist\/analytics-events\.js';\s*installGaEventTracking\(\);/);
});
