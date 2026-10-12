---
title: Content images in Markdown
description: A plain Markdown page whose local body image is wrapped in a picture element with AVIF and WebP sources.
lastUpdated: 2026-10-11
rss: false
---

This page is a plain `.md` file, so Hagilight can wrap its local body image in a `<picture>` element.

![A teal and lime gradient with a cream circle, used as a Markdown local image](../../assets/content-image-local.png)

Local images in `.md` files get AVIF and WebP `<source>` elements, and the `<img>` keeps the baseline loading, decoding, and marker class. MDX and site-root images are not wrapped.
