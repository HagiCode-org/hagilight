# Plain Astro setup

Use this reference with the `hagilight-official-website` skill. Install the feature package `@hagicode/hagilight` and `@hagicode/hagilight-core` at one exact version, as the from-scratch guide says. The package needs Astro `>=7`; the range is in [`versions.md`](../../hagilight-site-from-scratch/references/versions.md).

## Register the integration

The integration and the favicon helper come from `@hagicode/hagilight/integration`. The snippet below is trimmed from the plain-Astro demo.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { hagilight, hagilightFavicon } from '@hagicode/hagilight/integration';

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    hagilight({ rss: { getFeed: './src/rss-feed.ts' } }),
    hagilightFavicon(),
  ],
  i18n: {
    defaultLocale: 'en-US',
    locales: ['en-US', 'zh-CN'],
  },
});
```

- `site` must be an absolute HTTP(S) URL. The sitemap, robots and feeds all need it.
- `hagilight()` with no options is enough for a plain site: it writes the sitemap, `robots.txt`, RSS, `llms.txt` and the metadata file.
- `rss` takes `false` to turn feeds off, or an options object. `getFeed` points to a module at the project root whose default export is a feed callback. Type it with `RssFeedCallback` from `@hagicode/hagilight/integration`. Omit `getFeed` to serve a built-in empty feed.

## Options

| Option | Default | Effect |
| --- | --- | --- |
| `enabled` | `true` | Turns the sitemap and `robots.txt` on or off. It does not affect PostHog or the feeds. |
| `rss` | on | `false` turns the feeds off. An options object sets `locales` and `getFeed`. |
| `llms` | on | `false` turns `llms.txt` off. An options object sets `enabled`, `title`, `summary`, `lang` and `maxLinksPerSection` (default 12). |
| `metadata` | on | `false` opts out of `.well-known/hagilight.metadata.json`. |
| `analytics.posthog` | on | `{ enabled: false }` turns the injected PostHog off. `{ apiKey }` replaces the shared key. |
| `analytics.consent` | on | Strict prior consent for the injected PostHog. `{ enabled: false }` loads it at once. |
| `contentImages` | see the package README | Body image handling. |

The option types are in `@hagicode/hagilight/integration`. The README under `node_modules/@hagicode/hagilight` has the full descriptions.

## Locale routing

- Declare `i18n` in the Astro config with a `defaultLocale` and `locales`. RSS locales are derived from this when `rss` does not set them.
- Put each locale's pages in its own folder, as the demo does with `en-US/` and `zh-CN/` routes. The header's language links point to those folders.
- Pass the same locale string to `SEOHead` and `Footer` on every page. `SEOHead` turns it into the `og:locale` tag in `ll_CC` form, so `zh-CN` gives `zh_CN`. A bare `en` gives `en_US`, and a tag with no clear region is left out.

## Sitemap, robots and RSS

- `sitemap-index.xml` is written when the site has no sitemap of its own. An existing `@astrojs/sitemap` integration owns the sitemap, and `hagilight()` leaves it alone.
- `robots.txt` is written when the site has none. A robots page or a file in `public/` takes precedence.
- Feeds are `/rss.xml` and `/rss.<language>.xml`, one per locale.

Run the checks in [`build-checks.md`](../../hagilight-site-from-scratch/references/build-checks.md) on the output.

## `llms.txt`

`llms.txt` is generated from the built pages after the build. A site that ships its own `llms.txt`, as a public file or a page, keeps it. If no page is indexable, the build warns and writes none.

## Analytics: Google Analytics and 51LA are composed by hand

The integration does not inject Google Analytics or 51LA, so the layout composes them. The components come from `@hagicode/hagilight-core`:

- `GoogleAnalytics` takes `measurementId`, in the form `G-` followed by capital letters or digits.
- `Analytics51LA` takes `siteId`.
- Both render only in production builds.
- With consent on, each takes `consent={true}`, and the layout renders one `CookieConsent` with the providers it enables.

PostHog is injected by `hagilight()` by default. To compose `<PostHog />` yourself, turn the injection off with `analytics: { posthog: { enabled: false } }` and place `<PostHog />` from `@hagicode/hagilight-core/PostHog` in the layout head. Choose one owner. Do not leave both on.

The layout snippet is in [`layout.md`](layout.md).

## Build line

The footer shows `Branch:`, `Commit:` and `Built:` lines when `hagilight()` is registered. The branch and commit come from `HAGILIGHT_BUILD_BRANCH` and `HAGILIGHT_BUILD_COMMIT`, then Git, then `unknown`. Set `HAGILIGHT_BUILD_BRANCH` in CI, because a detached checkout reports `Branch: unknown`.
