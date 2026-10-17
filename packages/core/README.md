# @hagicode/hagilight-core

Shared Astro components, TypeScript utilities, and brand assets for HagiCode sites. This package works with plain Astro and Starlight; it does not require Starlight.

## Install

```sh
npm install @hagicode/hagilight-core astro
```

Use a supported Astro version (`>=7`). The other Hagilight packages install core automatically; install it directly if your site imports core entry points.

## Use

```astro
---
import Footer from '@hagicode/hagilight-core/Footer';
---

<Footer />
```

`Footer` renders localized site links and, when configured by a Hagilight RSS integration, feed links. Its `locale` and `links` props allow customization.

Above the links the footer states what HagiCode is: a one-line headline, the product summary, the Download and Product Docs calls to action, and the three pillars (smart, efficient, fun) in all ten locales. The calls to action are the `downloadClient` and `productDocs` quick links, so `overrides`, `removeLinks` and `siteId` apply to them and a removed link leaves no button behind; both report as `footer_brand` clicks with those ids, so the product statement can be told apart from the link lists. The block lays out by the width it is given (container queries), so it holds in a narrow Starlight content pane. As the footer scrolls into view the headline is uncovered and the pillar rules draw in, using scroll-driven animation; browsers without it, and visitors who prefer reduced motion, see the finished state. Copy comes from `@hagicode/hagilight-core/footer-brand` (`resolveFooterBrand`, `pickFooterBrandLinks`), and the Astro markup is exported as `@hagicode/hagilight-core/FooterBrand`.
The core Footer stays independent of feature packages and does not add
attribution by itself. Plain-Astro sites that want the literal
`Powered By hagilight@<version>` package attribution can replace this import with
`@hagicode/hagilight/Footer`; that component reads the exact build-time version
from `@hagicode/hagilight`'s own manifest, not from Astro.

Other entry points include `Copyright`, `PromotoBanner`, `GoogleAnalytics`, `PostHog`, and `Analytics51LA` Astro components; `links`, `favicon`, `seo`, `seo-schema`, `rss`, `rss-ownership`, `promotions`, and `analytics-events` utilities; and `logo.png` and `favicon.ico` assets. For example:

```ts
import { resolveSiteLinks } from '@hagicode/hagilight-core/links';

const links = resolveSiteLinks('en-US');
```

## Root transit (explicit opt-in)

Use this full-page component in an Astro root route (`src/pages/index.astro`):

```astro
---
import RootTransit from '@hagicode/hagilight-core/RootTransit';
---
<RootTransit destination="/en-US/" siteName="My site" />
```

Create the destination page first, for example `src/pages/en-US/index.astro`.
The component includes the official root transit's layout, dark/light colors,
system font stacks, outline-to-solid route sweep, beam, staggered trace and
continuation chip. It bundles its logo and favicon locally; no custom CSS,
animation setup, feature package, third-party resource or analytics is required.
The trace shows the actual configured destination, base and origin rather than
performing the official website's locale detection. Installing core alone never
changes routes. Consumers that do not import this page keep their current root.

`destination` and nonblank `siteName` are required. Optional `locale` (default
`en-US`), `heading`, `message`, and `continueLabel` supply the site's translated
copy. `links={[{ destination: '/zh-CN/', label: '简体中文', lang: 'zh-CN' }]}`
adds native alternative-language links without introducing locale selection or
storage rules. Named `head` and `footer` slots accept site-owned metadata and
quick links. Hagilight's demo is an adoption example with English at `/en-US/`
and Chinese at `/zh-CN/`; its separate Starlight demo does not opt in.

The deployment base comes from Astro's `BASE_URL`. Local `en-US/` or `/en-US/`
is relative to that base; an already based `/manual/en-US/` stays unchanged.
An absolute HTTP(S) URL must match `Astro.site` (or the request origin if absent)
and already lie within the base. Missing/blank destinations, external origins,
unsupported schemes, traversal outside the base and root aliases (including
`index.html`) throw `TypeError` prefixed `Hagilight RootTransit` during rendering
or static generation. Choose a supported content route, not the transit root.
The browser-safe `@hagicode/hagilight-core/root-transit` entry point exposes the
same destination resolver, navigation resolver, mount helper and interval.

After mounting, the page replaces the current history entry after **1,570 ms**:
the reference's 1,250 ms sweep plus 320 ms hold. Motion preferences suppress
animation without changing forwarding. The clock does not wait for animation
events, fonts or images. A normal continuation activation replaces immediately;
modified clicks retain native behavior. Leaving the document or an Astro
`astro:before-swap` event cancels the timer; `astro:page-load` mounts a newly
rendered transit page once. Back therefore does not re-enter an automatic loop.

With scripting, incoming search and fragment replace their configured counterparts
when nonempty, and the continuation anchor and timer share the resulting URL.
For example, `/manual/?utm=a#features` forwards to
`/manual/en-US/?utm=a#features`. A `?lang=` or `?next=` value is preserved as data
and never selects the destination. Without JavaScript (or if the script fails),
initial HTML still contains the heading, message and a working native link to the
configured landing page. Static HTML cannot carry a browser-only fragment or
request query into that link; automatic forwarding requires scripting.

Run `node --test test/root-transit.test.mjs` after building for URL/timer checks,
and `node test/root-transit-browser.mjs` for the minimal-consumer, responsive,
no-script, reduced-motion, base and history checks.
The latter also runs through `npm run test:viewport`. To compare a locally built
reference without changing it, set `HAGILIGHT_TRANSIT_REFERENCE_DIR` to the
official site's `dist` directory. Matching 1440/375 px captures at 625/1,250 ms
are written to `HAGILIGHT_ARTIFACT_DIR` (default `/tmp/hagilight-root-transit`),
alongside 320/375/1440 px light/dark, minimal-consumer and base-path captures.

## Build info

`@hagicode/hagilight-core/build-info` is browser-safe. It exports the `BuildInfo` type, `normalizeBuildInfo`, `shortCommit`, and `buildInfoItems`, which turn a resolved value into the footer's Branch, Commit, and Built items. `@hagicode/hagilight-core/build-info-resolver` is Node-only: `resolveBuildInfo({ root, env, now })` reads the value for one project. Keep Node-only code out of any module that a browser bundle imports.

Each field resolves on its own, in this order:

| Field | Order | Fallback |
| --- | --- | --- |
| Branch | `HAGILIGHT_BUILD_BRANCH`, then `git symbolic-ref --short -q HEAD` | `unknown` |
| Commit | `HAGILIGHT_BUILD_COMMIT`, then `git rev-parse HEAD` | `unknown` |
| Built | `now`, in UTC, truncated to whole seconds | none; always set |

After trimming, `HAGILIGHT_BUILD_BRANCH` must be nonblank and free of control characters. `HAGILIGHT_BUILD_COMMIT` must be 7 to 64 hexadecimal characters and is stored lowercased. An invalid explicit value falls through to Git. Git runs with a 5-second timeout and its stderr is discarded. A detached HEAD, an unborn branch, a missing `git`, a directory outside any repository, or a timeout yields `unknown` for that field only. The resolver never throws.

The footer shows the commit as its first seven characters, with the full hash in the `title` attribute. The core `Footer` renders this line only when it receives a `buildInfo` prop or the `hagilight()` integration from `@hagicode/hagilight/integration` is registered; otherwise it renders no build text.

## Site metadata file

The integrations write `.well-known/hagilight.metadata.json` into the build output. This module owns the contract, so the three packages cannot drift apart.

- `@hagicode/hagilight-core/site-metadata` is browser-safe. It exports `SITE_METADATA_PATH` (`.well-known/hagilight.metadata.json`, the only place the path is spelled), `buildSiteMetadata`, `validateSiteMetadata` (returns a list of problems; empty means valid), `serializeSiteMetadata` (fixed key order, two-space indent, trailing newline), `detectAnalyticsLoaders` (checks built HTML for each provider's loader markers), `ANALYTICS_LOADER_MARKERS`, and `resolveSiteMetadataOption` (the shared `metadata` option resolver).
- `@hagicode/hagilight-core/site-metadata-writer` is Node-only. `findDiscoveryOutputs(outDir)` reports which discovery files the build produced, and `writeSiteMetadata({ outDir, metadata, siteOwnedFiles, logger })` writes the file through a temporary file and a rename. An existing file, in the output or in `siteOwnedFiles`, is kept and reported.
- `@hagicode/hagilight-core/site-metadata-ownership` decides which integration writes the file when plain Astro and Starlight are both registered. Starlight claims at plugin creation, plain Astro defers, and the owner's write runs after every deferring peer has reported its build step.

The file follows `schemaVersion: 1`. Fields may be added within version 1. Renaming, removing, or re-typing a field requires a new version.

```json
{
  "schemaVersion": 1,
  "generator": { "name": "@hagicode/hagilight-starlight", "version": "0.1.0" },
  "site": {
    "name": "HagiCode Docs",
    "url": "https://docs.hagicode.com/",
    "base": "/",
    "description": "Documentation for HagiCode."
  },
  "languages": {
    "default": "en-US",
    "locales": [
      { "code": "en-US", "lang": "en-US", "path": "/" },
      { "code": "zh-CN", "lang": "zh-CN", "path": "/zh-CN/" }
    ]
  },
  "build": {
    "branch": "main",
    "commit": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    "builtAt": "2026-10-17T08:12:34Z"
  },
  "discovery": {
    "sitemap": "/sitemap-index.xml",
    "robots": "/robots.txt",
    "rss": "/rss.xml",
    "llms": "/llms.txt"
  },
  "analytics": { "googleAnalytics": true, "fiftyOneLa": false, "posthog": true },
  "features": { "seo": true, "promoto": true }
}
```

Rules that every writer applies:

- `site.name` comes from the `name` option, then the site's own title, then the home page name, then the URL hostname. `site.description` is omitted when no description exists.
- `build` holds the same branch, commit, and build time as the footer, with `unknown` for any value that cannot be resolved.
- `discovery` holds site-relative paths, relative to `site.base`, for the artifacts that exist in this build. A key is absent when its file is absent.
- `analytics` holds three booleans that say whether each provider's loader is in this build. Measurement IDs, 51LA site IDs, and PostHog keys are never written, and neither are environment values, absolute paths, or Git remotes.
- Only the schema fields are copied from typed inputs, so an extra input field cannot leak into the output.

## Comparison articles

Core ships the 136 `*-vs-hagicode` comparison articles (10 locales) as JSON under `data/comparison-articles/<locale>/<slug>.json`. The files are the `1.0.0` structured-article schema, unchanged from the source they moved from. Two entry points split the API by runtime, following the build-info split:

- `@hagicode/hagilight-core/comparison-articles` is browser-safe. It exports the article types, the `STRUCTURED_ARTICLE_*` constants, `validateStructuredArticleDetail(detail, sourceLabel?)` (throws an error that names the failing field path), `buildStructuredArticleDetailPath(locale, slug)` (`/articles/<locale>/<slug>.json`), `buildStructuredArticleLocaleManifestPath(locale)`, and two manifest builders over already-loaded details: `buildStructuredArticleLocaleManifestFromDetails(locale, details)` and `buildStructuredArticleRootManifestFromLocaleManifests(localeManifests)`.
- `@hagicode/hagilight-core/comparison-articles-source` is Node-only. It exports `STRUCTURED_ARTICLE_SOURCE_ROOT`, `listStructuredArticleLocales`, `listStructuredArticleSlugs`, `loadStructuredArticleDetail`, `loadStructuredArticleLocaleDetails`, `buildStructuredArticleLocaleManifest`, and `buildStructuredArticleRootManifest`. Each function takes an optional `sourceRoot` as its last argument, which tests use. Without it, the data root resolves from the module's location, so the packaged data of the installed core version is read from any working directory.

Loading fails with an error that names the file when an article's `locale` or `slug` does not match its directory or file name.

The schema has two optional parts for real comparisons, both backward compatible with the earlier files:

- Block type `comparison-table`: `{ id, type, caption?, headers, rows }`. `headers` has at least two entries (the first labels the row-label column); each row is `{ id, cells }` with exactly one cell per header and the row label first. The consuming site renders it as an HTML `<table>`.
- Top-level `faq`: a non-empty list of `{ question, answer }`. The consuming site renders it visibly and emits the same text as `FAQPage` structured data, so keep answers self-contained.

Only `en-US` and `zh-CN` carry the rewritten comparison structure (short answer, comparison table, what the agent does well, when to choose which, co-use guide, shared HagiCode section, bottom line, FAQ). The other eight locales still hold the earlier template and get rewritten only after the English page shows search impressions for comparison queries; do not add new template articles to them. `test/comparison-article-content.test.mjs` enforces both generations.

For one article without the loaders, import the raw JSON through the pattern export:

```ts
import claude from '@hagicode/hagilight-core/comparison-articles-data/en-US/claude-vs-hagicode.json' with { type: 'json' };
```

Only files under `data/comparison-articles/*.json` are exported this way; every other packaged path stays private.

## Content images

`@hagicode/hagilight-core/content-images` normalizes the `<img>` elements in Markdown and MDX body content at build time. A body image gets the marker class `hagilight-content-image`, `loading="lazy"`, and `decoding="async"`. Values the author already set are kept, existing classes are kept, and the marker is added once.

| Option | Default | Accepted values |
| --- | --- | --- |
| `loading` | `lazy` | `lazy` or `eager`, applied only when the image has no `loading` |
| `decoding` | `async` | `async`, `sync`, or `auto`, applied only when the image has no `decoding` |
| `className` | `hagilight-content-image` | A class name without whitespace |

Images inside a `<picture>` element are skipped. An MDX `class={expression}` gets no marker because its value is not known at build time. Raw HTML `<img>` tags inside a `.md` file are not normalized; use Markdown image syntax or MDX for body images.

Local body images in `.md` and `.mdx` files that Astro resolves are also wrapped in a `<picture>` element, with an AVIF `<source>` and a WebP `<source>` ahead of the `<img>`. The rule is shared by both file types. An image is wrapped only when all of these hold: it is a relative path (`./` or `../`) that Astro collects as a local file; its extension is not `.svg` or `.gif`, ignoring case, query strings, and fragments; it does not resolve into the project's `public/` directory (`publicDir`), where it keeps its plain `<img>`; the step is enabled; and it is not already inside a `<picture>` or `Picture` the author wrote. A direct import of `rehypeContentImages` or `satteriContentImages` without registration has no `publicDir`, so it skips the `public/` check and wraps every other image that passes. In `.mdx`, the plugin imports Astro's `Picture` component from `astro:assets`, and the inner `<img>` carries the marker class, `loading`, and `decoding`. Site-root, remote, and raw HTML `<img>` images are not wrapped. Astro generates the source URLs through its image service, so AVIF needs a service that can encode it. The default sharp service does. The passthrough no-op service (`astro/assets/services/noop`) does not, so the Astro integrations skip the wrapper there and log one warning. A plugin added by hand does not check the service, and its sources then point at the original bytes. Encoding adds build time, which Astro caches. In `.md`, each `<source>` also carries `src`, `loading`, `decoding`, `width`, and `height` copied from Astro's output; in `.mdx`, `<source>` carries only `srcset` and `type`. Browsers ignore the extra attributes on `source`, but they are not valid HTML there.

`hagilight()` from `@hagicode/hagilight-starlight` and `hagilight()` from `@hagicode/hagilight/integration` register the plugin automatically, for the whole site and regardless of integration order. Each one opts out through its `contentImages` option; see those packages' READMEs.

To use the plugin without a feature package, add it to the Markdown processor. With the default Sätteri processor:

```js
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { satteriContentImages } from '@hagicode/hagilight-core/content-images';

export default defineConfig({
  markdown: {
    processor: satteri({ hastPlugins: [satteriContentImages()] }),
  },
});
```

With the unified processor, pass `rehypeContentImages()` in `rehypePlugins` instead, from `@astrojs/markdown-remark`'s `unified()`. Integrations that wrap Astro can call `registerContentImages({ config, logger, enabled })` in `astro:config:setup` and `checkContentImageRegistration({ config, logger, enabled })` in `astro:config:done`, both exported from the same entry point.

## Banner placement

The banner is a fixed card at most `42rem` wide, centered between two insets: `--hagilight-promoto-inset-start` and `--hagilight-promoto-inset-end` (both default to `0px`). A layout with a sidebar or a table of contents sets them on `:root` so the card sits in the content column instead of over those rails. `@hagicode/hagilight-starlight` derives them from Starlight's own layout tokens, and `@hagicode/hagilight-docusaurus` measures the doc content column at runtime. A plain Astro site needs nothing.

## Promotion platforms

The shared banner (`PromotoBanner`, `loadActivePromotions`) displays only promotions whose `platforms` array in Index's `/promote.json` includes `web`, in addition to being enabled, inside their activation window, and matched with `/promote_content.json`. This follows the `platforms` flag documented in the Index README. An entry whose `platforms` is missing, empty, or not an array of strings is not displayed, other values such as `hagicode` are ignored, and matching is exact (`Web` does not match). When no promotion remains, the banner shows its site fallback or stays hidden, as before.

The card rises into place when it first appears and when it returns from the Footer or the page top, and sinks away when dismissed; browsers without `@starting-style` or `linear()` get the same movement with a plain ease-out or none, and `prefers-reduced-motion` turns all of it off along with automatic rotation. With more than one promotion, a thin line along the card's bottom edge fills over eight seconds and the next promotion arrives when it completes; hovering the card, tabbing into it, or pressing pause holds the line where it is. Slide content settles in the direction of travel (Previous reverses it). The call to action, muted copy and hover colors read Starlight tokens (`--sl-color-text-accent` on `--sl-color-black`, `--sl-color-gray-2`, `--sl-color-text-high`) and fall back to values derived from the card's own text color, so themes that map only part of the ramp stay legible on dark cards. Override `--promoto-cta-bg`, `--promoto-cta-fg`, `--promoto-muted`, `--promoto-strong` or `--promoto-rotation` on `.hagilight-promoto` to retune them.

The banner stays hidden while the page is at the top during a domain's first 30 visits, and while the Footer is in view. Every page load, refresh, and page-to-page navigation counts as a visit; scrolling and hash changes do not. The per-domain counter is stored in the visitor's browser under `hagilight:promoto-banner:visit-count:<hostname>` and is never sent anywhere.

A promotion's `image` may also carry `sources`, the alternative image files that Index publishes in the order AVIF, WebP, then the original. The banner renders them as a `<picture>` in that order, with the original as its `<img>`, and skips any entry whose `type` is not an `image/*` media type or whose URL is unsafe. Each `src` is resolved against `https://index.hagicode.com` when the promotion documents load. If the browser fails to load a tier, the banner removes it and the next tier is used. A card without `sources` renders the plain `<img>` as before, and `sources` never affect the dismissal signature, so a dismissed banner stays dismissed when only its image chain changes.

## First-party links and campaign tags

Shared link resolution classifies every destination from its parsed URL, never from substring matching, and chooses the relation attribute by that class.

| Class | Destinations | `rel` on a new-tab link |
| --- | --- | --- |
| `same-origin` | Relative URLs, or the site's own origin when `siteUrl` is set | `noopener` |
| `first-party` | Host `hagicode.com` or a subdomain of it (case-insensitive); `github.com` under the `HagiCode-org` organization | `noopener` |
| `third-party` | Every other `http:`/`https:` destination, and any other protocol | `noopener noreferrer` |

Look-alikes are third-party: `hagicode.com.evil.example`, `nothagicode.com`, `github.com/HagiCode-org-fake/site`, and `example.com/hagicode.com`. Same-tab links get no policy `rel`. The site-wide `Referrer-Policy` is unchanged, so a first-party link sends only the origin, and no site should declare `unsafe-url`.

The helpers are exported from `@hagicode/hagilight-core/links`: `classifyLink(href, { origin? })`, `getLinkRel(class)`, and `withCampaignUtm(href, { siteId, medium, origin? })`. `SiteLink.rel` is typed `'noopener' | 'noopener noreferrer'`.

### Campaign tags

Set `siteId` to the identifier of the hosting site, and first-party `hagicode.com` destinations in the footer get campaign parameters:

```js
resolveSiteLinks('en-US', { siteId: 'docs' });
// quick → downloadClient: https://www.hagicode.com/en-US/desktop/?utm_source=docs&utm_medium=footer
```

- Footer `quick`, `community` and related-site entries are tagged with `utm_medium=footer`. The banner call to action is tagged with `utm_medium=promoto`. Header and filing links are not tagged.
- Only `https:` destinations on `hagicode.com` hosts are tagged. GitHub, `mailto:`, `tel:`, third-party, same-origin and relative destinations are left unchanged, and so is every destination when `siteId` is absent or blank.
- Existing `utm_source` or `utm_medium` values win. Other query parameters and the fragment are kept.
- Tags are added after deduplication, so a tagged and a clean destination still collapse into one entry. `normalizeUrl` is unchanged. Canonical URLs, `og:url` and sitemap entries are built from page URLs and never contain `utm_*`.
- Footer clicks report the tagged `href` as `link_url` in the GA click event. The `link_url` dimension therefore includes `utm_source` and `utm_medium` for first-party footer clicks. No new event parameter is added.

### Options

- `links.siteId` (Starlight, Docusaurus, and the `Footer`/`Header` components) enables footer tags. The Starlight and Docusaurus promotion banners read this same value.
- `PromotoBanner` accepts an optional `siteId` prop, written to `data-site-id`. Without it the banner keeps the class-based `rel` and leaves destinations unchanged.
- Each slide is classified and tagged on its own when it renders, so a rotation from a third-party campaign to a first-party one gets the first-party `rel` and tags.

### Google Analytics cross-domain linker

Decision, recorded 2026-10-15 under the `first-party-link-policy-and-attribution` change: **no linker domain list is configured.**

- Every first-party host that runs HagiCode's shared `gtag` is a subdomain of `hagicode.com` (`www`, `docs`, `cost`, `design`, `index`, `soul`, `omniroute`, `openspec`, `impeccable`, `builder`, `newbe`, `awesome`, `tasks`, `trait`, `status`, `api`, and the download hosts `dl-server`, `server.dl`, `desktop.dl`, `dl-desktop`). They share the measurement ID `G-EN03FMT2Q4`, and GA4 sets its cookie on the registrable domain `hagicode.com`, so `_ga` and the session already follow a visitor between these subdomains. A linker would add nothing for them.
- One first-party destination sits on another registrable domain: `github.com/HagiCode-org/*`. It runs no HagiCode `gtag` and cannot read a `_gl` parameter, so a linker would only append `_gl` to GitHub links and make them longer. No linker is needed for it.
- Other hosts that appear in the sites, such as `hagicode-org.github.io` and Azure blob storage, are third-party under this policy and are outside the decision.
- Constraints that any future linker must respect: one `gtag('config', id)` call per page, so a `linker` setting is added to that single call in `GoogleAnalytics.astro`; the sites with their own inline `gtag` copies would each need the same change; and `_gl` must never reach canonical or sitemap URLs.
- Revisit this decision when a HagiCode-owned site runs the shared `gtag` on a registrable domain other than `hagicode.com`, or when a first-party destination on another domain also runs HagiCode's `gtag` and needs session continuity. Then list the host, add it to the linker in the single `config` call, and update the GA reference document, which lives in the monorepo root and needs its owner's follow-up edit.

## PostHog

Render the component once in the global layout's `<head>`, alongside Google Analytics when configured:

```astro
---
import PostHog from '@hagicode/hagilight-core/PostHog';
import GoogleAnalytics from '@hagicode/hagilight-core/GoogleAnalytics';
---
<html>
  <head>
    <PostHog />
    <GoogleAnalytics measurementId="G-EN03FMT2Q4" />
  </head>
  <body><slot /></body>
</html>
```

`<PostHog />` needs no enabled flag or project key. It uses `phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5`, API host `https://us.i.posthog.com`, and SDK defaults `2026-05-30`. It emits no loader or initialization outside production. The SDK is loaded asynchronously with anonymous cross-origin mode from `https://us-assets.i.posthog.com/static/array.js`.

For a different project, pass `<PostHog apiKey="phc_Custom123" />`. Keys must match `^phc_[A-Za-z0-9]+$`; invalid values fail rendering before a script is emitted. The host and defaults version stay fixed.

Non-Astro integrations can import the browser-safe ESM generator and its declarations without installing Astro:

```ts
import {
  posthogInitScript,
  DEFAULT_POSTHOG_API_KEY,
  POSTHOG_API_HOST,
  POSTHOG_DEFAULTS,
  POSTHOG_API_KEY_PATTERN,
} from '@hagicode/hagilight-core/posthog';

const script = posthogInitScript(); // optional custom key as the only argument
```

Initialization runs once per document, including when the script is re-executed before or after the SDK loads. Fresh documents initialize independently. SDK defaults own navigation tracking; Hagilight adds no PostHog capture calls or route listeners. Choose one initialization owner: omit this component when another integration initializes PostHog, or disable the plugin provider when composing it yourself. The plain Astro integration does not inject analytics automatically; the demo composes this component in its shared head (and in its transit page's head slot).

## Google Analytics click events

`GoogleAnalytics` also reports clicks on the key links and download buttons that the shared components render. There is nothing to configure: events follow the same rules as page views, so they are sent only on production pages where Google Analytics is enabled, never on the Starlight 404 page, and silently skipped when `gtag` is missing (development builds, blocked scripts).

A click on a tagged link calls `gtag('event', <action>, …)` once:

| Field | Value |
| --- | --- |
| Event name (action) | `download_click` for the `download` category, `store_visit` for the `store` category, `link_click` for every other category |
| `event_category` | `download`, `store`, `navigation`, `community`, or `promotion` |
| `event_label` | The link's stable id (for example `downloadClient`), never its localized text |
| `link_location` | Where the link sits: `header`, `footer`, `footer_brand`, `article_promotion`, `promoto_banner`, or your own value |
| `link_url` | The destination at click time |
| `transport_type` | `beacon`, so same-tab navigations still deliver |

Reporting never delays, cancels, or changes navigation, and carries no link text, form values, or visitor identifiers.

### Tracked links

The shared components tag exactly these links. The authoritative list is `TRACKED_SITE_LINKS` in `src/analytics-events.ts`; renaming a link id changes its GA label.

Use `store` for links to a store listing page (Microsoft Store, Steam), which reports `store_visit`. Use `download` for installers and download-hub entry points, which report `download_click`. A single click reports under one category only.

| `event_label` | `event_category` | Reported from |
| --- | --- | --- |
| `home`, `blog`, `support` | `navigation` | header (`home` also in the HagiCode showcase) |
| `dockerCompose`, `blogPosts` | `navigation` | footer quick links |
| `productDocs` | `navigation` | footer quick links, HagiCode showcase |
| `downloadClient` | `download` | footer quick links, HagiCode showcase (all-downloads link) |
| `microsoftStore` | `store` | footer quick links, HagiCode showcase (the Microsoft Store badge and its fallback link report `microsoftStore`) |
| `github`, `discord`, `issueFeedback` | `community` | footer community links |
| the promotion's id | `promotion` | floating promotion banner call to action, including rotated slides |

Related-site links, RSS, sitemap, about, contact, filings, the language chooser, and links you add through `extraLinks` do not report events. A consumer that overrides a tracked link's destination keeps the original label and reports the new destination as `link_url`.

### Tag your own links

```astro
---
import { gaEventAttributes } from '@hagicode/hagilight-core/analytics-events';
---

<a
  href="/downloads/"
  {...gaEventAttributes({ category: 'download', label: 'pricingDownload', location: 'pricing' })}
>Download</a>
```

`gaEventAttributes()` returns the `data-ga-category`, `data-ga-label`, `data-ga-location`, and optional `data-ga-url` attributes (pass `url` when the tagged element has no `href` of its own). It throws a `TypeError` for an unknown category or an empty label or location. The category must be one of `download`, `store`, `navigation`, `community`, or `promotion`; action names such as `store_visit` are not categories. For a store listing, use `category: 'store'`, for example `gaEventAttributes({ category: 'store', label: 'openSteamStore', location: 'pricing' })`. A hand-written `data-ga-*` tag with an invalid category is ignored at click time. The page must render `GoogleAnalytics` for the click to be reported. `siteLinkGaAttributes(link, location)` tags a resolved site link and returns `{}` for ids outside the tracked list.

### Reports

`event_category`, `event_label`, `link_location`, and `link_url` are custom event parameters. The property owner must register them as GA4 custom dimensions before they appear in standard reports; until then they are visible in DebugView and exports only. Ad blockers and browsers that block Google Analytics drop these events like any other, so treat the counts as directional.

See the [repository documentation](https://github.com/HagiCode-org/hagilight#readme) for the full list of entry points and usage.
