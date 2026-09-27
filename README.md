# Hagilight

Two independently publishable packages for Astro sites:

- `@hagicode/hagilight`: shared `.astro` components (currently `Copyright`).
- `@hagicode/hagilight-starlight`: Starlight-specific components and a plugin that adds a shared copyright below the default Footer.

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
