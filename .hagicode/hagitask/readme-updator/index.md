---
public: true
multilingual: false
style: product
---

# README requirements

## Product focus

- Present HagiLight as the shared HagiCode site layer for Astro, Starlight and Docusaurus sites: localized header and footer links, SEO metadata, sitemap, robots.txt and RSS, analytics, a promotion banner and a shared favicon, published as the npm packages `@hagicode/hagilight`, `@hagicode/hagilight-core`, `@hagicode/hagilight-starlight` and `@hagicode/hagilight-docusaurus`.
- Address site maintainers who add these packages to a plain Astro, Starlight or Docusaurus site. This repository is a developer-facing package set, so install and configuration usage is part of the product.
- Open with the package set, what each package provides and the package badges.

## Required content

- Keep one section per package with its install and configuration usage, plus the PostHog and Google Analytics options, first-party links and campaign tags, TypeScript usage, sitemap and robots.txt, and localized RSS, as the current README does.
- Ground usage examples in the package manifests and the `examples/` directory.

## Exclusions

- Exclude analytics keys, tokens, secret values, internal hosts, machine-specific paths and private links.
- Do not describe components or options the packages do not export.
- Keep repository maintenance instructions out of the README: repository layout, internal architecture, CI, build internals and local development workflow.
