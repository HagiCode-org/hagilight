function normalizeBasePath(basePath = '/') {
  const normalized = `/${String(basePath).replace(/^\/+|\/+$/gu, '')}`;
  return normalized === '/' ? '' : normalized;
}

export function resolveAbsoluteHttpUrl(value, label = 'URL') {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`Hagilight SEO ${label} must be an absolute HTTP(S) URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TypeError(`Hagilight SEO ${label} must be an absolute HTTP(S) URL.`);
  }
  return parsed;
}

export function resolveCanonicalUrl(pageUrl, { site } = {}) {
  const siteUrl = resolveAbsoluteHttpUrl(site, 'site');
  const canonical = resolveAbsoluteHttpUrl(pageUrl, 'page URL');
  if (canonical.origin !== siteUrl.origin) {
    throw new TypeError('Hagilight SEO page URL must use the configured Astro site origin.');
  }
  canonical.search = '';
  canonical.hash = '';
  return canonical.href;
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

function metaKey(entry) {
  if (entry?.tag !== 'meta') return undefined;
  const attrs = entry.attrs ?? {};
  if (typeof attrs.property === 'string') return `property:${attrs.property.toLowerCase()}`;
  if (typeof attrs.name === 'string') return `name:${attrs.name.toLowerCase()}`;
  return undefined;
}

function explicitMetaKeys(heads) {
  return new Set(heads.flatMap((head) => (Array.isArray(head) ? head : []))
    .map(metaKey)
    .filter(Boolean));
}

function explicitMetaValue(heads, key) {
  return heads.flatMap((head) => (Array.isArray(head) ? head : []))
    .find((entry) => metaKey(entry) === key)?.attrs?.content;
}

function existingMetaValue(head, key) {
  return head.find((entry) => metaKey(entry) === key)?.attrs?.content;
}

export function resolveSeoMetadata({
  entry,
  head = [],
  pageSeo = {},
  siteSeo = {},
  site,
  basePath = '/',
  explicitHead = [],
  body,
} = {}) {
  const data = entry?.data ?? {};
  const title = pageSeo.title
    ?? siteSeo.title
    ?? data.title
    ?? existingMetaValue(head, 'property:og:title');
  const description = pageSeo.description
    ?? data.description
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

export function resolveSeoImageUrl(value, { site, basePath = '/' } = {}) {
  if (!isValidSeoImageReference(value)) {
    throw new TypeError('Hagilight SEO image must be an absolute HTTP(S) URL or a site-root path.');
  }
  if (/^https?:\/\//iu.test(value)) return new URL(value).href;
  const siteUrl = resolveAbsoluteHttpUrl(site, 'site');
  const base = `${normalizeBasePath(basePath)}/`;
  return new URL(`${base}${value.replace(/^\/+/u, '')}`, siteUrl).href;
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
  const seen = new Set();
  const result = head.filter((entry) => {
    const key = metaKey(entry);
    if (!key || !generatedKeys.has(key)) return true;
    if (explicit.has(key)) {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }
    return false;
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

export function composeCoreSeoHead(head, metadata, {
  canonicalUrl,
  explicitHead = [],
} = {}) {
  const canonicalEntries = head.filter(({ tag, attrs }) => tag === 'link' && attrs?.rel === 'canonical');
  const explicitCanonical = explicitHead.flatMap((entries) => Array.isArray(entries) ? entries : [])
    .find(({ tag, attrs }) => tag === 'link' && attrs?.rel === 'canonical');
  const canonicalSource = explicitCanonical?.attrs?.href
    ?? canonicalEntries[0]?.attrs?.href
    ?? canonicalUrl;
  const canonical = resolveCanonicalUrl(canonicalSource, { site: metadata.site });
  const withoutCanonical = head.filter(({ tag, attrs }) => !(tag === 'link' && attrs?.rel === 'canonical'));
  const output = composeSeoHead(withoutCanonical, metadata, explicitHead);
  const link = { tag: 'link', attrs: { rel: 'canonical', href: canonical } };
  const insertionIndex = output.findIndex(({ tag }) => tag !== 'meta');
  output.splice(insertionIndex < 0 ? output.length : insertionIndex, 0, link);
  return output;
}

function dateValue(value, field) {
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Hagilight SEO ${field} must be a valid date.`);
  }
  return date.toISOString();
}

export function buildArticleStructuredData({
  url,
  title,
  description,
  author,
  publishedDate,
  modifiedDate,
} = {}) {
  const canonicalUrl = resolveAbsoluteHttpUrl(url, 'article URL').href;
  if (typeof title !== 'string' || !title.trim()) {
    throw new TypeError('Hagilight SEO article title must be a non-empty string.');
  }
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title.trim(),
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
  };
  if (typeof description === 'string' && description.trim()) article.description = description.trim();
  const published = dateValue(publishedDate, 'article publishedDate');
  const modified = dateValue(modifiedDate, 'article modifiedDate');
  if (published) article.datePublished = published;
  if (modified) article.dateModified = modified;
  if (typeof author === 'string' && author.trim()) {
    article.author = { '@type': 'Person', name: author.trim() };
  }
  return article;
}

export function buildBreadcrumbStructuredData(items = []) {
  if (!Array.isArray(items)) throw new TypeError('Hagilight SEO breadcrumb items must be an array.');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ name, url }, index) => {
      if (typeof name !== 'string' || !name.trim()) {
        throw new TypeError('Hagilight SEO breadcrumb names must be non-empty strings.');
      }
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: name.trim(),
        item: resolveAbsoluteHttpUrl(url, 'breadcrumb URL').href,
      };
    }),
  };
}

export function buildOrganizationStructuredData({
  name,
  url,
  logo,
  alternateName,
} = {}) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('Hagilight SEO organization name must be a non-empty string.');
  }
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: name.trim(),
    url: resolveAbsoluteHttpUrl(url, 'organization URL').href,
  };
  if (logo !== undefined) organization.logo = resolveAbsoluteHttpUrl(logo, 'organization logo').href;
  if (typeof alternateName === 'string' && alternateName.trim()) {
    organization.alternateName = alternateName.trim();
  }
  return organization;
}

export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}
