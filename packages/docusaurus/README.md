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
| `analytics.fiftyOneLa` | built-in ID, enabled | `{ enabled, siteId }`. Loads 51LA in production builds only. |
| `promoto` | `{ enabled: true }` | Shows the promotion banner and its styles. |
| `languageSelector` | `{ enabled: true }` | Controls the locale configuration warnings. It does not render a dropdown. Add `{ type: 'localeDropdown' }` to `themeConfig.navbar.items` for the switcher. |
| `seo` | `{ enabled: true }` | Emits sharing metadata and Organization and WebSite JSON-LD. Sub-options: `image`, `organization.name`, `organization.url`, `organization.logo`. |
| `sitemap` | `{ enabled: true }` | Writes a fallback `sitemap.xml` in production builds (see below). |
| `robots` | `{ enabled: true }` | Writes `robots.txt` in the default-locale build (see below). |
| `rss` | `{ enabled: true, includeDocs: true, includeBlog: true }` | Writes `rss.xml` for each locale that has feed items. `includeDocs` and `includeBlog` choose the sources. |
| `noIndex` | `false` | Stops this plugin from writing `sitemap.xml` and `robots.txt`. |

### Analytics defaults

The built-in analytics IDs (`G-EN03FMT2Q4` and 51LA `L6b88a5yK4h2Xnci`) belong to HagiCode. A site that omits `analytics` sends its traffic to HagiCode's properties. Set your own IDs, or disable each provider with `enabled: false`.

An analytics object enables its provider when it contains an ID. Set `enabled` explicitly to override that. `enabled: true` with no ID is a configuration error.

### SEO

- `seo.image` is an absolute HTTP(S) URL or a site-root path. When it is unset, `themeConfig.image` is the fallback sharing image.
- `seo.organization.url` and `seo.organization.logo` must be absolute HTTP(S) URLs.
- The Organization and WebSite JSON-LD is still emitted when a site replaces `SiteMetadata`.

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
