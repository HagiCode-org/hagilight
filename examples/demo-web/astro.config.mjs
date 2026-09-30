import { defineConfig } from 'astro/config';
import { hagilight, hagilightFavicon, hagilightRss } from '@hagicode/hagilight/integration';

const locales = {
  root: { label: 'English', lang: 'en-US' },
  'zh-CN': { label: '简体中文', lang: 'zh-CN' },
};

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  base: process.env.HAGILIGHT_DEMO_BASE ?? '/',
  integrations: [
    hagilight(),
    hagilightFavicon(),
    hagilightRss({ locales, getFeed: './src/rss-feed.ts' }),
  ],
  i18n: {
    defaultLocale: 'en-US',
    locales: ['en-US', 'zh-CN'],
  },
});
