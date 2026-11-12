---
name: hagilight-official-website
description: "Use when building or changing an official website on plain Astro with hagilight, where the maintainer owns the layout. Covers the hagilight() integration, the SEOHead and Footer components placed in the layout, locale routing, the analytics composed by hand, and the discovery files. No documentation plugin is involved."
---

# Hagilight official website

An official website is plain Astro. The maintainer writes the layout, the pages and the styles. Hagilight supplies the parts that every HagiCode site shares: the integration, the SEO head, the footer, and the discovery files. A documentation plugin is not part of this setup.

Run the shared start first: [`hagilight-site-from-scratch`](../hagilight-site-from-scratch/SKILL.md). It covers the exact-version install, the site URL and the build check. Then continue here.

## Model

Register `hagilight()` in the Astro config. Then place `SEOHead` and `Footer` in your own layout, and compose the analytics you use by hand. The rest of the site is yours.

## What the maintainer owns

- The layout file, the pages, the styles and the navigation.
- Where `SEOHead` and `Footer` sit in the layout.
- The locale routes and the page content.
- Google Analytics and 51LA, which the layout composes.

## What hagilight supplies

- `hagilight()` from `@hagicode/hagilight/integration`: `sitemap-index.xml` and `robots.txt` when the site has none of its own, localized RSS feeds, `llms.txt`, the site metadata file, and PostHog injected into production pages.
- `hagilightFavicon()` from the same module: the bundled icon, unless the site declares one.
- `SEOHead` from `@hagicode/hagilight/SEOHead`: the canonical link, title, description, Open Graph and Twitter tags, and a default `WebSite` and `Organization` JSON-LD block.
- `Footer` from `@hagicode/hagilight/Footer`: the localized footer, with the build line and the package attribution.

The integration injects PostHog only. Google Analytics and 51LA are composed in the layout. The details are in [`references/plain-astro.md`](references/plain-astro.md), and the layout placement is in [`references/layout.md`](references/layout.md).

## Rules

- Do not install or configure a documentation plugin on an official website. The layout is yours, and a documentation plugin would take over the page chrome.
- `hagilight()` needs an absolute `site` URL in the Astro config. Set it before anything else.
- Place `SEOHead` once in `<head>`, and pass the page's `locale`. Place `Footer` once per page, with the same `locale`.
- Pass `consent` to each analytics component and render one `CookieConsent` when the site uses consent.
