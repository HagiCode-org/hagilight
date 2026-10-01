import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputDir = join(root, 'examples/demo-web/dist');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

execFileSync(npm, ['run', 'build:core-footer-example'], {
  cwd: root,
  stdio: 'pipe',
  shell: process.platform === 'win32',
});

const pages = [
  {
    file: 'index.html',
    locale: 'en-US',
    canonical: 'https://hagilight.hagicode.com/',
    fallbackId: 'demo-web-fallback-en',
    labels: ['Live component', 'Live in document head', 'Optional · production-only scripts'],
  },
  {
    file: 'zh-CN/index.html',
    locale: 'zh-CN',
    canonical: 'https://hagilight.hagicode.com/zh-CN/',
    fallbackId: 'demo-web-fallback-zh',
    labels: ['实时组件', '真实文档 head', '可选 · 仅生产环境加载脚本'],
  },
];
const manifests = ['astro', 'core'].map((directory) =>
  JSON.parse(readFileSync(join(root, `packages/${directory}/package.json`), 'utf8')));
const config = readFileSync(join(root, 'examples/demo-web/astro.config.mjs'), 'utf8');
const englishFeed = readFileSync(join(outputDir, 'rss.xml'), 'utf8');
const englishAliasFeed = readFileSync(join(outputDir, 'rss.en.xml'), 'utf8');
const chineseFeed = readFileSync(join(outputDir, 'rss.zh-CN.xml'), 'utf8');

function feedItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map(([, item]) => item);
}

test('both locale pages cover every plain-Astro and shared-core export with localized navigation and real examples', () => {
  const featureIds = [
    'footer',
    'copyright',
    'site-links',
    'promotion',
    'logo',
    'seo-head',
    'seo-tools',
    'favicon',
    'rss',
    'analytics',
  ];

  for (const page of pages) {
    const html = readFileSync(join(outputDir, page.file), 'utf8');
    assert.ok(html.includes(`<html lang="${page.locale}"`), `${page.file} has its locale`);
    for (const manifest of manifests) {
      for (const exportPath of Object.keys(manifest.exports)) {
        assert.ok(html.includes(`${manifest.name}/${exportPath.slice(2)}`), `${page.file} documents ${manifest.name}/${exportPath.slice(2)}`);
      }
    }
    for (const id of featureIds) {
      assert.ok(html.includes(`href="#${id}"`), `${page.file} links to ${id}`);
      assert.ok(html.includes(`id="${id}"`), `${page.file} contains ${id}`);
    }
    assert.ok(html.includes('href="/" lang="en-US"'), `${page.file} links to English`);
    assert.ok(html.includes('href="/zh-CN/"'), `${page.file} links to Simplified Chinese`);
    assert.match(html, /<a class="feed-link" href="\/rss\.xml">[^<]+<\/a>/u);
    assert.match(html, new RegExp(`<a href="/sitemap-index\\.xml"[^>]*>${page.locale === 'zh-CN' ? '站点地图' : 'Sitemap'}</a>`, 'u'));
    for (const label of page.labels) assert.ok(html.includes(label), `${page.file} labels ${label}`);
    assert.match(html, /<footer\b/u, `${page.file} renders the package footer`);
    assert.match(html, /hagilight-footer__copyright[^>]*>[\s\S]*?© \d{4} HagiCode/u);
    const banner = html.match(/<hagilight-promoto-banner\b[^>]*>/u)?.[0] ?? '';
    assert.ok(banner.includes(page.fallbackId), `${page.file} carries its localized banner fallback`);
    assert.ok(
      banner.includes('&quot;link&quot;:&quot;#footer-preview&quot;'),
      `${page.file} banner fallback targets the footer`,
    );
    assert.match(html, /@hagicode\/hagilight-core\/links/u);
  }
});

test('built page heads contain route metadata, truthful JSON-LD, RSS discovery, and favicon', () => {
  for (const page of pages) {
    const html = readFileSync(join(outputDir, page.file), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, new RegExp(`<link rel="canonical" href="${page.canonical.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}"`, 'u'));
    assert.match(head, /property="og:title"/u);
    assert.match(head, /name="twitter:title"/u);
    assert.match(head, /type="application\/rss\+xml"/u);
    assert.match(head, /rel="icon" href="[^"]+\.ico" type="image\/x-icon"/u);

    const structuredData = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)]
      .map(([, json]) => JSON.parse(json));
    assert.deepEqual(structuredData.map(({ '@type': type }) => type), ['WebSite', 'WebPage']);
    assert.equal(structuredData[0].url, 'https://hagilight.hagicode.com/');
    assert.equal(structuredData[1].url, page.canonical);
    assert.equal(typeof structuredData[1].description, 'string');
  }
  assert.match(config, /import \{ hagilight, hagilightFavicon \} from '@hagicode\/hagilight\/integration'/u);
  assert.match(config, /hagilightFavicon\(\)/u);
  assert.match(config, /hagilight\(\{ rss: \{ getFeed: '\.\/src\/rss-feed\.ts' \} \}\)/u);
});

test('integration feeds keep English and Chinese metadata, items, and links separate', () => {
  assert.match(englishFeed, /^<\?xml/u);
  assert.equal(englishFeed, englishAliasFeed);
  assert.match(englishFeed, /<title>Hagilight core package showcase<\/title>/u);
  assert.match(englishFeed, /<description>English updates from the standalone Hagilight Astro demo\.<\/description>/u);
  assert.match(englishFeed, /<language>en-US<\/language>/u);
  assert.deepEqual(
    feedItems(englishFeed).map((item) => item.match(/<title>([^<]+)<\/title>/u)[1]),
    [
      'Explore Hagilight core, without Starlight.',
      'Review generated Footer feed links.',
    ],
  );
  assert.match(englishFeed, /<link>https:\/\/hagilight\.hagicode\.com\/#live-footer-example<\/link>/u);
  assert.doesNotMatch(englishFeed, /探索 Hagilight core/u);

  assert.match(chineseFeed, /<title>Hagilight 独立 Astro 示例<\/title>/u);
  assert.match(chineseFeed, /<description>来自 Hagilight 独立 Astro 示例的简体中文更新。<\/description>/u);
  assert.match(chineseFeed, /<language>zh-CN<\/language>/u);
  assert.deepEqual(
    feedItems(chineseFeed).map((item) => item.match(/<title>([^<]+)<\/title>/u)[1]),
    [
      '探索 Hagilight core，无需 Starlight。',
      '查看自动生成的页脚订阅链接。',
    ],
  );
  assert.match(chineseFeed, /<link>https:\/\/hagilight\.hagicode\.com\/zh-CN\/#live-footer-example<\/link>/u);
  assert.doesNotMatch(chineseFeed, /Explore Hagilight core/u);
});

test('generated Footer shows one English feed and default plus current-language Chinese feeds', () => {
  for (const [page, expected] of [
    ['index.html', [['https://hagilight.hagicode.com/rss.xml', 'RSS Feed']]],
    ['zh-CN/index.html', [
      ['https://hagilight.hagicode.com/rss.xml', 'RSS 订阅'],
      ['https://hagilight.hagicode.com/rss.zh-CN.xml', '当前语言 RSS'],
    ]],
  ]) {
    const html = readFileSync(join(outputDir, page), 'utf8');
    const footer = html.match(/<footer\b[\s\S]*?<\/footer>/u)?.[0];
    assert.ok(footer, `${page} has a Footer`);
    const actual = [...footer.matchAll(/<a\b[^>]*href="([^"]*rss[^"]*)"[^>]*>([^<]*)<\/a>/giu)]
      .map(([, href, label]) => [href, label]);
    assert.deepEqual(actual, expected, `${page} has the expected generated RSS links`);
  }
});

test('showcase stays free of analytics scripts and retains responsive accessible styles', () => {
  const html = pages.map(({ file }) => readFileSync(join(outputDir, file), 'utf8')).join('\n');
  assert.doesNotMatch(html, /googletagmanager\.com|sdk\.51\.la\/js-sdk|LA_COLLECT/u);

  const css = readdirSync(join(outputDir, '_astro'))
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(join(outputDir, '_astro', file), 'utf8'))
    .join('\n');
  assert.match(css, /:focus-visible/u);
  assert.match(css, /(?:max-width:\s*42rem|width<=42rem)/u);
  assert.match(css, /prefers-reduced-motion:\s*reduce/u);
  assert.match(css, /overflow-x:\s*auto/u);
});

test('sitemap and robots output use the configured base path', () => {
  for (const base of ['/', '/discovery-base/']) {
    if (base !== '/') {
      execFileSync(npm, ['run', 'build:core-footer-example'], {
        cwd: root,
        env: { ...process.env, HAGILIGHT_DEMO_BASE: base },
        stdio: 'pipe',
        shell: process.platform === 'win32',
      });
    }

    const buildRoot = outputDir;
    const robots = readFileSync(join(buildRoot, 'robots.txt'), 'utf8');
    const sitemapIndex = readFileSync(join(buildRoot, 'sitemap-index.xml'), 'utf8');
    const baseUrl = base === '/' ? '' : base.slice(0, -1);
    const sitemapUrl = `https://hagilight.hagicode.com${baseUrl}/sitemap-index.xml`;
    const home = readFileSync(join(buildRoot, 'index.html'), 'utf8');
    assert.equal(robots, `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`);
    assert.match(home, new RegExp(`<a href="${baseUrl}/sitemap-index\\.xml"[^>]*>Sitemap</a>`, 'u'));
    assert.match(sitemapIndex, /<sitemapindex\b/u);

    const sitemapFile = sitemapIndex.match(/<loc>[^<]*\/([^/<]+\.xml)<\/loc>/u)?.[1];
    assert.ok(sitemapFile, 'sitemap index references a generated sitemap file');
    const sitemap = readFileSync(join(buildRoot, sitemapFile), 'utf8');
    assert.ok(sitemap.includes(`https://hagilight.hagicode.com${baseUrl}/`));
    assert.ok(sitemap.includes(`https://hagilight.hagicode.com${baseUrl}/zh-CN/`));
  }
});