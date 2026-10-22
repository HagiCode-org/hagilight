import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packages = ['core', 'astro', 'starlight'].map((directory) => ({
  directory,
  manifest: JSON.parse(readFileSync(join(root, 'packages', directory, 'package.json'), 'utf8')),
}));

const expectedExports = {
  '@hagicode/hagilight-core/root-transit': ['ROOT_TRANSIT_DELAY_MS', 'resolveTransitDestination', 'resolveTransitNavigation', 'mountRootTransit'],
  '@hagicode/hagilight-core/root-transit-board': ['TRANSIT_BOARD_WINDOW', 'resolveTransitBoard'],
  '@hagicode/hagilight-core/splash-images': [
    'SPLASH_IMAGE_DEFAULTS',
    'loadSplashImage',
    'pickSplashIndex',
    'resolveSplashConfig',
    'splashImagePath',
    'splashImageUrl',
    'splashKey',
    'storeSplashImage',
  ],
  '@hagicode/hagilight-core/posthog': ['DEFAULT_POSTHOG_API_KEY', 'POSTHOG_API_HOST', 'POSTHOG_DEFAULTS', 'POSTHOG_API_KEY_PATTERN', 'posthogInitScript'],
  '@hagicode/hagilight-core/links': ['resolveSiteLinks'],
  '@hagicode/hagilight-core/favicon': ['getHagilightFaviconDataUri', 'resolveFaviconHeadEntry'],
  '@hagicode/hagilight-core/seo': ['composeCanonicalSeoHead', 'composeSeoHead', 'resolveSeoMetadata', 'serializeJsonLd'],
  '@hagicode/hagilight-core/seo-schema': ['seoSchema'],
  '@hagicode/hagilight-core/rss': ['generateRssFeed', 'resolveRssLocales'],
  '@hagicode/hagilight-core/rss-ownership': ['RSS_OWNER', 'registerStarlightRssOwner', 'resolvePlainAstroRssOwner'],
  '@hagicode/hagilight-core/site-metadata': [
    'ANALYTICS_LOADER_MARKERS',
    'SITE_METADATA_PATH',
    'SITE_METADATA_SCHEMA_VERSION',
    'buildSiteMetadata',
    'detectAnalyticsLoaders',
    'resolveSiteMetadataOption',
    'serializeSiteMetadata',
    'validateSiteMetadata',
  ],
  '@hagicode/hagilight-core/site-metadata-writer': ['findDiscoveryOutputs', 'writeSiteMetadata'],
  '@hagicode/hagilight-core/site-metadata-ownership': [
    'completeSiteMetadataOwnerBuild',
    'expectSiteMetadataReport',
    'registerStarlightSiteMetadataOwner',
    'reportSiteMetadataBuilt',
    'resolveSiteMetadataOwner',
  ],
  '@hagicode/hagilight-core/promotions': ['loadActivePromotions'],
  '@hagicode/hagilight-core/promoto-banner': [
    'definePromotoBannerElement',
    'getNextPromotionIndex',
    'getPromotionImageSources',
    'getPromotionSetSignature',
    'getPromotionVisibility',
    'selectPromotionCards',
    'shouldAutoRotate',
  ],
  '@hagicode/hagilight-core/analytics-events': [
    'GA_CATEGORIES',
    'GA_CATEGORY_ACTIONS',
    'GA_LOCATIONS',
    'TRACKED_SITE_LINKS',
    'gaEventAttributes',
    'handleGaClick',
    'installGaEventTracking',
    'siteLinkGaAttributes',
  ],
  '@hagicode/hagilight-core/content-images': [
    'CONTENT_IMAGE_CLASS',
    'checkContentImageRegistration',
    'rehypeContentImages',
    'registerContentImages',
    'satteriContentImages',
  ],
  '@hagicode/hagilight-core/footer-brand': [
    'FOOTER_BRAND_LOCALES',
    'pickFooterBrandLinks',
    'resolveFooterBrand',
  ],
  '@hagicode/hagilight-core/footer-avatar': [
    'FOOTER_AVATAR_DISPLAY_PX',
    'footerAvatarImageAttributes',
    'resolveFooterAvatarOptions',
  ],
  '@hagicode/hagilight-core/random-image': [
    'RANDOM_IMAGE_TIMEOUT_MS',
    'mountRandomImages',
    'pickRandomEntry',
    'randomPoolAttribute',
    'randomPoolFromManifest',
    'validateRandomPool',
  ],
  '@hagicode/hagilight-core/build-info': [
    'UNKNOWN',
    'buildInfoFromLocals',
    'buildInfoItems',
    'normalizeBranch',
    'normalizeBuildInfo',
    'normalizeCommit',
    'shortCommit',
  ],
  '@hagicode/hagilight-core/build-info-resolver': ['resolveBuildInfo'],
  '@hagicode/hagilight-core/comparison-articles': [
    'STRUCTURED_ARTICLE_CATEGORY',
    'STRUCTURED_ARTICLE_SCHEMA_VERSION',
    'buildStructuredArticleDetailPath',
    'buildStructuredArticleLocaleManifestFromDetails',
    'buildStructuredArticleLocaleManifestPath',
    'buildStructuredArticleRootManifestFromLocaleManifests',
    'validateStructuredArticleDetail',
  ],
  '@hagicode/hagilight-core/comparison-articles-source': [
    'STRUCTURED_ARTICLE_SOURCE_ROOT',
    'buildStructuredArticleLocaleManifest',
    'buildStructuredArticleRootManifest',
    'listStructuredArticleLocales',
    'listStructuredArticleSlugs',
    'loadStructuredArticleDetail',
    'loadStructuredArticleLocaleDetails',
  ],
  '@hagicode/hagilight/integration': ['hagilight', 'hagilightFavicon'],
  '@hagicode/hagilight-starlight': ['default'],
  '@hagicode/hagilight-starlight/locales': ['locales'],
  '@hagicode/hagilight-starlight/schema': ['aiDisclosureSchema', 'articlePromotionSchema', 'hagilightSchema', 'rssSchema'],
  '@hagicode/hagilight-starlight/showcase': ['getShowcaseCopy', 'showcaseLocales'],
};

test('every JavaScript export resolves to built ESM with a sibling declaration file', async () => {
  const seen = new Set();
  for (const { directory, manifest } of packages) {
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      if (subpath.includes('*')) {
        // Pattern exports map to packaged data files, not to modules; checked in the raw JSON test below.
        assert.equal(typeof target, 'string', `${manifest.name} ${subpath} must be a plain pattern target`);
        assert.match(target, /\*\.json$/u, `${manifest.name} ${subpath} must map JSON files only`);
        continue;
      }
      if (typeof target === 'string') {
        assert.doesNotMatch(target, /\.(?:m?js|ts)$/u, `${manifest.name} ${subpath} must use a types/default condition`);
        assert.ok(existsSync(join(root, 'packages', directory, target)), `${manifest.name} ${subpath} exists`);
        continue;
      }
      assert.match(target.default, /^\.\/dist\/.+\.js$/u);
      assert.equal(target.types, target.default.replace(/\.js$/u, '.d.ts'));
      assert.ok(existsSync(join(root, 'packages', directory, target.types)), `${manifest.name} ${subpath} types exist`);
      const specifier = subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`;
      const module = await import(specifier);
      for (const name of expectedExports[specifier] ?? assert.fail(`${specifier} is not covered`)) {
        assert.ok(name in module, `${specifier} exports ${name}`);
      }
      seen.add(specifier);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(expectedExports).sort());
});

test('the comparison article raw JSON pattern export resolves every packaged article file', () => {
  const core = packages[0].manifest;
  const pattern = core.exports['./comparison-articles-data/*.json'];
  assert.equal(pattern, './data/comparison-articles/*.json');
  const locales = readdirSync(join(root, 'packages', 'core', 'data', 'comparison-articles'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  assert.equal(locales.length, 10);
  let articles = 0;
  for (const locale of locales) {
    articles += readdirSync(join(root, 'packages', 'core', 'data', 'comparison-articles', locale.name))
      .filter((file) => file.endsWith('.json')).length;
  }
  assert.equal(articles, 136);
  assert.ok(core.files.includes('data/**/*.json'), 'core ships the comparison article data');
});

test('feature packages depend on the matching shared core and not on each other', () => {
  const [core, astro, starlight] = packages.map(({ manifest }) => manifest);
  for (const manifest of [astro, starlight]) {
    assert.equal(manifest.version, core.version);
    assert.equal(manifest.dependencies['@hagicode/hagilight-core'], core.version);
  }
  assert.equal(astro.dependencies['@hagicode/hagilight-starlight'], undefined);
  assert.equal(starlight.dependencies['@hagicode/hagilight'], undefined);
  assert.equal(core.dependencies['@hagicode/hagilight'], undefined);
  assert.equal(core.dependencies['@hagicode/hagilight-starlight'], undefined);
  assert.equal(core.peerDependencies['@astrojs/starlight'], undefined);
  assert.equal(core.peerDependenciesMeta.astro.optional, true);
  assert.equal(core.dependencies.astro, undefined);
  assert.match(import.meta.resolve('@hagicode/hagilight-core/PostHog'), /\/PostHog\.astro$/u);
});

test('typed consumer fixtures accept the documented APIs and reject invalid options', () => {
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  for (const project of ['test/types/tsconfig.json', 'tsconfig.routes.json']) {
    execFileSync(process.execPath, [tsc, '-p', project], { cwd: root, stdio: 'pipe' });
  }
});
