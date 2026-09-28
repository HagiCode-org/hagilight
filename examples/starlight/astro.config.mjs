import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';
import { locales } from '@hagicode/hagilight-starlight/locales';

const base = process.env.HAGILIGHT_EXAMPLE_BASE ?? '/';
const rssOption = (name) => {
  const key = name.replace(/[A-Z]/gu, (letter) => `_${letter}`).toUpperCase();
  return process.env[`HAGILIGHT_RSS_${key}`] !== 'false';
};

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  base,
  integrations: [
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
            url: 'https://hagilight.hagicode.com/',
          },
        },
        rss: {
          includeDocs: rssOption('includeDocs'),
          includeBlog: rssOption('includeBlog'),
        },
        hagicodePromotion: { enabled: true },
        promoto: { enabled: true },
        aiDisclosures: {
          isAITranslation: true,
          isAIAuthor: true,
          sourceLocale: 'root',
        },
        links: {
          siteId: 'hagilight-example',
          siteUrl: 'https://hagilight.hagicode.com/',
        },
      })],
    }),
  ],
});