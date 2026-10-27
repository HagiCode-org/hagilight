/**
 * Regroups the footer's catalog links and ecosystem sites into balanced,
 * purpose-based columns.
 *
 * The three source lists (`quick`, `community`, `relatedSites`) stay the public
 * contract of `resolveSiteLinks`; this module only decides where each entry is
 * shown, so a site that removes, replaces or adds links keeps working. Feed and
 * sitemap links are machine-facing, so they leave the columns and sit in the
 * footer's bottom row.
 */

export const FOOTER_COLUMN_IDS = ['start', 'learn', 'build', 'community'] as const;
export type FooterColumnId = (typeof FOOTER_COLUMN_IDS)[number];

/** Catalog ids that leave the columns for the bottom row. */
export const FOOTER_FEED_IDS: readonly string[] = ['rss', 'rssLocale', 'sitemap'];

/**
 * Curated placement by id; the order here is the order on the page. Link ids and
 * ecosystem site ids share one namespace on purpose: they never collide.
 */
const ASSIGNMENT: Readonly<Record<FooterColumnId, readonly string[]>> = {
  start: ['downloadClient', 'microsoftStore', 'dockerCompose', 'productDocs', 'about', 'hagicode-main'],
  learn: [
    'blogPosts', 'openspec-docs', 'omniroute-docs', 'fullstack-tutorial',
    'impeccable-site', 'awesome-sites', 'awesome-design-gallery',
  ],
  build: ['hagitask', 'compose-builder', 'soul-builder', 'trait-builder', 'costCalculator', 'gallery', 'index-data'],
  community: ['github', 'discord', 'issueFeedback', 'contactEmail', 'qqGroup', 'newbe-blog', 'status-page'],
};

export type FooterEntrySource = 'link' | 'site';

/** One link as a footer view renders it. */
export interface FooterColumnEntry {
  id: string;
  /** `link` entries come from the catalog or `extraLinks` and may report GA click events; `site` entries never do. */
  source: FooterEntrySource;
  label: string;
  href: string;
  target?: '_blank';
  rel?: string;
  ariaLabel?: string;
}

export interface FooterColumn {
  id: FooterColumnId;
  entries: FooterColumnEntry[];
}

interface LinkLike {
  id: string;
  label: string;
  href: string;
  target?: '_blank';
  rel?: string;
  ariaLabel?: string;
}

interface SiteLike {
  id: string;
  name: string;
  href: string;
  target?: '_blank';
  rel?: string;
}

export interface FooterColumnInput {
  quick: readonly LinkLike[];
  community: readonly LinkLike[];
  relatedSites: readonly SiteLike[];
}

function fromLink(link: LinkLike): FooterColumnEntry {
  const { id, label, href, target, rel, ariaLabel } = link;
  return { id, source: 'link', label, href, ...(target ? { target } : {}), ...(rel ? { rel } : {}), ...(ariaLabel ? { ariaLabel } : {}) };
}

function fromSite(site: SiteLike): FooterColumnEntry {
  const { id, name, href, target, rel } = site;
  return { id, source: 'site', label: name, href, ...(target ? { target } : {}), ...(rel ? { rel } : {}) };
}

/**
 * Returns the non-empty columns in page order, plus the feed links.
 *
 * An entry the curated map does not know (a consumer's extra link, a custom
 * ecosystem site, a future catalog entry) still shows: extra quick links join
 * `start`, extra community links join `community`, and any other site joins the
 * shortest column, so the columns stay level without anyone editing this file.
 */
export function groupFooterColumns(input: FooterColumnInput): { columns: FooterColumn[]; feeds: FooterColumnEntry[] } {
  const isFeed = (link: LinkLike) => FOOTER_FEED_IDS.includes(link.id);
  const feeds = input.quick.filter(isFeed).map(fromLink);

  const slots = new Map<string, FooterColumnId>();
  for (const columnId of FOOTER_COLUMN_IDS) {
    for (const id of ASSIGNMENT[columnId]) slots.set(id, columnId);
  }

  const columns: FooterColumn[] = FOOTER_COLUMN_IDS.map((id) => ({ id, entries: [] }));
  const unplaced: Array<{ entry: FooterColumnEntry; fallback?: FooterColumnId }> = [];
  const place = (entry: FooterColumnEntry, fallback?: FooterColumnId) => {
    const columnId = slots.get(entry.id);
    if (columnId) columns.find((column) => column.id === columnId)?.entries.push(entry);
    else unplaced.push({ entry, fallback });
  };

  for (const link of input.quick) if (!isFeed(link)) place(fromLink(link), 'start');
  for (const link of input.community) place(fromLink(link), 'community');
  for (const site of input.relatedSites) place(fromSite(site));

  // Curated order wins inside a column; the sort is stable, so entries sharing a slot keep their arrival order.
  const rank = (columnId: FooterColumnId, id: string) => ASSIGNMENT[columnId].indexOf(id);
  for (const column of columns) column.entries.sort((a, b) => rank(column.id, a.id) - rank(column.id, b.id));

  for (const { entry, fallback } of unplaced) {
    const target = fallback
      ? columns.find((column) => column.id === fallback)
      : columns.reduce((shortest, column) => (column.entries.length < shortest.entries.length ? column : shortest));
    target?.entries.push(entry);
  }

  return { columns: columns.filter((column) => column.entries.length > 0), feeds };
}
