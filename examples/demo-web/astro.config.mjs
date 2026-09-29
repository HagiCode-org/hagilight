import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  i18n: {
    defaultLocale: 'en-US',
    locales: ['en-US', 'zh-CN'],
  },
});
