# @hagicode/hagilight-core

Shared Astro components, TypeScript utilities, and brand assets for HagiCode sites. This package works with plain Astro and Starlight; it does not require Starlight.

## Install

```sh
npm install @hagicode/hagilight-core astro
```

Use a supported Astro version (`^6.0.7 || ^7.3.5`). The other Hagilight packages install core automatically; install it directly if your site imports core entry points.

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
