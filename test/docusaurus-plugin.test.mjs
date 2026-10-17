import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { DEFAULT_POSTHOG_API_KEY, posthogInitScript } from '@hagicode/hagilight-core/posthog';

const { hagilightDocusaurus, default: defaultExport } = await import(
  new URL('../packages/docusaurus/dist/index.js', import.meta.url).href
);

const i18n = {
  defaultLocale: 'en-US',
  locales: ['en-US'],
  currentLocale: 'en-US',
  path: 'i18n',
  localeConfigs: { 'en-US': { label: 'English', htmlLang: 'en-US', direction: 'ltr' } },
};

const sites = [];
function makeSite({ files = [], siteConfig = {} } = {}) {
  const siteDir = mkdtempSync(join(tmpdir(), 'hagilight-docusaurus-'));
  sites.push(siteDir);
  for (const file of files) {
    const path = join(siteDir, file);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, '');
  }
  return {
    siteDir,
    siteConfig: {
      title: 'HagiCode',
      url: 'https://example.com',
      ...siteConfig,
      themeConfig: { image: 'img/social.png', ...siteConfig.themeConfig },
    },
    i18n,
    baseUrl: '/',
  };
}

function createPlugin(options, siteOptions) {
  return hagilightDocusaurus(options)(makeSite(siteOptions));
}

function capturedGlobalData(plugin) {
  let captured;
  plugin.contentLoaded({ content: undefined, actions: { setGlobalData: (data) => { captured = data; } } });
  return captured;
}

const fileName = (path) => path.split(/[\\/]/u).pop();
const nonSeoHeadTags = (plugin) =>
  plugin.injectHtmlTags({ content: undefined }).headTags.filter((tag) => tag.attributes?.type !== 'application/ld+json');

let warnings;
const originalWarn = console.warn;
const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  warnings = [];
  console.warn = (message) => warnings.push(String(message));
});

afterEach(() => {
  console.warn = originalWarn;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  for (const dir of sites.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test('the default export is the same factory as the named export', () => {
  assert.equal(defaultExport, hagilightDocusaurus);
});

test('registering with no options enables every standard feature', () => {
  const plugin = createPlugin();
  assert.equal(plugin.name, '@hagicode/hagilight-docusaurus');
  assert.ok(plugin.getThemePath, 'theme path is exposed while footer is enabled');
  assert.deepEqual(plugin.getClientModules().map(fileName), ['analytics.js', 'promoto.js', 'promoto.css', 'styles.css']);

  const { options, version } = capturedGlobalData(plugin);
  assert.match(version, /^\d+\.\d+\.\d+/u);
  assert.equal(options.footer, true);
  assert.equal(options.googleAnalyticsId, 'G-EN03FMT2Q4');
  assert.equal(options.fiftyOneLaId, 'L6b88a5yK4h2Xnci');
  assert.equal(options.posthogApiKey, DEFAULT_POSTHOG_API_KEY);
  assert.equal(options.promoto, true);
  assert.equal(options.languageSelector, true);
  assert.equal(options.seo.enabled, true);
  assert.equal(options.sitemap, true);
  assert.equal(options.robots, true);
  assert.deepEqual(options.rss, { enabled: true, includeDocs: true, includeBlog: true });
  assert.equal(options.noIndex, false);
  assert.deepEqual(warnings, []);
});

test('each feature can be disabled without affecting the others', () => {
  const cases = [
    ['footer', { footer: { enabled: false } }],
    ['promoto', { promoto: { enabled: false } }],
    ['languageSelector', { languageSelector: { enabled: false } }],
    ['seo', { seo: { enabled: false } }],
    ['sitemap', { sitemap: { enabled: false } }],
    ['robots', { robots: { enabled: false } }],
    ['rss', { rss: { enabled: false } }],
  ];
  const defaults = capturedGlobalData(createPlugin()).options;

  for (const [feature, options] of cases) {
    const resolved = capturedGlobalData(createPlugin(options)).options;
    const state = resolved[feature];
    assert.equal(typeof state === 'boolean' ? state : state.enabled, false, `${feature} is disabled`);
    const others = Object.keys(defaults).filter((key) => key !== feature);
    for (const key of others) {
      assert.deepEqual(resolved[key], defaults[key], `${key} is unchanged when ${feature} is disabled`);
    }
  }
});

test('partial analytics override keeps the other provider on its default', () => {
  const { options } = capturedGlobalData(createPlugin({ analytics: { fiftyOneLa: { siteId: 'my_site-1' } } }));
  assert.equal(options.fiftyOneLaId, 'my_site-1');
  assert.equal(options.googleAnalyticsId, 'G-EN03FMT2Q4');
});

test('valid overrides replace the default analytics IDs', () => {
  const { options } = capturedGlobalData(
    createPlugin({
      analytics: {
        googleAnalytics: { measurementId: 'G-ABC123' },
        fiftyOneLa: { siteId: 'site_42' },
      },
    }),
  );
  assert.equal(options.googleAnalyticsId, 'G-ABC123');
  assert.equal(options.fiftyOneLaId, 'site_42');
});

test('a disabled analytics provider resolves to no ID', () => {
  const { options } = capturedGlobalData(
    createPlugin({ analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false }, posthog: { enabled: false } } }),
  );
  assert.equal(options.googleAnalyticsId, undefined);
  assert.equal(options.fiftyOneLaId, undefined);
});

test('invalid options fail at configuration time and name the option', () => {
  const cases = [
    [{ footer: true }, /option "footer" must be an object/u],
    [{ footer: { enabled: 'yes' } }, /option "footer\.enabled" must be a boolean/u],
    [{ analytics: [] }, /option "analytics" must be an object/u],
    [{ analytics: { googleAnalytics: { measurementId: 'UA-123' } } }, /option "analytics\.googleAnalytics\.measurementId" has an invalid format/u],
    [{ analytics: { googleAnalytics: { enabled: true } } }, /option "analytics\.googleAnalytics\.measurementId" is required/u],
    [{ analytics: { fiftyOneLa: { enabled: true } } }, /option "analytics\.fiftyOneLa\.siteId" is required/u],
    [{ analytics: { fiftyOneLa: { siteId: 'bad id!' } } }, /option "analytics\.fiftyOneLa\.siteId" has an invalid format/u],
    [{ seo: { enabled: 'no' } }, /option "seo\.enabled" must be a boolean/u],
    [{ seo: { image: '' } }, /option "seo\.image" must be a non-empty string/u],
    [{ seo: { image: 'og.png' } }, /option "seo\.image" must be an absolute HTTP\(S\) URL or a site-root path/u],
    [{ seo: { organization: { name: '  ' } } }, /option "seo\.organization\.name" must be a non-empty string/u],
    [{ seo: { organization: { url: 'ftp://example.com' } } }, /option "seo\.organization\.url" must be an absolute HTTP\(S\) URL/u],
    [{ seo: { organization: { logo: 42 } } }, /option "seo\.organization\.logo" must be a non-empty string/u],
    [{ sitemap: { enabled: 1 } }, /option "sitemap\.enabled" must be a boolean/u],
    [{ robots: 'off' }, /option "robots" must be an object/u],
    [{ rss: { includeBlog: 'no' } }, /option "rss\.includeBlog" must be a boolean/u],
    [{ rss: { includeDocs: 1 } }, /option "rss\.includeDocs" must be a boolean/u],
    [{ links: 'x' }, /option "links" must be an object/u],
    [{ noIndex: 'true' }, /option "noIndex" must be a boolean/u],
  ];

  for (const [options, pattern] of cases) {
    assert.throws(() => hagilightDocusaurus(options), pattern, JSON.stringify(options));
  }
});

test('the site-owned Footer component produces a conflict warning', () => {
  createPlugin(undefined, { files: ['src/theme/Footer/index.tsx'] });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /src\/theme\/Footer/u);
});

test('the site-owned SiteMetadata component produces a conflict warning while SEO is enabled', () => {
  createPlugin(undefined, { files: ['src/theme/SiteMetadata/index.tsx'] });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /src\/theme\/SiteMetadata/u);
});

test('the SiteMetadata conflict is silent when SEO is disabled', () => {
  createPlugin({ seo: { enabled: false } }, { files: ['src/theme/SiteMetadata/index.tsx'] });
  assert.deepEqual(warnings, []);
});

test('the footer conflict is silent when the footer is disabled', () => {
  createPlugin({ footer: { enabled: false } }, { files: ['src/theme/Footer.tsx'] });
  assert.deepEqual(warnings, []);
});

test('themeConfig.footer produces a conflict warning while the footer is enabled', () => {
  createPlugin(undefined, { siteConfig: { themeConfig: { footer: { links: [] } } } });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /themeConfig\.footer/u);
});

test('themeConfig.gtag produces a double-load warning while Google Analytics is enabled', () => {
  createPlugin(undefined, { siteConfig: { themeConfig: { gtag: { trackingID: 'G-SITE' } } } });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /load twice/u);
});

test('the official gtag plugin produces a double-load warning', () => {
  createPlugin(undefined, { siteConfig: { plugins: ['@docusaurus/plugin-google-gtag'] } });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /load twice/u);
});

test('the classic preset gtag option produces a double-load warning', () => {
  createPlugin(undefined, {
    siteConfig: { presets: [['@docusaurus/preset-classic', { gtag: { trackingID: 'G-SITE' } }]] },
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /load twice/u);
});

test('site gtag configuration is silent when Google Analytics is disabled', () => {
  createPlugin(
    { analytics: { googleAnalytics: { enabled: false } } },
    { siteConfig: { themeConfig: { gtag: { trackingID: 'G-SITE' } } } },
  );
  assert.deepEqual(warnings, []);
});

test('the footer site identifier is published for the banner only when the banner is enabled', () => {
  const siteMeta = (plugin) => nonSeoHeadTags(plugin).filter((tag) => tag.attributes?.name === 'hagilight-site-id');

  assert.deepEqual(siteMeta(createPlugin({ links: { siteId: 'docs' } })), [
    { tagName: 'meta', attributes: { name: 'hagilight-site-id', content: 'docs' } },
  ]);
  assert.deepEqual(siteMeta(createPlugin({ links: {} })), []);
  assert.deepEqual(siteMeta(createPlugin({ promoto: { enabled: false }, links: { siteId: 'docs' } })), []);
});

test('analytics head tags appear only in production builds', () => {
  const plugin = createPlugin();

  process.env.NODE_ENV = 'development';
  assert.deepEqual(nonSeoHeadTags(plugin), []);

  process.env.NODE_ENV = 'production';
  const { headTags } = plugin.injectHtmlTags({ content: undefined });
  assert.ok(headTags.some((tag) => tag.attributes?.src?.includes('googletagmanager.com/gtag/js?id=G-EN03FMT2Q4')));
  assert.ok(headTags.some((tag) => tag.attributes?.src === 'https://sdk.51.la/js-sdk-pro.min.js'));
  assert.ok(headTags.some((tag) => tag.innerHTML?.includes('LA.init({"id":"L6b88a5yK4h2Xnci"')));
});

test('a disabled provider leaves no head tags behind', () => {
  process.env.NODE_ENV = 'production';
  const plugin = createPlugin({ analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false }, posthog: { enabled: false } } });
  assert.deepEqual(nonSeoHeadTags(plugin), []);
  assert.deepEqual(plugin.getClientModules().map(fileName), ['promoto.js', 'promoto.css', 'styles.css']);
});

test('a disabled promote card ships neither its client module nor its stylesheet', () => {
  const plugin = createPlugin({ promoto: { enabled: false } });
  assert.deepEqual(plugin.getClientModules().map(fileName), ['analytics.js', 'styles.css']);
});

test('a sharing image is required by default and the warning is silent when either source sets one', () => {
  createPlugin(undefined, { siteConfig: { themeConfig: { image: undefined } } });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /seo\.image/u);

  warnings.length = 0;
  createPlugin({ seo: { image: '/img/og.png' } }, { siteConfig: { themeConfig: { image: undefined } } });
  assert.deepEqual(warnings, []);
});

test('the sharing-image warning is silent when SEO is disabled', () => {
  createPlugin({ seo: { enabled: false } }, { siteConfig: { themeConfig: { image: undefined } } });
  assert.deepEqual(warnings, []);
});

test('the theme path is omitted when the footer and SEO are both disabled', () => {
  const plugin = createPlugin({ footer: { enabled: false }, seo: { enabled: false } });
  assert.equal(plugin.getThemePath, undefined);
});

test('the theme path stays while only the footer is disabled, for the SEO sharing wrapper', () => {
  const plugin = createPlugin({ footer: { enabled: false } });
  assert.ok(plugin.getThemePath, 'theme path is exposed while SEO is enabled');
});

test('PostHog defaults and supplied options follow the Google Analytics convention', () => {
  for (const input of [undefined, {}, { analytics: {} }, {
    analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } },
  }]) {
    assert.equal(capturedGlobalData(createPlugin(input)).options.posthogApiKey, DEFAULT_POSTHOG_API_KEY);
  }
  for (const posthog of [{}, { enabled: false }, { enabled: false, apiKey: 'bad' }]) {
    const { options } = capturedGlobalData(createPlugin({ analytics: { posthog } }));
    assert.equal(options.posthogApiKey, undefined);
    assert.equal(options.googleAnalyticsId, 'G-EN03FMT2Q4');
    assert.equal(options.fiftyOneLaId, 'L6b88a5yK4h2Xnci');
  }
  for (const posthog of [{ apiKey: 'phc_Custom123' }, { enabled: true, apiKey: 'phc_Custom123' }]) {
    assert.equal(capturedGlobalData(createPlugin({ analytics: { posthog } })).options.posthogApiKey, 'phc_Custom123');
  }
  assert.throws(() => hagilightDocusaurus({ analytics: { posthog: { enabled: true } } }), /analytics\.posthog\.apiKey.*required/u);
  for (const posthog of [null, [], true, 'key']) {
    assert.throws(() => hagilightDocusaurus({ analytics: { posthog } }), /analytics\.posthog.*object/u);
  }
  for (const enabled of ['yes', 1, null]) {
    assert.throws(() => hagilightDocusaurus({ analytics: { posthog: { enabled } } }), /analytics\.posthog\.enabled.*boolean/u);
  }
  for (const apiKey of ['', 'bad', 'phc_', 'phc_Test-1', '</script>', 42, null]) {
    assert.throws(() => hagilightDocusaurus({ analytics: { posthog: { enabled: true, apiKey } } }), /analytics\.posthog\.apiKey/u);
  }
});

test('PostHog emits one shared head script only in production and stays independent of client modules', () => {
  const plugin = createPlugin();
  process.env.NODE_ENV = 'production';
  const tags = nonSeoHeadTags(plugin);
  assert.equal(tags.filter((tag) => tag.innerHTML === posthogInitScript()).length, 1);
  assert.ok(tags.some((tag) => tag.attributes?.src?.includes('googletagmanager')));
  assert.ok(tags.some((tag) => tag.attributes?.src?.includes('sdk.51.la')));
  for (const mode of ['development', 'test', undefined]) {
    if (mode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = mode;
    assert.deepEqual(nonSeoHeadTags(plugin), []);
  }
  process.env.NODE_ENV = 'production';
  const onlyPosthog = createPlugin({ analytics: {
    googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false },
  } });
  assert.deepEqual(nonSeoHeadTags(onlyPosthog), [{ tagName: 'script', innerHTML: posthogInitScript() }]);
  assert.deepEqual(onlyPosthog.getClientModules().map(fileName), ['promoto.js', 'promoto.css', 'styles.css']);
  const noPosthog = createPlugin({ analytics: { posthog: { enabled: false } } });
  assert.equal(nonSeoHeadTags(noPosthog).length, 4);
  assert.ok(nonSeoHeadTags(noPosthog).every((tag) => !tag.innerHTML?.includes('posthog.init')));
  assert.deepEqual(noPosthog.getClientModules().map(fileName), ['analytics.js', 'promoto.js', 'promoto.css', 'styles.css']);
  const custom = createPlugin({ analytics: { posthog: { apiKey: 'phc_Custom123' } } });
  assert.equal(nonSeoHeadTags(custom).filter((tag) => tag.innerHTML === posthogInitScript('phc_Custom123')).length, 1);
});
