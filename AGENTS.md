# HagiLight — Agent Guide

Two independently publishable npm packages that provide shared Astro and Starlight components for HagiCode documentation sites. Read this before editing, building, or publishing.

## Scope and ownership

- `@hagicode/hagilight` — shared `.astro` components (`Copyright`, `PromotoBanner`, `GoogleAnalytics`, `Analytics51LA`, logo) and site-link utilities.
- `@hagicode/hagilight-starlight` — Starlight plugin (header, footer links, locale chooser, content-width control, 404 hero, RSS, analytics, AI disclosures).
- This repository is **documentation-maintenance scope only** for agent edits: modify `AGENTS.md` as instructed. Treat source, generated, and cache files as read-only unless the user expands scope.

## Commands

```sh
npm install                 # install all workspaces
npm test                   # run node --test on test/*.test.mjs
npm run build:example      # build the examples/starlight demo workspace
npm run pack:check         # verify the tarball contents (scripts/verify-pack.mjs)
npm run integration:installed  # validate an installed tarball (scripts/integration-installed.mjs)
```

## Architecture

- npm workspaces: `packages/*` and `examples/*`.
- `packages/astro/` — shared `.astro` + `.mjs` source, published as source (consumers compile with Astro). New shared components belong here, with an entry in its `exports` and `files`. Localized footer catalog lives in `packages/astro/related-sites.json` (keep in sync with Docs).
- `packages/starlight/` — Starlight-only overrides and the plugin registered in `index.mjs`. New auto-applying components get an `exports` entry and are registered in `index.mjs`.
- `examples/starlight/` — private demo exercising both package entry points.
- `scripts/` — `verify-pack.mjs`, `integration-installed.mjs`, `publish.mjs`, `release.mjs` (publishing/release helpers).
- `test/` — node:test suites covering site links, header, language chooser, promotions, AI disclosures, article promotion, and release logic.

## Conventions

- Publish the dependency package before the Starlight package:
  `npm publish -w @hagicode/hagilight --access public` then `npm publish -w @hagicode/hagilight-starlight --access public`.
- Choose and record a license and confirm `@hagicode` scope permission before first publish.
- The plugin rejects a site that already overrides `Footer` or `components.Header`; do not silently replace consumer overrides.
- Default IDs: Google Analytics `G-EN03FMT2Q4`, 51LA `L6b88a5yK4h2Xnci`; both load only on production pages.

## Testing

- `npm test` runs `node --test test/*.test.mjs`.
- Run tests after any change to link resolution, header/language logic, promotions, or AI disclosures.
- `npm run build:example` must succeed as a consumer integration check.

## Deployment / Publishing

- CI (`.github/workflows/ci.yml`) validates both packages and builds the example on Linux, Windows, and macOS (incl. installed-tarball build).
- `npm-publish.yml` uses npm OIDC provenance (no token) with npm trusted publishers: owner `HagiCode-org`, repo `hagilight`, workflow `npm-publish.yml`. Configure trusted publishers before enabling publication; an initial authorized publish may be required first.
- Every push to `main` publishes a unique `dev` dist-tag prerelease; a GitHub release with a `vX.Y.Z` tag publishes both packages to `latest` (dependency package first; existing versions are skipped).
- `demo-gh-pages.yml` publishes the Starlight example to `https://hagilight.hagicode.com/` on successful `main` pushes (custom-domain `CNAME`, `gh-pages` branch root, Actions write permission required).
- `release-drafter.yml` maintains the next stable draft from merged PRs.
