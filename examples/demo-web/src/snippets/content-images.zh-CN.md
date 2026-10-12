本 Markdown 文件中的正文图片会由 `hagilight()` 在构建时统一处理，不会添加任何运行时脚本。

![青绿到青柠色渐变背景上带有一个奶油色圆形的相对路径本地图片](../assets/content-image-local.png)

![存放在源码 assets 目录中并由页面导入的暖色渐变图片](../assets/root-sample.png)

位于 `<picture>` 元素之外的图片会获得 `loading="lazy"`、`decoding="async"` 和 `hagilight-content-image` 类名。作者已经设置的值会保留。如需在整个站点关闭此处理，请给 `hagilight()` 传入 `contentImages: false`。
