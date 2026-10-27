# @hagicode/hagilight-docusaurus

Docusaurus plugin that adds the Hagilight footer, promotion banner, analytics, SEO metadata, and discovery files (`sitemap.xml`, `robots.txt`, `rss.xml`) to a Docusaurus 3 site.

## Install

```bash
npm install @hagicode/hagilight-docusaurus
```

Peer dependencies are `@docusaurus/core` and `@docusaurus/theme-classic` `^3.9.2`, and `react` `^18 || ^19`. The demo site uses Docusaurus 3.10.

## Minimal configuration

```js
// docusaurus.config.mjs
import { hagilightDocusaurus } from '@hagicode/hagilight-docusaurus';
import { i18n } from '@hagicode/hagilight-docusaurus/locales';

export default {
  title: 'My docs',
  url: 'https://docs.example.com',
  baseUrl: '/',
  i18n,
  plugins: [
    hagilightDocusaurus({
      analytics: {
        googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
        fiftyOneLa: { enabled: false },
      },
    }),
  ],
  themeConfig: {
    image: 'img/social-card.png',
    navbar: {
      items: [{ type: 'localeDropdown' }],
    },
  },
};
```

Keep `"type": "module"` out of the site's `package.json` and name an ESM config `docusaurus.config.mjs`. Docusaurus's generated registry needs webpack's CommonJS rewrite during SSR, which an ESM-typed package skips, so the production build fails with `require.resolveWeak is not a function`.

## Options

Every option is optional. Feature toggles take an object with `enabled`, which defaults to `true`.

| Option | Default | Effect |
| --- | --- | --- |
| `footer` | `{ enabled: true }` | Replaces the Docusaurus footer with the Hagilight footer. Uses `links`. |
| `links` | `{}` | Site link configuration from `@hagicode/hagilight-core`: `overrides`, `extraLinks`, `removeLinks`, `relatedSites`, `rssFeedUrl`, `rssLocaleFeedUrl`, `siteId`, `siteUrl`. |
| `analytics.googleAnalytics` | built-in ID, enabled | `{ enabled, measurementId }`. Loads gtag in production builds only. |
| `analytics.posthog` | built-in key, enabled | `{ enabled, apiKey }`. Loads PostHog in the global head in production builds only. |
| `analytics.fiftyOneLa` | built-in ID, enabled | `{ enabled, siteId }`. Loads 51LA in production builds only. |
| `promoto` | `{ enabled: true }` | Shows the promotion banner and its styles. |
| `languageSelector` | `{ enabled: true }` | Controls the locale configuration warnings. It does not render a dropdown. Add `{ type: 'localeDropdown' }` to `themeConfig.navbar.items` for the switcher. |
| `seo` | `{ enabled: true }` | Emits sharing metadata and Organization and WebSite JSON-LD. Sub-options: `image`, `organization.name`, `organization.url`, `organization.logo`. |
| `sitemap` | `{ enabled: true }` | Writes a fallback `sitemap.xml` in production builds (see below). |
| `robots` | `{ enabled: true }` | Writes `robots.txt` in the default-locale build (see below). |
| `rss` | `{ enabled: true, includeDocs: true, includeBlog: true }` | Writes `rss.xml` for each locale that has feed items. `includeDocs` and `includeBlog` choose the sources. |
| `noIndex` | `false` | Stops this plugin from writing `sitemap.xml` and `robots.txt`. |

### Footer avatar

`footer` takes `avatar` and `randomAvatar` next to `enabled`. Both default to `true`. `avatar: false` removes the decorative avatar from the brand block and its request; `randomAvatar: false` keeps the vendored default and ships no pool list and no picker script. The avatar and its pool come from `@hagicode/hagilight-core` (`assets/footer`), and the build emits the AVIF and WebP files as ordinary assets rather than inlining them into every page. A site whose `img-src` policy blocks `https://img-gen.hagicode.com` keeps the default image, and the pool refresh procedure is in the core README.

```js
hagilightDocusaurus({ footer: { avatar: true, randomAvatar: false } });
```

### Analytics defaults

The built-in analytics IDs (`G-EN03FMT2Q4`, 51LA `L6b88a5yK4h2Xnci`, and PostHog `phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5`) belong to HagiCode. A site that omits `analytics` sends its traffic to HagiCode's properties. Set your own IDs, or disable each provider with `enabled: false`.

An analytics object enables its provider when it contains an ID. Set `enabled` explicitly to override that. `enabled: true` with no ID is a configuration error.

PostHog needs no configuration or consumer project key when registering `hagilightDocusaurus()`. It uses `phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5`, API host `https://t.hagicode.com` (managed proxy), UI host `https://us.posthog.com`, person profiles `identified_only`, and SDK defaults `2026-05-30`. Sites with a strict script or connect policy must allow `t.hagicode.com`. Its single inline initialization shares the global head with Google Analytics on every production HTML page, including localized docs, blogs and not-found pages. No PostHog loader is emitted outside production.

| PostHog input | Behavior |
| --- | --- |
| Plugin options omitted, `analytics: {}`, or `posthog` omitted | Enabled with the supplied default key |
| `posthog: {}` | Disabled, like an empty Google Analytics provider |
| `posthog: { apiKey: 'phc_Custom123' }` | Enabled with the custom key |
| `posthog: { enabled: true, apiKey: 'phc_Custom123' }` | Enabled with the custom key |
| `posthog: { enabled: true }` | Configuration error: `apiKey` required |
| `posthog: { enabled: false }` | Disabled independently of Google Analytics and 51LA |
| `posthog: { searchQuery: 'zero-results' }` | Enabled with the default key; search text is sent only for searches with no results (Docusaurus has no PostHog search events, so this has no effect here) |
| `posthog: { searchQuery: 'off' }` | Enabled with the default key; no search text (the default) |

Keys must match `^phc_[A-Za-z0-9]+$`; enabled providers reject missing or malformed keys. Provider options must be objects and `enabled` must be boolean.

```js
hagilightDocusaurus(); // shared analytics defaults
hagilightDocusaurus({ analytics: { posthog: { apiKey: 'phc_Custom123' } } });
hagilightDocusaurus({ analytics: { posthog: { enabled: false } } });
hagilightDocusaurus({
  analytics: {
    googleAnalytics: { enabled: false },
    fiftyOneLa: { enabled: false },
    posthog: { enabled: false },
  },
}); // all analytics disabled
```

`searchQuery` accepts `off` (default) or `zero-results`; any other value fails configuration with an error naming `analytics.posthog.searchQuery`. It never changes whether PostHog is enabled: an object that holds only `searchQuery` counts as omitted, while `{}` still disables it.

Docusaurus sends `not_found_viewed` from its 404 page, `code_copied` from its code blocks, and `locale_changed` from the locale dropdown. The interaction observers are installed whenever PostHog is enabled, even when Google Analytics and 51LA are disabled. Platform gaps: there is no `search_used` or `search_result_clicked`, because Docusaurus search is not Pagefind; `article_promotion_impression`, `theme_changed`, `content_width_changed` and `locale_redirected` are Starlight-only or root-transit-only and are not sent here.

Each provider is independent: disabling Google Analytics and 51LA alone leaves PostHog enabled. Choose one PostHog initialization owner and opt out here if the site already supplies it. The loader initializes once per document, and the supplied SDK defaults own navigation tracking. The head registers the site context (`site_framework` `docusaurus`, the plugin version, and `site_id` from `links.siteId` or the site URL's hostname) once. On every route update, including the first page load, the plugin refreshes only `locale` and `page_type` through `posthog.register`, with `page_type` derived from the path, so the 404 page reports a path-derived type rather than `other`. The analytics client module is bundled whenever PostHog is enabled, even when Google Analytics and 51LA are disabled, so marked links are captured as `cta_click` without Google Analytics. Google Analytics and 51LA keep their navigation behavior.


### SEO

- `seo.image` is an absolute HTTP(S) URL or a site-root path. When it is unset, `themeConfig.image` is the fallback sharing image.
- `seo.organization.url` and `seo.organization.logo` must be absolute HTTP(S) URLs.
- The Organization and WebSite JSON-LD is still emitted when a site replaces `SiteMetadata`.

## Build line

The Hagilight footer shows `Branch:`, `Commit:`, and `Built:` after the attribution. The values are resolved from the site directory: `HAGILIGHT_BUILD_BRANCH` and `HAGILIGHT_BUILD_COMMIT`, then Git, then `unknown`; the core README gives the order. The line belongs to the Hagilight footer, so it is absent when `footer` is disabled. For a detached-HEAD CI checkout, set `HAGILIGHT_BUILD_BRANCH` in the build step as shown in the Astro README.

Docusaurus evaluates the plugin again for each locale it builds, so each locale resolves its own `Built:` time. Pages within one locale share that time, but two locales built in the same run can differ by a few seconds.

## Locale catalog

`@hagicode/hagilight-docusaurus/locales` exports the locale table used by the plugin:

```js
import { i18n, locales, localeConfigs, defaultLocale } from '@hagicode/hagilight-docusaurus/locales';
```

- `i18n` is a complete Docusaurus `i18n` config (`defaultLocale`, `locales`, `path: 'i18n'`, `localeConfigs`).
- `locales` and `localeConfigs` are the pieces `i18n` is built from, for sites that assemble their own `i18n` object.

Catalog locales are `en-US` (default), `zh-CN`, `zh-Hant`, `fr-FR`, `de-DE`, `es-ES`, `ja-JP`, `ko-KR`, `pt-BR`, and `ru-RU`.

## Discovery output

### sitemap.xml

Written in production builds only, into each locale's output directory, when:

- `sitemap` is enabled, and
- `noIndex` is not set, and
- the official `docusaurus-plugin-sitemap` is not in the loaded plugins.

The fallback lists every built route except the 404 page, with absolute URLs built from `url` and that locale's base URL. If the official sitemap plugin is loaded, this plugin writes nothing.

### robots.txt

Written only by the default-locale build. It contains `User-agent: *`, `Allow: /`, and one absolute `Sitemap:` line for every configured locale.

- A site-owned `static/robots.txt` takes precedence, and this plugin writes nothing.
- A build of a non-default locale alone prints a warning when the default-locale build has not written `robots.txt`.
- Build every locale (run `docusaurus build` without `--locale`) so `robots.txt` lists all sitemaps.

### rss.xml

Written per locale, into that locale's output directory, when feed items exist. Drafts and unlisted entries are excluded.

- A site-owned `static/rss.xml` takes precedence.
- The `<link rel="alternate">` head tag is added when feed items exist or the site owns `rss.xml`.
- With no items, the build logs an info message and writes nothing.

### .well-known/hagilight.metadata.json

Written by the default-locale build, as the last discovery step. It lists every configured locale, the discovery files this build wrote, and build facts. The schema is in `@hagicode/hagilight-core`'s README.

- `metadata: false` opts out. `metadata: { name, description }` overrides the site name, which defaults to `title`, and the description, which defaults to `tagline`.
- Analytics flags are `true` only in production builds that load the provider. Non-production builds report `false`.
- A build of a non-default locale writes nothing and warns when the default-locale build has not written the file, the same rule as `robots.txt`.
- A site-owned `static/.well-known/hagilight.metadata.json` takes precedence, and this plugin keeps it untouched.
- GitHub Pages needs a `.nojekyll` file in the published root, or the `.well-known` directory is dropped.

## Configuration warnings

The plugin prints a `[@hagicode/hagilight-docusaurus]` warning during the build when:

- Several locales are configured but `themeConfig.navbar.items` has no `localeDropdown` item, and `languageSelector` is enabled.
- A configured locale is not in the Hagilight catalog, so its native label and `lang` value are not checked. Use catalog locales or disable `languageSelector`.
- `src/theme/Footer` exists in the site while `footer` is enabled. Remove the site component or disable `footer`.
- `src/theme/SiteMetadata` exists while `seo` is enabled. Remove it or disable `seo`.
- Neither `themeConfig.image` nor `seo.image` is set while `seo` is enabled.
- `themeConfig.footer` is set while the Hagilight footer is enabled. Its links are ignored.
- Google Analytics is configured twice, through `themeConfig.gtag` or the official gtag plugin, and through this plugin.

## Plugin ordering

The sitemap check looks at every loaded plugin, so the position of `hagilightDocusaurus()` in `plugins` does not change the result. The official `docusaurus-plugin-sitemap` must be loaded to be detected.

## Demo

The demo site for this package lives in the monorepo at `examples/demo-docusaurus-web` and is published to https://docusaurus.hagicode.com/.

### Consent

`analytics.consent` (`enabled`, `privacyUrl`, `policyVersion`) mirrors the Starlight option. With consent on, providers leave inert descriptors in the head, the client module mounts the popup and gate, PostHog's click sink installs only after a grant, and the swizzled footer shows the localized "Cookie settings" entry. The popup styles ship in `consent.css`. `enabled: false` restores immediate loading.
