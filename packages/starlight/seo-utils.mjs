import { isBlogEntry } from './rss-utils.mjs';
import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
  buildOrganizationStructuredData,
} from '@hagicode/hagilight/seo-utils';

export {
  composeSeoHead,
  extractSeoDescription,
  isValidSeoImageReference,
  resolveSeoImageUrl,
  resolveSeoMetadata,
  serializeJsonLd,
} from '@hagicode/hagilight/seo-utils';

const normalizeSlug = (slug) => slug
  .replace(/^\/+|\/+$/gu, '')
  .replace(/(?:^|\/)index$/u, '');
const publishedLookupCache = new WeakMap();

export function resolveSeoLocales(locales) {
  const entries = locales === undefined
    ? [['root', { lang: 'en' }]]
    : Object.entries(locales);
  const usedLanguages = new Map();
  const resolved = entries.map(([route, config]) => {
    const lang = typeof config === 'string'
      ? config
      : config?.lang ?? (route === 'root' ? undefined : route);
    if (typeof lang !== 'string' || !lang.trim()) {
      throw new TypeError(`Hagilight SEO locale "${route}" must have a language tag.`);
    }

    let normalizedLang;
    try {
      [normalizedLang] = Intl.getCanonicalLocales(lang);
    } catch {
      throw new TypeError(`Hagilight SEO locale "${route}" has an invalid language tag "${lang}".`);
    }

    const collisionKey = normalizedLang.toLowerCase();
    const existingRoute = usedLanguages.get(collisionKey);
    if (existingRoute) {
      throw new Error(
        `Hagilight SEO locales "${existingRoute}" and "${route}" use the same language tag "${normalizedLang}".`,
      );
    }
    usedLanguages.set(collisionKey, route);
    return { route, lang: normalizedLang };
  });

  if (resolved.length === 0) {
    throw new Error('Hagilight SEO requires at least one configured Starlight locale.');
  }
  return resolved;
}

export function resolveSeoPage(entryId, locales) {
  const id = normalizeSlug(entryId ?? '');
  const localizedRoutes = locales
    .filter(({ route }) => route !== 'root')
    .sort((left, right) => right.route.length - left.route.length);
  const localized = localizedRoutes.find(({ route }) => id === route || id.startsWith(`${route}/`));
  if (localized) {
    return {
      route: localized.route,
      slug: normalizeSlug(id.slice(localized.route.length)),
    };
  }
  return { route: 'root', slug: id };
}

export function createPublishedDocsLookup(entries, locales) {
  const localeKey = JSON.stringify(locales);
  let lookups = publishedLookupCache.get(entries);
  if (lookups?.has(localeKey)) return lookups.get(localeKey);

  const pages = new Map();
  for (const entry of entries) {
    if (!entry || entry.data?.draft === true) continue;
    const page = resolveSeoPage(entry.id, locales);
    pages.set(`${page.route}\u0000${page.slug}`, entry);
  }
  const lookup = {
    get(route, slug) {
      return pages.get(`${route}\u0000${normalizeSlug(slug)}`);
    },
    has(route, slug) {
      return pages.has(`${route}\u0000${normalizeSlug(slug)}`);
    },
  };
  if (!lookups) {
    lookups = new Map();
    publishedLookupCache.set(entries, lookups);
  }
  lookups.set(localeKey, lookup);
  return lookup;
}

function parseCandidatePage(href, { locales, basePath }) {
  let pathname;
  try {
    pathname = new URL(href).pathname;
  } catch {
    return undefined;
  }

  const base = `/${(basePath ?? '/').replace(/^\/+|\/+$/gu, '')}`;
  if (base !== '/' && pathname !== base && !pathname.startsWith(`${base}/`)) return undefined;
  if (base !== '/') pathname = pathname.slice(base.length) || '/';

  const segments = pathname.split('/').filter(Boolean);
  if (segments.at(-1) === 'index.html') segments.pop();
  else if (segments.at(-1)?.endsWith('.html')) {
    segments[segments.length - 1] = segments.at(-1).slice(0, -5);
  }

  const routes = locales
    .filter(({ route }) => route !== 'root')
    .sort((left, right) => right.route.length - left.route.length);
  let route = 'root';
  if (segments[0]?.endsWith('.html')) {
    const first = segments[0].slice(0, -5);
    const matched = routes.find((locale) => locale.route === first);
    if (matched) {
      route = matched.route;
      segments.shift();
    }
  } else {
    const matched = routes.find(({ route: localeRoute }) => segments[0] === localeRoute);
    if (matched) {
      route = matched.route;
      segments.shift();
    }
  }

  return { route, slug: normalizeSlug(segments.join('/')) };
}

function isAlternateLink(entry) {
  return entry?.tag === 'link'
    && entry.attrs?.rel === 'alternate'
    && typeof entry.attrs.hreflang === 'string'
    && typeof entry.attrs.href === 'string';
}

function explicitAlternateKeys(heads) {
  return new Set(heads.flatMap((head) => (Array.isArray(head) ? head : [])
    .filter(isAlternateLink)
    .map(({ attrs }) => `${attrs.hreflang.toLowerCase()}\u0000${attrs.href}`)));
}

export function filterPublishedLocaleAlternates(head, {
  entryId,
  locales,
  lookup,
  basePath = '/',
  explicitHead = [],
}) {
  const page = resolveSeoPage(entryId, locales);
  const explicit = explicitAlternateKeys(explicitHead);
  const routesByLanguage = new Map(locales.map(({ route, lang }) => [lang.toLowerCase(), route]));

  return head.filter((entry) => {
    if (!isAlternateLink(entry)) return true;
    const { href, hreflang } = entry.attrs;
    if (explicit.has(`${hreflang.toLowerCase()}\u0000${href}`)) return true;

    const candidate = parseCandidatePage(href, { locales, basePath });
    if (!candidate || candidate.slug !== page.slug) return true;
    if (hreflang.toLowerCase() === 'x-default') {
      return lookup.has(candidate.route, candidate.slug);
    }

    const configuredRoute = routesByLanguage.get(hreflang.toLowerCase());
    if (!configuredRoute || configuredRoute !== candidate.route) return true;
    return lookup.has(configuredRoute, candidate.slug);
  });
}

function normalizeBasePath(basePath = '/') {
  const normalized = `/${basePath.replace(/^\/+|\/+$/gu, '')}`;
  return normalized === '/' ? '' : normalized;
}

export function buildDocsPageUrl(route, slug, {
  site,
  basePath = '/',
  format = 'directory',
  trailingSlash = 'always',
}) {
  const id = [route === 'root' ? '' : route, normalizeSlug(slug)].filter(Boolean).join('/');
  let pagePath;
  if (format === 'file') {
    pagePath = `/${id ? `${id}.html` : 'index.html'}`;
  } else if (!id) {
    pagePath = '/';
  } else {
    pagePath = `/${id}${trailingSlash === 'never' ? '' : '/'}`;
  }

  const base = normalizeBasePath(basePath);
  return new URL(`${base}${pagePath}`, site).href;
}

export function buildStructuredData({
  entry,
  entryId,
  canonicalUrl,
  site,
  siteTitle,
  pageSeo = {},
  organization,
  locales,
  defaultLocale = 'root',
  lookup,
  basePath = '/',
  format = 'directory',
  trailingSlash = 'always',
}) {
  if (!entry || entry.data?.draft === true || !canonicalUrl) return [];
  const page = resolveSeoPage(entryId, locales);
  if (!lookup.has(page.route, page.slug)) return [];

  const data = entry.data ?? {};
  const structuredData = [];
  if (isBlogEntry(page.slug)) {
    structuredData.push(buildArticleStructuredData({
      url: canonicalUrl,
      title: data.title,
      description: pageSeo.description ?? data.description,
      author: pageSeo.author ?? data.author,
      publishedDate: pageSeo.publishedDate ?? data.publishedDate,
      modifiedDate: data.lastUpdated,
    }));
  }

  const slugParts = page.slug.split('/').filter(Boolean);
  const crumbs = [];
  for (let index = 0; index <= slugParts.length; index += 1) {
    const ancestorSlug = slugParts.slice(0, index).join('/');
    const ancestor = lookup.get(page.route, ancestorSlug);
    if (!ancestor) continue;
    const url = ancestorSlug === page.slug
      ? canonicalUrl
      : buildDocsPageUrl(page.route, ancestorSlug, {
        site,
        basePath,
        format,
        trailingSlash,
      });
    crumbs.push({ name: ancestor.data.title, url });
  }
  if (crumbs.length > 0) {
    structuredData.push(buildBreadcrumbStructuredData(crumbs));
  }

  if (organization && page.route === defaultLocale && page.slug === '') {
    structuredData.push(buildOrganizationStructuredData({
      ...organization,
      alternateName: siteTitle,
    }));
  }
  return structuredData;
}
