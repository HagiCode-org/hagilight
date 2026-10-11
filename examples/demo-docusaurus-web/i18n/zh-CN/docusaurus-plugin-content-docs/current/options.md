---
sidebar_position: 3
---

# 选项

所有选项都是可选的。最后一列为默认值。

| 选项 | 类型 | 默认值 | 用途 |
| --- | --- | --- | --- |
| `footer` | `{ enabled }` | 启用 | 共享页脚与署名 |
| `promoto` | `{ enabled }` | 启用 | 推广卡片 |
| `languageSelector` | `{ enabled }` | 启用 | 导航栏语言下拉菜单的检查 |
| `analytics.googleAnalytics` | `{ enabled, measurementId }` | 启用 | 生产环境中的 Google Analytics |
| `analytics.fiftyOneLa` | `{ enabled, siteId }` | 启用 | 生产环境中的 51LA |
| `seo` | `{ enabled, image, organization }` | 启用 | JSON-LD 与默认分享图片 |
| `sitemap` | `{ enabled }` | 启用 | 备用 `sitemap.xml` |
| `robots` | `{ enabled }` | 启用 | 由默认语言构建生成的 `robots.txt` |
| `rss` | `{ enabled, includeDocs, includeBlog }` | 启用，两者都包含 | 每个语言的 `rss.xml` |
| `links` | 站点链接对象 | 内置 | 页脚链接自定义 |
| `noIndex` | 布尔值 | `false` | 跳过站点地图与 robots.txt 输出 |

使用对象关闭某项功能，例如 `sitemap: { enabled: false }`。直接传入布尔值会被拒绝，错误信息会指出对应的选项。

## 发现文件

站点中的 `static/robots.txt` 或 `static/rss.xml` 优先于同名的生成文件。
