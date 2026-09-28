# Hagilight

Two independently publishable packages for Astro sites:

- `@hagicode/hagilight`: shared `.astro` components (`Copyright` and the reusable promotion banner).
- `@hagicode/hagilight-starlight`: Starlight-specific components and a plugin that adds localized shared links and copyright below the default Footer, with optional analytics and active promotions.

The shared package also exports the HagiCode logo as `@hagicode/hagilight/logo.png`. The Starlight plugin uses it in the site title by default; a site-provided Starlight `logo` setting takes precedence.

The packages publish `.astro` source directly; consumers compile it with Astro. New shared components belong in `packages/astro/`, with an entry in its `exports` and `files`. Starlight-only overrides belong in `packages/starlight/`; add their entries to `exports` and register them in `index.mjs` when they should apply automatically.

## Local development

```sh
npm install
npm test
npm run build:example
```

The private `examples/starlight/` workspace demonstrates both package entry points. To use the packages in another site, install both `@hagicode/hagilight` and `@hagicode/hagilight-starlight` alongside compatible `astro` and `@astrojs/starlight` versions:

```js
// astro.config.mjs
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';

export default {
  integrations: [starlight({ title: 'My docs', plugins: [hagilight()] })],
};
```

The promotion banner is enabled by default. Disable it while keeping the shared Footer and copyright with `hagilight({ promoto: { enabled: false } })`:

```js
plugins: [hagilight({ promoto: { enabled: false } })]
```

The static HagiCode introduction at the end of each article is enabled by default and is controlled independently from the floating banner. It includes the product screenshot, complete overview, three feature descriptions, and localized copy for Simplified Chinese, English, Traditional Chinese, Japanese, Korean, German, French, Spanish, Brazilian Portuguese, and Russian. Disable it site-wide with `hagicodePromotion: { enabled: false }`; an article's optional `hagicodePromotion` boolean can override that default:

```js
plugins: [hagilight({
  hagicodePromotion: { enabled: false },
  promoto: { enabled: true },
})]
```

Set `hagicodePromotion: true` or `false` in article frontmatter to show or hide the introduction for that article. The field is optional; an omitted value inherits the site setting.

```md
---
title: Article without the HagiCode introduction
hagicodePromotion: false
---
```

The Starlight footer mirrors the current Docs header, quick links, community links, filing links, localized section labels, and the related-site entries currently displayed by Docs. Ecosystem Sites also includes HagiTask and the AI calculator. Related sites render as links only (no description text); their names and URLs are bundled from Docs' footer catalog. Entries marked `supportsLocalePath: true` receive the active locale path (currently the main site, OpenSpec, OmniRoute, and Design). Pass `relatedSites: []` to omit the bundled list or supply an array to replace it. Keep `packages/astro/related-sites.json` in sync when Docs changes its displayed site catalog.

Use `removeLinks` to remove entries by stable ID independently from Ecosystem Sites, Quick Links, and Community. Append quick or community links with `extraLinks.quick` and `extraLinks.community`; explicit IDs are recommended for consumer entries. Append ecosystem sites with `extraLinks.relatedSites`. Existing `relatedSites` replacement, legacy quick/community additions without IDs, and route/label overrides remain supported:

```js
plugins: [hagilight({
  links: {
    siteId: 'my-docs',
    siteUrl: 'https://docs.example.com/',
    overrides: {
      blog: { href: '/news/', label: { 'en-US': 'News' } },
    },
    removeLinks: {
      relatedSites: ['hagitask'],
      quick: ['downloadClient'],
      community: ['qqGroup'],
    },
    extraLinks: {
      quick: [{ id: 'install', href: '/install/', label: { 'en-US': 'Install' } }],
      community: [{
        id: 'community-chat',
        href: 'https://chat.example.com/',
        label: 'Community chat',
        external: true,
      }],
      relatedSites: [{
        id: 'product',
        name: { 'en-US': 'Product site' },
        description: { 'en-US': 'Our product website.' },
        url: 'https://example.com/',
      }],
    },
  },
})]
```

Removals apply to the defaults or replacement list before additions are appended. The resolver keeps existing entries in order, validates protocols, excludes the current site and destinations already rendered in Quick Links or Community, and filters duplicate IDs and URLs within each section. Link labels fall back from Traditional Chinese to Simplified Chinese and then English. The exported `resolveSiteLinks(locale, options)` function from `@hagicode/hagilight/site-links` provides the same localized link data to consumer-owned Starlight headers and is used by Hagilight's default Header.

RSS is enabled by default. With Astro's `site` set, Hagilight generates a feed for each configured Starlight language. `/rss.xml` remains the default alternate-link and footer destination for the English feed; `/rss.en.xml` is its explicit alias. With the shared locale map, `/rss.xml` contains English items and `/rss.zh-CN.xml` contains Simplified Chinese items from the `zh-cn` route. A custom locale map without English configured has no English feed items. Feed items link to absolute, base-aware URLs, carry the selected language metadata, and are ordered by descending `lastUpdated`; undated pages remain included without a publication date.

On non-English pages, Hagilight's default footer shows the default RSS link and a second, localized “current language” RSS link. English pages keep only the default link because both URLs contain the same English feed. Consumer-owned RSS feeds continue to suppress Hagilight's generated feeds and links.

By default, feeds include documentation pages and articles under the locale-relative `blog/<article>` path. A `blog/` listing or `blog/index` page is treated as documentation. Configure the independent site-wide switches:

```js
plugins: [hagilight({
  rss: {
    includeDocs: true,
    includeBlog: true,
  },
})]
```

Both switches default to `true`. An article can opt out with `rss: false` in its frontmatter, or explicitly remain included with `rss: true`; drafts and content types disabled site-wide are always excluded. A complete multilingual configuration looks like this:

```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';

export default defineConfig({
  site: 'https://docs.example.com',
  base: '/docs/',
  integrations: [
    starlight({
      title: 'My documentation',
      locales: {
        root: { label: 'English', lang: 'en-US' },
        'zh-cn': { label: '简体中文', lang: 'zh-CN' },
      },
      plugins: [hagilight({
        rss: { includeDocs: true, includeBlog: true },
      })],
    }),
  ],
});
```

In this example, `/docs/rss.xml` and `/docs/rss.en.xml` contain English items, while `/docs/rss.zh-CN.xml` contains items from the `zh-cn` route. Add the optional schema extension to the Starlight docs schema to validate the per-article field:

```ts
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { rssSchema } from '@hagicode/hagilight-starlight/rss-schema';
import { z } from 'astro/zod';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({ extend: z.object({ ...rssSchema.shape }) }),
  }),
};
```

```md
---
title: Article excluded from RSS
rss: false
---
```

The extension is optional. Without it, do not use `rss` in article frontmatter. Hagilight uses `@astrojs/rss` as its RSS XML serializer; the example does not register a second RSS generator. If a consumer switches from another RSS integration to Hagilight, remove the competing generator and its dependency if nothing else uses it. Set `rss: { enabled: false }` when another feed owns the RSS URL. If the site already declares an RSS alternate link (`rel="alternate"`, `type="application/rss+xml"`) in Starlight's `head`, Hagilight uses it instead of generating feeds. A consumer can explicitly override the footer link:

```js
starlight({
  head: [{
    tag: 'link',
    attrs: { rel: 'alternate', type: 'application/rss+xml', href: '/feeds/site.xml' },
  }],
  plugins: [hagilight({
    links: {
      overrides: { rss: { href: '/feeds/custom.xml' } },
    },
  })],
});
```

The explicit RSS override takes precedence over the configured alternate link. An Astro `site` is required to generate RSS; without one, disable RSS or configure a feed link in Starlight's `head`. Use `links: { removeLinks: { quick: ['rss'] } }` to hide the RSS entry. Default Docs destinations are explicit public URLs; site-specific routes should be overridden rather than assumed to exist on another site.

## Starlight Header and language chooser

The plugin registers a shared Header by default. It keeps Starlight's site title, configured search, social links, and theme control, and adds localized links from the `header` group. A site that already defines `components.Header` gets a setup error instead of having its Header silently replaced. Keep the site Header with `hagilight({ header: { enabled: false } })`; this opt-out does not change Footer or Head registration.

### Starlight not-found page

The plugin registers a 404-specific Hero by default. It keeps Starlight's 404 title, translated guidance, and normal site shell, then adds a translated home link under the site's base path. Other pages continue to use Starlight's default Hero. Static hosts must be configured to serve the generated `404.html` for missing routes; Hagilight does not configure host fallback behavior.

If a site already owns `components.Hero`, disable the automatic override:

```js
plugins: [hagilight({ notFoundPage: { enabled: false } })]
```

To include Hagilight's 404 treatment in a custom Hero, disable automatic registration and render the exported component on 404 entries:

```astro
---
import HagilightNotFoundHero from '@hagicode/hagilight-starlight/NotFoundHero';

const entryId = Astro.locals.starlightRoute.entry.id;
const isNotFound = entryId === '404' || entryId.endsWith('/404');
---

{isNotFound ? <HagilightNotFoundHero /> : <MySiteHero />}
```

### Shared Starlight locale map

Import the shared locale map and pass it to Starlight's standard `locales` setting:

```js
import starlight from '@astrojs/starlight';
import { locales } from '@hagicode/hagilight-starlight/locales';

starlight({
  title: 'My docs',
  locales,
});
```

The shared map makes English (`en-US`) the unprefixed `root` language and offers Simplified Chinese (`zh-CN`) at `zh-cn`; the example site follows the same routes (`/` and `/zh-cn/`). Locale paths preserve the configured key's casing, such as `/zh-Hant/`; content IDs must preserve that casing too. Astro's default content IDs are lowercase, so use a custom `generateId` with `docsLoader()` when using mixed-case keys, as the example does in `src/content.config.ts`. English is not also listed as `en-us`, avoiding duplicate English routes and RSS feed names.

This changes the routes for sites adopting the revised map: the former shared-map layout used Chinese at `/` and English at `/en-us/`; it now uses English at `/` and Chinese at `/zh-cn/`. Review bookmarks, internal links, translated content directories, feed links, and any redirects your deployment needs. Hagilight does not add redirects or replace a consumer's custom Starlight locale map. To keep the previous layout, define it explicitly:

```js
const siteLocales = {
  root: { label: '简体中文', lang: 'zh-CN' },
  'en-us': { label: 'English', lang: 'en-US' },
  'it-IT': { label: 'Italiano', lang: 'it-IT' },
};
```

Pass `siteLocales` as `locales`; add the corresponding translated docs to the Starlight content collection, since locale configuration alone does not create page content.

On multilingual desktop pages, the Header offers a Docs-inspired language dialog. Its default native-label catalog follows the shared locale map: English (`root` / `en-US`), Simplified Chinese (`zh-cn` / `zh-CN`), Traditional Chinese (`zh-Hant`), French (`fr-FR`), German (`de-DE`), Spanish (`es-ES`), Japanese (`ja-JP`), Korean (`ko-KR`), Portuguese (`pt-BR`), and Russian (`ru-RU`). Only routes configured by the consuming site's Starlight `locales` appear; configured locales outside this catalog are included using their Starlight labels. Selecting a language follows the equivalent route under the site's base path and trailing-slash rules, preserves the query and fragment, and updates Starlight's `starlight-route` preference when browser storage is available. Sites with one locale have no redundant chooser, and Starlight's mobile menu retains its built-in language selector.

To compose the shared Header into a custom override, disable automatic registration and import it directly:

```astro
---
import HagilightHeader from '@hagicode/hagilight-starlight/Header';
---

<HagilightHeader links={{ overrides: { blog: { href: '/news/' } } }} />
```

### Reading width and AI disclosures

Hagilight adds a desktop wide/narrow control beside Starlight's page title. Wide is the default on first visit; narrow leaves Starlight's existing content width unchanged. The selection is stored under the `hagilight-content-width` key and restored by a small head script before the page is painted. The control is hidden below Starlight's desktop breakpoint.

AI notices are disabled unless enabled in the plugin options. `sourceLocale` defaults to `root`; translation notices are omitted on that locale. Notices use the active Starlight language when a translation is available and otherwise fall back to English. A translated notice links to its source only when a matching docs entry exists, and that URL includes the configured site base path.
Sites with a custom Starlight `Head` must render Starlight's configured head entries (for example, by composing `@astrojs/starlight/components/Head.astro`) so the early width-preference script runs.

Starlight's docs collection is consumer-defined, so add the exported optional schema when using disclosure frontmatter. Existing schema fields can be combined with the Hagilight fields:

```ts
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { articlePromotionSchema } from '@hagicode/hagilight-starlight/article-promotion-schema';
import { z } from 'astro/zod';
import { aiDisclosureSchema } from '@hagicode/hagilight-starlight/ai-disclosure-schema';

const siteSchema = z.object({ category: z.string().optional() });
const hagilightSchema = z.object({
  ...aiDisclosureSchema.shape,
  ...articlePromotionSchema.shape,
});
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({ extend: siteSchema.extend(hagilightSchema.shape) }),
  }),
};
```

The schema exports validate the article override as an optional boolean. Sites that do not install `articlePromotionSchema` still get render-time type validation for the field.

Configure inherited values independently. Both flags default to `false`; a frontmatter value, including `false`, overrides its corresponding site default:

```js
plugins: [hagilight({
  aiDisclosures: {
    isAITranslation: true,
    isAIAuthor: true,
    sourceLocale: 'root',
  },
})]
```

```md
---
title: Translated guide
isAITranslation: false
---

This guide inherits the AI-assistance notice and explicitly suppresses the translation notice.
```

An omitted flag inherits the site default. Invalid option types or non-boolean frontmatter values fail validation. The exported `PageTitle`, `MarkdownContent`, and `ContentLayoutToggle` components are available for sites with existing Starlight overrides. Set the corresponding `contentComponents` option to `false` to keep that override, then compose the Hagilight component:

```js
plugins: [hagilight({
  contentComponents: { pageTitle: false, markdownContent: false },
  hagicodePromotion: { enabled: false },
  aiDisclosures: { isAITranslation: true, sourceLocale: 'root' },
})]
```

```astro
---
import DefaultPageTitle from '@astrojs/starlight/components/PageTitle.astro';
import ContentLayoutToggle from '@hagicode/hagilight-starlight/ContentLayoutToggle';
import HagilightMarkdownContent from '@hagicode/hagilight-starlight/MarkdownContent';
---

<DefaultPageTitle />
<ContentLayoutToggle />
<HagilightMarkdownContent
  aiDisclosures={{ isAITranslation: true, sourceLocale: 'root' }}
  hagicodePromotionEnabled={false}
>
  <slot />
</HagilightMarkdownContent>
```

Pass `hagicodePromotionEnabled` to the exported component to supply the site default when composing a custom MarkdownContent; it defaults to `true`. Per-article frontmatter continues to override it, and the article-end introduction remains separate from `promoto.enabled`.

Google Analytics and 51LA default to the Docs IDs (`G-EN03FMT2Q4` and `L6b88a5yK4h2Xnci`) and load only on production pages (Google Analytics is skipped on `/404`). Override either ID or disable either provider explicitly:

```js
plugins: [hagilight({
  analytics: {
    googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
    fiftyOneLa: { siteId: 'your-51la-site-id' },
    // googleAnalytics: { enabled: false },
    // fiftyOneLa: { enabled: false },
  },
})]
```

For a custom Starlight `Head`, omit the automatic Google Analytics option and compose the provider directly in that component. A custom Footer can similarly import `@hagicode/hagilight-starlight/Footer` and pass `locale` and `links`; direct imports of `Footer` and `PromotoFooter` remain supported. The standalone providers are available as `@hagicode/hagilight/GoogleAnalytics` and `@hagicode/hagilight/Analytics51LA`, each requiring its ID prop. Docs retains its independent links and analytics integrations and is unchanged by Hagilight.

The Starlight demo explicitly enables the banner with `hagilight({ promoto: { enabled: true } })`. Sites can also use the component directly and provide their own localized fallback for when no remote campaign is available:

```astro
---
import PromotoBanner from '@hagicode/hagilight/PromotoBanner';
---

<PromotoBanner
  fallback={{
    id: 'site-news',
    title: 'Site announcement',
    description: 'A message translated by your site.',
    ctaLabel: 'Read more',
    link: '/news/',
  }}
/>
```

Docs still has its own banner until it adopts hagilight separately. Enabling hagilight there before removing the Docs banner can display duplicate banners.

For ordinary Astro pages or MDX content, import components directly:

```astro
---
import Copyright from '@hagicode/hagilight/Copyright';
---
<Copyright name="HagiCode" />
```

The plugin intentionally rejects a site that already overrides `Footer`: only one Footer override can be registered. Sites needing their own Footer can instead import `@hagicode/hagilight-starlight/Footer` and compose their own override. Starlight's default Footer does not render a slot, so the shared content is placed after it instead of passed into it.

Before publishing either package, choose a license and confirm the npm organization has permission to use the `@hagicode` scope. Publish the dependency package first:

```sh
npm publish -w @hagicode/hagilight --access public
npm publish -w @hagicode/hagilight-starlight --access public
```

## GitHub Actions publishing

CI validates both packages and builds the example on Linux, Windows, and macOS, including an installed-tarball build. Every push to `main` publishes a unique prerelease to npm's `dev` dist-tag; a published, non-prerelease GitHub release with a `vX.Y.Z` tag publishes both packages to `latest`. The dependency package is always published before the Starlight package. Existing npm versions are skipped, so rerunning a partially completed publication can publish the remaining package. Release Drafter maintains the next stable draft from merged pull requests.

Before enabling publication, choose and record a license for both packages, ensure `@hagicode` permits publishing them, and configure **npm trusted publishers** for `@hagicode/hagilight` and `@hagicode/hagilight-starlight`: GitHub owner `HagiCode-org`, repository `hagilight`, workflow filename `npm-publish.yml` (no environment). The workflow uses npm OIDC provenance and does not require an npm token. A new package may require an initial authorized publish before npm allows configuring its trusted publisher.

## GitHub Pages demo

The Starlight example is published to [https://hagilight.hagicode.com/](https://hagilight.hagicode.com/) after successful pushes to `main`. Point the domain's DNS to GitHub Pages (for example, with a `CNAME` record for `hagilight` pointing to `hagicode-org.github.io`). In the repository's **Settings > Pages**, set the source to **Deploy from a branch**, select `gh-pages` and `/ (root)`, then save; the deployment workflow writes the custom-domain `CNAME` file. Enable **Enforce HTTPS** once GitHub Pages provisions a certificate. In **Settings > Actions > General > Workflow permissions**, allow read and write permissions so the workflow's `GITHUB_TOKEN` can update the branch.

If a deployment fails, open **Actions > Deploy Hagilight demo**, select the failed run, and inspect the failed install, build, or publish step's logs. A publish permission error indicates the workflow token's repository permissions need to be enabled; the site is served from the `gh-pages` branch root.
