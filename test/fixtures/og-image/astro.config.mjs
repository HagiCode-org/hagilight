import { defineConfig } from 'astro/config';

// The build test sets these per variant; the image origin is a loopback server it starts.
const domains = process.env.OG_IMAGE_DOMAINS ? process.env.OG_IMAGE_DOMAINS.split(',') : [];
export default defineConfig({
  site: 'https://og-image.example.test',
  base: process.env.OG_BASE || '/',
  output: 'static',
  image: { domains },
});
