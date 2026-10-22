import { resolveSiteLinks, type RelatedSite } from './links.js';

/** Rows the window shows at once; the destination lands on the middle one. */
export const TRANSIT_BOARD_WINDOW = 5;
const FOCUS = Math.floor(TRANSIT_BOARD_WINDOW / 2);

export interface TransitBoardOptions {
  /** This site's id in the related-sites catalog, so the board lists the other sites. */
  siteId?: string;
  /** Replaces the bundled HagiCode catalog. */
  relatedSites?: readonly RelatedSite[];
}

export interface TransitBoardInput extends TransitBoardOptions {
  locale: string;
  site: string | URL;
  siteName: string;
  /** Pathname the page forwards to. */
  route: string;
}

export interface TransitBoardRow {
  id: string;
  name: string;
  /** The site's own description, or its host when it has none. */
  detail: string;
  /** The host, shown beside a described row; empty when `detail` already is the host. */
  aside: string;
  destination: boolean;
}

export interface TransitBoard {
  /** The localized "Ecosystem Sites" label. */
  label: string;
  /** How many other sites the board lists. */
  count: number;
  /** The ecosystem sites, then this site, then the first of them again so the destination has rows on both sides. */
  rows: readonly TransitBoardRow[];
  /** Rows visible in the window. */
  shown: number;
  /** Rows the reel moves before the destination sits on the focus row. */
  travel: number;
}

/**
 * The departures board: every row is catalog data, localized to `locale`, and the last stop is this site. Build-time
 * only; nothing here reads the browser, so the finished state is also the markup a no-script visitor gets.
 */
export function resolveTransitBoard({ locale, site, siteName, route, siteId, relatedSites }: TransitBoardInput): TransitBoard {
  const links = resolveSiteLinks(locale, {
    siteUrl: new URL(site).href,
    ...(siteId === undefined ? {} : { siteId }),
    ...(relatedSites === undefined ? {} : { relatedSites }),
  });
  const others: TransitBoardRow[] = links.relatedSites.map((entry) => {
    const host = new URL(entry.href).host;
    return {
      id: entry.id,
      name: entry.name,
      detail: entry.description || host,
      aside: entry.description ? host : '',
      destination: false,
    };
  });
  const destination: TransitBoardRow = { id: 'destination', name: siteName, detail: route, aside: '→', destination: true };
  const rows = [...others, destination, ...others.slice(0, FOCUS)];
  const focus = Math.min(FOCUS, others.length);
  return {
    label: links.labels.relatedSites,
    count: others.length,
    rows,
    shown: Math.min(TRANSIT_BOARD_WINDOW, rows.length),
    travel: others.length - focus,
  };
}
