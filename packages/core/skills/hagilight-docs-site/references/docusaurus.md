# Docusaurus setup

Use this reference with the `hagilight-docs-site` skill when the documentation site runs on Docusaurus 3. Install the plugin and core at one exact version, as the from-scratch guide says. The plugin's peer ranges are `@docusaurus/core` and `@docusaurus/theme-classic` at `^3.9.2`, and React `^18 || ^19`; the table in [`versions.md`](../../hagilight-site-from-scratch/references/versions.md) is the source.

## Install

```sh
npm install --save-exact @hagicode/hagilight-core@<exact-version> @hagicode/hagilight-docusaurus@<exact-version>
npm install @docusaurus/core @docusaurus/theme-classic @docusaurus/preset-classic @docusaurus/types react react-dom
```

Declare every package your config imports, including `@docusaurus/types` and `@docusaurus/preset-classic`. The package manager does not hoist them for you.

## Register the plugin and the locales

The plugin is the named export `hagilightDocusaurus`. Its locale catalog is the `i18n` export from `@hagicode/hagilight-docusaurus/locales`, so take the locale settings from there.

```ts
// docusaurus.config.ts
import type { Config } from '@docusaurus/types';
import { hagilightDocusaurus } from '@hagicode/hagilight-docusaurus';
import { i18n } from '@hagicode/hagilight-docusaurus/locales';

const config: Config = {
  title: 'Example docs',
  url: 'https://docs.example.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  i18n,
  presets: [
    [
      'classic',
      {
        docs: { sidebarPath: './sidebars.ts', routeBasePath: 'docs' },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
        // The plugin writes the sitemap fallback when the official sitemap plugin is not loaded.
        sitemap: false,
      },
    ],
  ],
  plugins: [
    hagilightDocusaurus({
      seo: {
        image: '/img/social-card.png',
        organization: {
          name: 'Example',
          url: 'https://example.com',
          logo: 'https://docs.example.com/img/logo.svg',
        },
      },
      analytics: {
        googleAnalytics: { measurementId: 'G-XXXXXXXXXX' },
        fiftyOneLa: { enabled: false },
      },
    }),
  ],
  themeConfig: {
    image: 'img/social-card.png',
    navbar: {
      items: [
        { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs' },
        { type: 'localeDropdown', position: 'right' },
      ],
    },
  },
};

export default config;
```

Notes on the snippet:

- A locale that is not in the Hagilight catalog gets a warning and no label or `lang` check. Use catalog locales, or turn `languageSelector` off.
- With more than one locale, the language switcher needs a `localeDropdown` item in `themeConfig.navbar.items`. Without it the plugin warns.
- The position of `hagilightDocusaurus()` in `plugins` does not change the result. The sitemap check looks at every loaded plugin.

## Swizzles: the plugin warns, it does not stop the build

Docusaurus lets a site replace a theme component by swizzling it into `src/theme/`. The Hagilight plugin owns two of them. A swizzle left in place still builds, so the warning is the only signal. Treat each warning as a failed check.

- `src/theme/Footer` while `footer` is enabled: remove the swizzle, or set `footer: { enabled: false }` and keep the site's own footer.
- `src/theme/SiteMetadata` while `seo` is enabled: remove it, or set `seo: { enabled: false }`.

Two more warnings come from settings that conflict with the plugin:

- `themeConfig.footer` is set while the Hagilight footer is enabled. The footer links in `themeConfig` are ignored. Remove them.
- Google Analytics is configured twice, through `themeConfig.gtag` or the official gtag plugin, and through this plugin. Keep only the plugin's `analytics.googleAnalytics`.

## Build and discovery

- Build every locale (run `docusaurus build` without `--locale`). `robots.txt` is written only by the default-locale build, and it lists one sitemap per locale. A single-locale build leaves the others out.
- The discovery files and their rules are in [`build-checks.md`](../../hagilight-site-from-scratch/references/build-checks.md).

## Gotchas

- Keep `"type": "module"` out of the site's `package.json`. With it set, the production build fails with `require.resolveWeak is not a function`, because Docusaurus's generated registry needs webpack's CommonJS rewrite during SSR and an ESM-typed package skips it. If the config must be ESM, name it `docusaurus.config.mjs`, as the package README shows.
- On GitHub Pages, publish a `.nojekyll` file at the root. Without it, the `.well-known` directory is dropped.
