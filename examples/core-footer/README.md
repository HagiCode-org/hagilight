# Core footer demo

Private Astro workspace showing `@hagicode/hagilight/Footer`, `SEOHead`, and
the consumer-mounted RSS generator without Starlight. It is a local example,
not a publishable package.

From the Hagilight repository root:

```sh
npm run dev --workspace=hagilight-core-footer-example
npm run build:core-footer-example
```

The site has English and Simplified Chinese routes, an absolute Astro `site`,
sharing metadata on each page, and an RSS endpoint at `/rss.xml`. The layout
declares the feed alternate and the endpoint supplies its own feed entries;
the core package does not register routes or alternates automatically.
