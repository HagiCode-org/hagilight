import type { APIRoute } from 'astro';
import rssConfig from 'virtual:hagilight/rss-config';
import { renderRssFeed } from './dist/rss-runtime.js';

export const GET: APIRoute = () => renderRssFeed(rssConfig, 'en');
