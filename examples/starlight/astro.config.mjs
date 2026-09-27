import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Hagilight example',
      plugins: [hagilight()],
    }),
  ],
});
