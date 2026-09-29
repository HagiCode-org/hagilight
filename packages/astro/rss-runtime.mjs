import { generateRssFeed } from './rss-renderer.mjs';

const EMPTY_ENGLISH_FEED = {
  title: 'Hagilight RSS Feed',
  description: 'English-language feed for this site.',
  items: [],
};

export async function renderRssFeed(config, filename) {
  const locale = config.locales.find((entry) => entry.filename === filename);
  if (!locale && filename !== 'en') {
    throw new Error(`Hagilight RSS has no configured locale for "${filename}".`);
  }

  let feed;
  if (!locale) {
    feed = EMPTY_ENGLISH_FEED;
  } else {
    if (typeof config.getFeed !== 'function') {
      throw new TypeError('Hagilight RSS getFeed module must default-export a callback function.');
    }
    feed = await config.getFeed({ route: locale.route, lang: locale.lang });
    if (!feed || typeof feed !== 'object' || Array.isArray(feed)) {
      throw new TypeError(`Hagilight RSS getFeed callback for "${locale.lang}" must return an object.`);
    }
    if (typeof feed.title !== 'string' || !feed.title.trim()) {
      throw new TypeError(`Hagilight RSS getFeed callback for "${locale.lang}" must return a non-empty title.`);
    }
    if (typeof feed.description !== 'string' || !feed.description.trim()) {
      throw new TypeError(`Hagilight RSS getFeed callback for "${locale.lang}" must return a non-empty description.`);
    }
    if (!Array.isArray(feed.items)) {
      throw new TypeError(`Hagilight RSS getFeed callback for "${locale.lang}" must return an items array.`);
    }
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
