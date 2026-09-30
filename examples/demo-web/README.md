# Hagilight core package showcase

Private, standalone Astro workspace demonstrating the public exports of
`@hagicode/hagilight` without Starlight. It builds English and Simplified
Chinese pages and separate localized RSS feeds for
`https://hagilight.hagicode.com/`.

From the Hagilight repository root:

```sh
npm run dev --workspace=hagilight-core-footer-example
npm run build:core-footer-example
node --test test/demo-web-output.test.mjs
```

## Export-to-example map

| Core export | Where to see it |
| --- | --- |
| `./Footer` | The rendered localized footer at the bottom of either page |
| `./Copyright` | Copyright in the live footer and direct-import snippet |
| `./PromotoBanner` | Live banner with a locale-specific fallback; the fallback CTA targets the footer |
| `./site-links` | Resolver usage snippet; the live Footer receives generated RSS URLs from the integration |
| `./logo.png` | Hagilight logo in the page header |
| `./favicon` | `astro.config.mjs` registers `hagilightFavicon()` |
| `./favicon.ico` | Imported into the page head as a static icon asset |
| `./SEOHead` | Canonical URL and Open Graph/Twitter metadata in each page head |
| `./seo-utils`, `./seo-schema` | Usage snippets; the page head contains factual WebSite and WebPage JSON-LD |
| `./rss` | RSS rendering API used by the generated routes |
| `./integration` | `hagilight()` generates a sitemap and robots.txt; `hagilightRss()` registers localized routes and Footer feed URLs |
| `./GoogleAnalytics`, `./Analytics51LA` | Opt-in usage snippets only; neither integration is mounted here |

## Observing the examples

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
