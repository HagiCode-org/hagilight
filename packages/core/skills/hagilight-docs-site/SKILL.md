---
name: hagilight-docs-site
description: "Use when building or changing a documentation site with hagilight on Starlight or Docusaurus, where the plugin owns the header, footer, locale chooser and 404 page. Covers the plugin-driven model, the override rules that make a setup fail, and the choice between the two frameworks."
---

# Hagilight documentation site

A documentation site uses a hagilight plugin. The plugin owns the page chrome, so the site configures the plugin and does not replace the chrome. The shared start, including the exact-version install and the build check, is in [`hagilight-site-from-scratch`](../hagilight-site-from-scratch/SKILL.md). Follow it first.

## Choose the framework

- Starlight: `@hagicode/hagilight-starlight`, read [`references/starlight.md`](references/starlight.md). Most existing documentation sites in this organization use Starlight.
- Docusaurus: `@hagicode/hagilight-docusaurus`, read [`references/docusaurus.md`](references/docusaurus.md). Pick it only when the site already runs Docusaurus. Moving a Docusaurus site to Starlight is a rewrite, not a setup step.

Do not use both plugins on one site.

## What the plugin owns

Starlight plugin: the header, footer, locale chooser, content-width control, theme picker, 404 page, SEO head, RSS feeds, analytics and AI disclosures.

Docusaurus plugin: the footer, promotion banner, analytics, SEO head tags and JSON-LD, the sitemap, robots and RSS discovery files, and the locale catalog.

Configure these through the plugin's options. Do not rebuild them in the site.

## Override rules

These rules decide whether a setup builds.

- Starlight rejects a site that already overrides `Footer`, `components.Header`, `PageTitle` or `MarkdownContent`. The plugin fails the build with an error that names the component. Remove the override rather than keeping both. If you need the header of your own, set `header: { enabled: false }` in the plugin options and compose `@hagicode/hagilight-starlight/Header` yourself.
- Docusaurus does not fail on a swizzled `Footer` or `SiteMetadata`. It warns during the build. A swizzled `src/theme/Footer` is a problem while `footer` is enabled, and a swizzled `src/theme/SiteMetadata` is a problem while `seo` is enabled. Remove the swizzle, or disable the matching Hagilight feature. Do not leave both in place.

## Keep the shared steps

- Keep the site URL and locales in the framework config, as the from-scratch guide says. The locale list must match the plugin's catalog.
- Analytics and tagged links follow [`analytics-and-links.md`](../hagilight-site-from-scratch/references/analytics-and-links.md). Both plugins configure Google Analytics, 51LA and PostHog through their own `analytics` option.
- The build check follows [`build-checks.md`](../hagilight-site-from-scratch/references/build-checks.md) for the framework you chose.
