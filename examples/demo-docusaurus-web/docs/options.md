---
sidebar_position: 3
---

# Options

Every option is optional. The defaults are shown in the last column.

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `footer` | `{ enabled }` | enabled | Shared footer and attribution |
| `promoto` | `{ enabled }` | enabled | Promote card |
| `languageSelector` | `{ enabled }` | enabled | Locale checks for the navbar dropdown |
| `analytics.googleAnalytics` | `{ enabled, measurementId }` | enabled | Google Analytics in production |
| `analytics.fiftyOneLa` | `{ enabled, siteId }` | enabled | 51LA in production |
| `seo` | `{ enabled, image, organization }` | enabled | JSON-LD and the default sharing image |
| `sitemap` | `{ enabled }` | enabled | Fallback `sitemap.xml` |
| `robots` | `{ enabled }` | enabled | `robots.txt` from the default-locale build |
| `rss` | `{ enabled, includeDocs, includeBlog }` | enabled, both included | Per-locale `rss.xml` |
| `links` | site links object | built in | Footer link customization |
| `noIndex` | boolean | `false` | Skip sitemap and robots output |

A feature is turned off with an object, for example `sitemap: { enabled: false }`. Bare booleans are rejected with an error that names the option.

## Discovery files

A `static/robots.txt` or `static/rss.xml` in your site takes precedence over the generated file of the same name.
