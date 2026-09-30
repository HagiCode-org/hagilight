import { generateRssFeed as generateCoreRssFeed, type RssLocale } from '@hagicode/hagilight-core/rss';
import { selectRssEntries, type ResolvedRssContentOptions, type RssDocsEntry } from './rss-utils.js';

/** Serialized configuration exposed to the Starlight RSS routes. */
export interface StarlightRssRuntimeConfig {
  options: ResolvedRssContentOptions;
  locales: readonly RssLocale[];
}

export interface StarlightRssFeedInput extends StarlightRssRuntimeConfig {
  site: string | URL | undefined;
  baseUrl: string;
  filename: string | undefined;
  entries: readonly RssDocsEntry[];
}

export function generateRssFeed({
  site,
  baseUrl,
  filename,
  locales,
  options,
  entries,
}: StarlightRssFeedInput): Promise<Response> {
  if (!site) throw new Error('Hagilight RSS requires the Astro site option.');
  const locale = locales.find((item) => item.filename === filename);
  if (!locale && filename !== 'en') {
    throw new Error(`Hagilight RSS has no configured locale for "${filename}".`);
  }

  const items = selectRssEntries(entries, { filename, locales, options }).map(({ id, data }) => {
    const slug = id.replace(/(?:^|\/)index$/u, '');
    const lastUpdated = data.lastUpdated;
    return {
      title: data.title,
      description: data.description,
      ...(lastUpdated instanceof Date && !Number.isNaN(lastUpdated.getTime())
        ? { date: lastUpdated }
        : {}),
      link: slug ? `${slug}/` : '/',
    };
  });

  return generateCoreRssFeed({
    site,
    baseUrl,
    language: locale?.lang ?? 'en',
    title: 'Documentation',
    description: 'Recently updated documentation pages',
    items,
  });
}
