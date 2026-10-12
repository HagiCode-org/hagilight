---
title: Content images in Markdown
description: A plain Markdown page whose local body images are wrapped in picture elements with AVIF and WebP sources.
lastUpdated: 2026-10-11
rss: false
---

This page is a plain `.md` file, so Hagilight can wrap its local body images in `<picture>` elements.

![A teal and lime gradient with a cream circle, used as a Markdown local image](../../assets/content-image-local.png)

The next image is stored in `src/assets` and referenced by a relative path from this page's folder:

![A warm gradient, stored in src/assets and referenced by a relative path](../../assets/relative-sample.png)

Local images in `.md` files get AVIF and WebP `<source>` elements, and the `<img>` keeps the baseline loading, decoding, and marker class. MDX and site-root images are not wrapped.
