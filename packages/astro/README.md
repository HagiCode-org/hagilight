# @hagicode/hagilight

Astro integrations and components for HagiCode sites without Starlight. Provides sitemap and `robots.txt` generation, localized RSS feeds (enabled by default) and favicon, and a reusable SEO head component.

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

`hagilight()` generates a sitemap and `robots.txt` when the site does not already provide them, and localized RSS feeds (`/rss.xml`, `/rss.<language>.xml`) by default. Set an absolute HTTP(S) `site` URL. `hagilightFavicon()` adds the bundled icon unless the site already declares one.

RSS is on by default: `hagilight()` derives feed locales from the Astro `i18n` config and serves a built-in empty feed. Customize it with the `rss` option, for example `hagilight({ rss: { getFeed: './src/rss-feed.ts' } })`; `getFeed` points to a project-root-relative module exporting a feed callback. Pass `rss: false` to disable RSS. Import `@hagicode/hagilight/SEOHead` for SEO metadata in an Astro page or layout.

See the [repository documentation](https://github.com/HagiCode-org/hagilight#readme) for RSS configuration, feed callback types, and integration behavior.