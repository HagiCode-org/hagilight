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
const manifest = JSON.parse(readFileSync(join(root, 'packages/astro/package.json'), 'utf8'));
const config = readFileSync(join(root, 'examples/demo-web/astro.config.mjs'), 'utf8');

test('both locale pages cover every core export with localized navigation and real examples', () => {
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
    for (const [exportPath] of Object.entries(manifest.exports)) {
      assert.ok(html.includes(exportPath.slice(2)), `${page.file} documents ${exportPath}`);
    }
    for (const id of featureIds) {
      assert.ok(html.includes(`href="#${id}"`), `${page.file} links to ${id}`);
      assert.ok(html.includes(`id="${id}"`), `${page.file} contains ${id}`);
    }
    assert.ok(html.includes('href="/" lang="en-US"'), `${page.file} links to English`);
    assert.ok(html.includes('href="/zh-CN/"'), `${page.file} links to Simplified Chinese`);
    assert.match(html, /<a class="feed-link" href="\/rss\.xml">[^<]+<\/a>/u);
    for (const label of page.labels) assert.ok(html.includes(label), `${page.file} labels ${label}`);
    assert.match(html, /<footer\b/u, `${page.file} renders the package footer`);
    assert.match(html, /hagilight-footer__copyright[^>]*>[\s\S]*?© \d{4} HagiCode/u);
    const banner = html.match(/<hagilight-promoto-banner\b[^>]*>/u)?.[0] ?? '';
    assert.ok(banner.includes(page.fallbackId), `${page.file} carries its localized banner fallback`);
    assert.ok(
      banner.includes('&quot;link&quot;:&quot;#footer-preview&quot;'),
      `${page.file} banner fallback targets the footer`,
    );
    assert.match(html, /@hagicode\/hagilight\/site-links/u);
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
  assert.match(config, /import \{ hagilightFavicon \} from '@hagicode\/hagilight\/favicon'/u);
  assert.match(config, /integrations: \[hagilightFavicon\(\)\]/u);
});

test('feed is a valid consumer-owned output with links to the two real pages', () => {
  const xml = readFileSync(join(outputDir, 'rss.xml'), 'utf8');
  assert.match(xml, /^<\?xml/u);
  assert.match(xml, /<title>Hagilight core package showcase<\/title>/u);
  assert.match(xml, /<language>en-US<\/language>/u);
  assert.deepEqual(
    [...xml.matchAll(/<link>(https:\/\/hagilight\.hagicode\.com\/[^<]*)<\/link>/gu)].map(([, link]) => link),
    [
      'https://hagilight.hagicode.com/',
      'https://hagilight.hagicode.com/',
      'https://hagilight.hagicode.com/zh-CN/',
    ],
  );
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
