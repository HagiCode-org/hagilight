import type { APIRoute } from 'astro';
import rssConfig from 'virtual:hagilight/rss-config';
import { renderRssFeed } from './rss-runtime.mjs';

export const GET: APIRoute = () => renderRssFeed(rssConfig, 'en');
