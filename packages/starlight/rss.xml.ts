import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import rssConfig from 'virtual:hagilight-starlight/rss-config';
import { generateRssFeed } from './dist/rss-renderer.js';

export const GET: APIRoute = async ({ site }) => {
  const entries = await getCollection('docs');
  return generateRssFeed({
    site,
    baseUrl: import.meta.env.BASE_URL,
    filename: 'en',
    ...rssConfig,
    entries,
  });
};
