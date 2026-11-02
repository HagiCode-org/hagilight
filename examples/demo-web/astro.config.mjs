import { defineConfig } from 'astro/config';
import { hagilight, hagilightFavicon } from '@hagicode/hagilight/integration';

// HAGILIGHT_EXAMPLE_CONSENT_REGIONS=default (or a comma-separated list of ISO codes) builds the regional consent variant.
const consentRegions = process.env.HAGILIGHT_EXAMPLE_CONSENT_REGIONS;
const analytics = consentRegions === undefined
  ? undefined
  : { consent: { regions: consentRegions === 'default' ? 'default' : consentRegions.split(',').map((code) => code.trim()) } };

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  base: process.env.HAGILIGHT_DEMO_BASE ?? '/',
  integrations: [
    hagilight({ rss: { getFeed: './src/rss-feed.ts' }, ...(analytics ? { analytics } : {}) }),
    hagilightFavicon(),
  ],
  i18n: {
    defaultLocale: 'en-US',
    locales: ['en-US', 'zh-CN'],
  },
});
