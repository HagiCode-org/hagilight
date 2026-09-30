import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';
import { locales } from '@hagicode/hagilight-starlight/locales';

const base = process.env.HAGILIGHT_EXAMPLE_BASE ?? '/';
const rssOption = (name) => {
  const key = name.replace(/[A-Z]/gu, (letter) => `_${letter}`).toUpperCase();
  return process.env[`HAGILIGHT_RSS_${key}`] !== 'false';
};
const coreRssOrder = process.env.HAGILIGHT_TEST_CORE_RSS_ORDER;
if (coreRssOrder !== undefined && !['before', 'after'].includes(coreRssOrder)) {
  throw new Error('HAGILIGHT_TEST_CORE_RSS_ORDER must be "before" or "after".');
}
// Test-only: exercises RSS route ownership against the plain-Astro package.
const coreRssIntegration = coreRssOrder === undefined
  ? []
  : [(await import('@hagicode/hagilight/integration')).hagilightRss({ locales, getFeed: './src/rss-feed.mjs' })];

export default defineConfig({
  site: 'https://hagistar.hagicode.com',
  base,
  integrations: [
    ...(coreRssOrder === 'before' ? coreRssIntegration : []),
    starlight({
      title: 'Hagilight example',
      editLink: { baseUrl: 'https://github.com/HagiCode-org/hagilight/edit/main/' },
      locales,
      plugins: [hagilight({
        seo: {
          enabled: true,
          image: '/share-card.svg',
          organization: {
            name: 'Hagilight',
            url: 'https://hagistar.hagicode.com/',
          },
        },
        rss: {
          includeDocs: rssOption('includeDocs'),
          includeBlog: rssOption('includeBlog'),
        },
        hagicodePromotion: { enabled: true },
        promoto: { enabled: true },
        analytics: process.env.HAGILIGHT_VIEWPORT_TEST === 'true'
          ? { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } }
          : undefined,
        aiDisclosures: {
          isAITranslation: true,
          isAIAuthor: true,
          sourceLocale: 'root',
        },
        links: {
          siteId: 'hagilight-example',
          siteUrl: 'https://hagistar.hagicode.com/',
        },
      })],
    }),
    ...(coreRssOrder === 'after' ? coreRssIntegration : []),
  ],
});