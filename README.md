# HagiLight

Reusable Astro components and a Starlight plugin for HagiCode sites. This repository contains two npm packages:

## `@hagicode/hagilight`

For plain Astro sites and shared functionality used by the Starlight plugin.

- Footer, copyright notice, promotion banner, and localized site and community links.
- HagiCode logo and favicon assets, plus an optional integration that injects the favicon.
- SEO head component and utilities, plus RSS generation utilities. Plain Astro sites mount the component and RSS route themselves.
- Google Analytics and 51LA components.

## `@hagicode/hagilight-starlight`

A Starlight plugin that depends on `@hagicode/hagilight` and provides:

- Localized header, language chooser, and footer links.
- Content-width toggle, page title and Markdown content components, and a custom 404 page.
- End-of-article HagiCode introduction, floating promotion banner, and AI translation or authorship disclosures.
- SEO metadata, multilingual page discovery, and RSS feeds.
- Google Analytics, 51LA, and the shared favicon.

## Local development

Run `npm install`, `npm test`, and `npm run build:example` from the repository root.
