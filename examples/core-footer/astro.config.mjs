import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://core-footer.hagilight.example',
  i18n: {
    defaultLocale: 'en-US',
    locales: ['en-US', 'zh-CN'],
  },
});
