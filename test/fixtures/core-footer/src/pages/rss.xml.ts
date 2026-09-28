import type { APIRoute } from 'astro';
import { generateRssFeed } from '@hagicode/hagilight/rss';

export const GET: APIRoute = ({ site }) => generateRssFeed({
  site,
  baseUrl: import.meta.env.BASE_URL,
  language: 'en-US',
  title: 'Installed core consumer',
  description: 'Consumer-provided entries',
  items: [{ title: 'Installed core SEO', link: '/', description: 'Standalone core metadata.' }],
});
