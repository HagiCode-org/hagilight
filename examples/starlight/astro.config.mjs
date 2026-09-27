import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';
import { locales } from '@hagicode/hagilight-starlight/locales';

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  base: '/',
  integrations: [
    starlight({
      title: 'Hagilight example',
      editLink: { baseUrl: 'https://github.com/HagiCode-org/hagilight/edit/main/' },
      head: [{
        tag: 'link',
        attrs: {
          rel: 'alternate',
          type: 'application/rss+xml',
          href: 'https://hagilight.hagicode.com/rss.xml',
        },
      }],
      locales,
      plugins: [hagilight({
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
