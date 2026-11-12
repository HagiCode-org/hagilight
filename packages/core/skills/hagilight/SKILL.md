---
name: hagilight
description: "Use when starting, setting up or changing a website built with the hagilight packages: a new site from an empty project, a documentation site on Starlight or Docusaurus, or an official website on plain Astro. Routes to the guide for the site type."
---

# Hagilight

Entry point for building a site with `@hagicode/hagilight`. This skill does no setup itself. It sends you to the guide that matches what exists, then the guide does the work.

## Route by what exists

| Situation | Read next |
| --- | --- |
| No site yet, or an empty project | [`hagilight-site-from-scratch`](../hagilight-site-from-scratch/SKILL.md): the shared start. It asks the site type and hands off. |
| A documentation site (docs, wiki, or release notes), or a site that already uses Starlight or Docusaurus | [`hagilight-docs-site`](../hagilight-docs-site/SKILL.md): plugin-driven setup for Starlight or Docusaurus. |
| An official website on plain Astro, where the maintainer writes the layout | [`hagilight-official-website`](../hagilight-official-website/SKILL.md): `hagilight()` with the head and footer components placed by hand. |

If the site type is unclear, ask one question: does a plugin own the header, footer and locale chooser (documentation site), or does the maintainer write the layout (official website)? Then use the matching row.

## Rules that apply to every site type

- A site is one type or the other. Do not install the Starlight or Docusaurus plugin into an official website, and do not write a custom layout around a documentation plugin.
- Install the feature package and `@hagicode/hagilight-core` at one exact version. The peer ranges and the pinning rule are in [`versions.md`](../hagilight-site-from-scratch/references/versions.md).
- Option tables live in each package's README in `node_modules`. Read them there rather than copying them into the site.
- Analytics load only in production builds. Development pages carry no analytics loader.
