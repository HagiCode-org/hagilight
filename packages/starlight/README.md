# @hagicode/hagilight-starlight

A Starlight plugin for HagiCode documentation sites. Adds a localized header and footer, language chooser, content-width toggle, theme picker, custom 404 page, SEO metadata, RSS feeds, analytics, and AI-content disclosures.

## Install

```sh
npm install @hagicode/hagilight-starlight @astrojs/starlight astro
```

Use Starlight `^0.42.4` and Astro `^7.3.5`. The matching `@hagicode/hagilight-core` version is installed as a dependency.

## Use

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';
import { locales } from '@hagicode/hagilight-starlight/locales';

export default defineConfig({
  site: 'https://docs.example.com',
  integrations: [
    starlight({ title: 'Docs', locales, plugins: [hagilight()] }),
  ],
});
```

The plugin also exposes `@hagicode/hagilight-starlight/schema` for optional SEO frontmatter and individual Astro components such as `/Header` and `/MarkdownContent` for custom Starlight overrides. Configure features through the typed `HagilightStarlightOptions` passed to `hagilight()`.

### Theme picker

By default the plugin replaces Starlight's light/dark toggle with a theme picker offering nine choices: the default theme plus the Ocean, Sakura, and Forest themes in light and dark, and a "Default" choice that follows the visitor's system color scheme and renders the Forest theme. First-time visitors, and visitors with an invalid saved choice, therefore see Forest; the other themes appear only after an explicit selection, which is remembered in `localStorage`.

Earlier versions assigned each first-time visitor a random theme and stored it under `hagilight-theme-random`. That value is now ignored: returning visitors who never picked a theme explicitly see Forest after upgrading, while visitors with an explicit choice keep it.

Disable the picker to keep Starlight's built-in toggle or compose `@hagicode/hagilight-starlight/ThemeSelect` yourself:

```js
hagilight({ themes: { enabled: false } })
```

### Body images

`hagilight()` registers the content-image plugin from `@hagicode/hagilight-core/content-images` for the whole site. Every Markdown or MDX body image outside a `<picture>` element gets `loading="lazy"`, `decoding="async"`, and the class `hagilight-content-image`. Values the author set are kept, and logos and showcase images are not changed.

Local Markdown (`.md`) body images are also wrapped in a `<picture>` element with AVIF and WebP `<source>` elements, produced by Astro's image service. The default sharp service encodes AVIF. With the passthrough no-op service, the wrapper is skipped and one warning is logged. MDX, site-root, and remote images are not wrapped. Encoding adds build time, which Astro caches. Each `<source>` also carries `src`, `loading`, `decoding`, `width`, and `height` from Astro's output; browsers ignore these on `source`, but they are not valid HTML there. The opt-out below turns this step off too. The step adds no option of its own.

Turn it off for the site:

```js
hagilight({ contentImages: { enabled: false } })
```

### HagiCode showcase

After the body (and any translation notice) of every documentation article, the plugin renders a static HagiCode showcase: a headline, lead, and tagline with calls to action to the website and the documentation, three pillars (Smart, Efficient, Fun), a three-image gallery with captions, and a closing row with the Windows download button beside a selectable, copy-ready share sentence. The layout follows the showcase's own width: one column when narrow, a three-up pillar row, a gallery mosaic, and a two-column closing row from 36rem, and the pillars beside the pitch from 56rem (for example in the wide content mode). All text is localized for the ten published locales (`en-US`, `zh-CN`, `zh-Hant`, `ja-JP`, `ko-KR`, `de-DE`, `fr-FR`, `es-ES`, `pt-BR`, `ru-RU`) and falls back to English for any other language. Links come from the same locale-aware catalog as the footer.

Turn it off for the whole site, or override it per article:

```js
hagilight({ hagicodePromotion: { enabled: false } })
```

```md
---
title: An article without the showcase
hagicodePromotion: false
---
```

The floating banner is a separate option (`promoto`).

#### Reuse the copy

`@hagicode/hagilight-starlight/showcase` returns the same read-only copy, including the share sentence, so sibling sites can show identical wording:

```js
import { getShowcaseCopy, showcaseLocales } from '@hagicode/hagilight-starlight/showcase';

const copy = getShowcaseCopy('ja-JP'); // English copy for any unsupported locale
copy.shareText; // one sentence that ends with https://www.hagicode.com/
```

The catalog is frozen; changing a returned object throws.

#### Windows download button and the Microsoft badge script

The Windows button follows the official HagiCode website and documentation: the `<ms-store-badge>` element for product `9N3PM0N3SVDW` (`window-mode="direct"`, `theme="auto"`, `size="large"`, badge language matching the page locale). Inside it sits a plain "Get it from Microsoft Store" link to the Store listing, and next to it an "All downloads" link to the localized downloads page for other platforms. The store URL and the downloads URL come from `@hagicode/hagilight-core` (`microsoftStore`, `downloadClient`).

This is the only script the showcase loads: `https://get.microsoft.com/badge/ms-store-badge.bundled.js`, as a module script. It only draws the badge. If your content security policy blocks it, or the reader is offline or blocks third-party scripts, the plain Store link stays visible and works, and nothing else changes. To use the badge, allow `get.microsoft.com` in `script-src`. The loader is emitted once per page, and only when the showcase is enabled. There is no first-party script, no operating-system detection, and no Steam link (the Steam app is retired).

#### Assets and image traffic

The gallery images and pillar icons live in `assets/showcase/`, with a provenance record in `assets/showcase/manifest.json`. Each entry states its kind (`sourced` from the HagiCode web app or documentation, a hand-authored `svg`, or a `generated` illustration), its source path or generation record (tool, prompt, parameters, date), the crop and conversion applied, its size, and the audit verdict. Nothing is fetched from the product sites at build or read time.

Every asset passes the same audit before it is committed: the current `HagiCode` brand, no Steam or other retired-channel content, no third-party promotion, no credentials, private repository names, or personal data, and rasters at least 1200 px wide. A removable offending region may be cropped out, and the crop is recorded. Pick images in this order to keep traffic low: an audited existing image converted to WebP, then a hand-authored SVG, then a newly generated raster only when neither fits. Generated art is an illustration, never a replica of the product UI, contains no text or logos, is captioned as an illustration, is reviewed by a person, and records its prompt and parameters (never credentials). Generation is an authoring step; the package never calls a generator.

Budgets for the shipped sources, enforced by `npm test`: 768 KiB for all showcase sources together, 200 KiB per raster source (WebP only), and 8 KiB per SVG. `npm run build:example` also checks the built output: each delivered raster variant at most 200 KiB, the variants of one format at most 768 KiB together, and each AVIF variant smaller than the WebP variant of the same width.

Each gallery image renders as a `<picture>` with an AVIF source, a WebP source, and a JPEG `<img>` fallback, at widths 480, 800, and the native width. The tiers are derived at the consumer's build from the shipped WebP, with the `sharp` service that Astro already bundles, so no conversion runs outside the site's own build and no external service is involved. The chain needs a transforming image service: with the passthrough `astro/assets/services/noop` service the tiers serve the original bytes, and the plugin logs one warning. Opaque images use the JPEG tier. The JPEG tier cannot carry transparency, so an image that needs alpha needs a PNG tier, which the component does not offer yet, and a budget review before it is added.

Images are served through Astro's image pipeline as responsive, content-hashed files, load lazily with low priority, and sit after the article body, so a reader who does not reach the end downloads none of them.

Measured on `examples/demo-starlight-web` with one warm build each: the nine AVIF variants total 139.0 KiB (largest 41.4 KiB) and the nine JPEG variants total 387.4 KiB (largest 118.2 KiB). The shipped WebP sources are unchanged. The build took 21.6 s without the tiers and 20.4 s with them, a difference within run-to-run noise. A browser that supports AVIF downloads one variant per image, the AVIF one.

#### Adopting and verifying

Upgrading `@hagicode/hagilight`, `@hagicode/hagilight-starlight`, and `@hagicode/hagilight-core` together is the whole change. It needs no configuration, dependency, script, or CI step: the consumer's existing build derives the tiers. If the build logs the passthrough image service warning, remove the `image` service override or use the default `sharp` service.

To check a deployed site, run `curl -sI https://<site>/_astro/<file>.avif` with a real file name from the built `dist/_astro`; it should report `Content-Type: image/avif`. `docs` also previews on Azure Static Web Apps, so check that preview as well. Any host header fix belongs to the owning repository, not to this package.

#### Keep it in sync

The copy and assets mirror `repos/web` and `repos/docs` in the HagiCode monorepo, which this package never edits.

- **Copy:** edit `src/article-promotion-copy/<locale>.ts` (every locale must keep the same fields, feature ids, and gallery ids). Terminology is pinned in `GLOSSARY` in `src/article-promotion-copy/index.ts`, seeded from the product locale files in `repos/web/src/locales/<locale>/`. `HagiCode`, `OpenSpec`, `Hero Dungeon`, `Microsoft Store`, and `Windows` are never translated.
- **Images:** audit the candidate, crop and convert it to WebP (the AVIF and JPEG tiers are derived at build time, so an opaque image needs no extra file), add or update its `manifest.json` entry, register it in the `galleryImages` map in `ArticlePromotion.astro`, and add a caption and text alternative in every locale. The gallery mosaic places the first, second, and third catalog entries as the left top, left bottom, and right tall slot, so keep the gallery at three images or revisit the placement in the component's `@container (min-width: 36rem)` block. `npm test` checks that the manifest, the files, the component registry, and the copy agree.
- **Badge:** the product id is parsed from the Store URL and the badge language map lives in `src/windows-download.ts`. Re-check both against `repos/docs/src/components/MicrosoftStoreBadge.tsx` and the official site when the Store listing or the supported languages change.

The plugin footer and direct `/Footer` and `/PromotoFooter` components append
the literal `Powered By hagilight-starlight@<version>`. The version comes from
this package's own manifest at build time, not from Astro or Starlight.

See the [repository documentation](https://github.com/HagiCode-org/hagilight#readme) for schema setup and feature options.
