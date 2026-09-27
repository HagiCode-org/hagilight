import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';

export default defineConfig({
  site: 'https://hagicode-org.github.io',
  base: '/hagilight/',
  integrations: [
    starlight({
      title: 'Hagilight example',
      plugins: [hagilight({ promoto: { enabled: true } })],
    }),
  ],
});
