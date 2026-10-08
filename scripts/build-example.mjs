import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSiteLinks } from '@hagicode/hagilight-core/links';
import { COPY } from '../packages/starlight/dist/article-promotion.js';
import { resolveMicrosoftStoreBadgeLanguage } from '../packages/starlight/dist/windows-download.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

execFileSync(npm, ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

function build(env = {}) {
  execFileSync(npm, ['run', 'build', '-w', 'hagilight-example'], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    // On Windows `npm` resolves to the `npm.cmd` batch file, which child_process
    // cannot execute directly; route it through the shell like the sibling scripts.
    shell: process.platform === 'win32',
  });
  const outputDir = join(root, 'examples/demo-starlight-web/dist');
  return (filename) => readFileSync(join(outputDir, filename), 'utf8');
}

function buildCoreFooter() {
  execFileSync(npm, ['run', 'build', '-w', 'hagilight-core-footer-example'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const outputDir = join(root, 'examples/demo-web/dist');
  return (filename) => readFileSync(join(outputDir, filename), 'utf8');
}

function feedItems(xml) {
  assert.match(xml, /^<\?xml/u);
  assert.match(xml, /<rss\b/u);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map(([, item]) => item);
}

function itemLinks(xml) {
  return feedItems(xml).map((item) => item.match(/<link>([^<]+)<\/link>/u)?.[1]);
}

function verifyDefaultFeeds(read) {
  const english = read('rss.xml');
  const englishAlias = read('rss.en.xml');
  const chinese = read('rss.zh-CN.xml');
  const traditionalChinese = read('rss.zh-Hant.xml');
  assert.equal(english, englishAlias);
  assert.match(english, /<language>en-US<\/language>/u);
  assert.match(chinese, /<language>zh-CN<\/language>/u);
  assert.match(traditionalChinese, /<language>zh-Hant<\/language>/u);

  const englishLinks = itemLinks(english);
  assert.ok(englishLinks.includes('https://hagistar.hagicode.com/'));
  assert.ok(englishLinks.includes('https://hagistar.hagicode.com/blog/rss-example/'));
  assert.ok(!englishLinks.some((link) => link.includes('/en-us/')));
  assert.ok(!english.includes('Excluded from RSS'));
  assert.ok(!english.includes('RSS draft'));
  assert.ok(!chinese.includes('Excluded from RSS'));
  assert.ok(!chinese.includes('RSS draft'));
  assert.ok(!chinese.includes('English RSS blog example'));
  assert.ok(!english.includes('Chinese RSS blog example'));
  assert.ok(!traditionalChinese.includes('English RSS blog example'));

  const chineseLinks = itemLinks(chinese);
  assert.ok(chineseLinks.includes('https://hagistar.hagicode.com/zh-CN/'));
  assert.ok(chineseLinks.includes('https://hagistar.hagicode.com/zh-CN/blog/rss-example/'));
  assert.ok(!chineseLinks.some((link) => link.includes('/en-us/')));
  assert.ok(!chineseLinks.some((link) => link.includes('/rss-undated/')));
  assert.ok(itemLinks(traditionalChinese)
    .includes('https://hagistar.hagicode.com/zh-Hant/blog/rss-example/'));

  const undated = feedItems(english).find((item) => item.includes('/rss-undated/'));
  assert.ok(undated);
  assert.doesNotMatch(undated, /<pubDate>/u);
  const datedLinks = englishLinks.filter((link) => link.includes('blog/rss-example'));
  assert.deepEqual(datedLinks, ['https://hagistar.hagicode.com/blog/rss-example/']);
  assert.match(feedItems(english)[0], /<pubDate>/u);
}

function pageHead(read, filename) {
  const html = read(filename);
  const head = html.slice(0, html.indexOf('</head>'));
  assert.notEqual(html.indexOf('</head>'), -1, `${filename} has a closing head`);
  return { html, head };
}

function headAttributeValues(head, tagName, attributeName, match = '') {
  return [...head.matchAll(new RegExp(`<${tagName}\\b([^>]*${match}[^>]*)>`, 'gu'))]
    .map(([, attrs]) => attrs.match(new RegExp(`\\b${attributeName}=\"([^\"]*)\"`, 'u'))?.[1])
    .filter(Boolean);
}

function jsonLdValues(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)]
    .map(([, value]) => JSON.parse(value));
}

function verifySeoPage(read, filename, {
  canonical,
  sitemap,
  image,
} = {}) {
  const { html, head } = pageHead(read, filename);
  const canonicals = headAttributeValues(head, 'link', 'href', '\\brel="canonical"');
  assert.equal(canonicals.length, 1, `${filename} has one canonical`);
  assert.equal(new URL(canonicals[0]).href, canonicals[0], `${filename} canonical is absolute`);
  if (canonical) assert.equal(canonicals[0], canonical);
  assert.equal(new URL(canonicals[0]).search, '');
  assert.equal(new URL(canonicals[0]).hash, '');

  const sitemapLinks = headAttributeValues(head, 'link', 'href', '\\brel="sitemap"');
  assert.equal(sitemapLinks.length, 1, `${filename} retains Starlight's sitemap link`);
  if (sitemap) assert.equal(sitemapLinks[0], sitemap);
  assert.ok(head.includes('application/rss+xml'), `${filename} retains the RSS alternate`);
  for (const property of [
    'og:title',
    'og:description',
    'og:image',
    'twitter:title',
    'twitter:description',
    'twitter:image',
  ]) {
    const count = headAttributeValues(head, 'meta', 'content', `\\b(?:property|name)="${property}"`).length;
    assert.ok(count <= 1, `${filename} has at most one ${property}`);
  }
  const images = [
    ...head.matchAll(/<meta\b[^>]*(?:property|name)="(?:og:image|twitter:image)"[^>]*content="([^"]*)"/gu),
  ].map(([, value]) => value);
  if (image) {
    assert.equal(images.length, 2, `${filename} has one OG and one Twitter image`);
    assert.ok(images.every((value) => value === image));
  }
  for (const url of headAttributeValues(head, 'link', 'href', '\\bhreflang="')) {
    const parsed = new URL(url);
    assert.equal(parsed.search, '', `${filename} alternate has no query`);
    assert.equal(parsed.hash, '', `${filename} alternate has no fragment`);
  }
  return { html, head, jsonLd: jsonLdValues(html) };
}

function verifySeoOutput(read, basePath = '/') {
  const base = basePath === '/' ? '' : basePath.replace(/\/+$/u, '');
  const siteUrl = `https://hagistar.hagicode.com${base}`;
  const imageUrl = `${siteUrl}/share-card.svg`;
  const home = verifySeoPage(read, 'index.html', {
    canonical: `${siteUrl}/`,
    sitemap: `${base}/sitemap-index.xml` || '/sitemap-index.xml',
    image: imageUrl,
  });
  assert.match(home.html, new RegExp(`<a href="${base}/sitemap-index\\.xml"[^>]*>Sitemap</a>`, 'u'));
  assert.ok(home.head.includes('Hagilight example'));
  assert.ok(home.head.includes('Explore reusable Astro components'));
  assert.match(home.html, /<h1\b[^>]*>Hagilight example<\/h1>/u);
  assert.equal(home.jsonLd.some(({ '@type': type }) => type === 'Article'), false);
  assert.equal(home.jsonLd.filter(({ '@type': type }) => type === 'Organization').length, 1);

  const chineseHome = verifySeoPage(read, 'zh-CN/index.html', {
    canonical: `${siteUrl}/zh-CN/`,
    sitemap: `${base}/sitemap-index.xml` || '/sitemap-index.xml',
    image: imageUrl,
  });
  assert.match(chineseHome.html, new RegExp(`<a href="${base}/sitemap-index\\.xml"[^>]*>站点地图</a>`, 'u'));
  assert.match(chineseHome.html, /<html lang="zh-CN"/u);
  assert.match(chineseHome.html, /<h1\b[^>]*>Hagilight 示例<\/h1>/u);
  assert.ok(chineseHome.head.includes('了解可复用的 Astro 组件'));
  assert.notEqual(
    headAttributeValues(home.head, 'meta', 'content', '\\bproperty="og:title"')[0],
    headAttributeValues(chineseHome.head, 'meta', 'content', '\\bproperty="og:title"')[0],
  );

  const english = verifySeoPage(read, 'blog/rss-example/index.html', {
    canonical: `${siteUrl}/blog/rss-example/`,
    sitemap: `${base}/sitemap-index.xml` || '/sitemap-index.xml',
    image: imageUrl,
  });
  const chinese = verifySeoPage(read, 'zh-CN/blog/rss-example/index.html', {
    canonical: `${siteUrl}/zh-CN/blog/rss-example/`,
    sitemap: `${base}/sitemap-index.xml` || '/sitemap-index.xml',
    image: imageUrl,
  });
  const englishAlternates = headAttributeValues(english.head, 'link', 'href', '\\bhreflang="');
  const chineseAlternates = headAttributeValues(chinese.head, 'link', 'href', '\\bhreflang="');
  assert.deepEqual(englishAlternates, chineseAlternates, 'localized pages have reciprocal alternate URLs');
  assert.ok(englishAlternates.length >= 3);
  assert.ok(english.head.includes('Sharing metadata for an English documentation article'));
  assert.ok(english.head.includes('page-specific sharing fields take precedence'));
  assert.deepEqual(english.jsonLd.map(({ '@type': type }) => type), ['Article', 'BreadcrumbList']);
  assert.equal(english.jsonLd[0].datePublished, '2026-09-26T00:00:00.000Z');
  assert.equal(english.jsonLd[0].author.name, 'Hagilight documentation team');
  assert.equal(chinese.jsonLd[0].headline, 'Chinese RSS blog example');

  const onlyEnglish = verifySeoPage(read, 'rss-excluded/index.html', {
    canonical: `${siteUrl}/rss-excluded/`,
    sitemap: `${base}/sitemap-index.xml` || '/sitemap-index.xml',
    image: imageUrl,
  });
  const excerptFallback = verifySeoPage(read, 'rss-undated/index.html', {
    canonical: `${siteUrl}/rss-undated/`,
    sitemap: `${base}/sitemap-index.xml` || '/sitemap-index.xml',
    image: imageUrl,
  });
  assert.ok(excerptFallback.head.includes('This documentation page is included without a publication date.'));
  const availableLocales = headAttributeValues(
    onlyEnglish.head,
    'link',
    'hreflang',
    '\\bhreflang="',
  );
  assert.deepEqual(availableLocales, ['en-US', 'x-default']);
  const translatedFallback = verifySeoPage(read, 'de-DE/rss-excluded/index.html', {
    canonical: `${siteUrl}/de-DE/rss-excluded/`,
    sitemap: `${base}/sitemap-index.xml` || '/sitemap-index.xml',
    image: imageUrl,
  });
  assert.deepEqual(translatedFallback.jsonLd, []);

  const notFound = verifySeoPage(read, '404.html', {
    canonical: `${siteUrl}/404/`,
    sitemap: `${base}/sitemap-index.xml` || '/sitemap-index.xml',
  });
  assert.deepEqual(notFound.jsonLd, []);
  assert.ok(read('sitemap-index.xml').includes(`${siteUrl}/`), 'the generated sitemap index is present');
}

function verifyCoreFooterOutput(read) {
  for (const [filename, expectedCanonical, sitemapLabel] of [
    ['index.html', 'https://hagilight.hagicode.com/', 'Sitemap'],
    ['zh-CN/index.html', 'https://hagilight.hagicode.com/zh-CN/', '站点地图'],
  ]) {
    const html = read(filename);
    const head = html.slice(0, html.indexOf('</head>'));
    const canonicals = headAttributeValues(head, 'link', 'href', '\\brel="canonical"');
    assert.equal(canonicals.length, 1, `${filename} has one core canonical`);
    assert.equal(canonicals[0], expectedCanonical);
    assert.match(html, new RegExp(`<a href="/sitemap-index\\.xml"[^>]*>${sitemapLabel}</a>`, 'u'));
    assert.ok(head.includes('property="og:title"'), `${filename} has core sharing metadata`);
    assert.ok(head.includes('name="twitter:title"'), `${filename} has Twitter metadata`);
    assert.equal(headAttributeValues(head, 'link', 'href', 'application/rss\\+xml').length, 1);
    const footer = html.match(/<footer\b[\s\S]*?<\/footer>/u)?.[0];
    assert.ok(footer, `${filename} has a core Footer`);
    const rssLinks = [...footer.matchAll(/<a\b[^>]*href="([^"]*rss[^"]*)"[^>]*>([^<]*)<\/a>/giu)]
      .map(([, href, label]) => [href, label]);
    assert.deepEqual(rssLinks, filename === 'index.html'
      ? [['https://hagilight.hagicode.com/rss.xml', 'RSS Feed']]
      : [
        ['https://hagilight.hagicode.com/rss.xml', 'RSS 订阅'],
        ['https://hagilight.hagicode.com/rss.zh-CN.xml', '当前语言 RSS'],
      ]);
  }

  const english = read('rss.xml');
  const englishAlias = read('rss.en.xml');
  const chinese = read('rss.zh-CN.xml');
  assert.equal(english, englishAlias);
  assert.match(english, /^<\?xml/u);
  assert.match(english, /<language>en-US<\/language>/u);
  assert.match(chinese, /<language>zh-CN<\/language>/u);
  assert.deepEqual(itemLinks(english), [
    'https://hagilight.hagicode.com/',
    'https://hagilight.hagicode.com/#live-footer-example',
  ]);
  assert.deepEqual(itemLinks(chinese), [
    'https://hagilight.hagicode.com/zh-CN/',
    'https://hagilight.hagicode.com/zh-CN/#live-footer-example',
  ]);
  assert.ok(!english.includes('探索 Hagilight core'));
  assert.ok(!chinese.includes('Explore Hagilight core'));
}


const SHOWCASE_PAGES = {
  'en-US': 'index.html',
  'zh-CN': 'zh-CN/index.html',
  'zh-Hant': 'zh-Hant/index.html',
  'ja-JP': 'ja-JP/index.html',
  'ko-KR': 'ko-KR/index.html',
  'de-DE': 'de-DE/index.html',
  'fr-FR': 'fr-FR/index.html',
  'es-ES': 'es-ES/index.html',
  'pt-BR': 'pt-BR/index.html',
  'ru-RU': 'ru-RU/index.html',
};
const BADGE_LOADER = 'https://get.microsoft.com/badge/ms-store-badge.bundled.js';
const KIB = 1024;

function escapeHtml(value) {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;').replace(/'/gu, '&#39;');
}

function includesText(html, text) {
  return html.includes(text) || html.includes(escapeHtml(text));
}

function showcaseSection(html, filename) {
  const start = html.indexOf('<section class="hagilight-article-promotion');
  assert.notEqual(start, -1, `${filename} renders the HagiCode showcase`);
  return html.slice(start, html.indexOf('</section>', start));
}

function verifyShowcaseOutput(read) {
  const outputDir = join(root, 'examples/demo-starlight-web/dist');
  const astroDir = join(outputDir, '_astro');
  const hrefsOf = (links, ids) => ids.map((id) => links.find((link) => link.id === id).href);
  for (const [locale, filename] of Object.entries(SHOWCASE_PAGES)) {
    const html = read(filename);
    const copy = COPY[locale];
    const section = showcaseSection(html, filename);
    const links = resolveSiteLinks(locale);
    const [home, productDocs, microsoftStore, downloadClient] = hrefsOf(
      [...links.header, ...links.quick],
      ['home', 'productDocs', 'microsoftStore', 'downloadClient'],
    );

    assert.ok(includesText(section, copy.lead), `${filename} has the ${locale} lead`);
    assert.ok(includesText(section, copy.shareText), `${filename} has the ${locale} share sentence`);
    assert.ok(includesText(section, copy.features[0].label), `${filename} has the localized pillar labels`);
    assert.ok(section.includes(`href="${home}"`), `${filename} primary CTA`);
    assert.ok(section.includes(`href="${productDocs}"`), `${filename} secondary CTA`);
    assert.ok(section.includes(`href="${downloadClient}"`), `${filename} all-downloads link`);

    const badge = section.match(/<ms-store-badge\b([^>]*)>([\s\S]*?)<\/ms-store-badge>/u);
    assert.ok(badge, `${filename} has the Microsoft Store badge`);
    assert.match(badge[1], /\bproductid="9N3PM0N3SVDW"/u);
    assert.match(badge[1], /\bwindow-mode="direct"/u);
    assert.match(badge[1], /\btheme="auto"/u);
    assert.match(badge[1], /\bsize="large"/u);
    assert.ok(badge[1].includes(`language="${resolveMicrosoftStoreBadgeLanguage(locale)}"`), `${filename} badge language`);
    assert.ok(includesText(badge[1], copy.windowsStoreAriaLabel), `${filename} badge accessible name`);
    assert.ok(badge[2].includes(`href="${microsoftStore}"`), `${filename} fallback link`);
    assert.ok(includesText(badge[2], copy.windowsStoreLabel), `${filename} fallback text`);

    assert.equal(html.split(BADGE_LOADER).length - 1, 1, `${filename} loads the badge script once`);
    assert.ok(html.includes(`<script type="module" src="${BADGE_LOADER}">`), `${filename} badge loader is a module script`);

    const images = [...section.matchAll(/<img\b[^>]*>/gu)].map(([tag]) => tag);
    assert.equal(images.length, copy.gallery.length, `${filename} gallery image count`);
    images.forEach((tag, index) => {
      const alt = tag.match(/\balt="([^"]+)"/u)?.[1];
      assert.ok(alt, `${filename} image ${index} has alt text`);
      assert.ok([copy.gallery[index].alt, escapeHtml(copy.gallery[index].alt)].includes(alt), `${filename} image ${index} localized alt`);
      assert.match(tag, /\bloading="lazy"/u);
      assert.match(tag, /\bdecoding="async"/u);
      assert.match(tag, /\bwidth="\d+"/u);
      assert.match(tag, /\bheight="\d+"/u);
      for (const [, url] of tag.matchAll(/(\/_astro\/[^\s",]+\.webp)/gu)) {
        assert.match(url, /\.[\w-]{6,}\.webp$/u, `${url} is content-hashed`);
        assert.ok(statSync(join(outputDir, url)).size <= 200 * KIB, `${url} stays within the 200 KiB raster budget`);
      }
    });
    for (const [, url] of section.matchAll(/url\((\/_astro\/pillar-[^)]+)\)/gu)) {
      assert.match(url, /\.svg$/u);
      assert.ok(statSync(join(outputDir, url)).size <= 8 * KIB, `${url} stays within the 8 KiB SVG budget`);
    }
  }

  const showcaseFiles = readdirSync(astroDir).filter((file) => /^(?:workbench|proposal-workflow|heroes|pillar-)/u.test(file));
  assert.ok(showcaseFiles.some((file) => file.endsWith('.webp')) && showcaseFiles.some((file) => file.endsWith('.svg')));
  assert.ok(showcaseFiles.every((file) => /\.(?:webp|svg)$/u.test(file)), 'showcase images are WebP or SVG');
  const total = showcaseFiles.reduce((sum, file) => sum + statSync(join(astroDir, file)).size, 0);
  assert.ok(total <= 768 * KIB, `built showcase images total ${total} bytes, over the 768 KiB budget`);
}

function verifyShowcaseDisabled(read) {
  for (const [locale, filename] of Object.entries(SHOWCASE_PAGES)) {
    const html = read(filename);
    for (const marker of ['hagilight-article-promotion', 'ms-store-badge', 'get.microsoft.com']) {
      assert.ok(!html.includes(marker), `${filename} (${locale}) renders no showcase markup when disabled: ${marker}`);
    }
  }
}

const defaultFeeds = build();
verifyDefaultFeeds(defaultFeeds);
verifySeoOutput(defaultFeeds);
verifyShowcaseOutput(defaultFeeds);
const englishHome = readFileSync(join(root, 'examples/demo-starlight-web/dist/index.html'), 'utf8');
const chineseHome = readFileSync(join(root, 'examples/demo-starlight-web/dist/zh-CN/index.html'), 'utf8');
const traditionalChineseHome = readFileSync(
  join(root, 'examples/demo-starlight-web/dist/zh-Hant/index.html'),
  'utf8',
);
assert.ok(englishHome.includes('https://docs.hagicode.com/en-US/blog/'));
assert.ok(!englishHome.includes('https://docs.hagicode.com/blog/'));
assert.ok(!englishHome.includes('https://hagistar.hagicode.com/rss.zh-CN.xml'));
assert.ok(chineseHome.includes('https://docs.hagicode.com/blog/'));
assert.ok(chineseHome.includes('https://hagistar.hagicode.com/rss.zh-CN.xml'));
assert.ok(!chineseHome.includes('https://hagistar.hagicode.com/rss.en.xml'));
assert.ok(traditionalChineseHome.includes('hreflang="zh-Hant"'));
assert.ok(traditionalChineseHome.includes('canonical" href="https://hagistar.hagicode.com/zh-Hant/"'));
assert.ok(traditionalChineseHome.includes('本頁示範了覆寫'));
assert.ok(!readFileSync(join(root, 'examples/demo-starlight-web/dist/index.html'), 'utf8')
  .includes('https://hagistar.hagicode.com/rss.en.xml'));

const blogOnly = build({
  HAGILIGHT_EXAMPLE_BASE: '/rss-blog-only/',
  HAGILIGHT_RSS_INCLUDE_DOCS: 'false',
});
verifySeoOutput(blogOnly, '/rss-blog-only/');
const blogOnlyLinks = itemLinks(blogOnly('rss.xml'));
assert.ok(blogOnlyLinks.length > 0);
assert.ok(blogOnlyLinks.every((link) => /\/rss-blog-only\/blog\//u.test(link)));

const docsOnly = build({
  HAGILIGHT_EXAMPLE_BASE: '/rss-docs-only/',
  HAGILIGHT_RSS_INCLUDE_BLOG: 'false',
});
const docsOnlyLinks = itemLinks(docsOnly('rss.xml'));
assert.ok(docsOnlyLinks.length > 0);
assert.ok(docsOnlyLinks.every((link) => link.includes('/rss-docs-only/')));
assert.ok(docsOnlyLinks.every((link) => !link.includes('/blog/')));

verifyDefaultFeeds(build());
verifyShowcaseDisabled(build({ HAGILIGHT_EXAMPLE_PROMOTION: 'false' }));
verifyDefaultFeeds(build());
verifyCoreFooterOutput(buildCoreFooter());