import { defineConfig } from 'astro/config';
import { hagilight, hagilightFavicon } from '@hagicode/hagilight/integration';

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  base: process.env.HAGILIGHT_DEMO_BASE ?? '/',
  integrations: [
    hagilight({ rss: { getFeed: './src/rss-feed.ts' } }),
    hagilightFavicon(),
  ],
  i18n: {
    defaultLocale: 'en-US',
    locales: ['en-US', 'zh-CN'],
  },
});
