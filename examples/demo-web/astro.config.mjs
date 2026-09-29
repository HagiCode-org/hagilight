import { defineConfig } from 'astro/config';
import { hagilightFavicon } from '@hagicode/hagilight/favicon';

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  integrations: [hagilightFavicon()],
  i18n: {
    defaultLocale: 'en-US',
    locales: ['en-US', 'zh-CN'],
  },
});
