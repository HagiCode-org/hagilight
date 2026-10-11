---
sidebar_position: 2
---

# 功能

每项功能都可以单独关闭。插件只添加已启用的部分。

## 页脚

共享页脚，包含相关站点、快速链接、社区与备案链接、版权信息，以及带有插件版本号的署名行。页脚跟随当前语言显示；没有翻译标签的语言回退为英文。设置 `footer: { enabled: false }` 可移除页脚并保留站点自己的页脚。

## 统计

Google Analytics（默认 `G-EN03FMT2Q4`）和 51LA（默认 `L6b88a5yK4h2Xnci`）仅在生产构建中加载。每个统计服务都可以通过各自的 `enabled` 开关关闭；本演示为了自动化浏览器检查关闭了这两项。

## 推广卡片

一张可关闭的卡片，在页脚上方轮换展示推广内容。页脚进入视野时隐藏，并遵循减少动态效果的设置。

## 语言切换

配置多个语言时，插件会检查导航栏是否包含 `localeDropdown` 项，并检查每个语言是否在 HagiCode 语言目录中。插件只发出警告，从不修改导航栏。

## SEO

每个页面都有 Organization 与 WebSite JSON-LD，并为未设置自有图片的页面提供默认分享图片（`og:image` 与 `twitter:image`）。Docusaurus 仍会生成规范链接、`hreflang` 与 `x-default`。

## 站点地图、robots.txt 与 RSS

- 未使用官方站点地图插件时，每个语言的构建都会写入 `sitemap.xml`。
- `robots.txt` 由默认语言的构建生成，并列出每个语言的站点地图。
- `rss.xml` 包含当前文档版本以及每个语言的博客文章，页面头部带有订阅源自动发现链接。

当站点的 `static/` 中已有同名文件时，`robots.txt` 与 `rss.xml` 会被跳过。
