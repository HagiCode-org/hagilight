import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://consumer.example.test',
  i18n: {
    defaultLocale: 'en-US',
    locales: ['en-US', 'zh-CN'],
  },
});
