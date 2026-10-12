Body images in this Markdown file are normalized at build time by `hagilight()`, with no runtime script.

![A teal and lime gradient with a cream circle, used as a relative local image](../assets/content-image-local.png)

![A warm gradient stored in the source assets folder and imported by the page](../assets/root-sample.png)

Images outside a `<picture>` element get `loading="lazy"`, `decoding="async"`, and the `hagilight-content-image` class. Values the author already set are kept. Pass `contentImages: false` to `hagilight()` to turn this off for the site.
