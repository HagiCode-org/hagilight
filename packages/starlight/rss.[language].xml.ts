import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import rssConfig from 'virtual:hagilight-starlight/rss-config';
import { generateRssFeed } from './dist/rss-renderer.js';

export const getStaticPaths: GetStaticPaths = () => {
  const filenames = new Set(['en', ...rssConfig.locales.map(({ filename }) => filename)]);
  return [...filenames].map((language) => ({ params: { language } }));
};

export const GET: APIRoute = async ({ params, site }) => {
  const entries = await getCollection('docs');
  return generateRssFeed({
    site,
    baseUrl: import.meta.env.BASE_URL,
    filename: params.language,
    ...rssConfig,
    entries,
  });
};
