import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, isAbsolute, resolve, win32 } from 'node:path';
import sitemap from '@astrojs/sitemap';
import type { AstroConfig, AstroIntegration } from 'astro';
import { resolveFaviconHeadEntry, type FaviconOptions } from '@hagicode/hagilight-core/favicon';
import { resolveRssLocales, type RssLocale, type RssLocalesInput } from '@hagicode/hagilight-core/rss';
import { resolvePlainAstroRssOwner } from '@hagicode/hagilight-core/rss-ownership';

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
const PAGE_SOURCE_EXTENSIONS = new Set(['.astro', '.html', '.js', '.jsx', '.md', '.mdx', '.ts', '.tsx']);
const packageRoot = new URL('../', import.meta.url);
const routeEntrypoint = (name: string): string => fileURLToPath(new URL(name, packageRoot));

type ConfigPaths = Pick<AstroConfig, 'srcDir' | 'publicDir'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function integrationName(integration: unknown): unknown {
  return isRecord(integration) ? integration.name : undefined;
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
export function hagilight({ enabled = true, rss }: HagilightOptions = {}): AstroIntegration {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('Hagilight sitemap and robots enabled option must be a boolean.');
  }
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
  return {
    name: '@hagicode/hagilight:discovery',
    hooks: {
      'astro:config:setup'({ config, injectRoute, addMiddleware, updateConfig }) {
        if (!enabled) return;
        resolveDiscoverySite(config.site);

        const integrations: readonly unknown[] = config.integrations ?? [];
        if (!integrations.some((integration) => {
          const name = integrationName(integration);
          return name === '@astrojs/sitemap' || name === '@astrojs/starlight';
        })) {
          updateConfig({ integrations: [sitemap()] });
        }

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
      },
    },
  };
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