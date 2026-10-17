import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://consumer.example',
  base: process.env.HAGILIGHT_TRANSIT_BASE ?? '/',
});
