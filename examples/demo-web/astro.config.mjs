import { defineConfig } from 'astro/config';
import { hagilightFavicon } from '@hagicode/hagilight/favicon';
import { hagilight, hagilightRss } from '@hagicode/hagilight/integration';

const locales = {
  root: { label: 'English', lang: 'en-US' },
  'zh-CN': { label: '简体中文', lang: 'zh-CN' },
};

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  integrations: [
    hagilight(),
    hagilightFavicon(),
    hagilightRss({ locales, getFeed: './src/rss-feed.mjs' }),
  ],
  i18n: {
    defaultLocale: 'en-US',
    locales: ['en-US', 'zh-CN'],
  },
});
