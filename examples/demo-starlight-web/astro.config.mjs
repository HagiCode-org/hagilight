import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';
import { locales } from '@hagicode/hagilight-starlight/locales';

const base = process.env.HAGILIGHT_EXAMPLE_BASE ?? '/';
const rssOption = (name) => {
  const key = name.replace(/[A-Z]/gu, (letter) => `_${letter}`).toUpperCase();
  return process.env[`HAGILIGHT_RSS_${key}`] !== 'false';
};
const markdown = process.env.HAGILIGHT_EXAMPLE_MARKDOWN_PROCESSOR === 'unified'
  ? { markdown: { processor: (await import('@astrojs/markdown-remark')).unified() } }
  : {};
// 'true' registers plain-Astro hagilight() after the Starlight plugin, 'first' before it.
const discoveryMode = process.env.HAGILIGHT_EXAMPLE_DISCOVERY;
const discovery = discoveryMode === 'true' || discoveryMode === 'first'
  ? [(await import('@hagicode/hagilight/integration')).hagilight()]
  : [];
const contentImages = process.env.HAGILIGHT_EXAMPLE_CONTENT_IMAGES === 'off'
  ? { contentImages: { enabled: false } }
  : {};

export default defineConfig({
  site: 'https://hagistar.hagicode.com',
  base,
  ...markdown,
  integrations: [
    ...(discoveryMode === 'first' ? discovery : []),
    starlight({
      title: 'Hagilight example',
      editLink: { baseUrl: 'https://github.com/HagiCode-org/hagilight/edit/main/' },
      locales,
      plugins: [hagilight({
        ...contentImages,
        ...(process.env.HAGILIGHT_EXAMPLE_METADATA === 'false' ? { metadata: false } : {}),
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
        hagicodePromotion: { enabled: process.env.HAGILIGHT_EXAMPLE_PROMOTION !== 'false' },
        promoto: { enabled: true },
        analytics: process.env.HAGILIGHT_EXAMPLE_ANALYTICS === 'off'
          ? { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false }, posthog: { enabled: false } }
          : process.env.HAGILIGHT_VIEWPORT_TEST === 'true'
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
    ...(discoveryMode === 'first' ? [] : discovery),
  ],
});
