# Core footer demo

Private Astro workspace showing `@hagicode/hagilight/Footer` without
Starlight. It is a local example, not a publishable package.

From the Hagilight repository root:

```sh
npm run dev --workspace=hagilight-core-footer-example
npm run build:core-footer-example
```

The site has English and Simplified Chinese routes. The footer receives no
explicit `locale` or `links` props, so it uses Astro's current locale and
omits RSS until a feed URL is configured.
