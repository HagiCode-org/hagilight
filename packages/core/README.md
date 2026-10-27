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

Other entry points include `Copyright`, `PromotoBanner`, `GoogleAnalytics`, `PostHog`, and `Analytics51LA` Astro components; `links`, `favicon`, `seo`, `seo-schema`, `rss`, `rss-ownership`, `promotions`, `analytics-events`, and `posthog-events` utilities; and `logo.png` and `favicon.ico` assets. For example:

```ts
import { resolveSiteLinks } from '@hagicode/hagilight-core/links';

const links = resolveSiteLinks('en-US');
```

## Footer avatar

The footer brand block shows one decorative HagiCode avatar beside the headline. `avatar` defaults to `true`; `avatar={false}` removes the element and its request. The default is `assets/footer/avatar.avif` (128 px, with `avatar.webp` as the fallback) in a 64 px box, hidden below a 360 px container. `randomAvatar` defaults to `true`: the box becomes a 112 × 76 px stage, and once the footer nears the viewport the browser picks 6 distinct entries of the `cat-head-gallery` pool listed in `assets/footer/manifest.json`, preloads them, and deals three as a fan (the default fades out under them). All six loaded: every 3.6 seconds the left card leaves, the others shift left and a waiting card enters on the right, paused while the footer is off screen or the tab is hidden. Fewer than six loaded (or `prefers-reduced-motion: reduce`, which fetches only three) gives a still fan of three; fewer than three keeps the default. The browser picker is `@hagicode/hagilight-core/random-image` (`mountRandomFans`; browser-safe), preloads with a plain `Image()`, not `fetch`, waits up to 3 seconds per image, and makes no request under a data-saver preference. The slot carries `data-random-fan` (the same validated pool list); the showcase illustration in the Starlight article footer uses the same fan; the single-image swap (`data-random-pool`, `mountRandomImages`) stays exported for other slots. `randomAvatar={false}` ships no pool list and no picker script.

`@hagicode/hagilight-core/footer-avatar` resolves the two options (a non-boolean throws a `TypeError`) and gives the shared image attributes. The Astro footers and the Docusaurus footer render the same `<picture class="hagilight-brand__avatar">` markup.

A site with a strict `img-src` policy must allow `https://img-gen.hagicode.com` for the cat fan. Without it the fan fails and the default stays.

**Pool refresh.** The pool is the `pool` object in `assets/footer/manifest.json`: `album`, `maxBytes` (40 KiB) and `entries` (`key`, `bytes`). To change it, take keys from the album's `index.json`, keep 12 to 200 unique keys each at or under `maxBytes`, audit each one as text-free, current and private-data free, and update the list. Then run `npm test`: `test/footer-imagery.test.mjs` fails on a missing file, a size or dimension mismatch, an entry over the cap, or a pool outside 12 to 200. The vendored default is `source.objectKey` in the same manifest.

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
animation setup, feature package or analytics is required. By default it also
requests one image from `img-gen.hagicode.com`; the [splash image](#splash-image)
section describes that request and how to switch it off.
The departures board (see [below](#departures-board)) replaces the old destination/base/origin
trace; the page does not perform the official website's locale detection itself. Installing core alone never
changes routes. Consumers that do not import this page keep their current root.

`destination` and nonblank `siteName` are required. Optional `locale` (default
`en-US`), `heading`, `message`, `continueLabel`, and `loadingLabel` supply the site's translated
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

When the beam lands (1,250 ms, or at once when a continuation click starts the navigation early) the
page sets `data-transit-phase="loading"` on the root and a 3 px loading rail takes over from the beam: the
same blue-to-green gradient and vertical head, creeping toward 94% and never reaching 100%, with a sheen
that keeps moving while the next page is awaited. A browser navigation has no readable progress, so the
rail says "still working", not "x% done"; it is a `progressbar` without a value, named by `loadingLabel`
or, when that is unset, `heading`. The optional `loadingLabel` also cross-fades the status line into that
text; it has no English default because a default could not be localized. Under reduced motion the rail
is a still, partly filled bar. The attribute is style only and never moves the forward clock.

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

### Splash image

While the page forwards, `RootTransit` shows one image picked at random from the
img-gen `startup-splash` collection (`hagicode-splash-001` to `hagicode-splash-600`,
see [Image paths from img-gen](#image-paths-from-img-gen)). It is on by default. A
visit makes one request to `img-gen.hagicode.com` for an AVIF of about 20 to 50 KB,
after the page has mounted. The image is decorative, sits behind the content and takes
no layout space, so the heading, trace and links stay where they are. The splash never
delays the forward timer or a continuation click.

If the chosen image fails, one other key is tried. A second failure hides the image
with no visible message. A cache read waits at most 100 ms, and the page then
requests the network URL. The loaded image is stored in the Cache API for later
visits when the host sends CORS headers; without them the image still displays.

Pass `splash` to change it. `splash={false}` renders no splash markup and makes no request to
the image host. An object overrides any of these keys; other keys are rejected.

| Key | Default | Accepted values |
| --- | --- | --- |
| `baseUrl` | `https://img-gen.hagicode.com` | An HTTPS URL without credentials, query or fragment. A trailing slash is removed. |
| `prefix` | `startup-splash` | Letters, digits, `.`, `_` and `-` segments joined by `/`. No empty, `.` or `..` segment. |
| `count` | `600` | An integer from 1 to 9999. Keys are `hagicode-splash-001` upward. |
| `cacheName` | `hagilight.rootTransit.splash` | A non-empty string. |

The key pattern is the img-gen contract and cannot be changed. An invalid value throws a
`TypeError` prefixed `Hagilight RootTransit` during rendering.

```astro
<RootTransit destination="/en-US/" siteName="My site" splash={false} />
<RootTransit destination="/en-US/" siteName="My site" splash={{ count: 120 }} />
```

A site whose Content Security Policy blocks the image host should either set
`splash={false}` or allow `img-src https://img-gen.hagicode.com` and
`connect-src https://img-gen.hagicode.com`.

### Departures board

Beside the route sweep, the page shows a board that scrolls through the HagiCode ecosystem sites and stops
on this site. Every row is real catalog data, localized to the `locale` prop: the site name, its
description (or its host when it has none), and the host. The caption is the localized "Ecosystem Sites"
label and the number of sites listed. Nothing is invented: the rows come from the same
`related-sites.json` the footer uses, so a site added there appears on the board.

The reel is driven by the same `--run` variable and easing as the route sweep, so it comes to rest as the
beam finishes, and this site's row then fills from the left, the same landing as the continue chip. It
adds no timer and does not move forwarding. The finished state is also the static markup: without
scripting, or with reduced motion, you see the five-row window already stopped on this site. The board is
decorative (`aria-hidden`); the heading, message and links carry the page.

```astro
<RootTransit destination="/en-US/" siteName="My site" board={{ siteId: 'newbe-blog' }} />
<RootTransit destination="/en-US/" siteName="My site" board={{ relatedSites: [{ id: 'docs', name: 'Docs', url: 'https://docs.example/' }] }} />
<RootTransit destination="/en-US/" siteName="My site" board={false} />
```

| Option | Effect |
| --- | --- |
| `siteId` | Leaves that catalog id out, as the footer does, so a site is not listed on its own board. A site whose URL equals `Astro.site` is also left out. |
| `relatedSites` | Replaces the bundled catalog (`id`, localized `name`, optional `description`, `url`). |
| `false` | No board. |

`@hagicode/hagilight-core/root-transit-board` exposes `resolveTransitBoard()`, the pure function that builds
the rows. It is build-time only and reads nothing from the browser.

### Locale monitor

`localeMonitor` is off unless you set it. It shows what the browser's language inputs would resolve to,
so a maintainer can see why a visitor lands where they do. It never chooses a route.

```astro
<RootTransit destination="/en-US/" siteName="My site" localeMonitor />
<RootTransit destination="/en-US/" siteName="My site" localeMonitor={{ sharedDomain: false }} />
```

With the monitor on, a caption and five rows appear below the language links. Four rows are detection
inputs, in the same order as the official website's transit page (`repos/site`, `traceSiteEntryLocale()`):

| Order | Row | Read from | Wins when |
| --- | --- | --- | --- |
| 1 | `?lang=` | the page URL | the value is one of the ten supported locales |
| 2 | `hagicode:site-locale` | `localStorage`, falling back to the legacy `lang` key | the value is supported |
| 3 | `navigator.languages` | the browser, first supported entry | an entry is supported |
| 4 | `default` | fixed | nothing above is supported; always `en-US` |

The winning row carries the word **detected**. Unsupported values stay visible and are skipped. A regional
or legacy form such as `zh-TW`, `zh_CN`, `pt` or `de-AT` resolves to its supported locale, and the row shows
both, for example `de-AT → de-DE`.

The fifth row, **shared marker**, shows the marker recorded by a HagiCode site on the last visit. It is
evidence only. It never takes part in detection, and it never changes the target or the links.

Detection and navigation are separate, and the monitor keeps them separate:

| | Target and language links | Locale monitor |
| --- | --- | --- |
| Source | `destination` and `links` props | the four inputs above |
| Changed by a `?lang=` value | no; the forward target and the continue link stay as configured | no; it is reported as detected |
| Timer | the same 1,570 ms | unchanged; it adds no timer or listener |
| Marked as | `configured` | `detected` |

With `?lang=zh-CN` on a page configured for `/en-US/`, the page still forwards to `/en-US/?lang=zh-CN`
after the delay, and the monitor reports `zh-CN` as detected.

#### Cross-site marker

After it resolves the locale, the monitor records one marker: the locale, the winning input, the host and
the time, for example `zh-CN|query|docs.hagicode.com|1761000000`. It writes only two keys:

- `localStorage` key `hagicode:locale-monitor`, on every host.
- Cookie `hagicode_locale_monitor`, only when the page host is `hagicode.com` or one of its subdomains. It is
  written with `Domain=.hagicode.com; Path=/; SameSite=Lax; Secure; Max-Age=15552000` (about 180 days), so
  every HagiCode subdomain can read it.

`localStorage` is not shared between subdomains, which is why the cookie exists. Reading another site's
storage would need a hidden iframe bridge, and this component does not add one. The monitor never writes
`hagicode:site-locale` or `lang`, which belong to the official website.

`localeMonitor={{ sharedDomain }}` sets the cookie domain. The default is `hagicode.com`. Pass `false` for
same-origin only: no cookie is written anywhere, and the marker stays in `localStorage`. Any other value must
be a domain such as `example.test`, or the component throws a `TypeError` prefixed `Hagilight RootTransit`
during rendering.

#### Privacy and failure

The monitor reads the URL, the two storage keys, the marker and `navigator.languages`, and shows them on the
page. It sends nothing over the network and sends nothing to analytics. A blocked or throwing storage or
cookie fails only its own row or write, and the page still forwards on time. Without scripting, the five
rows are present in the HTML with placeholder values, and the continue link works. The cookie is sent with
every request to every `hagicode.com` subdomain, so it holds only the locale code, the winning input, a host
and a time, and it is kept small. Listing it in a cookie notice is the site owner's decision.

## Image paths from img-gen

<!--
Checked 2026-10-20 (OpenSpec task 1.1): `https://img-gen.hagicode.com/startup-splash/manifest.json` lists 600
entries, `hagicode-splash-001` to `hagicode-splash-600`, all unique and all 1232 x 704. The manifest and an AVIF
response both send no `Access-Control-Allow-Origin` header. A Cache API write downloads with CORS, so it fails
until img-gen sends that header. `<img>` display needs no CORS and is unaffected.
-->

`@hagicode/hagilight-core/splash-images` gives other HagiCode sites the image paths of the img-gen
`startup-splash` collection. img-gen is read only here: the host serves what img-gen publishes.

| Part | Value |
| --- | --- |
| Base URL | `https://img-gen.hagicode.com` |
| Prefix | `startup-splash` |
| File name | `hagicode-splash-NNN.avif`, with NNN padded to three digits |
| Range | 1 to 600 |
| Size | 1232 x 704 AVIF |
| Authoritative list | `https://img-gen.hagicode.com/startup-splash/manifest.json` |

The manifest lists `entries[]`, each with `key`, `file`, `width`, `height` and `bytes`. A site that needs only the
images that exist should read it. A site that can tolerate a failed image may build paths from the key pattern
directly, as the relay page does. The key pattern is the img-gen contract, so `SPLASH_IMAGE_DEFAULTS` does not
change it.

Worked example: index 7 becomes key `hagicode-splash-007`, then the URL
`https://img-gen.hagicode.com/startup-splash/hagicode-splash-007.avif`.

```js
import { pickSplashIndex, splashImageUrl } from '@hagicode/hagilight-core/splash-images';

splashImageUrl(7); // https://img-gen.hagicode.com/startup-splash/hagicode-splash-007.avif
splashImageUrl(pickSplashIndex()); // one of the 600 keys, at random
```

Cache API example for another site. The loader reads the Cache API within 100 ms and never rejects. A miss or an
unavailable cache means the caller shows the network URL. A stored image is keyed by its full URL.

```js
import { loadSplashImage, splashImageUrl, storeSplashImage } from '@hagicode/hagilight-core/splash-images';

const url = splashImageUrl(pickSplashIndex());
const loaded = await loadSplashImage(url);
if (loaded.source === 'cache') {
  img.src = URL.createObjectURL(loaded.blob);
} else {
  img.src = url;
  img.addEventListener('load', () => storeSplashImage(url), { once: true });
}
```

`storeSplashImage` downloads with a CORS `fetch` and keeps the 30 newest entries. It returns `false` when the host
sends no CORS header or the cache is unavailable, and the page still shows the image. A site with a Content
Security Policy needs `img-src https://img-gen.hagicode.com` to show the images, and `connect-src
https://img-gen.hagicode.com` for the store step.

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

- `@hagicode/hagilight-core/site-metadata` is browser-safe. It exports `SITE_METADATA_PATH` (`.well-known/hagilight.metadata.json`, the only place the path is spelled), `buildSiteMetadata`, `validateSiteMetadata` (returns a list of problems; empty means valid), `serializeSiteMetadata` (minified, fixed key order, trailing newline), `detectAnalyticsLoaders` (checks built HTML for each provider's loader markers), `ANALYTICS_LOADER_MARKERS`, and `resolveSiteMetadataOption` (the shared `metadata` option resolver).
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
  "features": { "seo": true, "promoto": true, "consent": true }
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

## Promotion analytics

The shared banner reports three PostHog events, with `promo_id` equal to the call to action's `data-ga-label` (the promotion id). Positions are 1-based, matching the visible counter.

| Event | Sent when | Properties |
|---|---|---|
| `promoto_impression` | A promotion has stayed visible for 1000 ms. Once per promotion per page; a new page key (pathname and query) allows it again. | `promo_id`, `position`, `rotating` (automatic rotation was active) |
| `promoto_dismissed` | The dismiss control is clicked. Sent before the existing dismissal steps, which are unchanged. A repeated click during the exit animation sends nothing. | `promo_id`, `visible_ms` (from the promotion first appearing on this page), `seen_count` (distinct promotions visible on this page, including this one) |
| `promoto_paged` | The carousel moves. `method` is `auto` for the rotation timer and `click` for previous or next. Pausing sends nothing, and reduced motion sends no `auto` event. | `from`, `to`, `method` |

Events are sent only when `window.posthog` has loaded and the visitor has not opted out. Nothing is queued while PostHog is still a stub, and a failing capture never changes display, rotation, dismissal, paging or navigation. The Astro `PromotoBanner` and the Docusaurus card share this element, so both send the same events.

Per-promotion click-through is `cta_click` with `category=promotion` divided by `promoto_impression`, grouped by `promo_id`. Dismissal rate should use visitors who had an impression as its denominator, because a dismissal hides the banner for good.

### Close behavior

Dismissal is stored in `localStorage` under `hagilight:promoto-banner:dismissed-signature`, not `sessionStorage`. There is no expiry; the value stays until the browser clears site data or the card set changes. The stored value is the signature of all cards, not one promotion id, so one close hides the whole set and changing any card shows it again. It is scoped per origin, so each `*.hagicode.com` site dismisses on its own. If storage is unavailable, the dismissal is not kept and the banner returns on the next load. Hiding at page top (first 30 visits per hostname) and while the footer is in view are not dismissals and are not reported.

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

- Footer `quick`, `community` and related-site entries are tagged with `utm_medium=footer`, `utm_campaign=<link id>` (the related site's id for ecosystem entries) and `utm_content=footer`. Footer-brand links say `utm_content=footer_brand` instead. The banner call to action is tagged with `utm_medium=promoto`, `utm_campaign=<promotion id>` and `utm_content=promoto_banner`. Article-end promotion links are tagged with `utm_medium=article`, `utm_campaign=<link id>` and `utm_content=article_promotion`. The Store badge and header links are not tagged.
- Only `https:` destinations on `hagicode.com` hosts are tagged. GitHub, `mailto:`, `tel:`, third-party, same-origin and relative destinations are left unchanged, and so is every destination when `siteId` is absent or blank.
- Existing `utm_source`, `utm_medium`, `utm_campaign` or `utm_content` values win; only missing keys are added. Other query parameters and the fragment are kept.
- Tags are added after deduplication, so a tagged and a clean destination still collapse into one entry. `normalizeUrl` is unchanged. Canonical URLs, `og:url` and sitemap entries are built from page URLs and never contain `utm_*`.
- Footer clicks report the tagged `href` as `link_url` in the GA click event. The `link_url` dimension therefore includes `utm_source` and `utm_medium` for first-party footer clicks. No new event parameter is added.

### Options

- `links.siteId` (Starlight, Docusaurus, and the `Footer`/`Header` components) enables footer tags. The Starlight and Docusaurus promotion banners read this same value.
- `links.siteUrl` names the hosting site's URL for same-origin classification and for excluding its own Ecosystem Sites entry. When it is not set, the core `Footer` uses the page's Astro `site` (`Astro.site`) instead, so a site built for `https://fullstack.hagicode.com` does not list the HagiCode Fullstack entry on its own footer. An explicit `siteUrl` wins, and with neither value the footer behaves as before. The fallback never sets `siteId`, so no campaign tags are added.
- `PromotoBanner` accepts an optional `siteId` prop, written to `data-site-id`. Without it the banner keeps the class-based `rel` and leaves destinations unchanged. The Starlight `PromotoFooter` component takes the same `siteId` prop and forwards it.
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

`<PostHog />` needs no enabled flag or project key. Optional props set the site context: `siteId` (defaults to the site URL's hostname), `framework` (`astro` by default; Starlight passes `starlight`), `version` (defaults to this package's version), and `pageType` (see below). It uses `phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5`, API host `https://t.hagicode.com` (HagiCode's managed proxy), UI host `https://us.posthog.com`, person profiles `identified_only` (profiles are created only for identified users), and SDK defaults `2026-05-30`. It emits no loader or initialization outside production. The SDK is loaded asynchronously with anonymous cross-origin mode from `https://t.hagicode.com/static/array.js`, so the proxy must serve both ingestion and `/static/` assets. Sites with a strict script or connect policy must allow `t.hagicode.com`.

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

const script = posthogInitScript(); // optional custom key as the first argument
// Optional second argument: the site context, { siteId?, framework, version, pageType? }
const withContext = posthogInitScript(undefined, { framework: 'astro', version: '0.1.0', siteId: 'docs.example.com' });
```

Initialization runs once per document, including when the script is re-executed before or after the SDK loads. Fresh documents initialize independently. SDK defaults own navigation tracking. Beyond them, Hagilight makes one `posthog.register` call with the site context, sets `capture_exceptions`, and sends `cta_click` events through one click listener per document. It adds no other capture calls and no route listeners. Choose one initialization owner: omit this component when another integration initializes PostHog, or disable the plugin provider when composing it yourself. The plain Astro `hagilight()` integration injects the same script into every production head by default (see its README), so render this component only in a custom head where that integration is not the owner, such as a Starlight site that keeps its own `Head` or a site that sets `analytics: { posthog: { enabled: false } }`.

### Site context

After initialization, each page registers five super properties once. Empty values are omitted:

- `site_id`: `links.siteId` when a site sets it, otherwise the site URL's hostname, otherwise the document hostname at run time. Two sites on one hostname with different base paths share a `site_id` unless `links.siteId` is set.
- `site_framework`: `astro`, `starlight` or `docusaurus`.
- `hagilight_version`: the version of the integration that rendered the page.
- `locale`: the document's `<html lang>`, read at run time.
- `page_type`: one of `home`, `docs`, `blog`, `compare`, `404` or `other`. A build-time value wins, then `<meta name="hagilight:page-type">`, then `other`. Starlight derives the value per page. Plain Astro sets it with the `pageType` prop of `SEOHead`, which emits the meta element. Docusaurus refreshes `locale` and `page_type` on every route update, including the first page load, from the path. Because it classifies by path only, its 404 page reports a path-derived type (`docs`, `blog` or `compare`) rather than `other`.

The site-metadata file keeps its schema; it gains no analytics identifier.

### Event vocabulary and `cta_click`

`@hagicode/hagilight-core/posthog-events` is the only place PostHog event names, per-event property allowlists, super-property keys, page types and framework names are spelled. It is browser-safe, with no Astro or Node imports, and it exports `POSTHOG_EVENTS`, `POSTHOG_SUPER_PROPERTIES`, `POSTHOG_PAGE_TYPES`, `POSTHOG_FRAMEWORKS`, `capturePostHogEvent`, `sanitizePostHogProperties`, `destinationOf`, `resolvePageType`, `classifyPagePath`, `installPostHogClickTracking` and `handlePostHogClick`.

A marked link (any element with `data-ga-category`, `data-ga-label` and `data-ga-location`) produces one `cta_click` event:

- `category`, `label` and `location` come from the same attributes that Google Analytics reads.
- `destination_host` is the lowercase host of the destination only. The destination comes from `data-ga-url`, then the `href` property, then the `href` attribute. No path, query string, hash or credential is ever sent.
- `is_external` is `true` only when the destination host differs from the current page's host. A non-HTTP(S) or unparseable destination omits `destination_host` and reports `false`.

The click listener is passive and capture-phase. It never cancels, stops or delays a click, and it is installed at most once per document whether or not Google Analytics is enabled. It sends nothing when `window.posthog` is absent or `has_opted_out_capturing()` returns `true`, and it never reads link text or form input or identifies the visitor. Other events in the vocabulary are documented with their features.

Changing the vocabulary is a deliberate change: update the table in `packages/core/src/posthog-events.ts` and the snapshot in `test/posthog-events.test.mjs` together.

### Exception capture and privacy limits

`posthog.init` sets `capture_exceptions: true`, so unhandled errors are reported as `$exception` events. Project-side prerequisite: `$exception` events also need the `autocapture_exceptions_opt_in` setting enabled in the PostHog project. That setting belongs to the PostHog project owner and not to this repository, so until it is enabled, expect no `$exception` events. Hagilight does not call `identify`, `opt_in_capturing`, `opt_out_capturing` or any session-replay method, so visitors are never identified by Hagilight and no consent state changes.

## Analytics consent

Analytics is off until a visitor grants it. With consent on (the default whenever a provider is enabled), Google Analytics, 51LA and PostHog leave only inert `application/json` descriptors in the page. The gate (`@hagicode/hagilight-core/consent-gate`) injects each loader once, after a grant, and nothing from the undecided period is queued or replayed. Consent-off output (`consent` prop `false`, or `analytics.consent.enabled: false` in a framework plugin) keeps the static loaders as before.

- `@hagicode/hagilight-core/consent` (browser-safe): `getConsent()` returns `{ necessary: 'granted', analytics: 'granted' | 'denied' | 'undecided' }`; `setConsent({ analytics })`; `onConsentChange(callback)` returns an unsubscribe function; `openConsentPreferences()` reopens the popup. None of them throw. `configureConsent({ regionHook })` takes an optional region check: returning `false` means consent is not required; any other result or a throw means it is.
- Events: `hagilight:consent-change` on `document`, with the new state as `detail`, after each effective change.
- Storage: cookie `hagicode_consent` (`Domain=.hagicode.com`, `Path=/`, `SameSite=Lax`, `Secure`, 180 days) on hagicode.com hosts only, and localStorage `hagicode:consent` everywhere. The record is `1|granted|<epoch seconds>|<policyVersion>`, expires after 180 days, and a changed policy version asks again. With storage blocked the choice holds for the page session only.
- `@hagicode/hagilight-core/CookieConsent` (Astro): renders the popup. Pass `providers` (the enabled analytics providers), and optionally `privacyUrl` (an absolute HTTP(S) URL or a `/` path; omitted means no privacy link) and `policyVersion` (1 to 32 letters, digits, dots, underscores or hyphens). Mount it only when a provider is enabled. The popup publishes `--hagilight-consent-clearance` so the banner and footers stay clear of it.
- `@hagicode/hagilight-core/consent-markup` holds the shared markup, the config descriptor and the option validators; `@hagicode/hagilight-core/consent-copy` holds the localized copy for every `SITE_LOCALES` code.

Storage names that the details list (and that cleanup removes on withdrawal) are verified in `test/fixtures/consent-sdk-storage.json`: PostHog writes `ph_<key>_posthog` (cookie and localStorage), `__ph_opt_in_out_<key>` and two `ph_<key>_` sessionStorage keys; Google Analytics writes `_ga` and `_ga_<id>`. 51LA's names are not verified yet. Re-verify the SDK names whenever an SDK is upgraded, and update `packages/core/src/consent-gate.ts` and the fixture together.

Withdrawal stops collection: PostHog opts out and its `ph_` entries are removed; GA sets `ga-disable-<id>` and its cookies are removed; any provider that cannot stop in place (51LA always, GA and PostHog until the consent browser check confirms otherwise) reloads the page after the denial is saved.

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
