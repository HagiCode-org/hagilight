# Analytics and tagged links

Hagilight sites can load Google Analytics, 51LA and PostHog. This reference says what each site type configures and where the rules live. Option tables stay in the package READMEs.

## Production builds only

Every provider renders only in a production build. Development pages carry no loader, so a dev server cannot show that analytics work. Check analytics on a production build, or on the deployed site.

## Which provider each site type configures

| Site type | Google Analytics | 51LA | PostHog |
| --- | --- | --- | --- |
| Documentation, Starlight | `analytics.googleAnalytics` in the `hagilight()` plugin options | `analytics.fiftyOneLa` in the same options | `analytics.posthog` in the same options, on by default |
| Documentation, Docusaurus | `analytics.googleAnalytics` in `hagilightDocusaurus()` options | `analytics.fiftyOneLa` in the same options | `analytics.posthog` in the same options, on by default |
| Official website, plain Astro | Compose `<GoogleAnalytics measurementId="G-…" />` from `@hagicode/hagilight-core/GoogleAnalytics` in the layout head | Compose `<Analytics51LA siteId="…" />` from `@hagicode/hagilight-core/Analytics51LA` in the layout | Injected by `hagilight()` by default, through `analytics.posthog` |

Each provider takes `enabled` and its ID. Omitting `enabled` enables a provider when its ID is set. `enabled: false` turns it off without affecting the others.

For plain Astro, the layout composes Google Analytics and 51LA by hand, because `hagilight()` injects only PostHog. Pick one owner for PostHog. Either keep the default injection, or set `analytics: { posthog: { enabled: false } }` and compose `<PostHog />` from `@hagicode/hagilight-core/PostHog` in the layout head yourself. Do not do both.

## Consent

Analytics stay off until a visitor grants consent. Consent is on by default whenever a provider is enabled, so the popup and the gate come with the provider. Turning consent off (`consent: { enabled: false }` where the option exists) loads the providers at once.

Regional consent (`analytics.consent.regions` and its related options) changes who sees the prompt. Set it only if the site serves visitors who need it. The option, its default country set and its resolution rules are in `@hagicode/hagilight-core`'s README under "Analytics consent" and "Regional analytics consent".

## Tagged links

A link that should report a click event carries its tag as attributes. Never write `data-ga-*` attributes by hand.

- For a link in the catalog of tracked site links, use `siteLinkGaAttributes(link, location)` from `@hagicode/hagilight-core/analytics-events`. It returns `{}` for any link that is not in the catalog, so it is safe to call for every link. The catalog ids are listed in the core README under "Google Analytics click events".
- For your own link, use `gaEventAttributes({ category, label, location })` from the same module. The `category` must be one of `download`, `store`, `navigation`, `community` or `promotion`. `label` and `location` must be non-empty.

```astro
---
import { gaEventAttributes } from '@hagicode/hagilight-core/analytics-events';
---

<a
  href="https://example.com/download"
  {...gaEventAttributes({ category: 'download', label: 'desktop-download', location: 'hero' })}
>Download</a>
```

Related sites, RSS links, sitemap links, about and contact links, filing links, and extra links that the consumer adds stay untagged. Tag a link only when it is one of those tracked kinds.
