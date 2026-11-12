# Starlight setup

Use this reference with the `hagilight-docs-site` skill when the documentation site runs on Starlight. Install the feature package and core at one exact version, as the from-scratch guide says, and use the peer ranges in [`versions.md`](../../hagilight-site-from-scratch/references/versions.md).

## Register the plugin and the locales

The plugin is the default export of `@hagicode/hagilight-starlight`. It goes in `starlight({ plugins: [...] })`. The locale list comes from the plugin's own catalog, so pass `locales` from `@hagicode/hagilight-starlight/locales` and do not write the locale map by hand.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';
import { locales } from '@hagicode/hagilight-starlight/locales';

export default defineConfig({
  site: 'https://docs.example.com',
  integrations: [
    starlight({
      title: 'Docs',
      locales,
      plugins: [hagilight({
        links: { siteId: 'docs-example', siteUrl: 'https://docs.example.com/' },
        seo: {
          organization: { name: 'Example', url: 'https://example.com/' },
        },
        analytics: {
          googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
          fiftyOneLa: { enabled: false },
        },
      })],
    }),
  ],
});
```

`hagilight()` with no options also works: it enables the shared defaults. Pass only the options you need. The full option list, including `aiDisclosures`, `rss` and `contentImages`, is in the `@hagicode/hagilight-starlight` README under `node_modules`.

## Extend the content schema

The plugin reads extra frontmatter fields: `hagicodePromotion`, `rss`, `isAITranslation`, `isAIAuthor` and the shared `seo` object. Extend the Starlight docs schema with `hagilightSchema`, so these fields validate on every page.

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { hagilightSchema } from '@hagicode/hagilight-starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({ extend: hagilightSchema }),
  }),
};
```

## Optional: plain-Astro discovery

`@hagicode/hagilight/integration` exports the plain-Astro `hagilight()` integration. Add it when the site also needs `robots.txt` and `llms.txt`. The Starlight plugin already writes the sitemap and the RSS feeds, and the plain integration does not write a second sitemap when Starlight owns one.

```js
// astro.config.mjs (integrations)
import { hagilight as hagilightDiscovery } from '@hagicode/hagilight/integration';

integrations: [
  starlight({ /* ...as above... */ }),
  hagilightDiscovery(),
],
```

Register the discovery integration after the Starlight plugin, as above. Registering it before the plugin also works: the Starlight plugin writes `.well-known/hagilight.metadata.json` in either order, and that file lists `llms.txt` whichever order is used.

## Starlight rules that fail the build

- Do not override `Footer`, `components.Header`, `PageTitle` or `MarkdownContent`. The plugin rejects the override and names the component. Remove the override.
- To replace the header, set `header: { enabled: false }` in the plugin options, then compose `@hagicode/hagilight-starlight/Header` in your own component. For `PageTitle`, set `contentComponents: { pageTitle: false }` and compose `@hagicode/hagilight-starlight/ContentLayoutToggle` into your own `PageTitle`. For `MarkdownContent`, set `contentComponents: { markdownContent: false }` and compose `@hagicode/hagilight-starlight/MarkdownContent` into your own override.
- A site-owned `components.Head` conflicts with enabled SEO, Google Analytics or PostHog. Disable those features first, as the package README describes, before keeping a custom head.
