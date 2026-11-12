---
name: hagilight-site-from-scratch
description: "Use when a project has no hagilight site yet and needs the shared start for any site type: choosing the site type, installing hagilight at one exact version, the site URL and locales, production-only analytics, and the build check. Hands off to the documentation-site or official-website guide."
---

# Hagilight from scratch

The shared start for an empty project. It sets the steps every hagilight site needs, asks the one question that decides the rest, and then hands off to the guide for that site type.

## Step 1: Choose the site type

Ask this question before you install anything or write any config:

> Is this a documentation site, where a plugin owns the header, footer and locale chooser? Or an official website, where you write the layout yourself?

- Documentation site: read [`hagilight-docs-site`](../hagilight-docs-site/SKILL.md). It then asks whether to use Starlight or Docusaurus.
- Official website: read [`hagilight-official-website`](../hagilight-official-website/SKILL.md).

Steps 2 to 5 apply to both site types. The guide you were handed gives the framework-specific commands and files for each of them.

## Step 2: Install at one exact version

Install the feature package and `@hagicode/hagilight-core` at the same exact version. Use the version you chose, never a range such as `^` or `~`.

| Site type | Feature package | Peers the guide installs |
| --- | --- | --- |
| Documentation, Starlight | `@hagicode/hagilight-starlight` | `@astrojs/starlight`, `astro` |
| Documentation, Docusaurus | `@hagicode/hagilight-docusaurus` | `@docusaurus/core`, `@docusaurus/theme-classic`, `@docusaurus/preset-classic`, `@docusaurus/types`, `react`, `react-dom` |
| Official website | `@hagicode/hagilight` | `astro` |

```sh
npm install --save-exact @hagicode/hagilight-core@<exact-version> <feature-package>@<exact-version>
```

Then confirm one version is in use:

```sh
npm ls @hagicode/hagilight-core
```

Every `@hagicode/hagilight*` package in the tree must show the same version. The peer ranges that each package accepts are in [`references/versions.md`](references/versions.md).

## Step 3: Set the site URL and locales

- Set `site` in the Astro config to the absolute `https://` URL of the deployed site. Sitemap, feeds and site metadata all depend on it, and RSS fails the build without it.
- Declare the locales once. Plain Astro uses `i18n`. Starlight takes `locales` from `@hagicode/hagilight-starlight/locales`. Docusaurus takes `i18n` from `@hagicode/hagilight-docusaurus/locales`. Use the catalog locale codes so that labels and `lang` values are checked against the catalog.
- The first locale is the default. Its build writes the files that cover every locale, such as Docusaurus `robots.txt`.

## Step 4: Enable production-only analytics

- Analytics load only in production builds. Development pages carry no analytics loader, so a dev server cannot show whether analytics work.
- The packages ship shared Google Analytics, 51LA and PostHog defaults. Keep them, replace them with your own IDs, or turn one off with `enabled: false`.
- Analytics stay off until a visitor grants consent. Keep consent on unless the site has decided otherwise.

Which provider each site type configures, the consent pointer, and how tagged links are written are in [`references/analytics-and-links.md`](references/analytics-and-links.md).

## Step 5: Build and check

Run the production build, then check the build output: the sitemap, the `robots.txt` and the feed files (`rss.xml` and `rss.<language>.xml`) where the site type generates them. [`references/build-checks.md`](references/build-checks.md) lists which files each site type writes and the checks to run on them. A missing sitemap, robots file or feed is a failed check, not a warning to ignore.

## Done when

- `npm ls @hagicode/hagilight-core` shows one version for every `@hagicode/hagilight*` package.
- The production build finishes with the site URL and locales set.
- The output contains the sitemap, robots and feed files listed for the site type.
