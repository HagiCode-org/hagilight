import type { HeadEntry } from './head.js';

export type { HeadAttributeValue, HeadEntry } from './head.js';

export interface SeoFields {
  title?: string;
  description?: string;
  image?: string;
}

export interface PageSeo extends SeoFields {
  author?: string;
  publishedDate?: Date | string | number;
}

export interface SeoMetadata {
  title?: string;
  description?: string;
  image?: string;
}

export interface SeoSiteOptions {
  site?: string | URL;
  basePath?: string;
}

export interface ResolveSeoMetadataOptions extends SeoSiteOptions {
  entry?: { data?: { title?: string; description?: string } };
  head?: readonly HeadEntry[];
  pageSeo?: SeoFields;
  siteSeo?: SeoFields;
  explicitHead?: readonly (readonly HeadEntry[] | undefined)[];
  body?: string;
}

export interface ComposeCanonicalSeoHeadOptions {
  canonicalUrl?: string | URL;
  explicitHead?: readonly (readonly HeadEntry[] | undefined)[];
}

export interface ArticleStructuredDataInput {
  url: string | URL;
  title: string;
  description?: string;
  author?: string;
  publishedDate?: Date | string | number;
  modifiedDate?: Date | string | number;
}

export interface BreadcrumbItem {
  name: string;
  url: string | URL;
}

export interface OrganizationStructuredDataInput {
  name: string;
  url: string | URL;
  logo?: string | URL;
  alternateName?: string;
}

export type StructuredData = Record<string, unknown>;

function normalizeBasePath(basePath: string = '/'): string {
  const normalized = `/${String(basePath).replace(/^\/+|\/+$/gu, '')}`;
  return normalized === '/' ? '' : normalized;
}

export function resolveAbsoluteHttpUrl(value: unknown, label = 'URL'): URL {
  let parsed: URL;
  try {
    parsed = new URL(value as string | URL);
  } catch {
    throw new TypeError(`Hagilight SEO ${label} must be an absolute HTTP(S) URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TypeError(`Hagilight SEO ${label} must be an absolute HTTP(S) URL.`);
  }
  return parsed;
}

export function resolveCanonicalUrl(pageUrl: string | URL, { site }: { site?: string | URL } = {}): string {
  const siteUrl = resolveAbsoluteHttpUrl(site, 'site');
  const canonical = resolveAbsoluteHttpUrl(pageUrl, 'page URL');
  if (canonical.origin !== siteUrl.origin) {
    throw new TypeError('Hagilight SEO page URL must use the configured Astro site origin.');
  }
  canonical.search = '';
  canonical.hash = '';
  return canonical.href;
}

export function extractSeoDescription(body: unknown): string | undefined {
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

function metaKey(entry: HeadEntry | undefined): string | undefined {
  if (entry?.tag !== 'meta') return undefined;
  const attrs = entry.attrs ?? {};
  if (typeof attrs.property === 'string') return `property:${attrs.property.toLowerCase()}`;
  if (typeof attrs.name === 'string') return `name:${attrs.name.toLowerCase()}`;
  return undefined;
}

function flattenHeads(heads: readonly (readonly HeadEntry[] | undefined)[]): HeadEntry[] {
  return heads.flatMap((head) => (Array.isArray(head) ? head : []));
}

function explicitMetaKeys(heads: readonly (readonly HeadEntry[] | undefined)[]): Set<string> {
  return new Set(flattenHeads(heads).map(metaKey).filter((key): key is string => Boolean(key)));
}

function metaContent(entry: HeadEntry | undefined): string | undefined {
  const content = entry?.attrs?.content;
  return typeof content === 'string' ? content : undefined;
}

function explicitMetaValue(heads: readonly (readonly HeadEntry[] | undefined)[], key: string): string | undefined {
  return metaContent(flattenHeads(heads).find((entry) => metaKey(entry) === key));
}

function existingMetaValue(head: readonly HeadEntry[], key: string): string | undefined {
  return metaContent(head.find((entry) => metaKey(entry) === key));
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
}: ResolveSeoMetadataOptions = {}): SeoMetadata {
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

export function isValidSeoImageReference(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function resolveSeoImageUrl(value: string, { site, basePath = '/' }: SeoSiteOptions = {}): string {
  if (!isValidSeoImageReference(value)) {
    throw new TypeError('Hagilight SEO image must be an absolute HTTP(S) URL or a site-root path.');
  }
  if (/^https?:\/\//iu.test(value)) return new URL(value).href;
  const siteUrl = resolveAbsoluteHttpUrl(site, 'site');
  const base = `${normalizeBasePath(basePath)}/`;
  return new URL(`${base}${value.replace(/^\/+/u, '')}`, siteUrl).href;
}

export function composeSeoHead(
  head: readonly HeadEntry[],
  metadata: SeoMetadata,
  explicitHead: readonly (readonly HeadEntry[] | undefined)[] = [],
): HeadEntry[] {
  const explicit = explicitMetaKeys(explicitHead);
  const values: [string, string | undefined][] = [
    ['property:og:title', metadata.title],
    ['property:og:description', metadata.description],
    ['property:og:image', metadata.image],
    ['name:twitter:title', metadata.title],
    ['name:twitter:description', metadata.description],
    ['name:twitter:image', metadata.image],
  ];
  const generatedKeys = new Set(values.map(([key]) => key));
  const seen = new Set<string>();
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

function isCanonicalLink(entry: HeadEntry): boolean {
  return entry.tag === 'link' && entry.attrs?.rel === 'canonical';
}

function canonicalHref(entry: HeadEntry | undefined): string | undefined {
  const href = entry?.attrs?.href;
  return typeof href === 'string' ? href : undefined;
}

/**
 * Compose Open Graph/Twitter metadata plus exactly one canonical link for a
 * plain Astro page. An explicit canonical link wins over existing ones, which
 * win over `canonicalUrl`.
 */
export function composeCanonicalSeoHead(
  head: readonly HeadEntry[],
  metadata: SeoMetadata & { site?: string | URL },
  { canonicalUrl, explicitHead = [] }: ComposeCanonicalSeoHeadOptions = {},
): HeadEntry[] {
  const canonicalSource = canonicalHref(flattenHeads(explicitHead).find(isCanonicalLink))
    ?? canonicalHref(head.find(isCanonicalLink))
    ?? canonicalUrl;
  if (canonicalSource === undefined) {
    throw new TypeError('Hagilight SEO page URL must be an absolute HTTP(S) URL.');
  }
  const canonical = resolveCanonicalUrl(canonicalSource, { site: metadata.site });
  const output = composeSeoHead(head.filter((entry) => !isCanonicalLink(entry)), metadata, explicitHead);
  const link: HeadEntry = { tag: 'link', attrs: { rel: 'canonical', href: canonical } };
  const insertionIndex = output.findIndex(({ tag }) => tag !== 'meta');
  output.splice(insertionIndex < 0 ? output.length : insertionIndex, 0, link);
  return output;
}

function dateValue(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? value : new Date(value as string | number);
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
}: ArticleStructuredDataInput): StructuredData {
  const canonicalUrl = resolveAbsoluteHttpUrl(url, 'article URL').href;
  if (typeof title !== 'string' || !title.trim()) {
    throw new TypeError('Hagilight SEO article title must be a non-empty string.');
  }
  const article: StructuredData = {
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

export function buildBreadcrumbStructuredData(items: readonly BreadcrumbItem[] = []): StructuredData {
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
}: OrganizationStructuredDataInput): StructuredData {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('Hagilight SEO organization name must be a non-empty string.');
  }
  const organization: StructuredData = {
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

/** Serialize JSON-LD safely for inline `<script type="application/ld+json">`. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}
