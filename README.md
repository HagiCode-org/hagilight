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

The Starlight footer mirrors the current Docs header, quick links, community links, filing links, localized section labels, and the related-site entries currently displayed by Docs. Related sites render as links only (no description text); their names and URLs are bundled from Docs' footer catalog. Pass `relatedSites: []` to omit them or supply an array to replace them. Keep `packages/astro/related-sites.json` in sync when Docs changes its displayed site catalog. Route and label overrides and additional entries can also be passed through `links`:

```js
plugins: [hagilight({
  links: {
    siteId: 'my-docs',
    siteUrl: 'https://docs.example.com/',
    overrides: {
      blog: { href: '/news/', label: { 'en-US': 'News' } },
    },
    extraLinks: {
      quick: [{ href: '/install/', label: 'Install' }],
    },
    relatedSites: [
      { id: 'product', name: 'Product site', url: 'https://example.com/' },
    ],
  },
})]
```

The exported `resolveSiteLinks(locale, options)` function from `@hagicode/hagilight/site-links` provides localized shared link data to consumer-owned Starlight headers and is used by Hagilight's default Header. Link labels fall back from Traditional Chinese to Simplified Chinese and then English. Related sites matching the current site or any displayed footer link are omitted, as are duplicate destinations. Default Docs destinations are explicit public URLs; site-specific routes should be overridden rather than assumed to exist on another site.

## Starlight Header and language chooser

The plugin registers a shared Header by default. It keeps Starlight's site title, configured search, social links, and theme control, and adds localized links from the `header` group. A site that already defines `components.Header` gets a setup error instead of having its Header silently replaced. Keep the site Header with `hagilight({ header: { enabled: false } })`; this opt-out does not change Footer or Head registration.

On multilingual desktop pages, the Header offers a Docs-inspired language dialog. Its default native-label catalog is Simplified Chinese (`root` / `zh-CN`), English (`en-US`), Traditional Chinese (`zh-Hant`), French (`fr-FR`), German (`de-DE`), Spanish (`es-ES`), Japanese (`ja-JP`), Korean (`ko-KR`), Portuguese (`pt-BR`), and Russian (`ru-RU`). Only routes configured by the consuming site's Starlight `locales` appear; configured locales outside this catalog are included using their Starlight labels. Selecting a language follows the equivalent route under the site's base path and trailing-slash rules, preserves the query and fragment, and updates Starlight's `starlight-route` preference when browser storage is available. Sites with one locale have no redundant chooser, and Starlight's mobile menu retains its built-in language selector.

To compose the shared Header into a custom override, disable automatic registration and import it directly:

```astro
---
import HagilightHeader from '@hagicode/hagilight-starlight/Header';
---

<HagilightHeader links={{ overrides: { blog: { href: '/news/' } } }} />
```

Google Analytics and 51LA are independently opt-in. Supply a provider ID to enable it; setting `enabled: true` without the required ID fails plugin setup. The scripts are emitted only for production pages (Google Analytics is skipped on `/404`), and no Docs tracking IDs are included:

```js
plugins: [hagilight({
  analytics: {
    googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
    fiftyOneLa: { siteId: 'your-51la-site-id' },
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
