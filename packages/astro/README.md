# @hagicode/hagilight

Astro integrations and components for HagiCode sites without Starlight. Provides sitemap and `robots.txt` generation, optional localized RSS feeds and favicon, and a reusable SEO head component.

## Install

```sh
npm install @hagicode/hagilight astro
```

Use a supported Astro version (`^6.0.7 || ^7.3.5`). The matching `@hagicode/hagilight-core` version is installed as a dependency.

## Use

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { hagilight, hagilightFavicon } from '@hagicode/hagilight/integration';

export default defineConfig({
  site: 'https://example.com',
  integrations: [hagilight(), hagilightFavicon()],
});
```

`hagilight()` generates a sitemap and `robots.txt` when the site does not already provide them. Set an absolute HTTP(S) `site` URL. `hagilightFavicon()` adds the bundled icon unless the site already declares one.

For localized RSS, use `hagilightRss({ locales, getFeed: './src/rss-feed.ts' })` from the same `/integration` entry point; `getFeed` points to a project-root-relative module exporting a feed callback. Import `@hagicode/hagilight/SEOHead` for SEO metadata in an Astro page or layout.

See the [repository documentation](https://github.com/HagiCode-org/hagilight#readme) for RSS configuration, feed callback types, and integration behavior.
