# @hagicode/hagilight

Astro integrations and components for HagiCode sites without Starlight. Provides sitemap and `robots.txt` generation, localized RSS feeds (enabled by default) and favicon, and a reusable SEO head component.

## Install

```sh
npm install @hagicode/hagilight astro
```

Use a supported Astro version (`>=7`). The matching `@hagicode/hagilight-core` version is installed as a dependency.

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

Use `@hagicode/hagilight/Footer` for the shared localized footer with the
literal `Powered By hagilight@<version>` attribution. The version is read at build
time from this package's own manifest, not from Astro. Existing
`@hagicode/hagilight-core/Footer` imports remain supported and render without a
feature-package attribution; switch that import to `@hagicode/hagilight/Footer`
to opt in while keeping the same `locale` and `links` props.

## Body images

`hagilight()` registers the content-image plugin from `@hagicode/hagilight-core/content-images`. Markdown and MDX body images then get `loading="lazy"`, `decoding="async"`, and the class `hagilight-content-image`, with the author's values kept. This registration does not depend on `enabled`, so `hagilight({ enabled: false })` still registers the plugin.

Local Markdown (`.md`) body images are also wrapped in a `<picture>` element with AVIF and WebP sources. This needs an image service that can encode AVIF: the default sharp service does, and the passthrough no-op service skips the wrapper with one warning. MDX, site-root, and remote images are not wrapped. Encoding adds build time, which Astro caches. Each `<source>` also carries `src`, `loading`, `decoding`, `width`, and `height` from Astro's output; browsers ignore these on `source`, but they are not valid HTML there. The opt-out below turns this step off too.

To opt out, pass either form:

```js
hagilight({ contentImages: false });
hagilight({ contentImages: { enabled: false } });
```

Sites that do not use this integration can import the plugin from `@hagicode/hagilight-core` directly; its README describes the options and processor setup.

See the [repository documentation](https://github.com/HagiCode-org/hagilight#readme) for RSS configuration, feed callback types, and integration behavior.