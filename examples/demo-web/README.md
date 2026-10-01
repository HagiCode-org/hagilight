# Hagilight core package showcase

Private, standalone Astro workspace demonstrating the public exports of
`@hagicode/hagilight` and `@hagicode/hagilight-core` without Starlight. It
builds English and Simplified Chinese pages and separate localized RSS feeds for
`https://hagilight.hagicode.com/`.

From the Hagilight repository root:

```sh
npm run build              # compile the packages before running the dev server
npm run dev --workspace=hagilight-core-footer-example
npm run build:core-footer-example
node --test test/demo-web-output.test.mjs
```

## Export-to-example map

| Export | Where to see it |
| --- | --- |
| `@hagicode/hagilight-core/Footer` | The rendered localized footer at the bottom of either page |
| `@hagicode/hagilight/SEOHead` | Canonical URL and Open Graph/Twitter metadata in each page head |
| `@hagicode/hagilight/integration` | Registered `hagilight()` generates a sitemap, robots.txt, and RSS feeds by default; `rss: { getFeed: './src/rss-feed.ts' }` registers localized routes and Footer feed URLs from the typed `src/rss-feed.ts`; `hagilightFavicon()` is registered in `astro.config.mjs` |
| `@hagicode/hagilight-core/Copyright` | Copyright in the live footer and direct-import snippet |
| `@hagicode/hagilight-core/PromotoBanner`, `/promotions` | Live banner with a locale-specific fallback; the fallback CTA targets the footer |
| `@hagicode/hagilight-core/links` | Resolver usage snippet; the live Footer receives generated RSS URLs from the integration |
| `@hagicode/hagilight-core/logo.png` | Hagilight logo in the page header |
| `@hagicode/hagilight-core/favicon`, `/favicon.ico` | Favicon helper snippet; the `.ico` asset is imported into the page head |
| `@hagicode/hagilight-core/seo`, `/seo-schema` | Usage snippets; the page head contains factual WebSite and WebPage JSON-LD |
| `@hagicode/hagilight-core/rss`, `/rss-ownership` | RSS rendering API used by the generated routes, and route-owner coordination with Starlight |
| `@hagicode/hagilight-core/GoogleAnalytics`, `/Analytics51LA` | Opt-in usage snippets only; neither integration is mounted here |

## Observing the examples

- `examples/demo-web/astro.config.mjs` registers `hagilight()` explicitly and
  sets the public `site`. That integration enables the sitemap and robots
  output by default; `hagilight({ enabled: false })` disables both. Existing
  `@astrojs/sitemap` or Starlight integration owns sitemap generation, and a
  consumer `public/robots.txt` or `src/pages/robots.txt.*` takes precedence.
- The build publishes `sitemap-index.xml` and a `robots.txt` `Sitemap:` line
  pointing to its absolute URL. With a base such as `/manual/`, the sitemap
  index and entries include that path. The robots policy must be served at the
  origin root (`/robots.txt`) when deployed under a base path.
- Hagilight does not generate `llms.txt`; add a consumer-owned file with
  localized links only when wanted, or omit it to publish no AI discovery file.
- Use the feature index to navigate to each live or instructional example. Switch between `/` and `/zh-CN/` to compare localized page content and footer links.
- The logo is in the header; scroll to the bottom to inspect the real Footer and Copyright. The promotion component may show an eligible remote campaign instead of the local fallback. When the fallback is used, its link jumps to the footer and the banner yields that area.
- Inspect the built page source or document head for each route's canonical URL, sharing metadata, JSON-LD, favicon link, and RSS alternate. The favicon and localized RSS integrations are registered in the Astro config; the layout also imports the exported `.ico` asset for a deterministic static `<link>`.
- Follow the RSS link in the page header or footer, or open `/rss.xml`, `/rss.en.xml`, or `/rss.zh-CN.xml`. The per-language metadata and entries come from `src/rss-feed.mjs`; the integration owns the generated routes and Footer links.
- Analytics components emit scripts only in production and require `measurementId` (`GoogleAnalytics`) or `siteId` (`Analytics51LA`). Add the documented component to a consumer layout only when intentionally opting in with the site's IDs. This showcase does not mount them or load tracking scripts.
- The focused output test builds the demo and checks both locale pages, all package exports, head/feed output, and the absence of analytics tracking scripts. Its CSS assertions cover narrow-layout, keyboard focus, and reduced-motion rules.

The GitHub **Deployments** page shows separate `demo-web` and
`demo-starlight-web` publication entries, linked to
`https://hagilight.hagicode.com/` and `https://hagistar.hagicode.com/`,
respectively. A successful entry means its workflow built the example and
published its branch; it does not verify that the separate Starlight host has
consumed the snapshot or that either site is reachable.

The `demo-web` branch root is the GitHub Pages source for `hagilight.hagicode.com`;
update **Settings > Pages** from the former `gh-pages` source. The separate
Starlight example is published to `demo-starlight-web`, which requires a
separate hosting consumer because this repository can select only one GitHub
Pages branch.