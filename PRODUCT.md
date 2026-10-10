# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Site maintainers** at HagiCode who install the packages into Astro or Starlight sites (docs, blog, marketing) and expect drop-in behavior without reworking their own overrides.
- **Readers of those sites**, a multilingual audience reading HagiCode documentation and articles who may evaluate, download, or adopt HagiCode. They meet HagiLight as the header, language chooser, footer, in-article HagiCode showcase, floating promotion banner, AI-disclosure notices, and the 404 page.

## Product Purpose

HagiLight is the shared UI and site-plumbing layer for HagiCode sites: reusable Astro components, an Astro integration (sitemap, robots.txt, RSS), and a Starlight plugin, published as three npm packages (`@hagicode/hagilight-core`, `@hagicode/hagilight`, `@hagicode/hagilight-starlight`). It exists so every HagiCode site carries the same identity, links, SEO, analytics, and promotion surfaces without each site re-implementing them. Success is consistent HagiCode presentation across sites, with maintainers adopting it by installing a package rather than copying code.

## Positioning

The HagiCode brand layer for Astro and Starlight: a shared link catalog and related-sites footer, the HagiCode product showcase and promotions kept in sync with the web and docs repos, ten-locale copy, and GA click tracking tied to stable link ids. A generic Starlight theme could not truthfully offer any of that.

## Operating Context

- Consumed inside host Astro and Starlight sites; HagiLight components sit alongside the host's own content and overrides.
- Two private demos exercise the packages: `examples/demo-web` (core, no Starlight; https://hagilight.hagicode.com) and `examples/demo-starlight-web` (https://hagistar.hagicode.com).
- Production-only analytics: Google Analytics and 51LA load only on production pages.
- Sources are TypeScript compiled to `dist/`; `.astro` components stay in native format.

## Capabilities and Constraints

- Core: links, favicon, SEO and JSON-LD, RSS, promotions loader, GA click-event tags, Footer, Copyright, PromotoBanner, GoogleAnalytics, Analytics51LA, brand assets.
- Plain Astro: `hagilight()` integration, Footer with version attribution, SEOHead.
- Starlight: localized header, language chooser, footer links, content-width toggle, theme picker (three extra light/dark themes, Forest as first-visit default), custom 404, end-of-article HagiCode showcase, floating promotion banner, AI translation/authorship disclosures, RSS, analytics.
- Ten locales: en-US, zh-CN, zh-Hant, fr-FR, de-DE, es-ES, ja-JP, ko-KR, pt-BR, ru-RU. All UI copy lives in per-locale catalogs.
- Must never silently replace a consumer's `Footer` or `components.Header` override; the plugin rejects the conflict instead.
- Tracked link ids are GA `event_label`s. Tagged links go through `gaEventAttributes()` or `siteLinkGaAttributes()`, never hand-written `data-ga-*`; renaming an id is a deliberate analytics change. Related sites, RSS, sitemap, about, contact, filings, and consumer `extraLinks` stay untagged.
- Showcase images are audited local WebP/SVG within a 768 KiB total budget and are never hot-linked; the Microsoft Store badge loader from `get.microsoft.com` is the only script.
- Showcase copy, images, and the Store product id stay in sync with `repos/web` and `repos/docs`.
- Undecided: license, and `@hagicode` npm scope permission before first publish.

## Brand Commitments

HagiCode identity: logo and favicon ship from core (`packages/core/logo.png`, `favicon.ico`). The showcase carries three pillars (smart, efficient, fun) with their SVGs in `packages/starlight/assets/showcase/`. The Forest theme is the Starlight default for first-time visitors.

## Evidence on Hand

- Showcase assets and provenance record: `packages/starlight/assets/showcase/` (`manifest.json`, `heroes.webp`, `workbench.webp`, `proposal-workflow.webp`, pillar SVGs).
- Localized copy catalog: `packages/starlight/src/article-promotion-copy/`.
- Live demos at the two URLs above.
- Absent: testimonials, customer logos, usage numbers, and benchmarks. Do not fabricate them.

## Product Principles

1. **Guest in the host site.** Components add HagiCode presence without overriding or fighting the host's layout, content, or consumer-owned overrides.
2. **Every locale is first-class.** Copy and layout must hold across ten languages and varying text length, not just English.
3. **Promotion respects reading.** Showcase, banner, and disclosures serve a reader who came for documentation; they inform and invite without blocking the task.
4. **Measurable, privacy-light.** Link clicks report stable ids and URLs only: no link text, form values, or visitor identifiers.
5. **Lean and self-contained.** Local audited assets, a fixed size budget, no third-party scripts beyond the Store badge.

## Accessibility & Inclusion

No formal standard has been stated. Ten-locale support (including CJK and Cyrillic scripts) and light/dark theme variants are established product needs.
