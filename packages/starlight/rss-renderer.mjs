import rss from '@astrojs/rss';
import { selectRssEntries } from './rss-utils.mjs';

export function generateRssFeed({ site, baseUrl, filename, locales, options, entries }) {
  if (!site) throw new Error('Hagilight RSS requires the Astro site option.');
  const locale = locales.find((item) => item.filename === filename);
  if (!locale && filename !== 'en') {
    throw new Error(`Hagilight RSS has no configured locale for "${filename}".`);
  }

  const base = new URL(baseUrl, site);
  const items = selectRssEntries(entries, { filename, locales, options }).map(({ id, data }) => {
    const slug = id.replace(/(?:^|\/)index$/u, '');
    return {
      title: data.title,
      description: data.description,
      ...(data.lastUpdated instanceof Date && !Number.isNaN(data.lastUpdated.getTime())
        ? { pubDate: data.lastUpdated }
        : {}),
      link: new URL(`${slug ? `${slug}/` : ''}`, base).toString(),
    };
  });

  return rss({
    title: 'Documentation',
    description: 'Recently updated documentation pages',
    site: base,
    customData: `<language>${locale?.lang ?? 'en'}</language>`,
    items,
  });
}
