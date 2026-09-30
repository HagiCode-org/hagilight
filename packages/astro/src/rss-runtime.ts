import { generateRssFeed } from '@hagicode/hagilight-core/rss';
import type { RssFeedContent, RssRuntimeConfig } from './rss-config.js';

const EMPTY_ENGLISH_FEED: RssFeedContent = {
  title: 'Hagilight RSS Feed',
  description: 'English-language feed for this site.',
  items: [],
};

export async function renderRssFeed(
  config: Pick<RssRuntimeConfig, 'site' | 'baseUrl' | 'locales' | 'getFeed'>,
  filename: string | undefined,
): Promise<Response> {
  const locale = config.locales.find((entry) => entry.filename === filename);
  if (!locale && filename !== 'en') {
    throw new Error(`Hagilight RSS has no configured locale for "${filename}".`);
  }

  let feed: RssFeedContent;
  if (!locale) {
    feed = EMPTY_ENGLISH_FEED;
  } else {
    if (typeof config.getFeed !== 'function') {
      throw new TypeError('Hagilight RSS getFeed module must default-export a callback function.');
    }
    const result: unknown = await config.getFeed({ route: locale.route, lang: locale.lang });
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new TypeError(`Hagilight RSS getFeed callback for "${locale.lang}" must return an object.`);
    }
    const candidate = result as Partial<RssFeedContent>;
    if (typeof candidate.title !== 'string' || !candidate.title.trim()) {
      throw new TypeError(`Hagilight RSS getFeed callback for "${locale.lang}" must return a non-empty title.`);
    }
    if (typeof candidate.description !== 'string' || !candidate.description.trim()) {
      throw new TypeError(`Hagilight RSS getFeed callback for "${locale.lang}" must return a non-empty description.`);
    }
    if (!Array.isArray(candidate.items)) {
      throw new TypeError(`Hagilight RSS getFeed callback for "${locale.lang}" must return an items array.`);
    }
    feed = candidate as RssFeedContent;
  }

  return generateRssFeed({
    site: config.site,
    baseUrl: config.baseUrl,
    language: locale?.lang ?? 'en',
    title: feed.title,
    description: feed.description,
    items: feed.items,
  });
}
