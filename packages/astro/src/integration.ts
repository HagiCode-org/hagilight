import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, isAbsolute, resolve, win32 } from 'node:path';
import sitemap from '@astrojs/sitemap';
import type { AstroConfig, AstroIntegration } from 'astro';
import { resolveFaviconHeadEntry, type FaviconOptions } from '@hagicode/hagilight-core/favicon';
import { resolveRssLocales, type RssLocale, type RssLocalesInput } from '@hagicode/hagilight-core/rss';
import {
  RSS_OWNER,
  resolvePlainAstroRssOwner,
  type RssOwnerClaim,
} from '@hagicode/hagilight-core/rss-ownership';

export type {
  RssFeedCallback,
  RssFeedContent,
  RssFeedRequest,
  RssFooterContext,
} from './rss-config.js';

export interface HagilightOptions {
  /** Generate `sitemap-index.xml` and `robots.txt`. Defaults to `true`. */
  enabled?: boolean;
}

export interface HagilightRssOptions {
  /** Starlight-shaped locale map, for example `{ root: { lang: 'en-US' }, 'zh-CN': { lang: 'zh-CN' } }`. */
  locales: RssLocalesInput;
  /** Project-root-relative module whose default export is an `RssFeedCallback`. */
  getFeed: string;
}

export type HagilightFaviconOptions = FaviconOptions;

export type HagilightRssIntegration = AstroIntegration & { readonly [RSS_OWNER]: RssOwnerClaim };

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
 * Generate a sitemap and `robots.txt` for a plain Astro site. An existing
 * `@astrojs/sitemap` or Starlight integration owns sitemap generation, and a
 * consumer-owned robots page or public file takes precedence.
 */
export function hagilight({ enabled = true }: HagilightOptions = {}): AstroIntegration {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('Hagilight sitemap and robots enabled option must be a boolean.');
  }
  return {
    name: '@hagicode/hagilight:discovery',
    hooks: {
      'astro:config:setup'({ config, injectRoute, updateConfig }) {
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
      },
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

function resolveRssOptions(options: unknown): { locales: RssLocale[]; getFeed: string } {
  if (!isRecord(options)) {
    throw new TypeError('Hagilight RSS integration options must be an object.');
  }
  const locales = resolveRssLocales(options.locales as RssLocalesInput | undefined, { requireNonEmpty: true });
  if (typeof options.getFeed !== 'string' || !options.getFeed.trim()) {
    throw new TypeError('Hagilight RSS getFeed must be a non-empty module path such as "./src/rss-feed.mjs".');
  }
  return { locales, getFeed: options.getFeed.trim() };
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
    throw new Error(`Hagilight RSS route conflicts with consumer-owned file(s): ${collisions.join(', ')}. Remove the conflicting route or do not enable hagilightRss().`);
  }
}

interface VirtualRssConfig {
  modulePath: string;
  site: string;
  baseUrl: string;
  locales: readonly RssLocale[];
  defaultFeedUrl: string;
  localeFeedUrls: Record<string, string>;
}

function createVirtualPlugin({ modulePath, site, baseUrl, locales, defaultFeedUrl, localeFeedUrls }: VirtualRssConfig) {
  return {
    name: '@hagicode/hagilight:rss',
    resolveId(id: string): string | null {
      return id === VIRTUAL_RSS_CONFIG ? VIRTUAL_RSS_CONFIG_RESOLVED : null;
    },
    load(id: string): string | null {
      if (id !== VIRTUAL_RSS_CONFIG_RESOLVED) return null;
      return [
        `import * as siteFeedModule from ${JSON.stringify(modulePath)};`,
        'const config = {',
        `  site: ${JSON.stringify(site)},`,
        `  baseUrl: ${JSON.stringify(baseUrl)},`,
        `  locales: ${JSON.stringify(locales)},`,
        '  getFeed: siteFeedModule.default,',
        `  footer: ${JSON.stringify({ defaultFeedUrl, localeFeedUrls, locales })},`,
        '};',
        'export default config;',
      ].join('\n');
    },
  };
}

/**
 * Generate localized `/rss.xml`, `/rss.en.xml`, and `/rss.<language>.xml`
 * routes and expose their URLs to the plain-Astro Footer. An enabled Starlight
 * Hagilight RSS integration in the same project owns the routes instead.
 */
export function hagilightRss(input: HagilightRssOptions): HagilightRssIntegration {
  const options = resolveRssOptions(input);

  return {
    name: '@hagicode/hagilight:rss',
    [RSS_OWNER]: { package: 'astro', enabled: true },
    hooks: {
      'astro:config:setup'({ config, injectRoute, addMiddleware, updateConfig }) {
        if (resolvePlainAstroRssOwner(config.integrations) === 'starlight') return;

        const site = resolveSite(config.site);
        const modulePath = resolveFeedModule(config.root, options.getFeed);
        assertNoRouteCollisions(config, options.locales);
        const baseSegments = `${config.base || '/'}`
          .split('/')
          .filter(Boolean);
        const baseUrl = baseSegments.length > 0 ? `/${baseSegments.join('/')}/` : '/';
        const baseLocation = new URL(baseUrl, site);
        const defaultFeedUrl = new URL('rss.xml', baseLocation).href;
        const localeFeedUrls = Object.fromEntries(options.locales
          .filter(({ filename }) => filename !== 'en')
          .map(({ lang, filename }) => [lang, new URL(`rss.${filename}.xml`, baseLocation).href]));

        injectRoute({
          pattern: '/rss.xml',
          entrypoint: routeEntrypoint('rss.xml.ts'),
          prerender: true,
        });
        injectRoute({
          pattern: '/rss.[language].xml',
          entrypoint: routeEntrypoint('rss.[language].xml.ts'),
          prerender: true,
        });
        addMiddleware({
          entrypoint: fileURLToPath(new URL('./rss-middleware.js', import.meta.url)),
          order: 'pre',
        });
        updateConfig({
          vite: {
            plugins: [createVirtualPlugin({
              modulePath,
              site,
              baseUrl,
              locales: options.locales,
              defaultFeedUrl,
              localeFeedUrls,
            })],
          },
        });
      },
    },
  };
}
