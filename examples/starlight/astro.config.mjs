import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';

export default defineConfig({
  site: 'https://hagilight.hagicode.com',
  base: '/',
  integrations: [
    starlight({
      title: 'Hagilight example',
      plugins: [hagilight({ promoto: { enabled: true } })],
    }),
  ],
});
