import { isBlogEntry } from './rss-utils.mjs';

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

function validDate(value) {
  if (value === undefined || value === null || value === false) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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
    const article = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.title,
      url: canonicalUrl,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    };
    const description = pageSeo.description ?? data.description;
    if (description) article.description = description;
    const published = validDate(pageSeo.publishedDate ?? data.publishedDate);
    const modified = validDate(data.lastUpdated);
    if (published) article.datePublished = published;
    if (modified) article.dateModified = modified;
    const author = pageSeo.author ?? data.author;
    if (typeof author === 'string' && author.trim()) {
      article.author = { '@type': 'Person', name: author.trim() };
    }
    structuredData.push(article);
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
    crumbs.push({
      '@type': 'ListItem',
      position: crumbs.length + 1,
      name: ancestor.data.title,
      item: url,
    });
  }
  if (crumbs.length > 0) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs,
    });
  }

  if (organization && page.route === defaultLocale && page.slug === '') {
    const org = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: organization.name,
      url: organization.url,
    };
    if (organization.logo) org.logo = organization.logo;
    if (siteTitle) org.alternateName = siteTitle;
    structuredData.push(org);
  }
  return structuredData;
}

export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}

function metaKey(entry) {
  if (entry?.tag !== 'meta') return undefined;
  const attrs = entry.attrs ?? {};
  if (typeof attrs.property === 'string') return `property:${attrs.property.toLowerCase()}`;
  if (typeof attrs.name === 'string') return `name:${attrs.name.toLowerCase()}`;
  return undefined;
}

function existingMetaValue(head, key) {
  return head.find((entry) => metaKey(entry) === key)?.attrs?.content;
}

function explicitMetaValue(heads, key) {
  return heads.flatMap((head) => (Array.isArray(head) ? head : []))
    .find((entry) => metaKey(entry) === key)?.attrs?.content;
}

export function extractSeoDescription(body) {
  if (typeof body !== 'string' || !body.trim()) return undefined;
  const text = body
    .replace(/^```[\s\S]*?^```/gmu, ' ')
    .replace(/^import\s.+;?\s*$/gmu, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/gmu, '')
    .replace(/[*_~]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!text) return undefined;

  const characters = Array.from(text);
  if (characters.length <= 160) return text;
  let end = 159;
  const boundary = characters.slice(0, end).lastIndexOf(' ');
  if (boundary > 120) end = boundary;
  return `${characters.slice(0, end).join('').trimEnd()}…`;
}

export function resolveSeoMetadata({
  entry,
  head,
  pageSeo = {},
  siteSeo = {},
  site,
  basePath = '/',
  explicitHead = [],
  body,
}) {
  const title = pageSeo.title
    ?? siteSeo.title
    ?? entry.data.title
    ?? existingMetaValue(head, 'property:og:title');
  const description = pageSeo.description
    ?? entry.data.description
    ?? explicitMetaValue(explicitHead, 'name:description')
    ?? explicitMetaValue(explicitHead, 'property:og:description')
    ?? extractSeoDescription(body)
    ?? existingMetaValue(head, 'name:description')
    ?? existingMetaValue(head, 'property:og:description')
    ?? siteSeo.description;
  const image = pageSeo.image ?? siteSeo.image;

  return {
    title,
    description,
    image: image === undefined ? undefined : resolveSeoImageUrl(image, { site, basePath }),
  };
}

export function isValidSeoImageReference(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function resolveSeoImageUrl(value, { site, basePath = '/' }) {
  if (!isValidSeoImageReference(value)) {
    throw new TypeError('Hagilight SEO image must be an absolute HTTP(S) URL or a site-root path.');
  }
  if (/^https?:\/\//iu.test(value)) return new URL(value).href;
  const base = `${normalizeBasePath(basePath)}/`;
  return new URL(`${base}${value.replace(/^\/+/u, '')}`, site).href;
}

function explicitMetaKeys(heads) {
  return new Set(heads.flatMap((head) => (Array.isArray(head) ? head : [])
    .map(metaKey)
    .filter(Boolean)));
}

export function composeSeoHead(head, metadata, explicitHead = []) {
  const explicit = explicitMetaKeys(explicitHead);
  const values = [
    ['property:og:title', metadata.title],
    ['property:og:description', metadata.description],
    ['property:og:image', metadata.image],
    ['name:twitter:title', metadata.title],
    ['name:twitter:description', metadata.description],
    ['name:twitter:image', metadata.image],
  ];
  const generatedKeys = new Set(values.map(([key]) => key));
  const result = head.filter((entry) => {
    const key = metaKey(entry);
    return !key || explicit.has(key) || !generatedKeys.has(key);
  });
  const present = new Set(result.map(metaKey).filter(Boolean));

  for (const [key, content] of values) {
    if (content === undefined || explicit.has(key) || present.has(key)) continue;
    const separator = key.indexOf(':');
    const attribute = key.slice(0, separator);
    const value = key.slice(separator + 1);
    result.push({ tag: 'meta', attrs: { [attribute]: value, content } });
  }
  return result;
}
