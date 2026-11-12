# Layout: SEOHead, Footer and site metadata

Use this reference with the `hagilight-official-website` skill. The layout is yours. Hagilight supplies the head and footer components, and the layout decides where they sit. The snippet below is trimmed from the plain-Astro demo layout.

```astro
---
// src/layouts/SiteLayout.astro
import Footer from '@hagicode/hagilight/Footer';
import SEOHead from '@hagicode/hagilight/SEOHead';
import GoogleAnalytics from '@hagicode/hagilight-core/GoogleAnalytics';
import Analytics51LA from '@hagicode/hagilight-core/Analytics51LA';
import CookieConsent from '@hagicode/hagilight-core/CookieConsent';
import favicon from '@hagicode/hagilight-core/favicon.ico';

interface Props {
  locale: string;
  title: string;
  description: string;
}

const { locale, title, description } = Astro.props;
const site = Astro.site?.href;
if (!site) throw new Error('This layout needs an absolute Astro site URL.');
const pageUrl = new URL(Astro.url.pathname, site).href;
---

<!doctype html>
<html lang={locale}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title}</title>
    <link rel="icon" href={favicon} type="image/x-icon" />
    <SEOHead
      site={site}
      siteSeo={{ title: 'Example' }}
      page={{ url: pageUrl, title, description }}
      locale={locale}
    />
    <GoogleAnalytics measurementId="G-XXXXXXXXXX" consent={true} />
    <Analytics51LA siteId="XXXXXXXXXXXXXXXX" consent={true} />
  </head>
  <body>
    <slot />
    <Footer locale={locale} consent={true} />
    <CookieConsent providers={['googleAnalytics', 'fiftyOneLa']} locale={locale} />
  </body>
</html>
```

## What each piece does

- `SEOHead` writes the canonical link, the title and description tags, the Open Graph and Twitter tags, and the default JSON-LD. Pass `site` as an absolute URL, `page` with the page's own URL, title and description, and `locale`.
- `Footer` is the localized footer with the build line. Set `consent={true}` only when this layout also renders `CookieConsent`, because the "Cookie settings" entry needs the popup to open.
- `CookieConsent` mounts the consent popup once. List only the providers this layout enables.
- The `measurementId` and `siteId` values are placeholders. Use the site's own IDs, and keep the `G-` format for `measurementId`.

## Site metadata

`hagilight()` writes `/.well-known/hagilight.metadata.json` once per build. It is written last, after the sitemap and `llms.txt`, so it lists what exists. It holds booleans for analytics, never IDs or keys. A site-owned copy in `public/` is never overwritten. `metadata: false` opts out.

## Build line

The footer's build line reads `HAGILIGHT_BUILD_BRANCH` and `HAGILIGHT_BUILD_COMMIT` from the environment, then Git, then `unknown`. The layout does not set these. The CI build step does.
