import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
  buildOrganizationStructuredData,
  type HeadEntry,
  type StructuredData,
} from '@hagicode/hagilight-core/seo';
import { isBlogEntry } from './rss-utils.js';
import type { TrailingSlash } from './not-found.js';

export interface SeoLocale {
  route: string;
  lang: string;
}

export interface SeoPage {
  route: string;
  slug: string;
}

export interface SeoDocsEntry {
  id: string;
  body?: string | undefined;
  data: {
    title: string;
    description?: string | undefined;
    draft?: boolean | undefined;
    author?: string | undefined;
    publishedDate?: Date | string | number | undefined;
    lastUpdated?: Date | string | number | undefined | unknown;
    [key: string]: unknown;
  };
}

export interface PublishedDocsLookup<Entry extends SeoDocsEntry = SeoDocsEntry> {
  get(route: string, slug: string): Entry | undefined;
  has(route: string, slug: string): boolean;
}

export type BuildFormat = 'directory' | 'file' | 'preserve';

export interface SeoOrganization {
  name: string;
  url: string;
  logo?: string;
}

const normalizeSlug = (slug: string): string => slug
  .replace(/^\/+|\/+$/gu, '')
  .replace(/(?:^|\/)index$/u, '');
const publishedLookupCache = new WeakMap<object, Map<string, PublishedDocsLookup<SeoDocsEntry>>>();

export type SeoLocalesInput = Readonly<Record<string, string | { lang?: string | undefined } | undefined>>;

export function resolveSeoLocales(locales: SeoLocalesInput | undefined): SeoLocale[] {
  const entries: [string, string | { lang?: string | undefined } | undefined][] = locales === undefined
    ? [['root', { lang: 'en' }]]
    : Object.entries(locales);
  const usedLanguages = new Map<string, string>();
  const resolved = entries.map(([route, config]) => {
    const lang = typeof config === 'string'
      ? config
      : config?.lang ?? (route === 'root' ? undefined : route);
    if (typeof lang !== 'string' || !lang.trim()) {
      throw new TypeError(`Hagilight SEO locale "${route}" must have a language tag.`);
    }

    let normalizedLang: string;
    try {
      [normalizedLang] = Intl.getCanonicalLocales(lang) as [string];
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

export function resolveSeoPage(entryId: string | undefined, locales: readonly SeoLocale[]): SeoPage {
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

export function createPublishedDocsLookup<Entry extends SeoDocsEntry>(
  entries: readonly Entry[],
  locales: readonly SeoLocale[],
): PublishedDocsLookup<Entry> {
  const localeKey = JSON.stringify(locales);
  let lookups = publishedLookupCache.get(entries);
  const cached = lookups?.get(localeKey);
  if (cached) return cached as PublishedDocsLookup<Entry>;

  const pages = new Map<string, Entry>();
  for (const entry of entries) {
    if (!entry || entry.data?.draft === true) continue;
    const page = resolveSeoPage(entry.id, locales);
    pages.set(`${page.route}\u0000${page.slug}`, entry);
  }
  const lookup: PublishedDocsLookup<Entry> = {
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
  lookups.set(localeKey, lookup as PublishedDocsLookup<SeoDocsEntry>);
  return lookup;
}

function parseCandidatePage(
  href: string,
  { locales, basePath }: { locales: readonly SeoLocale[]; basePath: string | undefined },
): SeoPage | undefined {
  let pathname: string;
  try {
    pathname = new URL(href).pathname;
  } catch {
    return undefined;
  }

  const base = `/${(basePath ?? '/').replace(/^\/+|\/+$/gu, '')}`;
  if (base !== '/' && pathname !== base && !pathname.startsWith(`${base}/`)) return undefined;
  if (base !== '/') pathname = pathname.slice(base.length) || '/';

  const segments = pathname.split('/').filter(Boolean);
  const last = segments.at(-1);
  if (last === 'index.html') segments.pop();
  else if (last?.endsWith('.html')) {
    segments[segments.length - 1] = last.slice(0, -5);
  }

  const routes = locales
    .filter(({ route }) => route !== 'root')
    .sort((left, right) => right.route.length - left.route.length);
  let route = 'root';
  const first = segments[0];
  if (first?.endsWith('.html')) {
    const matched = routes.find((locale) => locale.route === first.slice(0, -5));
    if (matched) {
      route = matched.route;
      segments.shift();
    }
  } else {
    const matched = routes.find(({ route: localeRoute }) => first === localeRoute);
    if (matched) {
      route = matched.route;
      segments.shift();
    }
  }

  return { route, slug: normalizeSlug(segments.join('/')) };
}

interface AlternateLink extends HeadEntry {
  attrs: HeadEntry['attrs'] & { rel: 'alternate'; hreflang: string; href: string };
}

function isAlternateLink(entry: HeadEntry | undefined): entry is AlternateLink {
  return entry?.tag === 'link'
    && entry.attrs?.rel === 'alternate'
    && typeof entry.attrs.hreflang === 'string'
    && typeof entry.attrs.href === 'string';
}

function explicitAlternateKeys(heads: readonly (readonly HeadEntry[] | undefined)[]): Set<string> {
  return new Set(heads.flatMap((head) => (Array.isArray(head) ? head : [])
    .filter(isAlternateLink)
    .map(({ attrs }) => `${attrs.hreflang.toLowerCase()}\u0000${attrs.href}`)));
}

export interface FilterAlternatesOptions {
  entryId: string;
  locales: readonly SeoLocale[];
  lookup: PublishedDocsLookup<SeoDocsEntry>;
  basePath?: string;
  explicitHead?: readonly (readonly HeadEntry[] | undefined)[];
}

export function filterPublishedLocaleAlternates<Entry extends HeadEntry>(head: readonly Entry[], {
  entryId,
  locales,
  lookup,
  basePath = '/',
  explicitHead = [],
}: FilterAlternatesOptions): Entry[] {
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

function normalizeBasePath(basePath: string = '/'): string {
  const normalized = `/${basePath.replace(/^\/+|\/+$/gu, '')}`;
  return normalized === '/' ? '' : normalized;
}

export interface DocsPageUrlOptions {
  site: string | URL;
  basePath?: string;
  format?: BuildFormat;
  trailingSlash?: TrailingSlash;
}

export function buildDocsPageUrl(route: string, slug: string, {
  site,
  basePath = '/',
  format = 'directory',
  trailingSlash = 'always',
}: DocsPageUrlOptions): string {
  const id = [route === 'root' ? '' : route, normalizeSlug(slug)].filter(Boolean).join('/');
  let pagePath: string;
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

export interface BuildStructuredDataOptions {
  entry: SeoDocsEntry | undefined;
  entryId: string;
  canonicalUrl: string | undefined;
  site: string | URL;
  siteTitle?: string | undefined;
  pageSeo?: { description?: string | undefined; author?: string | undefined; publishedDate?: Date | string | number | undefined };
  organization?: SeoOrganization | undefined;
  locales: readonly SeoLocale[];
  defaultLocale?: string;
  lookup: PublishedDocsLookup<SeoDocsEntry>;
  basePath?: string;
  format?: BuildFormat;
  trailingSlash?: TrailingSlash;
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
}: BuildStructuredDataOptions): StructuredData[] {
  if (!entry || entry.data?.draft === true || !canonicalUrl) return [];
  const page = resolveSeoPage(entryId, locales);
  if (!lookup.has(page.route, page.slug)) return [];

  const data = entry.data ?? {};
  const structuredData: StructuredData[] = [];
  if (isBlogEntry(page.slug)) {
    structuredData.push(buildArticleStructuredData({
      url: canonicalUrl,
      title: data.title,
      description: pageSeo.description ?? data.description,
      author: pageSeo.author ?? data.author,
      publishedDate: pageSeo.publishedDate ?? data.publishedDate,
      modifiedDate: data.lastUpdated as Date | string | number | undefined,
    }));
  }

  const slugParts = page.slug.split('/').filter(Boolean);
  const crumbs: { name: string; url: string }[] = [];
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
      ...(siteTitle === undefined ? {} : { alternateName: siteTitle }),
    }));
  }
  return structuredData;
}
