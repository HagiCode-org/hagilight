import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, isAbsolute, resolve, win32 } from 'node:path';
import sitemap from '@astrojs/sitemap';
import { resolveRssLocales } from './rss-locales.mjs';

export const HAGILIGHT_RSS_OWNER = Symbol.for('@hagicode/hagilight/rss-owner');
const VIRTUAL_RSS_CONFIG = 'virtual:hagilight/rss-config';
const VIRTUAL_RSS_CONFIG_RESOLVED = `\0${VIRTUAL_RSS_CONFIG}`;
const RSS_OWNER_REGISTRY = Symbol.for('@hagicode/hagilight/rss-owner-registry');
const PAGE_SOURCE_EXTENSIONS = new Set(['.astro', '.html', '.js', '.jsx', '.md', '.mdx', '.ts', '.tsx']);
const registeredRssOwners = globalThis[RSS_OWNER_REGISTRY] ?? new Map();
globalThis[RSS_OWNER_REGISTRY] = registeredRssOwners;

export function hagilight({ enabled = true } = {}) {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('Hagilight sitemap and robots enabled option must be a boolean.');
  }
  return {
    name: '@hagicode/hagilight:discovery',
    hooks: {
      'astro:config:setup'({ config, injectRoute, updateConfig }) {
        if (!enabled) return;
        if (!config.site) {
          throw new Error('Hagilight sitemap and robots require an absolute Astro site URL. Set `site` in astro.config.mjs.');
        }
        const integrations = config.integrations ?? [];
        if (!integrations.some(({ name }) => name === '@astrojs/sitemap' || name === '@astrojs/starlight')) {
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
            entrypoint: fileURLToPath(new URL('./robots.txt.ts', import.meta.url)),
            prerender: true,
          });
        }
      },
    },
  };
}

export function registerStarlightRssOwner(enabled) {
  const token = Symbol('starlight-rss-owner');
  registeredRssOwners.set(token, { package: 'starlight', enabled });
  return () => registeredRssOwners.delete(token);
}

function resolveOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Hagilight RSS integration options must be an object.');
  }
  const locales = resolveRssLocales(options.locales, { requireNonEmpty: true });
  if (typeof options.getFeed !== 'string' || !options.getFeed.trim()) {
    throw new TypeError('Hagilight RSS getFeed must be a non-empty module path such as "./src/rss-feed.mjs".');
  }
  return { locales, getFeed: options.getFeed.trim() };
}

function resolveSite(site) {
  let parsed;
  try {
    parsed = new URL(site);
  } catch {
    throw new Error('Hagilight RSS requires an absolute Astro site URL. Set `site` in astro.config.mjs.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Hagilight RSS requires an absolute HTTP(S) Astro site URL.');
  }
  return parsed.href;
}

function resolveFeedModule(root, reference) {
  if (reference.startsWith('file:') || isAbsolute(reference) || win32.isAbsolute(reference)) {
    throw new TypeError('Hagilight RSS getFeed must be a path relative to the Astro project root.');
  }
  const rootPath = fileURLToPath(root);
  const modulePath = resolve(rootPath, reference);
  if (!existsSync(modulePath) || !statSync(modulePath).isFile()) {
    throw new Error(`Hagilight RSS getFeed module "${reference}" was not found relative to the Astro project root.`);
  }
  return modulePath;
}

function routeCollisions(config, locales) {
  const expectedFiles = new Set(['rss.xml', 'rss.en.xml', ...locales.map(({ filename }) => `rss.${filename}.xml`)]);
  const pageRoot = resolve(fileURLToPath(config.srcDir), 'pages');
  const publicRoot = fileURLToPath(config.publicDir);
  const collisions = [];

  function findPageCollisions(directory) {
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

function findStarlightRss(config) {
  const registeredOwners = [...registeredRssOwners.values()];
  const owners = registeredOwners.length > 0
    ? registeredOwners
    : (config.integrations ?? [])
    .map((integration) => integration?.[HAGILIGHT_RSS_OWNER])
    .filter((owner) => owner?.package === 'starlight');
  registeredRssOwners.clear();
  return owners;
}

function createVirtualPlugin({ modulePath, site, baseUrl, locales, defaultFeedUrl, localeFeedUrls }) {
  return {
    name: '@hagicode/hagilight:rss',
    resolveId(id) {
      return id === VIRTUAL_RSS_CONFIG ? VIRTUAL_RSS_CONFIG_RESOLVED : null;
    },
    load(id) {
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

export function hagilightRss(input) {
  const options = resolveOptions(input);

  return {
    name: '@hagicode/hagilight:rss',
    [HAGILIGHT_RSS_OWNER]: { package: 'core', enabled: true },
    hooks: {
      'astro:config:setup'({ config, injectRoute, addMiddleware, updateConfig }) {
        const starlightOwners = findStarlightRss(config);
        const activeStarlightOwners = starlightOwners.filter((owner) => owner.enabled);
        if (activeStarlightOwners.length > 1) {
          throw new Error('Hagilight RSS cannot determine a sole route owner because multiple Starlight RSS integrations are enabled.');
        }
        if (activeStarlightOwners.length > 0) return;
        if (starlightOwners.length > 0) {
          throw new Error('Hagilight RSS cannot establish route ownership: Starlight RSS is explicitly disabled while hagilightRss() requests feed generation. Enable Starlight RSS or remove hagilightRss().');
        }

        const site = resolveSite(config.site);
        const modulePath = resolveFeedModule(config.root, options.getFeed);
        routeCollisions(config, options.locales);
        const baseSegments = `${config.base || '/'}`
          .split('/')
          .filter(Boolean);
        const baseUrl = baseSegments.length > 0 ? `/${baseSegments.join('/')}/` : '/';
        const baseLocation = new URL(baseUrl, site);
        const defaultFeedUrl = new URL('rss.xml', baseLocation).href;
        const localeFeedUrls = Object.fromEntries(options.locales
          .filter(({ filename }) => filename !== 'en')
          .map(({ lang, filename }) => [lang, new URL(`rss.${filename}.xml`, baseLocation).href]));
        const rssIntegrationPath = dirname(fileURLToPath(import.meta.url));
        const plugin = createVirtualPlugin({
          modulePath,
          site,
          baseUrl,
          locales: options.locales,
          defaultFeedUrl,
          localeFeedUrls,
        });

        injectRoute({
          pattern: '/rss.xml',
          entrypoint: resolve(rssIntegrationPath, './rss.xml.ts'),
          prerender: true,
        });
        injectRoute({
          pattern: '/rss.[language].xml',
          entrypoint: resolve(rssIntegrationPath, './rss.[language].xml.ts'),
          prerender: true,
        });
        addMiddleware({
          entrypoint: resolve(rssIntegrationPath, './rss-middleware.mjs'),
          order: 'pre',
        });
        updateConfig({ vite: { plugins: [plugin] } });
      },
    },
  };
}
