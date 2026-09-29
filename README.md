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

## Desktop viewport regression baseline

Install the Chromium browser once with `npx playwright install chromium`, then run `npm run test:viewport` from the Hagilight repository root. The command builds and serves both example sites locally before checking these routes at 1536 x 864, 1920 x 1080, and 2560 x 1440 CSS viewport pixels:

| Example | Routes | Layout states |
| --- | --- | --- |
| Core Astro | `/`, `/zh-CN/` | Header actions, bounded feature cards, internal code-block scrolling, and document overflow |
| Starlight | `/zh-CN/`, `/zh-Hant/` | Header, sidebar, populated page outline, narrow and wide reading widths, and the open language chooser |

The suite blocks external requests, disables optional analytics only for its test build, waits for fonts, and disables animation. On failure it reports the route, viewport, and affected region, then saves a screenshot; CI retains these under `.ci-artifacts/viewport/`.

These dimensions are Chromium CSS viewport pixels at device scale factor 1. They do not emulate macOS display scaling, physical device pixels, Safari, or other browser typography; a real-device/browser pass remains complementary.
