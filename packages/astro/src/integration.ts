import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, isAbsolute, join, resolve, win32 } from 'node:path';
import sitemap from '@astrojs/sitemap';
import type { AstroConfig, AstroIntegration } from 'astro';
import type { BuildInfo } from '@hagicode/hagilight-core/build-info';
import { resolveBuildInfo } from '@hagicode/hagilight-core/build-info-resolver';
import { checkContentImageRegistration, registerContentImages } from '@hagicode/hagilight-core/content-images';
import { resolveFaviconHeadEntry, type FaviconOptions } from '@hagicode/hagilight-core/favicon';
import { DEFAULT_POSTHOG_API_KEY, POSTHOG_API_KEY_PATTERN, posthogInitScript, type PostHogSiteContext } from '@hagicode/hagilight-core/posthog';
import { consentHeadScript } from '@hagicode/hagilight-core/consent-mount';
import { validatePolicyVersion, validatePrivacyUrl } from '@hagicode/hagilight-core/consent-markup';
import { resolveRssLocales, type RssLocale, type RssLocalesInput } from '@hagicode/hagilight-core/rss';
import { resolvePlainAstroRssOwner } from '@hagicode/hagilight-core/rss-ownership';
import { resolveSiteMetadataOption } from '@hagicode/hagilight-core/site-metadata';
import {
  expectSiteMetadataReport,
  reportSiteMetadataBuilt,
  resolveSiteMetadataOwner,
} from '@hagicode/hagilight-core/site-metadata-ownership';
import { buildLlmsTxt, parsePageMeta, type LlmsPage } from './llms.js';
import { writeAstroSiteMetadata } from './site-metadata.js';

export type {
  RssFeedCallback,
  RssFeedContent,
  RssFeedRequest,
  RssFooterContext,
} from './rss-config.js';

export interface HagilightOptions {
  /** Generate `sitemap-index.xml` and `robots.txt`. Defaults to `true`. */
  enabled?: boolean;
  /**
   * Generate localized `/rss.xml` and `/rss.<language>.xml` feeds. Defaults to
   * `true`, so integrating `hagilight()` is enough to publish an RSS feed.
   * Pass `false` to disable, or an options object to customize the feed:
   * - `locales`: Starlight-shaped locale map. Derived from the Astro `i18n`
   *   config when omitted.
   * - `getFeed`: project-root-relative module whose default export is an
   *   `RssFeedCallback`. A built-in empty feed is used when omitted.
   */
  rss?: boolean | HagilightRssOptions;
  /**
   * Apply the body-image baseline (`loading`, `decoding`, marker class) to Markdown
   * and MDX images. Defaults to `true`; `false` or `{ enabled: false }` opts out.
   * Independent of `enabled`, which controls only sitemap and robots.
   */
  contentImages?: boolean | HagilightContentImagesOptions;
  /**
   * Generate `/llms.txt` after the build from the built pages. Defaults to `true`; `false` or
   * `{ enabled: false }` opts out. A site-provided `llms.txt` (public file or page) is never
   * overwritten. It also follows `enabled`: `hagilight({ enabled: false })` skips it.
   */
  llms?: boolean | HagilightLlmsOptions;
  /**
   * Generate `/.well-known/hagilight.metadata.json` after the build. Defaults to `true`; `false`
   * opts out, and an options object may set `name` and `description`. A site-provided file is
   * never overwritten. Independent of `enabled`. When the Starlight plugin is also registered
   * and generates metadata, the Starlight plugin writes the file.
   */
  metadata?: boolean | HagilightMetadataOptions;
  /**
   * Analytics providers this integration injects into every page head of a production build.
   * Only PostHog is injected here; Starlight sites configure it through the Starlight plugin,
   * which owns the head, so this integration adds nothing when `@astrojs/starlight` is registered.
   */
  analytics?: HagilightAnalyticsOptions;
}

export interface HagilightAnalyticsOptions {
  posthog?: HagilightPostHogOptions;
  /**
   * Strict prior consent for the PostHog this integration injects. On by default; `enabled: false` injects PostHog
   * immediately as before. Components composed by hand take their own `consent` prop.
   */
  consent?: HagilightConsentOptions;
}

export interface HagilightConsentOptions {
  enabled?: boolean;
  /** An absolute HTTP(S) URL or a site-relative path for the privacy link. */
  privacyUrl?: string;
  /** Defaults to `1`. 1 to 32 letters, digits, dots, underscores or hyphens. */
  policyVersion?: string;
}

export interface HagilightPostHogOptions {
  /** Defaults to true when the provider options are omitted, otherwise to whether `apiKey` is set. */
  enabled?: boolean;
  /** Project key, `phc_` followed by ASCII letters or digits. Defaults to the HagiCode project key. */
  apiKey?: string;
}

export interface HagilightMetadataOptions {
  /** Defaults to `true`. */
  enabled?: boolean;
  /** Site name. Defaults to the home page `og:site_name` or title, then the site hostname. */
  name?: string;
  /** Site description. Defaults to the home page description. */
  description?: string;
}

export interface HagilightLlmsOptions {
  /** Defaults to `true`. */
  enabled?: boolean;
  /** Site name for the H1. Defaults to the home page `og:site_name` or title. */
  title?: string;
  /** Summary blockquote. Defaults to the home page description. */
  summary?: string;
  /** Language to list, for example `en-US`. Defaults to the Astro default locale, then the home page language. */
  lang?: string;
  /** Maximum links per section. Defaults to 12. */
  maxLinksPerSection?: number;
  /** Maximum links in total. Defaults to 120. */
  maxLinks?: number;
}

export interface HagilightContentImagesOptions {
  /** Defaults to `true`. */
  enabled?: boolean;
}

export interface HagilightRssOptions {
  /** Starlight-shaped locale map, for example `{ root: { lang: 'en-US' }, 'zh-CN': { lang: 'zh-CN' } }`. Derived from Astro `i18n` when omitted. */
  locales?: RssLocalesInput;
  /** Project-root-relative module whose default export is an `RssFeedCallback`. A built-in empty feed is used when omitted. */
  getFeed?: string;
}

export type HagilightFaviconOptions = FaviconOptions;

const VIRTUAL_RSS_CONFIG = 'virtual:hagilight/rss-config';
const VIRTUAL_RSS_CONFIG_RESOLVED = `\0${VIRTUAL_RSS_CONFIG}`;
const VIRTUAL_BUILD_INFO = 'virtual:hagilight/build-info';
const VIRTUAL_BUILD_INFO_RESOLVED = `\0${VIRTUAL_BUILD_INFO}`;
const PAGE_SOURCE_EXTENSIONS = new Set(['.astro', '.html', '.js', '.jsx', '.md', '.mdx', '.ts', '.tsx']);
const packageRoot = new URL('../', import.meta.url);
const routeEntrypoint = (name: string): string => fileURLToPath(new URL(name, packageRoot));

type ConfigPaths = Pick<AstroConfig, 'srcDir' | 'publicDir'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolvePostHogApiKey(analytics: unknown): string | undefined {
  if (analytics !== undefined && !isRecord(analytics)) {
    throw new TypeError('Hagilight analytics option must be an object.');
  }
  const posthog = analytics?.posthog;
  if (posthog === undefined) return DEFAULT_POSTHOG_API_KEY;
  if (!isRecord(posthog)) {
    throw new TypeError('Hagilight PostHog analytics options must be an object.');
  }
  if (posthog.enabled !== undefined && typeof posthog.enabled !== 'boolean') {
    throw new TypeError('Hagilight PostHog analytics enabled option must be a boolean.');
  }
  if (!(posthog.enabled ?? Boolean(posthog.apiKey))) return undefined;
  const apiKey = posthog.apiKey;
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('Hagilight PostHog analytics is enabled but its apiKey is missing.');
  }
  if (!POSTHOG_API_KEY_PATTERN.test(apiKey)) {
    throw new Error('Hagilight PostHog analytics apiKey has an invalid format.');
  }
  return apiKey;
}

function integrationName(integration: unknown): unknown {
  return isRecord(integration) ? integration.name : undefined;
}

const PACKAGE_VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
).version;

/** The plain-Astro site context: `site_id` is the configured site's hostname, when there is one. */
/** Consent for the injected PostHog: on by default, and the core validators name any invalid option. */
function resolveConsentOptions(analytics: unknown, posthogEnabled: boolean): {
  enabled: boolean;
  privacyUrl: string | undefined;
  policyVersion: string;
} {
  const consent = isRecord(analytics) ? analytics.consent : undefined;
  if (consent !== undefined && !isRecord(consent)) {
    throw new TypeError('Hagilight analytics consent option must be an object.');
  }
  if (consent?.enabled !== undefined && typeof consent.enabled !== 'boolean') {
    throw new TypeError('Hagilight analytics consent enabled option must be a boolean.');
  }
  return {
    enabled: posthogEnabled && (consent?.enabled ?? true),
    privacyUrl: validatePrivacyUrl(consent?.privacyUrl),
    policyVersion: validatePolicyVersion(consent?.policyVersion),
  };
}

function postHogSiteContext(site: unknown): PostHogSiteContext {
  let siteId: string | undefined;
  try {
    siteId = new URL(site as string | URL).hostname || undefined;
  } catch {
    siteId = undefined;
  }
  return { siteId, framework: 'astro', version: PACKAGE_VERSION };
}

function resolveDiscoverySite(site: unknown): URL {
  const message = 'Hagilight sitemap and robots require an absolute HTTP(S) Astro site URL. Set `site` in astro.config.mjs.';
  let parsed: URL;
  try {
    parsed = new URL(site as string | URL);
  } catch {
    throw new Error(message);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error(message);
  }
  return parsed;
}

/**
 * Built-in RSS feed used when a consumer does not supply a `getFeed` module.
 * It is serialized into the generated virtual module, so it must stay a pure
 * function with no external references.
 */
const BUILTIN_RSS_FEED = async (): Promise<{ title: string; description: string; items: never[] }> => ({
  title: 'Site Updates',
  description: 'RSS feed for this site.',
  items: [],
});
const BUILTIN_RSS_FEED_SOURCE = BUILTIN_RSS_FEED.toString();

/**
 * Generate a sitemap and `robots.txt` for a plain Astro site, and (by default)
 * localized RSS feeds. An existing `@astrojs/sitemap` or Starlight integration
 * owns sitemap generation, a consumer-owned robots page or public file takes
 * precedence, and an enabled Starlight Hagilight integration owns RSS feeds.
 */
export function hagilight({ enabled = true, rss, contentImages, llms, metadata, analytics }: HagilightOptions = {}): AstroIntegration {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('Hagilight sitemap and robots enabled option must be a boolean.');
  }
  if (contentImages !== undefined && typeof contentImages !== 'boolean' && !isRecord(contentImages)) {
    throw new TypeError('Hagilight content images option must be a boolean or an options object.');
  }
  if (isRecord(contentImages) && contentImages.enabled !== undefined && typeof contentImages.enabled !== 'boolean') {
    throw new TypeError('Hagilight content images enabled option must be a boolean.');
  }
  const posthogApiKey = resolvePostHogApiKey(analytics);
  const consent = resolveConsentOptions(analytics, posthogApiKey !== undefined);
  const llmsOptions = resolveLlmsOptions(llms);
  const metadataOptions = resolveSiteMetadataOption(metadata);
  const contentImagesEnabled = typeof contentImages === 'boolean' ? contentImages : contentImages?.enabled !== false;
  if (rss !== undefined && typeof rss !== 'boolean' && !isRecord(rss)) {
    throw new TypeError('Hagilight RSS option must be a boolean or an options object.');
  }
  if (isRecord(rss)) {
    if (rss.locales !== undefined && !isRecord(rss.locales)) {
      throw new TypeError('Hagilight RSS locales must be an object.');
    }
    if (rss.getFeed !== undefined && (typeof rss.getFeed !== 'string' || !rss.getFeed.trim())) {
      throw new TypeError('Hagilight RSS getFeed must be a non-empty module path.');
    }
  }
  let resolvedConfig: AstroConfig | undefined;
  let resolvedBuildInfo: BuildInfo | undefined;
  // Set when the Starlight plugin owns the metadata file. This integration then reports
  // after its `llms.txt` step, so the owner's write sees the final discovery outputs.
  let metadataPeerToken: symbol | undefined;
  return {
    name: '@hagicode/hagilight:discovery',
    hooks: {
      'astro:config:setup'({ command, config, injectRoute, injectScript, addMiddleware, updateConfig, logger }) {
        // Integrations added by this hook go in one update, in order: the sitemap first, then the
        // metadata finalizer, so the finalizer's build hook runs after the sitemap has written its index.
        let sitemapNeeded = false;
        try {
          registerContentImages({ config, logger, enabled: contentImagesEnabled });
          const buildInfo = resolveBuildInfo({ root: fileURLToPath(config.root) });
          resolvedBuildInfo = buildInfo;
          metadataPeerToken = resolveSiteMetadataOwner() === 'starlight' ? expectSiteMetadataReport() : undefined;
          updateConfig({ vite: { plugins: [createBuildInfoPlugin(buildInfo)] } });
          addMiddleware({ entrypoint: fileURLToPath(new URL('./build-info-middleware.js', import.meta.url)), order: 'pre' });
          // Independent of `enabled`. The shared script initializes once per document, and a Starlight
          // site gets PostHog from the Starlight plugin's generated Head instead.
          const hasStarlight = (config.integrations ?? []).some((integration) => integrationName(integration) === '@astrojs/starlight');
          if (posthogApiKey && command === 'build' && !hasStarlight) {
            if (consent.enabled) {
              // The loader travels inside an inert descriptor; the shared mount places the popup and starts PostHog
              // and its click sink only after a grant.
              const loader = posthogInitScript(posthogApiKey, postHogSiteContext(config.site));
              injectScript('head-inline', consentHeadScript({
                posthog: { apiKey: posthogApiKey, loader },
                config: { providers: ['posthog'], privacyUrl: consent.privacyUrl, policyVersion: consent.policyVersion },
              }));
              const mountModule = fileURLToPath(import.meta.resolve('@hagicode/hagilight-core/consent-mount'));
              injectScript('page', `import { mountConsent } from ${JSON.stringify(mountModule)};\nmountConsent();`);
            } else {
              injectScript('head-inline', posthogInitScript(posthogApiKey, postHogSiteContext(config.site)));
              // The click sink is independent of Google Analytics; it stays silent until window.posthog exists.
              const clickSink = fileURLToPath(import.meta.resolve('@hagicode/hagilight-core/posthog-events'));
              injectScript('page', `import { installPostHogClickTracking } from ${JSON.stringify(clickSink)};\ninstallPostHogClickTracking();`);
            }
          }
          if (!enabled) return;
          resolveDiscoverySite(config.site);

          const integrations: readonly unknown[] = config.integrations ?? [];
          sitemapNeeded = !integrations.some((integration) => {
            const name = integrationName(integration);
            return name === '@astrojs/sitemap' || name === '@astrojs/starlight';
          });

          const pageRoot = resolve(fileURLToPath(config.srcDir), 'pages');
          const publicRoot = fileURLToPath(config.publicDir);
          const hasRobotsPage = existsSync(pageRoot) && readdirSync(pageRoot).some((name) =>
            /^robots\.txt\.(?:astro|html|js|jsx|md|mdx|ts|tsx)$/u.test(name)
            || name === 'robots.txt');
          if (!hasRobotsPage && !existsSync(resolve(publicRoot, 'robots.txt'))) {
            injectRoute({
              pattern: '/robots.txt',
              entrypoint: routeEntrypoint('robots.txt.ts'),
              prerender: true,
            });
          }

          if (rss === false) return;
          if (resolvePlainAstroRssOwner(config.integrations) === 'starlight') return;

          const rssOptions: HagilightRssOptions = rss === true || rss === undefined ? {} : rss;
          const locales = resolveRssLocales(
            deriveRssLocales(rssOptions.locales, config),
            { requireNonEmpty: false },
          );
          const modulePath = rssOptions.getFeed
            ? resolveFeedModule(config.root, rssOptions.getFeed)
            : null;

          const site = resolveSite(config.site);
          assertNoRouteCollisions(config, locales);
          const baseSegments = `${config.base || '/' }`.split('/').filter(Boolean);
          const baseUrl = baseSegments.length > 0 ? `/${baseSegments.join('/')}/` : '/';
          const baseLocation = new URL(baseUrl, site);
          const defaultFeedUrl = new URL('rss.xml', baseLocation).href;
          const localeFeedUrls = Object.fromEntries(locales
            .filter(({ filename }) => filename !== 'en')
            .map(({ lang, filename }) => [lang, new URL(`rss.${filename}.xml`, baseLocation).href]));

          injectRoute({ pattern: '/rss.xml', entrypoint: routeEntrypoint('rss.xml.ts'), prerender: true });
          injectRoute({ pattern: '/rss.[language].xml', entrypoint: routeEntrypoint('rss.[language].xml.ts'), prerender: true });
          addMiddleware({ entrypoint: fileURLToPath(new URL('./rss-middleware.js', import.meta.url)), order: 'pre' });
          updateConfig({
            vite: {
              plugins: [createVirtualPlugin({ modulePath, site, baseUrl, locales, defaultFeedUrl, localeFeedUrls })],
            },
          });
        } finally {
          // The finalizer is skipped when a Starlight owner writes the file.
          const appended: AstroIntegration[] = [
            ...(sitemapNeeded ? [sitemap()] : []),
            ...(metadataPeerToken === undefined && metadataOptions.enabled
              ? [createMetadataFinalizer(() => ({ config: resolvedConfig, build: resolvedBuildInfo, options: metadataOptions }))]
              : []),
          ];
          if (appended.length > 0) updateConfig({ integrations: appended });
        }
      },
      'astro:config:done'({ config, logger }) {
        resolvedConfig = config;
        checkContentImageRegistration({ config, logger, enabled: contentImagesEnabled });
      },
      'astro:build:done'({ dir, pages, logger }) {
        try {
          if (enabled && llmsOptions.enabled && resolvedConfig) {
            writeLlmsTxt({ config: resolvedConfig, dir, pages, options: llmsOptions, logger });
          }
        } finally {
          if (metadataPeerToken !== undefined) {
            reportSiteMetadataBuilt(metadataPeerToken);
            metadataPeerToken = undefined;
          }
        }
      },
    },
  };
}

interface MetadataSource {
  config: AstroConfig | undefined;
  build: BuildInfo | undefined;
  options: { enabled: boolean; name?: string; description?: string };
}

/**
 * Integration appended after the sitemap, so its `astro:build:done` runs after
 * `@astrojs/sitemap` has written `sitemap-index.xml`. Hook order follows the
 * integration list, which is why the metadata write does not run in this integration's own hook.
 */
function createMetadataFinalizer(source: () => MetadataSource): AstroIntegration {
  return {
    name: '@hagicode/hagilight:metadata',
    hooks: {
      'astro:build:done'({ dir, pages, logger }) {
        const { config, build, options } = source();
        if (!config || !build || !options.enabled) return;
        writeAstroSiteMetadata({ config, outDir: fileURLToPath(dir), pages, build, options, logger });
      },
    },
  };
}

function resolveLlmsOptions(llms: boolean | HagilightLlmsOptions | undefined): HagilightLlmsOptions & { enabled: boolean } {
  if (llms !== undefined && typeof llms !== 'boolean' && !isRecord(llms)) {
    throw new TypeError('Hagilight llms option must be a boolean or an options object.');
  }
  if (typeof llms === 'boolean') return { enabled: llms };
  const options = llms ?? {};
  if (options.enabled !== undefined && typeof options.enabled !== 'boolean') {
    throw new TypeError('Hagilight llms enabled option must be a boolean.');
  }
  for (const key of ['title', 'summary', 'lang'] as const) {
    if (options[key] !== undefined && (typeof options[key] !== 'string' || !options[key]!.trim())) {
      throw new TypeError(`Hagilight llms ${key} must be a non-empty string.`);
    }
  }
  for (const key of ['maxLinksPerSection', 'maxLinks'] as const) {
    if (options[key] !== undefined && (!Number.isInteger(options[key]) || (options[key] as number) < 1)) {
      throw new TypeError(`Hagilight llms ${key} must be a positive integer.`);
    }
  }
  return { ...options, enabled: options.enabled !== false };
}

interface WriteLlmsTxtInput {
  config: AstroConfig;
  dir: URL;
  pages: readonly { pathname: string }[];
  options: HagilightLlmsOptions;
  logger: { info(message: string): void; warn(message: string): void };
}

function writeLlmsTxt({ config, dir, pages, options, logger }: WriteLlmsTxtInput): void {
  const outDir = fileURLToPath(dir);
  const target = join(outDir, 'llms.txt');
  if (existsSync(target)) {
    logger.info('llms.txt already exists in the build output; leaving it untouched.');
    return;
  }
  const base = `${config.base || '/'}`.replace(/\/?$/u, '/');
  const siteBase = new URL(base, config.site as string | URL);
  const i18n = config.i18n as { defaultLocale?: string } | undefined;
  const entries: LlmsPage[] = [];
  for (const { pathname } of pages) {
    const relative = pathname.replace(/^\/+/u, '');
    const candidates = relative === '' || relative.endsWith('/')
      ? [join(outDir, relative, 'index.html')]
      : [join(outDir, relative, 'index.html'), join(outDir, `${relative}.html`)];
    const file = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    if (!file) continue;
    const url = new URL(relative, siteBase).href;
    const meta = parsePageMeta(readFileSync(file, 'utf8'), url);
    if (!meta) continue;
    entries.push({ path: new URL(url).pathname.slice(siteBase.pathname.length - 1), url, lang: meta.lang, title: meta.title, description: meta.description, siteName: meta.siteName });
  }
  const body = buildLlmsTxt({
    pages: entries,
    title: options.title,
    summary: options.summary,
    lang: options.lang ?? i18n?.defaultLocale,
    maxLinksPerSection: options.maxLinksPerSection,
    maxLinks: options.maxLinks,
  });
  if (!body) {
    logger.warn('No indexable pages were found, so llms.txt was not generated.');
    return;
  }
  writeFileSync(target, body, 'utf8');
  logger.info(`Generated llms.txt from ${entries.length} page(s).`);
}

function deriveRssLocales(locales: RssLocalesInput | undefined, config: AstroConfig): RssLocalesInput | undefined {
  if (locales !== undefined) return locales;
  const i18n = config.i18n as { defaultLocale?: string; locales?: unknown[] } | undefined;
  if (!i18n?.locales?.length) return undefined;
  const defaultLocale = i18n.defaultLocale ?? String(i18n.locales[0]);
  const map: Record<string, { lang: string }> = {};
  for (const entry of i18n.locales) {
    const lang = typeof entry === 'string' ? entry : (entry as { codes?: string[]; path?: string }).codes?.[0]
      ?? (entry as { path?: string }).path;
    if (typeof lang !== 'string' || !lang.trim()) continue;
    if (lang === defaultLocale) map.root = { lang };
    else map[lang] = { lang };
  }
  return map;
}

function resolveFeedModule(root: URL, reference: string): string {
  if (reference.startsWith('file:') || isAbsolute(reference) || win32.isAbsolute(reference)) {
    throw new TypeError('Hagilight RSS getFeed must be a path relative to the Astro project root.');
  }
  const modulePath = resolve(fileURLToPath(root), reference);
  if (!existsSync(modulePath) || !statSync(modulePath).isFile()) {
    throw new Error(`Hagilight RSS getFeed module "${reference}" was not found relative to the Astro project root.`);
  }
  return modulePath;
}

interface VirtualRssConfig {
  modulePath: string | null;
  site: string;
  baseUrl: string;
  locales: readonly RssLocale[];
  defaultFeedUrl: string;
  localeFeedUrls: Record<string, string>;
}

function resolveSite(site: unknown): string {
  let parsed: URL;
  try {
    parsed = new URL(site as string | URL);
  } catch {
    throw new Error('Hagilight RSS requires an absolute Astro site URL. Set `site` in astro.config.mjs.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Hagilight RSS requires an absolute HTTP(S) Astro site URL.');
  }
  return parsed.href;
}

function assertNoRouteCollisions(config: ConfigPaths, locales: readonly RssLocale[]): void {
  const expectedFiles = new Set(['rss.xml', 'rss.en.xml', ...locales.map(({ filename }) => `rss.${filename}.xml`)]);
  const pageRoot = resolve(fileURLToPath(config.srcDir), 'pages');
  const publicRoot = fileURLToPath(config.publicDir);
  const collisions: string[] = [];

  function findPageCollisions(directory: string): void {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'rss.xml' || /^rss\..+\.xml$/u.test(entry.name)) {
          for (const child of readdirSync(entryPath, { withFileTypes: true })) {
            if (child.isFile()
              && child.name.startsWith('index.')
              && PAGE_SOURCE_EXTENSIONS.has(extname(child.name))) {
              collisions.push(resolve(entryPath, child.name));
            }
          }
        }
        findPageCollisions(entryPath);
      } else if (entry.isFile()) {
        const extension = extname(entry.name);
        if (!PAGE_SOURCE_EXTENSIONS.has(extension)) continue;
        const sourceName = entry.name.slice(0, -extension.length);
        if (expectedFiles.has(sourceName) || /^rss\..+\.xml$/u.test(sourceName)) {
          collisions.push(entryPath);
        }
      }
    }
  }
  findPageCollisions(pageRoot);

  for (const filename of expectedFiles) {
    const publicFile = resolve(publicRoot, filename);
    if (existsSync(publicFile) && statSync(publicFile).isFile()) collisions.push(publicFile);
  }

  if (collisions.length > 0) {
    throw new Error(`Hagilight RSS route conflicts with consumer-owned file(s): ${collisions.join(', ')}. Remove the conflicting route or disable RSS with rss: false.`);
  }
}

interface VirtualRssConfig {
  modulePath: string | null;
  site: string;
  baseUrl: string;
  locales: readonly RssLocale[];
  defaultFeedUrl: string;
  localeFeedUrls: Record<string, string>;
}

function createVirtualPlugin({ modulePath, site, baseUrl, locales, defaultFeedUrl, localeFeedUrls }: VirtualRssConfig) {
  const feedImport = modulePath ? `import * as siteFeedModule from ${JSON.stringify(modulePath)};` : '';
  const getFeedExpr = modulePath ? 'siteFeedModule.default' : `(${BUILTIN_RSS_FEED_SOURCE})`;
  return {
    name: '@hagicode/hagilight:rss',
    resolveId(id: string): string | null {
      return id === VIRTUAL_RSS_CONFIG ? VIRTUAL_RSS_CONFIG_RESOLVED : null;
    },
    load(id: string): string | null {
      if (id !== VIRTUAL_RSS_CONFIG_RESOLVED) return null;
      return [
        feedImport,
        'const config = {',
        `  site: ${JSON.stringify(site)},`,
        `  baseUrl: ${JSON.stringify(baseUrl)},`,
        `  locales: ${JSON.stringify(locales)},`,
        `  getFeed: ${getFeedExpr},`,
        `  footer: ${JSON.stringify({ defaultFeedUrl, localeFeedUrls, locales })},`,
        '};',
        'export default config;',
      ].join('\n');
    },
  };
}

function createBuildInfoPlugin(buildInfo: BuildInfo) {
  return {
    name: '@hagicode/hagilight:build-info',
    resolveId(id: string): string | null {
      return id === VIRTUAL_BUILD_INFO ? VIRTUAL_BUILD_INFO_RESOLVED : null;
    },
    load(id: string): string | null {
      if (id !== VIRTUAL_BUILD_INFO_RESOLVED) return null;
      return `export default ${JSON.stringify(buildInfo)};`;
    },
  };
}

/** Inject the bundled HagiCode favicon unless the site head already declares an icon. */
export function hagilightFavicon(options: HagilightFaviconOptions = {}): AstroIntegration {
  if (!isRecord(options)) {
    throw new TypeError('Hagilight favicon options must be an object.');
  }
  return {
    name: '@hagicode/hagilight:favicon',
    hooks: {
      'astro:config:setup'({ config, updateConfig }) {
        const head = (config as { head?: Parameters<typeof resolveFaviconHeadEntry>[0] }).head;
        const entry = resolveFaviconHeadEntry(head, options);
        if (!entry) return;
        updateConfig({ head: [...(head ?? []), entry] } as Parameters<typeof updateConfig>[0]);
      },
    },
  };
}