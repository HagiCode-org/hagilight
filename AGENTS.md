# HagiLight — Agent Guide

Three publishable, TypeScript-authored npm packages that provide shared Astro and Starlight components for HagiCode documentation sites. Read this before editing, building, or publishing.

## Scope and ownership

- `@hagicode/hagilight-core` — shared TypeScript utilities (links, favicon, SEO, RSS, RSS route ownership, promotions), shared `.astro` components (`Copyright`, `PromotoBanner`, `GoogleAnalytics`, `Analytics51LA`), and brand assets. No Starlight dependency.
- `@hagicode/hagilight` — plain-Astro integrations (`hagilight`, `hagilightRss`, `hagilightFavicon`), `Footer`, `SEOHead`, and generated routes. Depends on core only.
- `@hagicode/hagilight-starlight` — Starlight plugin (header, footer links, locale chooser, content-width control, 404 hero, RSS, analytics, AI disclosures). Depends on core only.
- This repository is **documentation-maintenance scope only** for agent edits: modify `AGENTS.md` as instructed. Treat source, generated, and cache files as read-only unless the user expands scope.

## Commands

```sh
npm install                 # install all workspaces
npm run build              # tsc -b: compile packages/*/src to packages/*/dist (core first)
npm run typecheck          # build + check Astro route files and test/types fixtures
npm test                   # build, then run node --test on test/*.test.mjs
npm run build:example      # build packages and both example workspaces
npm run pack:check         # verify the tarball contents (scripts/verify-pack.mjs)
npm run integration:installed  # validate an installed tarball (scripts/integration-installed.mjs)
```

## Architecture

- npm workspaces: `packages/*` and `examples/*`.
- TypeScript sources live in `packages/*/src/*.ts` and compile (strict, `tsconfig.base.json`) to ignored `packages/*/dist/` ESM + `.d.ts`. `.astro` components and Astro route `.ts` files stay at each package root and import `./dist/*.js`. Every JS export uses `types`/`default` conditions.
- `packages/core/` — shared runtime, components, and assets used by both feature packages. Localized footer catalog lives in `packages/core/src/related-sites.json` (keep in sync with Docs).
- `packages/astro/` — plain-Astro integration (`src/integration.ts`), Footer, SEOHead, and route entry points.
- `packages/starlight/` — Starlight-only overrides and the plugin in `src/index.ts`. New auto-applying components get an `exports` entry and are registered in `src/index.ts`. It must import shared code from core, never from `@hagicode/hagilight`.
- `examples/demo-starlight-web/` — private Starlight demo exercising both package entry points.
- `examples/demo-web/` — private core Astro demo without Starlight.
- `scripts/` — `packages.mjs` (package order and version-graph checks), `verify-pack.mjs`, `integration-installed.mjs`, `publish.mjs`, `release.mjs` (publishing/release helpers).
- `test/` — node:test suites covering exports, site links, header, language chooser, promotions, RSS ownership, AI disclosures, article promotion, and release logic; `test/types/` holds typed consumer fixtures with `@ts-expect-error` negative cases.

## Conventions

- All three packages share one version; both feature packages depend on the exact core version. Publish core first, then `@hagicode/hagilight` and `@hagicode/hagilight-starlight` (`scripts/publish.mjs` enforces this order).
- Choose and record a license and confirm `@hagicode` scope permission before first publish.
- The plugin rejects a site that already overrides `Footer` or `components.Header`; do not silently replace consumer overrides.
- Default IDs: Google Analytics `G-EN03FMT2Q4`, 51LA `L6b88a5yK4h2Xnci`; both load only on production pages.

## Testing

- `npm test` builds the packages, then runs `node --test test/*.test.mjs`.
- Run tests after any change to link resolution, header/language logic, promotions, or AI disclosures.
- `npm run build:example` must succeed as a consumer integration check.

## Deployment / Publishing

- CI (`.github/workflows/ci.yml`) builds and type-checks all three packages, then runs tests, both example builds, pack checks, and isolated installed-tarball consumers on Linux, Windows, and macOS.
- `npm-publish.yml` uses npm OIDC provenance (no token) with npm trusted publishers: owner `HagiCode-org`, repo `hagilight`, workflow `npm-publish.yml`. Configure trusted publishers before enabling publication; an initial authorized publish may be required first.
- Every push to `main` publishes a unique `dev` dist-tag prerelease; a GitHub release with a `vX.Y.Z` tag publishes all three packages to `latest` (core first; existing versions are skipped).
- `.github/workflows/demo-web.yml` publishes `examples/demo-web/` to the `demo-web` branch and creates the `demo-web` GitHub deployment with `https://hagilight.hagicode.com/`; select `demo-web` root as this repository's GitHub Pages source instead of `gh-pages`.
- `.github/workflows/demo-starlight-web.yml` publishes `examples/demo-starlight-web/` to the `demo-starlight-web` branch and creates the separate `demo-starlight-web` GitHub deployment with `https://hagistar.hagicode.com/`; that domain requires a separate hosting consumer because this repository's GitHub Pages source serves only one branch.
- A successful deployment means its workflow built the example and published its branch; it does not verify that the separate Starlight host has consumed the snapshot or that either site is reachable.
- Both demo workflows run independently on pushes to `main`; neither updates `gh-pages`.
- `release-drafter.yml` maintains the next stable draft from merged PRs.
