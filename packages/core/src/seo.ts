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
  sameAs?: readonly (string | URL)[];
}

export interface SoftwareApplicationOffer {
  price: number | string;
  priceCurrency: string;
  url?: string | URL;
  /** A schema.org ItemAvailability URL, or a bare term such as `InStock`. */
  availability?: string;
}

export interface SoftwareApplicationStructuredDataInput {
  name: string;
  applicationCategory: string;
  operatingSystem: string;
  downloadUrl?: string | URL;
  offers?: SoftwareApplicationOffer;
  sameAs?: readonly (string | URL)[];
  description?: string;
  url?: string | URL;
}

export interface WebSiteStructuredDataInput {
  name: string;
  url: string | URL;
  basePath?: string;
}

export interface DefaultOrganizationOptions {
  name?: string;
  logo?: string | URL;
  alternateName?: string;
  sameAs?: readonly (string | URL)[];
}

export interface DefaultStructuredDataInput {
  siteName?: string;
  site?: string | URL;
  basePath?: string;
  enabled?: boolean;
  organization?: DefaultOrganizationOptions;
  structuredData?: StructuredData | readonly StructuredData[];
  head?: readonly HeadEntry[];
}

export interface SocialCardOptions {
  url?: string;
  type?: string;
  siteName?: string;
  locale?: string;
  image?: string;
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
    // A table of contents is navigation, not a summary: drop the heading and its link list.
    .replace(/^#{1,6}\s*(?:table of contents|contents|toc|目录|目錄)\s*$(?:\n\s*(?:[-*+]|\d+\.)\s.*$|\n\s*$)*/gimu, ' ')
    .replace(/^import\s.+;?\s*$/gmu, ' ')
    // Document furniture is not a summary: metadata lines (Last updated, Version, Status, ...),
    // horizontal rules and table rows.
    .replace(/^\s*(?:>\s*)*(?:[-*]\s+)?[_*]{0,2}(?:last updated|updated|version|status|date|audience|refs?|source of truth|owner|authors?)(?::[_*]{0,2}|[_*]{0,2}:)[^\n]*$/gimu, ' ')
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gmu, ' ')
    .replace(/^\s*\|.*\|\s*$/gmu, ' ')
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
    // Starlight emits `<meta name="description">` from the site-wide description for pages without
    // their own, while og/twitter carry the page excerpt. Keep all three in step.
    ['name:description', metadata.description],
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
    // Never drop an existing description when there is nothing to replace it with.
    if (key === 'name:description' && metadata.description === undefined) return true;
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

const OPEN_GRAPH_REGION_BY_LANGUAGE: Readonly<Record<string, string>> = {
  de: 'DE',
  en: 'US',
  es: 'ES',
  fr: 'FR',
  ja: 'JP',
  ko: 'KR',
  ru: 'RU',
  zh: 'CN',
};

/**
 * Convert a BCP 47 tag to the Open Graph `ll_CC` form. Only explicit mappings are used: a tag
 * without an unambiguous region yields `undefined` instead of a guessed locale.
 */
export function toOpenGraphLocale(tag: string | undefined): string | undefined {
  if (typeof tag !== 'string') return undefined;
  const [language = '', second = '', third = ''] = tag.trim().split(/[-_]/u);
  if (!/^[a-z]{2,3}$/iu.test(language)) return undefined;
  const code = language.toLowerCase();
  const script = second.length === 4 ? second.toLowerCase() : undefined;
  const region = script === undefined ? second : third;
  if (/^[a-z]{2}$/iu.test(region)) return `${code}_${region.toUpperCase()}`;
  if (script !== undefined) {
    if (code === 'zh' && script === 'hant') return 'zh_TW';
    if (code === 'zh' && script === 'hans') return 'zh_CN';
    return undefined;
  }
  if (second !== '') return undefined;
  const defaultRegion = OPEN_GRAPH_REGION_BY_LANGUAGE[code];
  return defaultRegion === undefined ? undefined : `${code}_${defaultRegion}`;
}

function socialCardKey(entry: HeadEntry | undefined): string | undefined {
  // Open Graph and Twitter names count under either attribute, so `name="og:type"` also wins.
  return metaKey(entry)
    ?.replace(/^name:og:/u, 'property:og:')
    .replace(/^property:twitter:/u, 'name:twitter:');
}

/**
 * Append the Open Graph and Twitter card tags that `composeSeoHead` does not write. A key the
 * consumer already supplies, under either attribute, is left to the consumer, and no entry the
 * consumer passed is changed.
 */
export function composeSocialCardHead(
  head: readonly HeadEntry[],
  card: SocialCardOptions,
  explicitHead: readonly (readonly HeadEntry[] | undefined)[] = [],
): HeadEntry[] {
  const present = new Set(
    [...head, ...flattenHeads(explicitHead)]
      .map(socialCardKey)
      .filter((key): key is string => Boolean(key)),
  );
  const siteName = card.siteName?.trim();
  const values: [string, string | undefined][] = [
    ['property:og:url', card.url || undefined],
    ['property:og:type', card.type?.trim() || 'website'],
    ['property:og:site_name', siteName || undefined],
    ['property:og:locale', toOpenGraphLocale(card.locale)],
    ['name:twitter:card', card.image ? 'summary_large_image' : 'summary'],
  ];
  const result = [...head];
  for (const [key, content] of values) {
    if (content === undefined || present.has(key)) continue;
    const separator = key.indexOf(':');
    result.push({ tag: 'meta', attrs: { [key.slice(0, separator)]: key.slice(separator + 1), content } });
  }
  return result;
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

/**
 * Validate a list of `sameAs` URLs: each must be an absolute HTTP(S) URL, duplicates are dropped
 * in first-seen order, and an empty input yields an empty list so the caller can omit the key.
 */
export function normalizeSameAs(values: readonly (string | URL)[] | undefined): string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) {
    throw new TypeError('Hagilight SEO sameAs must be an array of absolute HTTP(S) URLs.');
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const href = resolveAbsoluteHttpUrl(value, 'sameAs URL').href;
    if (seen.has(href)) continue;
    seen.add(href);
    result.push(href);
  }
  return result;
}

export function buildOrganizationStructuredData({
  name,
  url,
  logo,
  alternateName,
  sameAs,
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
  const sameAsUrls = normalizeSameAs(sameAs);
  if (sameAsUrls.length > 0) organization.sameAs = sameAsUrls;
  return organization;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Hagilight SEO software ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredText(value, field);
}

function offerAvailability(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new TypeError('Hagilight SEO software offer availability must be a non-empty string.');
  if (/^[A-Za-z]+$/u.test(trimmed)) return `https://schema.org/${trimmed}`;
  return resolveAbsoluteHttpUrl(trimmed, 'offer availability').href;
}

function buildOffer({ price, priceCurrency, url, availability }: SoftwareApplicationOffer): StructuredData {
  const offer: StructuredData = { '@type': 'Offer' };
  if (typeof price === 'number') {
    if (!Number.isFinite(price) || price < 0) {
      throw new TypeError('Hagilight SEO software offer price must be a finite, non-negative number.');
    }
    offer.price = price;
  } else {
    offer.price = requiredText(price, 'offer price');
  }
  const currency = requiredText(priceCurrency, 'offer priceCurrency');
  if (!/^[A-Z]{3}$/u.test(currency)) {
    throw new TypeError('Hagilight SEO software offer priceCurrency must be an ISO 4217 code.');
  }
  offer.priceCurrency = currency;
  if (url !== undefined) offer.url = resolveAbsoluteHttpUrl(url, 'offer URL').href;
  if (availability !== undefined) offer.availability = offerAvailability(availability);
  return offer;
}

/**
 * Build a schema.org `SoftwareApplication` block. The required fields must be non-blank; optional
 * values are emitted only when supplied, and nothing (price, rating, version) is invented.
 */
export function buildSoftwareApplicationStructuredData({
  name,
  applicationCategory,
  operatingSystem,
  downloadUrl,
  offers,
  sameAs,
  description,
  url,
}: SoftwareApplicationStructuredDataInput): StructuredData {
  const application: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: requiredText(name, 'name'),
    applicationCategory: requiredText(applicationCategory, 'applicationCategory'),
    operatingSystem: requiredText(operatingSystem, 'operatingSystem'),
  };
  if (downloadUrl !== undefined) application.downloadUrl = resolveAbsoluteHttpUrl(downloadUrl, 'download URL').href;
  if (offers !== undefined) application.offers = buildOffer(offers);
  const sameAsUrls = normalizeSameAs(sameAs);
  if (sameAsUrls.length > 0) application.sameAs = sameAsUrls;
  const text = optionalText(description, 'description');
  if (text !== undefined) application.description = text;
  if (url !== undefined) application.url = resolveAbsoluteHttpUrl(url, 'application URL').href;
  return application;
}

function siteRootHref(url: string | URL, basePath: string = '/'): string {
  return new URL(`${normalizeBasePath(basePath)}/`, resolveAbsoluteHttpUrl(url, 'site URL')).href;
}

export function buildWebSiteStructuredData({ name, url, basePath = '/' }: WebSiteStructuredDataInput): StructuredData {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('Hagilight SEO website name must be a non-empty string.');
  }
  const root = siteRootHref(url, basePath);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${root}#website`,
    name: name.trim(),
    url: root,
  };
}

function addStructuredDataTypes(types: Set<string>, value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) addStructuredDataTypes(types, item);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  const { '@type': type, '@graph': graph } = value as StructuredData;
  for (const name of Array.isArray(type) ? type : [type]) {
    if (typeof name === 'string') types.add(name);
  }
  addStructuredDataTypes(types, graph);
}

/**
 * Collect the `@type` values a page already declares at the top level and inside `@graph`, from
 * the consumer's structured data and from JSON-LD head scripts. An unparseable script declares
 * nothing, so it can never suppress a default block.
 */
export function collectStructuredDataTypes(
  structuredData: StructuredData | readonly StructuredData[] = [],
  head: readonly HeadEntry[] = [],
): Set<string> {
  const types = new Set<string>();
  addStructuredDataTypes(types, structuredData);
  for (const entry of head) {
    if (entry.tag !== 'script' || entry.attrs?.type !== 'application/ld+json' || typeof entry.content !== 'string') {
      continue;
    }
    try {
      addStructuredDataTypes(types, JSON.parse(entry.content));
    } catch {
      // Unreadable JSON-LD is ignored; the default block for its types is still emitted.
    }
  }
  return types;
}

/**
 * Build the `WebSite` and `Organization` blocks that the page does not already declare. Nothing is
 * built when disabled, without an absolute site URL, or without a site title.
 */
export function buildDefaultStructuredData({
  siteName,
  site,
  basePath,
  enabled = true,
  organization = {},
  structuredData,
  head,
}: DefaultStructuredDataInput = {}): StructuredData[] {
  const name = siteName?.trim();
  if (!enabled || !name || site === undefined) return [];
  const declared = collectStructuredDataTypes(structuredData, head);
  const blocks: StructuredData[] = [];
  if (!declared.has('WebSite')) blocks.push(buildWebSiteStructuredData({ name, url: site, basePath }));
  if (!declared.has('Organization')) {
    blocks.push(buildOrganizationStructuredData({
      name: organization.name?.trim() || name,
      url: siteRootHref(site, basePath),
      logo: organization.logo,
      alternateName: organization.alternateName,
      sameAs: organization.sameAs,
    }));
  }
  return blocks;
}

/** Serialize JSON-LD safely for inline `<script type="application/ld+json">`. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}
