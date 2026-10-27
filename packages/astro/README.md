# @hagicode/hagilight

Astro integrations and components for HagiCode sites without Starlight. Provides sitemap and `robots.txt` generation, localized RSS feeds (enabled by default) and favicon, and a reusable SEO head component.

## Install

```sh
npm install @hagicode/hagilight astro
```

Use a supported Astro version (`>=7`). The matching `@hagicode/hagilight-core` version is installed as a dependency.

## Use

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { hagilight, hagilightFavicon } from '@hagicode/hagilight/integration';

export default defineConfig({
  site: 'https://example.com',
  integrations: [hagilight(), hagilightFavicon()],
});
```

`hagilight()` generates a sitemap and `robots.txt` when the site does not already provide them, and localized RSS feeds (`/rss.xml`, `/rss.<language>.xml`) by default. Set an absolute HTTP(S) `site` URL. `hagilightFavicon()` adds the bundled icon unless the site already declares one.

RSS is on by default: `hagilight()` derives feed locales from the Astro `i18n` config and serves a built-in empty feed. Customize it with the `rss` option, for example `hagilight({ rss: { getFeed: './src/rss-feed.ts' } })`; `getFeed` points to a project-root-relative module exporting a feed callback. Pass `rss: false` to disable RSS. Import `@hagicode/hagilight/SEOHead` for SEO metadata in an Astro page or layout.

Use `@hagicode/hagilight/Footer` for the shared localized footer with the
literal `Powered By hagilight@<version>` attribution. The version is read at build
time from this package's own manifest, not from Astro. Existing
`@hagicode/hagilight-core/Footer` imports remain supported and render without a
feature-package attribution; switch that import to `@hagicode/hagilight/Footer`
to opt in while keeping the same `locale` and `links` props.

## Build line

`hagilight()` adds a build line to the footer's copyright text, after the attribution: `Branch:`, `Commit:` (seven characters, with the full hash in the `title` attribute), and `Built:` (UTC time to the second). The line appears even with `hagilight({ enabled: false })`. Without this integration, `@hagicode/hagilight-core/Footer` renders no build text.

The values come from `HAGILIGHT_BUILD_BRANCH` and `HAGILIGHT_BUILD_COMMIT`, then Git, then `unknown`; the core README gives the full order. CI systems often check out a detached HEAD, which reports `Branch: unknown`. Pass the branch in the build step:

```yaml
- name: Build site
  env:
    HAGILIGHT_BUILD_BRANCH: ${{ github.head_ref || github.ref_name }}
  run: npm run build
```

`github.head_ref` is set on pull requests and `github.ref_name` on pushes. A shallow clone still reports its commit, because `git rev-parse HEAD` reads the checkout.

## SEO head

`@hagicode/hagilight/SEOHead` writes the canonical link, the title, description and image tags, and these generated tags. Each appears once, and a tag is left out when its value cannot be determined:

- `og:url` is the canonical URL.
- `og:type` is `website`, or the `ogType` prop.
- `og:site_name` is the `siteSeo.title`.
- `og:locale` comes from the `locale` prop, else `Astro.currentLocale`, in `ll_CC` form: `zh-CN` gives `zh_CN`, `zh-Hant` gives `zh_TW`, and a bare `en` gives `en_US`. A tag with no unambiguous region gets no `og:locale`.
- `twitter:card` is `summary_large_image` when an image resolves, otherwise `summary`.

It also writes a default `WebSite` and `Organization` JSON-LD block, built from the site title and the site URL with its base path. The `Organization` name defaults to the site title.

```astro
<SEOHead
  site={site}
  siteSeo={{ title: 'Example Docs' }}
  page={{ url: pageUrl, title, description }}
  locale="zh-CN"
  ogType="article"
  organization={{ name: 'Example Labs', logo: 'https://example.com/logo.png', alternateName: 'EL' }}
  structuredData={pageStructuredData}
/>
```

Your own tags win. A managed tag you pass in `head` keeps your value, and the generated twin is not written. Open Graph and Twitter keys match whether you write them as `property` or `name`, so `<meta name="og:type">` also suppresses the generated `og:type`. A default `WebSite` or `Organization` block is skipped when your `structuredData`, or a `script[type="application/ld+json"]` head entry, declares that `@type` at the top level or inside `@graph`. Unparseable JSON-LD does not stop the page and does not suppress a default block.

To turn the default structured data off, pass `defaultStructuredData={false}`. Your own `structuredData` is still rendered.

### Preview image format

Social crawlers cannot read every image format, so `SEOHead` checks the preview image at build time. The image is `page.image`, or `siteSeo.image` when the page declares none. Its format is read from the extension of its path, ignoring case, query and fragment; the image bytes are not read.

| Format | Extensions | Result |
| --- | --- | --- |
| Crawler-compatible | `.jpg`, `.jpeg`, `.png`, `.gif` | Declared exactly as given. Nothing is fetched or re-encoded. |
| Convertible | `.avif`, `.webp` | A remote `http://` or `https://` image becomes a JPEG at quality 80, written under the build output. The declared address is that file under the site's own origin. |
| Unrecognised | anything else, such as `.svg` or no extension | Declared exactly as given, with a build warning. |

The output is never larger than 1200×630 and is never enlarged, so a smaller image keeps its size: a 640×400 image stays 640×400, a 1024×768 image becomes 1024×630, and a 1600×1000 image becomes 1200×630.

A convertible image given as a site-root path is not converted. It is declared as given, with the same kind of warning. Pages that share one convertible image share one converted file.

Convertible images on a remote host need that host in the site's own `image.domains` (or `image.remotePatterns`) in its Astro config:

```js
// astro.config.mjs
export default defineConfig({
  image: { domains: ['images.example.com'] },
});
```

A failed conversion fails the build. The unconverted image is never declared in its place. The build fails in these cases:

- The host is not permitted: `Hagilight could not convert the SEO image <address>: its host <host> is not permitted. Add <host> to image.domains in the Astro config.`
- The image cannot be fetched, returns an error status, or cannot be decoded: Astro reports the failure and names the image address.

The build warning reads `Hagilight SEO image <address> was kept as declared: its format was not checked for crawler compatibility.`, or, for a site-root convertible image, `... site-root images are not converted, so its format was not checked for crawler compatibility.`

## llms.txt

`hagilight()` writes `/llms.txt` after the build, following the [llms.txt](https://llmstxt.org/) layout: the site name as the H1, the home page description as a blockquote summary, and one H2 section of links per top-level path segment. It is generated from the built HTML, so it works for plain Astro and Starlight sites alike and needs no content collection.

- Only one language is listed: the Astro `i18n.defaultLocale`, then the home page language. The home pages of the other languages go under `## Optional`.
- Pages are left out when they are `noindex`, instant redirects, 404 pages, or declare a canonical URL for another page.
- Each link carries the page's meta description. A description repeated on three or more pages is treated as a site-wide default and left out of the links.
- Section order is Overview first, then by page count. A section lists 12 links (Overview 36) and the file lists at most 120.
- An `llms.txt` that the site already provides, as a public file or a page, is never overwritten. `hagilight({ enabled: false })` skips generation too.

```js
hagilight({
  llms: {
    title: 'Example Docs',        // default: the home page og:site_name
    summary: 'What this site is.', // default: the home page description
    lang: 'en-US',                // default: i18n.defaultLocale
    maxLinksPerSection: 60,       // default: 12
    maxLinks: 200,                // default: 120
  },
});
```

Pass `llms: false` (or `{ enabled: false }`) to opt out. The file is only as good as the page titles and descriptions it reads, so write a real `description` for important pages.

## Site metadata

`hagilight()` writes `/.well-known/hagilight.metadata.json` after the build, next to `llms.txt`. A consumer that needs one machine-readable description of the site reads this file. The schema and its privacy rules are in `@hagicode/hagilight-core`'s README.

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

- The file is served under the site's base path, at `<site URL><base>.well-known/hagilight.metadata.json`. A site under `/docs/` gets `/docs/.well-known/hagilight.metadata.json`. An origin-level `/.well-known/` path needs a proxy or a second deployment; a hagilight build controls only its own output.
- Name and description come from the `name` and `description` options, then the home page `og:site_name` or title and description. Locales come from Astro `i18n`. Analytics flags are `true` only when the built pages contain that provider's loader.
- The file needs an absolute `site` URL. Without one, the build warns and skips the file; it does not fail.
- Sitemap and `llms.txt` are checked after they are written, so `discovery` lists what this build actually produced.
- Pass `metadata: false` to opt out, or `metadata: { name, description }` to set the values. The `enabled` option does not turn it off. A `public/.well-known/hagilight.metadata.json` file is copied as the site's own and kept byte for byte.
- Hosts that drop dot-directories need an explicit opt-in. GitHub Pages' Jekyll step skips `.well-known` unless the published root contains an empty `.nojekyll` file.
- When the Starlight plugin is also registered with metadata enabled, the Starlight plugin writes the file, and this integration defers to it. Registration order does not change the output.

## PostHog

`hagilight()` injects PostHog into the head of every page of a production build, with no analytics option, enabled flag, or project key. It uses `phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5`, API host `https://t.hagicode.com` (managed proxy), UI host `https://us.posthog.com`, person profiles `identified_only`, and SDK defaults `2026-05-30`, the same as the Starlight and Docusaurus plugins. Sites with a strict script or connect policy must allow `t.hagicode.com`. `astro dev` pages emit no loader. Injection does not depend on the `enabled` option, which controls only the sitemap and `robots.txt`.

| PostHog input | Behavior |
| --- | --- |
| `analytics` omitted, `analytics: {}`, or `posthog` omitted | Enabled with the supplied default key |
| `posthog: {}` | Disabled, like an empty provider in the Starlight plugin |
| `posthog: { apiKey: 'phc_Custom123' }` | Enabled with the custom key |
| `posthog: { enabled: true, apiKey: 'phc_Custom123' }` | Enabled with the custom key |
| `posthog: { enabled: true }` | Configuration error: `apiKey` required |
| `posthog: { enabled: false }` | Disabled |

```js
hagilight({ analytics: { posthog: { apiKey: 'phc_Custom123' } } });
hagilight({ analytics: { posthog: { enabled: false } } });
```

The built-in key belongs to HagiCode, so a site that omits `analytics` sends its traffic to HagiCode's project. The loader initializes once per document. SDK defaults own navigation tracking. Hagilight also registers the site context once after initialization (`site_id` from `links.siteId` or the site URL's hostname, `site_framework` `astro`, `hagilight_version`, `locale` from `<html lang>`, and `page_type`), sets `capture_exceptions`, and sends `cta_click` for marked links through a click listener that works without Google Analytics; it adds no other capture calls. `page_type` is `other` unless a page sets it: pass the `pageType` prop to `SEOHead`, which emits `<meta name="hagilight:page-type">`, or render that meta element yourself. Choose one initialization owner: a site that already renders `@hagicode/hagilight-core/PostHog` or another PostHog snippet should remove it or set `enabled: false`. When `@astrojs/starlight` is registered, this integration injects nothing and the Starlight plugin owns PostHog. The `analytics.posthog` flag in `hagilight.metadata.json` is `true` when the built pages contain the loader.

## Body images

`hagilight()` registers the content-image plugin from `@hagicode/hagilight-core/content-images`. Markdown and MDX body images then get `loading="lazy"`, `decoding="async"`, and the class `hagilight-content-image`, with the author's values kept. This registration does not depend on `enabled`, so `hagilight({ enabled: false })` still registers the plugin.

Local body images in `.md` and `.mdx` files are also wrapped in a `<picture>` element with AVIF and WebP sources. The rule is the same for both file types: a relative local image that is not `.svg` or `.gif` and does not resolve into `public/` is wrapped, so a Markdown image in an `.mdx` page renders as `picture` with an inner `<img>`. This needs an image service that can encode AVIF: the default sharp service does, and the passthrough no-op service skips the wrapper with one warning. Site-root and remote images, and raw HTML `<img>` tags, are not wrapped. Encoding adds build time, which Astro caches. In `.md`, each `<source>` also carries `src`, `loading`, `decoding`, `width`, and `height` from Astro's output; in `.mdx`, `<source>` carries only `srcset` and `type`. Browsers ignore the extra attributes on `source`, but they are not valid HTML there. The opt-out below turns this step off too.

To opt out, pass either form:

```js
hagilight({ contentImages: false });
hagilight({ contentImages: { enabled: false } });
```

Sites that do not use this integration can import the plugin from `@hagicode/hagilight-core` directly; its README describes the options and processor setup.

See the [repository documentation](https://github.com/HagiCode-org/hagilight#readme) for RSS configuration, feed callback types, and integration behavior.