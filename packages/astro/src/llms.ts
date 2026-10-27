/**
 * `llms.txt` generation. The file is derived from the built HTML so it works for every site
 * type (plain Astro, Starlight) without depending on content collections: each indexable page
 * contributes its `<title>` and meta description, grouped by its first path segment.
 * Format: https://llmstxt.org/ (H1 name, blockquote summary, H2 link sections).
 */

export interface LlmsPage {
  /** Path relative to the site root, with a leading slash, for example `/guides/install/`. */
  path: string;
  url: string;
  lang: string | undefined;
  title: string;
  description: string | undefined;
  /** The page's `og:site_name`, used to name the site and to strip the title suffix. */
  siteName?: string | undefined;
}

export interface LlmsPageMeta {
  lang: string | undefined;
  title: string;
  description: string | undefined;
  siteName: string | undefined;
}

export interface BuildLlmsTxtOptions {
  pages: readonly LlmsPage[];
  /** Overrides the site name taken from the home page. */
  title?: string;
  /** Overrides the summary taken from the home page description. */
  summary?: string;
  /** Preferred language, for example the Astro default locale. Falls back to the home page language. */
  lang?: string;
  maxLinksPerSection?: number;
  maxLinks?: number;
}

export const DEFAULT_MAX_LINKS_PER_SECTION = 12;
export const DEFAULT_MAX_LINKS = 120;
const OVERVIEW_LIMIT_FACTOR = 3;
const GENERIC_DESCRIPTION_MIN_PAGES = 3;
/** `<meta name="hagilight:llms" content="exclude">` keeps an immediate-redirect page out of llms.txt. */
export const LLMS_EXCLUDE_META_NAME = 'hagilight:llms';
export const LLMS_EXCLUDE_META_VALUE = 'exclude';
const LOCALE_SEGMENT = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/iu;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu, (match, dec, hex, name) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return ENTITIES[String(name).toLowerCase()] ?? match;
  });
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [, name, double, single] of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) {
    result[name.toLowerCase()] = decodeEntities(double ?? single ?? '');
  }
  return result;
}

function clean(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/gu, ' ').trim();
  return text ? text : undefined;
}

function normalizeUrl(href: string, base: string): string | undefined {
  try {
    const url = new URL(href, base);
    url.hash = '';
    url.search = '';
    return url.href.replace(/\/index\.html$/u, '/');
  } catch {
    return undefined;
  }
}

/**
 * Read the facts `llms.txt` needs from one built page. Returns `undefined` for pages that should
 * not be listed: `noindex`, instant redirects, 404 pages, and pages whose canonical URL points
 * somewhere else.
 */
/**
 * Read the page head without applying indexing rules. Site-level facts such as the
 * site name and description stay available on pages that are `noindex`.
 */
export function parseHeadMeta(html: string): LlmsPageMeta {
  const headEnd = html.indexOf('</head>');
  const head = headEnd === -1 ? html : html.slice(0, headEnd);
  const metas = [...head.matchAll(/<meta\b[^>]*>/giu)].map(([tag]) => attributes(tag));
  const named = (name: string) => metas.find((meta) => meta.name?.toLowerCase() === name)?.content;
  const property = (name: string) => metas.find((meta) => meta.property?.toLowerCase() === name)?.content;
  const title = clean(decodeEntities(head.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? '')) ?? '';
  const htmlTag = html.match(/<html\b[^>]*>/iu)?.[0];
  return {
    lang: clean(htmlTag ? attributes(htmlTag).lang : undefined),
    title,
    description: clean(named('description') ?? property('og:description')),
    siteName: clean(property('og:site_name')),
  };
}

export function parsePageMeta(html: string, pageUrl: string): LlmsPageMeta | undefined {
  const headEnd = html.indexOf('</head>');
  const head = headEnd === -1 ? html : html.slice(0, headEnd);
  const metas = [...head.matchAll(/<meta\b[^>]*>/giu)].map(([tag]) => attributes(tag));
  const named = (name: string) => metas.find((meta) => meta.name?.toLowerCase() === name)?.content;

  if (/noindex/iu.test(named('robots') ?? '')) return undefined;
  if (metas.some((meta) => meta['http-equiv']?.toLowerCase() === 'refresh')) return undefined;
  // A page that redirects as soon as it loads (for example an inline script) opts out explicitly.
  if (metas.some((meta) => meta.name?.toLowerCase() === LLMS_EXCLUDE_META_NAME
    && meta.content?.trim().toLowerCase() === LLMS_EXCLUDE_META_VALUE)) return undefined;

  const canonicalTag = [...head.matchAll(/<link\b[^>]*>/giu)]
    .map(([tag]) => attributes(tag))
    .find((link) => link.rel?.toLowerCase().split(/\s+/u).includes('canonical'));
  if (canonicalTag?.href) {
    const canonical = normalizeUrl(canonicalTag.href, pageUrl);
    const own = normalizeUrl(pageUrl, pageUrl);
    // A trailing-slash difference is a site setting, not a different page.
    if (canonical && own && canonical.replace(/\/$/u, '') !== own.replace(/\/$/u, '')) return undefined;
  }

  const meta = parseHeadMeta(html);
  if (!meta.title || /^(?:404\b|page not found)/iu.test(meta.title)) return undefined;
  return meta;
}

function sameLanguage(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.startsWith(`${y}-`) || y.startsWith(`${x}-`);
}

function segmentsOf(page: LlmsPage): string[] {
  const segments = page.path.split('/').filter(Boolean);
  if (segments.length > 0 && LOCALE_SEGMENT.test(segments[0]) && (sameLanguage(segments[0], page.lang) || segments.length === 1)) {
    segments.shift();
  }
  return segments;
}

function humanize(segment: string): string {
  const text = decodeURIComponent(segment).replace(/[-_]+/gu, ' ').trim();
  return text.replace(/\b[a-z]/gu, (letter) => letter.toUpperCase());
}

function stripSiteSuffix(title: string, siteName: string | undefined): string {
  if (!siteName) return title;
  const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const stripped = title.replace(new RegExp(`\\s*[|•·–—-]\\s*${escaped}$`, 'iu'), '').trim();
  return stripped || title;
}

function mostCommonLanguage(pages: readonly LlmsPage[]): string | undefined {
  const counts = new Map<string, number>();
  for (const page of pages) if (page.lang) counts.set(page.lang, (counts.get(page.lang) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

function mostCommonSiteName(pages: readonly LlmsPage[]): string | undefined {
  const counts = new Map<string, number>();
  for (const page of pages) if (page.siteName) counts.set(page.siteName, (counts.get(page.siteName) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

function linkLine(page: LlmsPage, siteName: string | undefined, generic: ReadonlySet<string>): string {
  const title = stripSiteSuffix(page.title, siteName).replace(/[[\]]/gu, '');
  return page.description && !generic.has(page.description) ? `- [${title}](${page.url}): ${page.description}` : `- [${title}](${page.url})`;
}

/** Build the `llms.txt` body. Returns `undefined` when there is nothing to list. */
export function buildLlmsTxt(options: BuildLlmsTxtOptions): string | undefined {
  const maxPerSection = options.maxLinksPerSection ?? DEFAULT_MAX_LINKS_PER_SECTION;
  const maxLinks = options.maxLinks ?? DEFAULT_MAX_LINKS;
  const all = [...options.pages].sort((a, b) => a.path.localeCompare(b.path));
  if (all.length === 0) return undefined;

  const shallowest = (candidates: readonly LlmsPage[]) =>
    [...candidates].sort((a, b) => segmentsOf(a).length - segmentsOf(b).length || a.path.length - b.path.length)[0];

  let lang = options.lang && all.some((page) => sameLanguage(page.lang, options.lang))
    ? options.lang
    : shallowest(all.filter((page) => segmentsOf(page).length === 0))?.lang ?? mostCommonLanguage(all);
  if (!all.some((page) => sameLanguage(page.lang, lang))) lang = mostCommonLanguage(all);

  const inLanguage = all.filter((page) => lang === undefined || sameLanguage(page.lang, lang));
  const home = shallowest(inLanguage.filter((page) => segmentsOf(page).length === 0)) ?? shallowest(inLanguage);
  const siteName = clean(options.title) ?? home?.siteName ?? mostCommonSiteName(inLanguage) ?? home?.title;
  const summary = clean(options.summary) ?? home?.description;

  const sections = new Map<string, LlmsPage[]>();
  const hasChildren = (segment: string) => inLanguage.some((other) => {
    const parts = segmentsOf(other);
    return parts[0] === segment && parts.length > 1;
  });
  for (const page of inLanguage) {
    const segments = segmentsOf(page);
    // Top-level pages without children (for example /about/) go to Overview; /guides/... goes to Guides.
    const key = segments.length === 0 || (segments.length === 1 && !hasChildren(segments[0]))
      ? 'Overview'
      : humanize(segments[0]);
    sections.set(key, [...(sections.get(key) ?? []), page]);
  }

  // A description repeated across pages is a site-wide default, not information about the page.
  const descriptionCounts = new Map<string, number>();
  for (const page of inLanguage) if (page.description) descriptionCounts.set(page.description, (descriptionCounts.get(page.description) ?? 0) + 1);
  const generic = new Set([...descriptionCounts].filter(([, count]) => count >= GENERIC_DESCRIPTION_MIN_PAGES).map(([text]) => text));

  const lines = [`# ${siteName ?? 'Site'}`];
  if (summary) lines.push('', `> ${summary}`);
  let remaining = maxLinks;
  const ordered = [...sections.entries()].sort(([a, pa], [b, pb]) =>
    (a === 'Overview' ? -1 : 0) - (b === 'Overview' ? -1 : 0) || pb.length - pa.length || a.localeCompare(b));
  for (const [name, pages] of ordered) {
    if (remaining <= 0) break;
    // Flat sites keep most pages under Overview, so it gets a larger share than a topical section.
    const limit = name === 'Overview' ? maxPerSection * OVERVIEW_LIMIT_FACTOR : maxPerSection;
    const picked = [...pages]
      .sort((a, b) => segmentsOf(a).length - segmentsOf(b).length || a.path.localeCompare(b.path))
      .slice(0, Math.min(limit, remaining));
    remaining -= picked.length;
    lines.push('', `## ${name}`, '', ...picked.map((page) => linkLine(page, siteName, generic)));
  }

  const alternates = all
    .filter((page) => lang !== undefined && page.lang && !sameLanguage(page.lang, lang) && segmentsOf(page).length === 0)
    .sort((a, b) => (a.lang ?? '').localeCompare(b.lang ?? ''));
  if (alternates.length > 0) {
    lines.push('', '## Optional', '', ...alternates.map((page) => `- [${page.lang}](${page.url})`));
  }
  return `${lines.join('\n')}\n`;
}
