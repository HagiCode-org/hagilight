---
sidebar_position: 2
---

# Features

Each feature can be turned off on its own. The plugin adds only the parts that are enabled.

## Footer

A shared footer with related sites, quick links, community and filing links, copyright, and an attribution line with the package version. It follows the current locale and falls back to English for locales without translated labels. Set `footer: { enabled: false }` to remove it and keep the site's own footer.

## Analytics

Google Analytics (`G-EN03FMT2Q4` by default) and 51LA (`L6b88a5yK4h2Xnci` by default) load only in production builds. Each provider can be turned off with its `enabled` switch, and this demo turns both off for automated browser checks.

## Promote card

A dismissible card that rotates between promotions above the footer. It is hidden while the footer is in view and respects reduced-motion settings.

## Language selector

When several locales are configured, the plugin checks that the navbar has a `localeDropdown` item and that every locale is in the HagiCode catalog. It only warns and never changes the navbar.

## SEO

Organization and WebSite JSON-LD on every page, and a default sharing image (`og:image` and `twitter:image`) for pages that do not set their own. Docusaurus still produces canonical links, `hreflang`, and `x-default`.

## Sitemap, robots.txt, and RSS

- `sitemap.xml` is written in every locale build when the official sitemap plugin is not in use.
- `robots.txt` is written by the default-locale build and lists each locale's sitemap.
- `rss.xml` contains the current docs version and the blog posts of each locale, with a feed auto-discovery link in the page head.

`robots.txt` and `rss.xml` are skipped when your site already provides a file with the same name in `static/`.
