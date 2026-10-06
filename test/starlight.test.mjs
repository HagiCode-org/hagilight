import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import hagilight from '@hagicode/hagilight-starlight';
import {
  getNotFoundHomeHref,
  getNotFoundHomeLabel,
  isNotFoundEntry,
} from '../packages/starlight/dist/not-found.js';

function configure(options = {}, components = {}, logo, additionalConfig = {}, astroConfig = {}) {
  const config = { components, logo, ...additionalConfig };
  const integrations = [];
  let updated;
  hagilight(options).hooks['config:setup']({
    astroConfig: { site: 'https://example.com/', base: '/', ...astroConfig },
    config,
    updateConfig: (value) => { updated = value; },
    addIntegration: (integration) => integrations.push(integration),
  });
  return { updated, integrations };
}

test('registers a configured footer without discarding an opted-out header override', () => {
  const { updated, integrations } = configure({
    header: { enabled: false },
    analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } },
  }, { Header: './Header.astro' });

  assert.equal(updated.components.Header, './Header.astro');
  assert.deepEqual(updated.logo, {
    src: fileURLToPath(import.meta.resolve('@hagicode/hagilight-core/logo.png')),
    alt: 'HagiCode',
  });
  assert.match(updated.components.Footer, /^virtual:hagilight-starlight\/.+\/Footer\.astro$/);
  assert.match(updated.components.Hero, /[\\/]NotFoundHero\.astro$/);
  assert.match(updated.components.Head, /^virtual:hagilight-starlight\/.+\/Head\.astro$/);
  assert.equal(integrations.length, 1);
});

test('keeps a consumer Hero when automatic 404 customization is disabled', () => {
  const { updated } = configure({
    notFoundPage: { enabled: false },
  }, {
    Hero: './CustomHero.astro',
    Search: './CustomSearch.astro',
  });

  assert.equal(updated.components.Hero, './CustomHero.astro');
  assert.equal(updated.components.Search, './CustomSearch.astro');
});

test('rejects a consumer Hero override unless automatic 404 customization is disabled', () => {
  assert.throws(
    () => configure({}, { Hero: './CustomHero.astro' }),
    /existing Starlight Hero override.*notFoundPage: \{ enabled: false \}.*NotFoundHero/,
  );
});

test('validates not-found page options', () => {
  assert.throws(() => configure({ notFoundPage: null }), /notFoundPage options must be an object/);
  assert.throws(() => configure({ notFoundPage: [] }), /notFoundPage options must be an object/);
  assert.throws(
    () => configure({ notFoundPage: { enabled: 'yes' } }),
    /notFoundPage enabled option must be a boolean/,
  );
});

test('resolves localized home URLs under the site base and trailing-slash rules', () => {
  assert.equal(getNotFoundHomeHref({ basePath: '/', locale: undefined }), '/');
  assert.equal(getNotFoundHomeHref({ basePath: '/', locale: 'root' }), '/');
  assert.equal(
    getNotFoundHomeHref({ basePath: '/docs/', locale: 'en-us', trailingSlash: 'always' }),
    '/docs/en-us/',
  );
  assert.equal(
    getNotFoundHomeHref({ basePath: '/docs/', locale: 'fr-FR', trailingSlash: 'never' }),
    '/docs/fr-FR',
  );
  assert.equal(getNotFoundHomeLabel('zh-CN'), '返回首页');
  assert.equal(getNotFoundHomeLabel('fr-FR'), 'Retour à l’accueil');
  assert.equal(getNotFoundHomeLabel('xx-XX'), 'Back to home');
});

test('uses the customized Hero only for Starlight 404 entries', () => {
  assert.equal(isNotFoundEntry('404'), true);
  assert.equal(isNotFoundEntry('fr-FR/404'), true);
  assert.equal(isNotFoundEntry('fr-FR/guide'), false);
});

test('preserves a site-defined Starlight logo', () => {
  const { updated } = configure({}, {}, { src: './custom-logo.svg', alt: 'Custom logo' });

  assert.equal(updated.logo, undefined);
});

test('passes disabled promotion configuration to the footer wrapper', () => {
  const { updated, integrations } = configure({
    promoto: { enabled: false },
    analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } },
  });

  assert.match(updated.components.Footer, /\/Footer\.astro$/);
  assert.match(updated.components.Head, /^virtual:hagilight-starlight\/.+\/Head\.astro$/);
  assert.equal(integrations.length, 1);
  const [vite] = integrationVitePlugins(integrations[0]);
  const footerSource = vite.load(vite.resolveId(updated.components.Footer));
  assert.match(footerSource, /import Footer from .*Footer\.astro/u);
  assert.match(footerSource, /<Footer/u);
  assert.doesNotMatch(footerSource, /PromotoBanner/u);
});

test('rejects an existing footer override instead of replacing it', () => {
  assert.throws(
    () => configure({}, { Footer: './CustomFooter.astro' }),
    /existing Starlight Footer override/,
  );
});

test('rejects conflicting content hooks with an explicit component composition path', () => {
  assert.throws(
    () => configure({}, { PageTitle: './CustomPageTitle.astro' }),
    /existing Starlight PageTitle override.*ContentLayoutToggle/,
  );
  assert.throws(
    () => configure({}, { MarkdownContent: './CustomMarkdownContent.astro' }),
    /existing Starlight MarkdownContent override.*MarkdownContent/,
  );

  const { updated } = configure({
    contentComponents: { pageTitle: false, markdownContent: false },
  }, {
    PageTitle: './CustomPageTitle.astro',
    MarkdownContent: './CustomMarkdownContent.astro',
    Search: './CustomSearch.astro',
  });
  assert.equal(updated.components.PageTitle, './CustomPageTitle.astro');
  assert.equal(updated.components.MarkdownContent, './CustomMarkdownContent.astro');
  assert.equal(updated.components.Search, './CustomSearch.astro');
});

test('validates disclosure and component options before configuration', () => {
  assert.throws(() => configure({ aiDisclosures: [] }), /aiDisclosures options must be an object/);
  assert.throws(
    () => configure({ aiDisclosures: { isAITranslation: 'yes' } }),
    /isAITranslation option must be a boolean/,
  );
  assert.throws(
    () => configure({ aiDisclosures: { sourceLocale: 'en/US' } }),
    /sourceLocale option must be a non-empty string/,
  );
  assert.throws(
    () => configure({ contentComponents: { pageTitle: 'enabled' } }),
    /contentComponents pageTitle option must be a boolean/,
  );
});

test('enables each analytics provider independently and delivers options per plugin instance', () => {
  const google = configure({
    analytics: {
      googleAnalytics: { measurementId: 'G-TEST123' },
      fiftyOneLa: { enabled: false },
    },
  });
  const la = configure({
    analytics: {
      googleAnalytics: { enabled: false },
      fiftyOneLa: { siteId: 'site_123' },
    },
  });
  const googleHead = google.updated.components.Head;
  const googleFooter = google.updated.components.Footer;
  const laFooter = la.updated.components.Footer;

  assert.match(googleHead, /^virtual:hagilight-starlight\/.+\/Head\.astro$/);
  assert.match(la.updated.components.Head, /^virtual:hagilight-starlight\/.+\/Head\.astro$/);

  const [googleVite] = integrationVitePlugins(google.integrations[0]);
  const [laVite] = integrationVitePlugins(la.integrations[0]);
  const googleFooterModule = googleVite.load(googleVite.resolveId(googleFooter));
  const laFooterModule = laVite.load(laVite.resolveId(laFooter));
  assert.match(googleFooterModule, /PromotoBanner/);
  assert.match(laFooterModule, /Analytics51LA/);
  assert.notEqual(googleFooter, laFooter);
  assert.match(googleVite.load(googleVite.resolveId(googleHead)), /GoogleAnalytics/);
});

test('requires valid IDs when analytics providers are enabled', () => {
  assert.throws(() => configure({ analytics: [] }), /analytics options must be an object/);
  assert.throws(
    () => configure({ analytics: { googleAnalytics: { enabled: true } } }),
    /measurementId is missing/,
  );
  assert.throws(
    () => configure({ analytics: { fiftyOneLa: { enabled: true } } }),
    /siteId is missing/,
  );
  assert.throws(
    () => configure({ analytics: { googleAnalytics: { measurementId: 'not-an-id' } } }),
    /invalid format/,
  );
});

test('rejects an existing head override when SEO or Google Analytics owns the head', () => {
  assert.doesNotThrow(() => configure({
    seo: { enabled: false },
    analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } },
  }, { Head: './CustomHead.astro' }));
  assert.throws(
    () => configure(
      { analytics: { googleAnalytics: { measurementId: 'G-TEST123' } } },
      { Head: './CustomHead.astro' },
    ),
    /Hagilight SEO cannot replace an existing Starlight Head override/,
  );
});

test('validates SEO defaults, organization identity, site URL, and unambiguous language tags', () => {
  assert.throws(() => configure({ seo: null }), /seo options must be an object/);
  assert.throws(() => configure({ seo: { enabled: 'yes' } }), /seo enabled option must be a boolean/);
  assert.throws(() => configure({ seo: { title: '  ' } }), /SEO title must be a non-empty string/);
  assert.throws(() => configure({ seo: { image: 'javascript:alert(1)' } }), /SEO image must be/);
  assert.throws(
    () => configure({ seo: { organization: { url: 'https://example.com/' } } }),
    /organization name is required/,
  );
  assert.throws(
    () => configure({ seo: { organization: { name: 'Example', url: 'mailto:team@example.com' } } }),
    /organization URL must be an absolute HTTP\(S\) URL/,
  );
  assert.throws(
    () => configure(
      { rss: { enabled: false } },
      {},
      undefined,
      {},
      { site: undefined },
    ),
    /SEO requires an absolute Astro site URL/,
  );
  assert.throws(
    () => configure(
      { rss: { enabled: false } },
      {},
      undefined,
      { locales: { root: { lang: 'en-US' }, 'en-us': { lang: 'en-us' } } },
    ),
    /same language tag/,
  );

  const optedOut = configure({
    rss: { enabled: false },
    seo: { enabled: false },
    analytics: {
      googleAnalytics: { enabled: false },
      fiftyOneLa: { enabled: false },
    },
  }, {}, undefined, {}, { site: undefined });
  assert.equal(optedOut.updated.components.Head, undefined);
});

test('uses Docs analytics IDs by default and allows overriding or disabling providers', () => {
  const defaults = configure();
  const enabled = configure({
    analytics: {
      googleAnalytics: { measurementId: 'G-TEST123' },
      fiftyOneLa: { siteId: 'site_123' },
    },
    links: { siteId: 'docs', relatedSites: [] },
  });
  const [defaultVite] = integrationVitePlugins(defaults.integrations[0]);
  const [enabledVite] = integrationVitePlugins(enabled.integrations[0]);
  const defaultSource = defaultVite.load(defaultVite.resolveId(optionsModuleId(defaults.updated.components.Footer)));
  const enabledSource = enabledVite.load(enabledVite.resolveId(optionsModuleId(enabled.updated.components.Footer)));

  assert.match(defaultSource, /"promotoEnabled":true/);
  assert.match(defaultSource, /"googleAnalyticsMeasurementId":"G-EN03FMT2Q4"/);
  assert.match(defaultSource, /"fiftyOneLaId":"L6b88a5yK4h2Xnci"/);
  assert.match(enabledSource, /"googleAnalyticsMeasurementId":"G-TEST123"/);
  assert.match(enabledSource, /"fiftyOneLaId":"site_123"/);
  const disabled = configure({
    analytics: {
      googleAnalytics: { enabled: false },
      fiftyOneLa: { enabled: false },
    },
  });
  const [disabledVite] = integrationVitePlugins(disabled.integrations[0]);
  const disabledSource = disabledVite.load(
    disabledVite.resolveId(optionsModuleId(disabled.updated.components.Footer)),
  );
  assert.doesNotMatch(disabledSource, /googleAnalyticsMeasurementId|fiftyOneLaId/);
});

test('passes the finalized configured RSS alternate link to the footer options', () => {
  const siteConfig = { head: [] };
  const { updated, integrations } = configure({}, {}, undefined, siteConfig);
  siteConfig.head.push({
    tag: 'link',
    attrs: {
      rel: 'alternate',
      type: 'application/rss+xml',
      href: 'https://example.com/feed.xml',
    },
  });
  const [vite] = integrationVitePlugins(integrations[0]);
  const source = vite.load(vite.resolveId(optionsModuleId(updated.components.Footer)));
  const footerSource = vite.load(vite.resolveId(updated.components.Footer));
  const options = JSON.parse(source.match(/^export default (.*);$/mu)[1]);

  assert.equal(options.rssFeedUrl, 'https://example.com/feed.xml');
  assert.match(footerSource, /rssFeedUrl=\{options\.rssFeedUrl\}/);
});

test('generates an RSS route and alternate link by default', () => {
  const { updated, integrations } = configure();
  const routes = [];
  const [vite] = integrationVitePlugins(integrations[0], routes);
  const source = vite.load(vite.resolveId(optionsModuleId(updated.components.Footer)));
  const footerSource = vite.load(vite.resolveId(updated.components.Footer));
  const options = JSON.parse(source.match(/^export default (.*);$/mu)[1]);

  assert.deepEqual(routes.map(({ pattern }) => pattern), ['/rss.xml', '/rss.[language].xml']);
  assert.match(routes[0].entrypoint, /rss\.xml\.ts$/);
  assert.match(routes[1].entrypoint, /rss\.\[language\]\.xml\.ts$/);
  assert.equal(updated.head[0].attrs.href, 'https://example.com/rss.xml');
  assert.equal(options.rssFeedUrl, 'https://example.com/rss.xml');
  assert.deepEqual(options.rssLocaleFeedUrls, {});
  assert.match(footerSource, /rssLocaleFeedUrls=\{options\.rssLocaleFeedUrls\}/);
  const rssConfig = vite.load(vite.resolveId('virtual:hagilight-starlight/rss-config'));
  assert.deepEqual(JSON.parse(rssConfig.match(/^export default (.*);$/mu)[1]), {
    options: { includeDocs: true, includeBlog: true },
    locales: [{ route: 'root', lang: 'en', filename: 'en' }],
  });
});

test('respects a site feed and supports disabling RSS generation', () => {
  const ownFeed = configure({}, {}, undefined, { head: [{
    tag: 'link', attrs: { rel: 'alternate', type: 'application/rss+xml', href: '/blog/feed.xml' },
  }] });
  const disabled = configure({ rss: { enabled: false } });
  const ownRoutes = [];
  const disabledRoutes = [];
  integrationVitePlugins(ownFeed.integrations[0], ownRoutes);
  integrationVitePlugins(disabled.integrations[0], disabledRoutes);

  assert.deepEqual(ownRoutes, []);
  assert.deepEqual(disabledRoutes, []);
  assert.equal(ownFeed.updated.head.length, 4);
  assert.equal(disabled.updated.head.length, 3);
  assert.throws(() => configure({ rss: null }), /rss options must be an object/);
  assert.throws(() => configure({ rss: { enabled: 'yes' } }), /rss enabled option must be a boolean/);
  assert.throws(() => configure({ rss: { includeDocs: 'yes' } }), /rss includeDocs option must be a boolean/);
  assert.throws(() => configure({ rss: { includeBlog: 1 } }), /rss includeBlog option must be a boolean/);
});

test('maps Chinese-root Starlight locales to safe unique feed filenames', () => {
  const configured = configure({}, {}, undefined, {
    locales: {
      root: { lang: 'zh-CN' },
      'en-us': { lang: 'en-US' },
      'zh-Hant': { lang: 'zh-Hant' },
    },
  });
  const routes = [];
  const [vite] = integrationVitePlugins(configured.integrations[0], routes);
  const source = vite.load(vite.resolveId('virtual:hagilight-starlight/rss-config'));
  const rssConfig = JSON.parse(source.match(/^export default (.*);$/mu)[1]);
  const optionsSource = vite.load(vite.resolveId(optionsModuleId(configured.updated.components.Footer)));
  const options = JSON.parse(optionsSource.match(/^export default (.*);$/mu)[1]);

  assert.deepEqual(rssConfig.locales, [
    { route: 'root', lang: 'zh-CN', filename: 'zh-CN' },
    { route: 'en-us', lang: 'en-US', filename: 'en' },
    { route: 'zh-Hant', lang: 'zh-Hant', filename: 'zh-Hant' },
  ]);
  assert.deepEqual(routes.map(({ pattern }) => pattern), ['/rss.xml', '/rss.[language].xml']);
  assert.deepEqual(options.rssLocaleFeedUrls, {
    'zh-CN': 'https://example.com/rss.zh-CN.xml',
    'zh-Hant': 'https://example.com/rss.zh-Hant.xml',
  });
  assert.throws(
    () => configure({ seo: { enabled: false } }, {}, undefined, {
      locales: { root: { lang: 'en' }, 'en-us': { lang: 'en-US' } },
    }),
    /collide on the "en" feed filename/,
  );
  assert.throws(
    () => configure({ seo: { enabled: false } }, {}, undefined, {
      locales: { root: { lang: 'zh-CN' }, 'zh-cn': { lang: 'zh-cn' } },
    }),
    /collide on the "zh-CN" feed filename/,
  );
});

test('respects the Astro base path and requires a site only for generated RSS', () => {
  const base = configure({}, {}, undefined, {}, { base: '/docs/' });
  assert.equal(base.updated.head[0].attrs.href, 'https://example.com/docs/rss.xml');
  assert.throws(
    () => configure({}, {}, undefined, {}, { site: undefined }),
    /SEO requires an absolute Astro site URL/,
  );
  assert.doesNotThrow(
    () => configure({
      rss: { enabled: false },
      seo: { enabled: false },
    }, {}, undefined, {}, { site: undefined }),
  );
});

test('serializes independent AI disclosure defaults into each plugin options module', () => {
  const defaults = configure();
  const enabled = configure({
    aiDisclosures: {
      isAITranslation: true,
      isAIAuthor: false,
      sourceLocale: 'en-US',
    },
  });
  const [defaultVite] = integrationVitePlugins(defaults.integrations[0]);
  const [enabledVite] = integrationVitePlugins(enabled.integrations[0]);
  const defaultOptionsModule = defaultVite.load(defaultVite.resolveId(
    optionsModuleId(defaults.updated.components.Footer),
  ));
  const enabledOptionsModule = enabledVite.load(enabledVite.resolveId(
    optionsModuleId(enabled.updated.components.Footer),
  ));
  const parseOptions = (source) => JSON.parse(source.match(/^export default (.*);$/mu)[1]);

  assert.deepEqual(parseOptions(defaultOptionsModule).aiDisclosures, {
    isAITranslation: false,
    isAIAuthor: false,
    sourceLocale: 'root',
  });
  assert.deepEqual(parseOptions(enabledOptionsModule).aiDisclosures, {
    isAITranslation: true,
    isAIAuthor: false,
    sourceLocale: 'en-US',
  });
});

test('validates and forwards the independent article promotion default', () => {
  const defaults = configure();
  const promotionDisabled = configure({
    promoto: { enabled: false },
    hagicodePromotion: { enabled: true },
  });
  const bannerOnly = configure({
    promoto: { enabled: true },
    hagicodePromotion: { enabled: false },
  });
  const optionsFor = (result) => {
    const [vite] = integrationVitePlugins(result.integrations[0]);
    const source = vite.load(vite.resolveId(optionsModuleId(result.updated.components.MarkdownContent)));
    return JSON.parse(source.match(/^export default (.*);$/mu)[1]);
  };

  assert.equal(optionsFor(defaults).hagicodePromotionEnabled, true);
  assert.equal(optionsFor(promotionDisabled).hagicodePromotionEnabled, true);
  assert.equal(optionsFor(promotionDisabled).promotoEnabled, false);
  assert.equal(optionsFor(bannerOnly).hagicodePromotionEnabled, false);
  assert.equal(optionsFor(bannerOnly).promotoEnabled, true);

  const [vite] = integrationVitePlugins(defaults.integrations[0]);
  const markdownSource = vite.load(vite.resolveId(defaults.updated.components.MarkdownContent));
  assert.match(markdownSource, /hagicodePromotionEnabled=\{options\.hagicodePromotionEnabled\}/);

  assert.throws(() => configure({ hagicodePromotion: null }), /hagicodePromotion options must be an object/);
  assert.throws(() => configure({ hagicodePromotion: [] }), /hagicodePromotion options must be an object/);
  assert.throws(
    () => configure({ hagicodePromotion: { enabled: 'yes' } }),
    /hagicodePromotion enabled option must be a boolean/,
  );
});

test('preserves configured CSS, head entries, and unrelated component overrides', () => {
  const existingHead = { tag: 'meta', attrs: { name: 'description', content: 'Site content' } };
  const { updated } = configure({}, { Search: './Search.astro' }, undefined, {
    customCss: ['./src/site.css'],
    head: [existingHead],
  });

  assert.deepEqual(updated.customCss.slice(0, 1), ['./src/site.css']);
  assert.match(updated.customCss[1], /content-width\.css$/);
  assert.equal(updated.head[0], existingHead);
  assert.match(updated.head[2].content, /hagilight-content-width/);
  assert.equal(updated.components.Search, './Search.astro');
  assert.match(updated.components.PageTitle, /PageTitle\.astro$/);
  assert.match(updated.components.MarkdownContent, /MarkdownContent\.astro$/);
});

test('auto-injects the bundled HagiCode favicon as a data URI and respects a consumer favicon', () => {
  const { updated } = configure();
  const favicon = updated.head.find(
    (entry) => entry.tag === 'link' && entry.attrs.rel === 'icon' && entry.attrs.href.startsWith('data:'),
  );

  assert.ok(favicon, 'expected a data-URI favicon link in the head');
  assert.match(favicon.attrs.href, /^data:image\/x-icon;base64,/u);
  assert.equal(favicon.attrs.type, 'image/x-icon');

  const consumer = configure({}, {}, undefined, { favicon: '/my-favicon.png' });
  const injected = consumer.updated.head.find(
    (entry) => entry.tag === 'link' && entry.attrs.rel === 'icon' && entry.attrs.href.startsWith('data:'),
  );
  assert.equal(injected, undefined, 'a consumer-provided favicon must suppress the auto-injected one');
});

function integrationVitePlugins(integration, routes = []) {
  let config;
  integration.hooks['astro:config:setup']({
    injectRoute: (route) => routes.push(route),
    updateConfig: (value) => { config = value; },
  });
  return config.vite.plugins;
}

function optionsModuleId(componentId) {
  return `${componentId.slice(0, componentId.lastIndexOf('/'))}/options`;
}