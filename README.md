# HagiLight

Reusable Astro components and a Starlight plugin for HagiCode sites. This repository contains two npm packages:

## `@hagicode/hagilight`

For plain Astro sites and shared functionality used by the Starlight plugin.

- Footer, copyright notice, promotion banner, and localized site and community links.
- HagiCode logo and favicon assets, plus an optional integration that injects the favicon.
- SEO head component and utilities, plus an RSS renderer and an opt-in localized RSS integration.
- An Astro integration that generates a sitemap and `robots.txt` by default.
- Google Analytics and 51LA components.

## `@hagicode/hagilight-starlight`

A Starlight plugin that depends on `@hagicode/hagilight` and provides:

- Localized header, language chooser, and footer links.
- Content-width toggle, page title and Markdown content components, and a custom 404 page.
- End-of-article HagiCode introduction, floating promotion banner, and AI translation or authorship disclosures.
- SEO metadata, multilingual page discovery, and RSS feeds.
- Google Analytics, 51LA, and the shared favicon.

## Local development

Run `npm install`, `npm test`, and `npm run build:example` from the repository root.

## Sitemap and robots.txt for plain Astro

Register the core integration in `astro.config.mjs` (importing a component alone
cannot register an Astro integration):

```js
import { defineConfig } from 'astro/config';
import { hagilight } from '@hagicode/hagilight/integration';

export default defineConfig({
  site: 'https://example.test',
  integrations: [hagilight()],
});
```

By default, Astro's sitemap integration generates `sitemap-index.xml` and
Hagilight generates `robots.txt` pointing to it. Set `hagilight({ enabled: false })`
to disable both. An existing `@astrojs/sitemap` integration or Starlight owns the
sitemap instead; a consumer-owned `public/robots.txt` or `src/pages/robots.txt.*`
is left untouched. Set Astro's `site` to the public origin; if deploying under a
`base` path, ensure the host serves robots.txt at the origin root as well, since
search engines look for `/robots.txt`.

## Localized RSS for plain Astro

Plain Astro sites can keep owning RSS routes and call `generateRssFeed` from
`@hagicode/hagilight/rss`, or opt in to generated routes and Footer links with
`hagilightRss` from `@hagicode/hagilight/integration`:

```js
import { defineConfig } from 'astro/config';
import { hagilightRss } from '@hagicode/hagilight/integration';

const locales = {
  root: { label: 'English', lang: 'en-US' },
  'zh-CN': { label: '简体中文', lang: 'zh-CN' },
};

export default defineConfig({
  site: 'https://example.test',
  integrations: [
    hagilightRss({ locales, getFeed: './src/rss-feed.mjs' }),
  ],
});
```

The `getFeed` path is resolved relative to the Astro project root. Its module
must default-export a callback that receives `{ route, lang }` for each
configured locale and returns `{ title, description, items }`. Items use the
same `title`, `link`, optional `description`, and optional `date`/`pubDate`
shape accepted by `generateRssFeed`. The integration requires an absolute
HTTP(S) `site` URL, a nonempty Starlight-shaped `locales` map, and a valid
callback module and result.

The integration prerenders `/rss.xml`, `/rss.en.xml`, and
`/rss.<language>.xml` for each configured non-English language. `/rss.xml` and
`/rss.en.xml` use the configured English callback result. If no English locale
is configured, both are valid empty English feeds; Hagilight does not invoke a
different language's callback or borrow its content. A generated filename
conflicting with a page or public file fails the build rather than replacing
consumer-owned output. Removing the integration leaves route and Footer
behavior unchanged.

Generated route and item URLs honor Astro's `base`, for example
`base: '/manual/'` generates `/manual/rss.xml` and resolves relative item links
under `https://example.test/manual/`. The core `Footer` gets the default feed
link and, on configured non-English pages, a current-language link from
request-local integration context. Explicit `links.rssFeedUrl`,
`links.rssLocaleFeedUrl`, link overrides, and existing removal options remain
authoritative.

When both Hagilight integrations are active, Starlight remains the sole RSS
owner if its RSS generation is enabled; the core integration then adds neither
routes nor core Footer URLs. Having both packages installed does not enable
either integration. If the Starlight integration is present with RSS explicitly
disabled while `hagilightRss()` is also enabled, setup fails with an ownership
diagnostic; remove one integration or enable Starlight RSS instead.

## Desktop viewport regression baseline

Install the Chromium browser once with `npx playwright install chromium`, then run `npm run test:viewport` from the Hagilight repository root. The command builds and serves both example sites locally before checking these routes at 1536 x 864, 1920 x 1080, and 2560 x 1440 CSS viewport pixels:

| Example | Routes | Layout states |
| --- | --- | --- |
| Core Astro | `/`, `/zh-CN/` | Header actions, bounded feature cards, internal code-block scrolling, and document overflow |
| Starlight | `/zh-CN/`, `/zh-Hant/` | Header, sidebar, populated page outline, narrow and wide reading widths, and the open language chooser |

The suite blocks external requests, disables optional analytics only for its test build, waits for fonts, and disables animation. On failure it reports the route, viewport, and affected region, then saves a screenshot; CI retains these under `.ci-artifacts/viewport/`.

These dimensions are Chromium CSS viewport pixels at device scale factor 1. They do not emulate macOS display scaling, physical device pixels, Safari, or other browser typography; a real-device/browser pass remains complementary.
