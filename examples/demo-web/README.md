# Core footer demo

Private Astro workspace showing `@hagicode/hagilight/Footer`, `SEOHead`, and
the consumer-mounted RSS generator without Starlight. It builds for
`https://hagilight.hagicode.com/` and is published to the `demo-web` branch.

From the Hagilight repository root:

```sh
npm run dev --workspace=hagilight-core-footer-example
npm run build:core-footer-example
```

The site has English and Simplified Chinese routes, an absolute Astro `site`,
sharing metadata on each page, and an RSS endpoint at `/rss.xml`. The layout
declares the feed alternate and the endpoint supplies its own feed entries;
the core package does not register routes or alternates automatically.

The `demo-web` branch root is the GitHub Pages source for `hagilight.hagicode.com`;
update **Settings > Pages** from the former `gh-pages` source. The separate
Starlight example is published to `demo-starlight-web` for
`hagistar.hagicode.com`, which requires a separate hosting consumer because
this repository can select only one GitHub Pages branch.
