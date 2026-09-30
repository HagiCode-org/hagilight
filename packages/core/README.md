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

Other entry points include `Copyright`, `PromotoBanner`, `GoogleAnalytics`, and `Analytics51LA` Astro components; `links`, `favicon`, `seo`, `seo-schema`, `rss`, `rss-ownership`, and `promotions` utilities; and `logo.png` and `favicon.ico` assets. For example:

```ts
import { resolveSiteLinks } from '@hagicode/hagilight-core/links';

const links = resolveSiteLinks('en-US');
```

See the [repository documentation](https://github.com/HagiCode-org/hagilight#readme) for the full list of entry points and usage.
