import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  base: '/',
  integrations: [
    starlight({
      title: 'Hagilight example',
      plugins: [hagilight({
        promoto: { enabled: true },
        links: {
          siteId: 'hagilight-example',
          siteUrl: 'https://hagilight.hagicode.com/',
          relatedSites: [
            { id: 'hagilight-example', name: 'This example', url: 'https://hagilight.hagicode.com/' },
            { id: 'hagicode-main', name: 'HagiCode', url: 'https://www.hagicode.com/' },
            { id: 'hagicode-docs', name: 'HagiCode Docs', url: 'https://docs.hagicode.com/' },
          ],
        },
      })],
    }),
  ],
});
