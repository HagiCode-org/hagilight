import type { APIRoute, GetStaticPaths } from 'astro';
import rssConfig from 'virtual:hagilight/rss-config';
import { renderRssFeed } from './rss-runtime.mjs';

export const getStaticPaths: GetStaticPaths = () => [...new Set([
  'en',
  ...rssConfig.locales.map(({ filename }) => filename),
])].map((language) => ({ params: { language } }));

export const GET: APIRoute = ({ params }) => renderRssFeed(rssConfig, params.language);
