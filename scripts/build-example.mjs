import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function build(env = {}) {
  execFileSync(npm, ['run', 'build', '-w', 'hagilight-example'], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    // On Windows `npm` resolves to the `npm.cmd` batch file, which child_process
    // cannot execute directly; route it through the shell like the sibling scripts.
    shell: process.platform === 'win32',
  });
  const outputDir = join(root, 'examples/starlight/dist');
  return (filename) => readFileSync(join(outputDir, filename), 'utf8');
}

function buildCoreFooter() {
  execFileSync(npm, ['run', 'build', '-w', 'hagilight-core-footer-example'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const outputDir = join(root, 'examples/core-footer/dist');
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
  assert.ok(englishLinks.includes('https://hagilight.hagicode.com/'));
  assert.ok(englishLinks.includes('https://hagilight.hagicode.com/blog/rss-example/'));
  assert.ok(!englishLinks.some((link) => link.includes('/en-us/')));
  assert.ok(!english.includes('Excluded from RSS'));
  assert.ok(!english.includes('RSS draft'));
  assert.ok(!chinese.includes('Excluded from RSS'));
  assert.ok(!chinese.includes('RSS draft'));
  assert.ok(!chinese.includes('English RSS blog example'));
  assert.ok(!english.includes('Chinese RSS blog example'));
  assert.ok(!traditionalChinese.includes('English RSS blog example'));

  const chineseLinks = itemLinks(chinese);
  assert.ok(chineseLinks.includes('https://hagilight.hagicode.com/zh-CN/'));
  assert.ok(chineseLinks.includes('https://hagilight.hagicode.com/zh-CN/blog/rss-example/'));
  assert.ok(!chineseLinks.some((link) => link.includes('/en-us/')));
  assert.ok(!chineseLinks.some((link) => link.includes('/rss-undated/')));
  assert.ok(itemLinks(traditionalChinese)
    .includes('https://hagilight.hagicode.com/zh-Hant/blog/rss-example/'));

  const undated = feedItems(english).find((item) => item.includes('/rss-undated/'));
  assert.ok(undated);
  assert.doesNotMatch(undated, /<pubDate>/u);
  const datedLinks = englishLinks.filter((link) => link.includes('blog/rss-example'));
  assert.deepEqual(datedLinks, ['https://hagilight.hagicode.com/blog/rss-example/']);
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
  const siteUrl = `https://hagilight.hagicode.com${base}`;
  const imageUrl = `${siteUrl}/share-card.svg`;
  const home = verifySeoPage(read, 'index.html', {
    canonical: `${siteUrl}/`,
    sitemap: `${base}/sitemap-index.xml` || '/sitemap-index.xml',
    image: imageUrl,
  });
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
  for (const [filename, expectedCanonical] of [
    ['index.html', 'https://core-footer.hagilight.example/'],
    ['zh-CN/index.html', 'https://core-footer.hagilight.example/zh-CN/'],
  ]) {
    const html = read(filename);
    const head = html.slice(0, html.indexOf('</head>'));
    const canonicals = headAttributeValues(head, 'link', 'href', '\\brel="canonical"');
    assert.equal(canonicals.length, 1, `${filename} has one core canonical`);
    assert.equal(canonicals[0], expectedCanonical);
    assert.ok(head.includes('property="og:title"'), `${filename} has core sharing metadata`);
    assert.ok(head.includes('name="twitter:title"'), `${filename} has Twitter metadata`);
    assert.equal(headAttributeValues(head, 'link', 'href', 'application/rss\\+xml').length, 1);
  }

  const xml = read('rss.xml');
  assert.match(xml, /^<\?xml/u);
  assert.match(xml, /<language>en-US<\/language>/u);
  const links = itemLinks(xml);
  assert.deepEqual(links, [
    'https://core-footer.hagilight.example/',
    'https://core-footer.hagilight.example/zh-CN/',
  ]);
}

const defaultFeeds = build();
verifyDefaultFeeds(defaultFeeds);
verifySeoOutput(defaultFeeds);
const englishHome = readFileSync(join(root, 'examples/starlight/dist/index.html'), 'utf8');
const chineseHome = readFileSync(join(root, 'examples/starlight/dist/zh-CN/index.html'), 'utf8');
const traditionalChineseHome = readFileSync(
  join(root, 'examples/starlight/dist/zh-Hant/index.html'),
  'utf8',
);
assert.ok(englishHome.includes('https://docs.hagicode.com/en-US/blog/'));
assert.ok(!englishHome.includes('https://docs.hagicode.com/blog/'));
assert.ok(!englishHome.includes('https://hagilight.hagicode.com/rss.zh-CN.xml'));
assert.ok(chineseHome.includes('https://docs.hagicode.com/blog/'));
assert.ok(chineseHome.includes('https://hagilight.hagicode.com/rss.zh-CN.xml'));
assert.ok(!chineseHome.includes('https://hagilight.hagicode.com/rss.en.xml'));
assert.ok(traditionalChineseHome.includes('hreflang="zh-Hant"'));
assert.ok(traditionalChineseHome.includes('canonical" href="https://hagilight.hagicode.com/zh-Hant/"'));
assert.ok(traditionalChineseHome.includes('本頁示範了覆寫'));
assert.ok(!readFileSync(join(root, 'examples/starlight/dist/index.html'), 'utf8')
  .includes('https://hagilight.hagicode.com/rss.en.xml'));

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
verifyCoreFooterOutput(buildCoreFooter());