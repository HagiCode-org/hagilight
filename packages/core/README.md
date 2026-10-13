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
The core Footer stays independent of feature packages and does not add
attribution by itself. Plain-Astro sites that want the literal
`Powered By hagilight@<version>` package attribution can replace this import with
`@hagicode/hagilight/Footer`; that component reads the exact build-time version
from `@hagicode/hagilight`'s own manifest, not from Astro.

Other entry points include `Copyright`, `PromotoBanner`, `GoogleAnalytics`, and `Analytics51LA` Astro components; `links`, `favicon`, `seo`, `seo-schema`, `rss`, `rss-ownership`, `promotions`, and `analytics-events` utilities; and `logo.png` and `favicon.ico` assets. For example:

```ts
import { resolveSiteLinks } from '@hagicode/hagilight-core/links';

const links = resolveSiteLinks('en-US');
```

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

## Promotion platforms

The shared banner (`PromotoBanner`, `loadActivePromotions`) displays only promotions whose `platforms` array in Index's `/promote.json` includes `web`, in addition to being enabled, inside their activation window, and matched with `/promote_content.json`. This follows the `platforms` flag documented in the Index README. An entry whose `platforms` is missing, empty, or not an array of strings is not displayed, other values such as `hagicode` are ignored, and matching is exact (`Web` does not match). When no promotion remains, the banner shows its site fallback or stays hidden, as before.

The banner stays hidden while the page is at the top during a domain's first 30 visits, and while the Footer is in view. Every page load, refresh, and page-to-page navigation counts as a visit; scrolling and hash changes do not. The per-domain counter is stored in the visitor's browser under `hagilight:promoto-banner:visit-count:<hostname>` and is never sent anywhere.

A promotion's `image` may also carry `sources`, the alternative image files that Index publishes in the order AVIF, WebP, then the original. The banner renders them as a `<picture>` in that order, with the original as its `<img>`, and skips any entry whose `type` is not an `image/*` media type or whose URL is unsafe. Each `src` is resolved against `https://index.hagicode.com` when the promotion documents load. If the browser fails to load a tier, the banner removes it and the next tier is used. A card without `sources` renders the plain `<img>` as before, and `sources` never affect the dismissal signature, so a dismissed banner stays dismissed when only its image chain changes.

## Google Analytics click events

`GoogleAnalytics` also reports clicks on the key links and download buttons that the shared components render. There is nothing to configure: events follow the same rules as page views, so they are sent only on production pages where Google Analytics is enabled, never on the Starlight 404 page, and silently skipped when `gtag` is missing (development builds, blocked scripts).

A click on a tagged link calls `gtag('event', <action>, …)` once:

| Field | Value |
| --- | --- |
| Event name (action) | `download_click` for the `download` category, `link_click` for every other category |
| `event_category` | `download`, `navigation`, `community`, or `promotion` |
| `event_label` | The link's stable id (for example `downloadClient`), never its localized text |
| `link_location` | Where the link sits: `header`, `footer`, `article_promotion`, `promoto_banner`, or your own value |
| `link_url` | The destination at click time |
| `transport_type` | `beacon`, so same-tab navigations still deliver |

Reporting never delays, cancels, or changes navigation, and carries no link text, form values, or visitor identifiers.

### Tracked links

The shared components tag exactly these links. The authoritative list is `TRACKED_SITE_LINKS` in `src/analytics-events.ts`; renaming a link id changes its GA label.

| `event_label` | `event_category` | Reported from |
| --- | --- | --- |
| `home`, `blog`, `support` | `navigation` | header (`home` also in the HagiCode showcase) |
| `dockerCompose`, `blogPosts` | `navigation` | footer quick links |
| `productDocs` | `navigation` | footer quick links, HagiCode showcase |
| `downloadClient`, `microsoftStore` | `download` | footer quick links, HagiCode showcase (the Microsoft Store badge and its fallback link report `microsoftStore`) |
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

`gaEventAttributes()` returns the `data-ga-category`, `data-ga-label`, `data-ga-location`, and optional `data-ga-url` attributes (pass `url` when the tagged element has no `href` of its own). It throws a `TypeError` for an unknown category or an empty label or location. A hand-written `data-ga-*` tag with an invalid category is ignored at click time. The page must render `GoogleAnalytics` for the click to be reported. `siteLinkGaAttributes(link, location)` tags a resolved site link and returns `{}` for ids outside the tracked list.

### Reports

`event_category`, `event_label`, `link_location`, and `link_url` are custom event parameters. The property owner must register them as GA4 custom dimensions before they appear in standard reports; until then they are visible in DebugView and exports only. Ad blockers and browsers that block Google Analytics drop these events like any other, so treat the counts as directional.

See the [repository documentation](https://github.com/HagiCode-org/hagilight#readme) for the full list of entry points and usage.
