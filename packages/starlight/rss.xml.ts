import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('Hagilight RSS requires the Astro site option.');

  const pages = await getCollection('docs', ({ data }) => !data.draft);
  const base = new URL(import.meta.env.BASE_URL, site);
  return rss({
    title: 'Documentation',
    description: 'Recently updated documentation pages',
    site: base,
    items: pages
      .sort((a, b) =>
        (b.data.lastUpdated instanceof Date ? b.data.lastUpdated.getTime() : 0)
        - (a.data.lastUpdated instanceof Date ? a.data.lastUpdated.getTime() : 0))
      .map(({ id, data }) => ({
        title: data.title,
        description: data.description,
        ...(data.lastUpdated instanceof Date ? { pubDate: data.lastUpdated } : {}),
        link: new URL(`${id.replace(/(?:^|\/)index$/u, '')}/`, base).toString(),
      })),
  });
};
