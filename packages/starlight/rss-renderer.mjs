import { generateRssFeed as generateCoreRssFeed } from '@hagicode/hagilight/rss';
import { selectRssEntries } from './rss-utils.mjs';

export function generateRssFeed({ site, baseUrl, filename, locales, options, entries }) {
  if (!site) throw new Error('Hagilight RSS requires the Astro site option.');
  const locale = locales.find((item) => item.filename === filename);
  if (!locale && filename !== 'en') {
    throw new Error(`Hagilight RSS has no configured locale for "${filename}".`);
  }

  const items = selectRssEntries(entries, { filename, locales, options }).map(({ id, data }) => {
    const slug = id.replace(/(?:^|\/)index$/u, '');
    return {
      title: data.title,
      description: data.description,
      ...(data.lastUpdated instanceof Date && !Number.isNaN(data.lastUpdated.getTime())
        ? { date: data.lastUpdated }
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
