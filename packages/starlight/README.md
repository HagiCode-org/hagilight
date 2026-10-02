# @hagicode/hagilight-starlight

A Starlight plugin for HagiCode documentation sites. Adds a localized header and footer, language chooser, content-width toggle, custom 404 page, SEO metadata, RSS feeds, analytics, and AI-content disclosures.

## Install

```sh
npm install @hagicode/hagilight-starlight @astrojs/starlight astro
```

Use Starlight `^0.42.4` and Astro `^7.3.5`. The matching `@hagicode/hagilight-core` version is installed as a dependency.

## Use

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';
import { locales } from '@hagicode/hagilight-starlight/locales';

export default defineConfig({
  site: 'https://docs.example.com',
  integrations: [
    starlight({ title: 'Docs', locales, plugins: [hagilight()] }),
  ],
});
```

The plugin also exposes `@hagicode/hagilight-starlight/schema` for optional SEO frontmatter and individual Astro components such as `/Header` and `/MarkdownContent` for custom Starlight overrides. Configure features through the typed `HagilightStarlightOptions` passed to `hagilight()`.

The plugin footer and direct `/Footer` and `/PromotoFooter` components append
the literal `power by hagilight-starlight@<version>`. The version comes from
this package's own manifest at build time, not from Astro or Starlight.

See the [repository documentation](https://github.com/HagiCode-org/hagilight#readme) for schema setup and feature options.
