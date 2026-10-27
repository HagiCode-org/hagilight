import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSiteLinks, withCampaignUtm } from '@hagicode/hagilight-core/links';
import { COPY } from '../packages/starlight/dist/article-promotion.js';
import { resolveMicrosoftStoreBadgeLanguage } from '../packages/starlight/dist/windows-download.js';
import { verifyBuildInfo } from './build-info-assertions.mjs';
import { verifyConsentPage, verifyPostHog, verifyPostHogInteractions, verifyPromotoAnalytics } from './posthog-assertions.mjs';

const sharp = createRequire(import.meta.resolve('astro/package.json'))('sharp');

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const EXAMPLE_IMAGE_CACHE = join(root, 'examples/demo-starlight-web/node_modules/.astro/assets');
// Inside the project so Astro can rename assets into outDir; a tmpdir can sit on another device (EXDEV).
const EXAMPLE_OUTPUT_ROOT = join(root, 'examples/demo-starlight-web/node_modules/.hagilight-variants');

execFileSync(npm, ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

function build(env, outputDir) {
  // A warm image cache makes Astro copy files into dist, which fails intermittently on Windows runners.
  rmSync(EXAMPLE_IMAGE_CACHE, { recursive: true, force: true });
  // Astro's cleanup silently skips files Windows will not delete, so each variant gets a fresh outDir.
  rmSync(outputDir, { recursive: true, force: true });
  execFileSync(npm, ['run', 'build', '-w', 'hagilight-example', '--', '--outDir', outputDir], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    // On Windows `npm` resolves to the `npm.cmd` batch file, which child_process
    // cannot execute directly; route it through the shell like the sibling scripts.
    shell: process.platform === 'win32',
  });
  const read = (filename) => readFileSync(join(outputDir, filename), 'utf8');
  const pages = readdirSync(outputDir, { recursive: true }).filter((file) => file.endsWith('.html'));
  assert.ok(pages.some((file) => /404(?:\.html|[\\/]index\.html)$/u.test(file)), 'PostHog checks cover the 404 page');
  assert.ok(pages.some((file) => file.includes('zh-CN')), 'PostHog checks cover localized pages');
  // The analytics-off variant disables PostHog on purpose, so no page is expected to initialize it.
  if (env.HAGILIGHT_EXAMPLE_ANALYTICS !== 'off') {
    for (const file of pages) {
      verifyPostHog(read(file), file, { framework: 'starlight' });
      verifyPostHogInteractions(read(file), file, { searchQuery: 'off' });
    }
    const notFound = pages.find((file) => /404(?:\.html|[\\/]index\.html)$/u.test(file));
    verifyPostHog(read(notFound), notFound, { framework: 'starlight', pageType: '404' });
    verifyPostHogInteractions(read(notFound), notFound, { searchQuery: 'off' });
  } else {
    for (const file of pages) assert.ok(!read(file).includes('posthog.init('), `${file} initializes no PostHog when analytics is off`);
  }
  for (const file of pages) verifyConsentPage(read(file), file, { enabled: env.HAGILIGHT_EXAMPLE_ANALYTICS !== 'off' });
  const consentMetadata = JSON.parse(read('.well-known/hagilight.metadata.json'));
  assert.equal(consentMetadata.features.consent, env.HAGILIGHT_EXAMPLE_ANALYTICS !== 'off', 'the metadata consent flag matches the popup');
  read.bytes = (filename) => readFileSync(join(outputDir, filename));
  return read;
}

function readSiteMetadata(read) {
  const metadata = JSON.parse(read('.well-known/hagilight.metadata.json'));
  assert.equal(metadata.schemaVersion, 1);
  return metadata;
}

function verifySiteMetadataCoexistence(afterStarlight, beforeStarlight) {
  const normalize = (metadata) => ({ ...metadata, build: { ...metadata.build, builtAt: 'unknown' } });
  const after = readSiteMetadata(afterStarlight);
  const before = readSiteMetadata(beforeStarlight);
  assert.equal(after.generator.name, '@hagicode/hagilight-starlight');
  assert.equal(after.languages.default, 'en-US');
  assert.ok(after.languages.locales.some(({ code, path }) => code === 'zh-CN' && path === '/zh-CN/'), 'the demo locales are listed');
  assert.equal(before.generator.name, '@hagicode/hagilight-starlight');
  // Both integrations are registered, so the sitemap and llms.txt exist before the single write.
  for (const metadata of [after, before]) {
    assert.equal(metadata.discovery.sitemap, '/sitemap-index.xml');
    assert.equal(metadata.discovery.llms, '/llms.txt');
  }
  assert.deepEqual(normalize(before), normalize(after));
}

function buildCoreFooter() {
  execFileSync(npm, ['run', 'build', '-w', 'hagilight-core-footer-example'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const outputDir = join(root, 'examples/demo-web/dist');
  const read = (filename) => readFileSync(join(outputDir, filename), 'utf8');
  const pages = readdirSync(outputDir, { recursive: true }).filter((file) => file.endsWith('.html'));
  assert.ok(pages.some((file) => file.includes('zh-CN')), 'PostHog checks cover the localized plain-Astro pages');
  for (const file of pages) {
    verifyPostHog(read(file), `plain Astro ${file}`, { framework: 'astro' });
    verifyPostHogInteractions(read(file), `plain Astro ${file}`, { searchQuery: 'off' });
  }
  for (const file of pages) verifyConsentPage(read(file), `plain Astro ${file}`, { enabled: true });
  return read;
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
    ['en-US/index.html', 'https://hagilight.hagicode.com/en-US/', 'Sitemap'],
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
    assert.deepEqual(rssLinks, filename === 'en-US/index.html'
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
    'https://hagilight.hagicode.com/en-US/',
    'https://hagilight.hagicode.com/en-US/#live-footer-example',
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
const SHOWCASE_FILE = /^(?:cat-head|pillar-)/u;
const SHOWCASE_FORMATS = ['avif', 'webp', 'jpeg'];
const SHOWCASE_ASSETS = join(root, 'packages/starlight/assets/showcase');
const DEMO_DIST = join(root, 'examples/demo-starlight-web/dist');
const CORE_DIST = join(root, 'examples/demo-web/dist');

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

function attributeOf(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'u'))?.[1];
}

function srcsetCandidates(srcset, filename) {
  return srcset.split(',').map((entry) => {
    const [url, descriptor] = entry.trim().split(/\s+/u);
    assert.match(descriptor ?? '', /^\d+w$/u, `${filename} srcset entry ${url} declares a pixel width`);
    return { url, width: Number(descriptor.slice(0, -1)) };
  });
}

function sniffImageFormat(bytes) {
  if (bytes.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(bytes.toString('ascii', 8, 12))) return 'avif';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  return 'unknown';
}

function showcaseFilesIn(dist) {
  const astroDir = join(dist, '_astro');
  return existsSync(astroDir) ? readdirSync(astroDir).filter((file) => SHOWCASE_FILE.test(file)) : [];
}

const variantCache = new Map();
async function inspectVariant(url, format) {
  if (!variantCache.has(url)) {
    assert.match(url, /^\/_astro\/[^/]+\.[\w-]{6,}\.(?:avif|webp|jpeg)$/u, `${url} is content-hashed under /_astro/`);
    assert.ok(url.endsWith(`.${format}`), `${url} is listed as ${format}`);
    const path = join(DEMO_DIST, url);
    assert.ok(existsSync(path), `${url} exists in the build output`);
    const bytes = readFileSync(path);
    assert.equal(sniffImageFormat(bytes), format, `${url} is declared ${format} but its bytes are ${sniffImageFormat(bytes)}`);
    const { width, height } = await sharp(path).metadata();
    variantCache.set(url, { width, height, bytes: bytes.length });
  }
  return variantCache.get(url);
}

const sourceCache = new Map();
async function shippedSource(name) {
  if (!sourceCache.has(name)) {
    const path = join(SHOWCASE_ASSETS, `${name}.webp`);
    assert.ok(existsSync(path), `${name} has a shipped WebP source`);
    const { width, height } = await sharp(path).metadata();
    sourceCache.set(name, { width, height });
  }
  return sourceCache.get(name);
}

function peakSnr(reference, candidate) {
  let squared = 0;
  for (let i = 0; i < reference.length; i++) squared += (reference[i] - candidate[i]) ** 2;
  const mse = squared / reference.length;
  return mse === 0 ? Infinity : 10 * Math.log10((255 ** 2) / mse);
}

const fidelityCache = new Map();
async function verifyNativeFidelity(name, format, url) {
  if (!fidelityCache.has(url)) {
    const reference = await sharp(join(SHOWCASE_ASSETS, `${name}.webp`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const candidate = await sharp(join(DEMO_DIST, url)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([candidate.info.width, candidate.info.height], [reference.info.width, reference.info.height], `${url} is the shipped source's native size`);
    const value = peakSnr(reference.data, candidate.data);
    console.log(`showcase ${name} ${format} native PSNR ${value.toFixed(2)} dB`);
    fidelityCache.set(url, value);
  }
  const value = fidelityCache.get(url);
  assert.ok(value >= 36, `${name} ${format} native variant measures ${value.toFixed(2)} dB against the shipped WebP, under the 36 dB floor`);
}

async function verifyShowcaseOutput(read) {
  const astroDir = join(DEMO_DIST, '_astro');
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
    // The article-end links are campaign-tagged for the example's site id; the download link is not.
    const articleTag = (id, href) => withCampaignUtm(href, {
      siteId: 'hagilight-example',
      medium: 'article',
      campaign: id,
      content: 'article_promotion',
    });
    assert.ok(section.includes(`href="${escapeHtml(articleTag('home', home))}"`), `${filename} primary CTA`);
    assert.ok(section.includes(`href="${escapeHtml(articleTag('productDocs', productDocs))}"`), `${filename} secondary CTA`);
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

    // The showcase's one picture is the cat-head avatar in the primary call to action. It is decorative, so its alt stays empty.
    const pictures = [...section.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/gu)].map(([, inner]) => inner);
    assert.equal(pictures.length, 1, `${filename} renders the cat-head avatar picture once`);
    const parts = pictures[0].match(/^\s*<source\b([^>]*)>\s*<source\b([^>]*)>\s*<img\b([^>]*)>\s*$/u);
    assert.ok(parts, `${filename} avatar lists AVIF, then WebP, then the JPEG img`);
    const [, avif, webp, img] = parts;
    assert.match(avif, /\btype="image\/avif"/u, `${filename} avatar leads with AVIF`);
    assert.match(webp, /\btype="image\/webp"/u, `${filename} avatar follows with WebP`);
    assert.doesNotMatch(`${avif}${webp}`, /\b(?:loading|decoding|fetchpriority)=/u, `${filename} avatar keeps lazy attributes on the img`);

    assert.match(img, /\salt(?:=""|(?=[\s/>]))/u, `${filename} avatar has an empty alt`);
    assert.match(img, /\bloading="lazy"/u);
    assert.match(img, /\bdecoding="async"/u);
    assert.match(img, /\bwidth="\d+"/u);
    assert.match(img, /\bheight="\d+"/u);

    const sizes = attributeOf(img, 'sizes');
    assert.ok(sizes, `${filename} avatar has a size hint`);
    assert.equal(attributeOf(avif, 'sizes'), sizes, `${filename} avatar AVIF size hint`);
    assert.equal(attributeOf(webp, 'sizes'), sizes, `${filename} avatar WebP size hint`);

    const tiers = {
      avif: srcsetCandidates(attributeOf(avif, 'srcset'), filename),
      webp: srcsetCandidates(attributeOf(webp, 'srcset'), filename),
      jpeg: srcsetCandidates(attributeOf(img, 'srcset'), filename),
    };
    const widths = tiers.jpeg.map((candidate) => candidate.width);
    for (const format of SHOWCASE_FORMATS) {
      assert.deepEqual(tiers[format].map((candidate) => candidate.width), widths, `${filename} avatar ${format} offers the same widths`);
    }
    const native = Number(attributeOf(img, 'width'));
    const src = attributeOf(img, 'src');
    assert.match(src, /^\/_astro\/cat-head\.[^/]+\.jpeg$/u, `${filename} avatar falls back to the native cat-head JPEG`);
    const name = tiers.jpeg[0].url.split('/').pop().split('.')[0];
    const source = await shippedSource(name);
    assert.deepEqual([source.width, source.height], [native, Number(attributeOf(img, 'height'))], `${filename} avatar declares the shipped source size`);

    for (const { width } of tiers.jpeg) {
      const variants = {};
      for (const format of SHOWCASE_FORMATS) {
        const { url } = tiers[format].find((candidate) => candidate.width === width);
        variants[format] = { url, ...(await inspectVariant(url, format)) };
        assert.equal(variants[format].width, width, `${url} is ${width} px wide`);
      }
      const pixelSizes = new Set(SHOWCASE_FORMATS.map((format) => `${variants[format].width}x${variants[format].height}`));
      assert.equal(pixelSizes.size, 1, `${name} at ${width} px: tiers differ in pixel size`);
      assert.ok(
        variants.avif.bytes < variants.webp.bytes,
        `${name} at ${width} px: AVIF ${variants.avif.bytes} bytes is not smaller than WebP ${variants.webp.bytes} bytes`,
      );
    }
    await verifyNativeFidelity(name, 'jpeg', src);

    for (const [, url] of section.matchAll(/url\((\/_astro\/pillar-[^)]+)\)/gu)) {
      assert.match(url, /\.svg$/u);
      assert.ok(statSync(join(DEMO_DIST, url)).size <= 8 * KIB, `${url} stays within the 8 KiB SVG budget`);
    }
  }

  const showcaseFiles = readdirSync(astroDir).filter((file) => SHOWCASE_FILE.test(file));
  for (const format of [...SHOWCASE_FORMATS, 'svg']) {
    assert.ok(showcaseFiles.some((file) => file.endsWith(`.${format}`)), `a built ${format} showcase file exists`);
  }
  assert.ok(showcaseFiles.every((file) => /\.(?:avif|webp|jpeg|svg)$/u.test(file)), 'showcase files are AVIF, WebP, JPEG, or SVG');
  const sizeOf = (file) => statSync(join(astroDir, file)).size;
  for (const file of showcaseFiles.filter((name) => name.endsWith('.svg'))) {
    assert.ok(sizeOf(file) <= 8 * KIB, `${file} is ${sizeOf(file)} bytes, over the 8 KiB SVG budget`);
  }
  for (const file of showcaseFiles.filter((name) => !name.endsWith('.svg'))) {
    assert.ok(sizeOf(file) <= 200 * KIB, `${file} is ${sizeOf(file)} bytes, over the 200 KiB raster budget`);
  }
  for (const format of SHOWCASE_FORMATS) {
    const total = showcaseFiles.filter((file) => file.endsWith(`.${format}`)).reduce((sum, file) => sum + sizeOf(file), 0);
    assert.ok(total <= 768 * KIB, `built ${format} showcase variants total ${total} bytes, over the 768 KiB per-format budget`);
  }
}

function verifyShowcaseDisabled(read, dist) {
  for (const [locale, filename] of Object.entries(SHOWCASE_PAGES)) {
    const html = read(filename);
    for (const marker of ['hagilight-article-promotion', 'ms-store-badge', 'get.microsoft.com']) {
      assert.ok(!html.includes(marker), `${filename} (${locale}) renders no showcase markup when disabled: ${marker}`);
    }
  }
  const derivedTiers = showcaseFilesIn(dist).filter((file) => /\.(?:avif|jpeg)$/u.test(file));
  assert.deepEqual(derivedTiers, [], 'a disabled showcase emits no AVIF or JPEG tier');
}

const CONTENT_IMAGE_MARKER = 'hagilight-content-image';
const CONTENT_IMAGE_FILES = ['content-images/index.html', 'zh-CN/content-images/index.html'];
const CONTENT_BODY_SRC = /^(?:\/_astro\/content-image-local\.[^"]+\.png|\/content-images\/root-sample\.png)$/u;

function imageTags(html) {
  return [...html.matchAll(/<img\b[^>]*>/gu)].map(([tag]) => tag);
}

function markerCount(tag) {
  return (attributeOf(tag, 'class') ?? '').split(/\s+/u).filter((name) => name === CONTENT_IMAGE_MARKER).length;
}

function verifyBodyImages(read) {
  for (const filename of CONTENT_IMAGE_FILES) {
    const html = read(filename);
    const tags = imageTags(html);
    const [picture] = html.match(/<picture\b[\s\S]*?<\/picture>/u) ?? [];
    assert.ok(picture, `${filename} wraps the Picture image in a picture element`);
    assert.match(picture, /<source\b[^>]*type="image\/avif"/u, `${filename} offers an AVIF source`);
    assert.match(picture, /<source\b[^>]*type="image\/webp"/u, `${filename} offers a WebP source`);
    const body = tags.filter((tag) => CONTENT_BODY_SRC.test(attributeOf(tag, 'src') ?? ''));
    assert.equal(body.length, 3, `${filename} renders the three body images`);
    assert.deepEqual(
      body.map((tag) => attributeOf(tag, 'loading')).sort(),
      ['eager', 'lazy', 'lazy'],
      `${filename} keeps the author's eager loading and lazy-loads the others`,
    );
    for (const tag of body) {
      const src = attributeOf(tag, 'src');
      assert.match(src, /^\/(?!\/)/u, `${filename} serves ${src} from its own origin`);
      assert.equal(attributeOf(tag, 'decoding'), 'async', `${filename} ${src} decodes asynchronously`);
      const inPicture = picture.includes(tag);
      assert.equal(
        markerCount(tag),
        inPicture ? 0 : 1,
        `${filename} ${src} ${inPicture ? 'skips' : 'carries'} the content-image marker`,
      );
    }
    for (const tag of tags.filter((image) => !body.includes(image))) {
      assert.equal(markerCount(tag), 0, `${filename} leaves ${attributeOf(tag, 'src')} unmarked`);
    }
  }
  for (const filename of ['index.html', 'zh-CN/index.html']) {
    for (const tag of imageTags(read(filename))) {
      assert.equal(markerCount(tag), 0, `${filename} leaves logo and showcase ${attributeOf(tag, 'src')} unmarked`);
    }
  }
  for (const feed of ['rss.xml', 'rss.zh-CN.xml']) {
    assert.ok(!read(feed).includes('/content-images/'), `${feed} omits the content-images demo page`);
  }
}

function verifyContentImagesDisabled(read) {
  for (const filename of CONTENT_IMAGE_FILES) {
    const tags = imageTags(read(filename));
    assert.ok(tags.every((tag) => markerCount(tag) === 0), `${filename} renders no content-image marker when disabled`);
    const [plain, eager] = tags.filter((tag) => attributeOf(tag, 'src') === '/content-images/root-sample.png');
    assert.ok(plain && eager, `${filename} renders both root-sample images`);
    assert.equal(attributeOf(plain, 'loading'), undefined, `${filename} leaves the plain image without loading`);
    assert.equal(attributeOf(plain, 'decoding'), undefined, `${filename} leaves the plain image without decoding`);
    assert.equal(attributeOf(eager, 'loading'), 'eager', `${filename} keeps the author's eager loading`);
    assert.equal(attributeOf(eager, 'decoding'), undefined, `${filename} adds no decoding to the eager image`);
  }
}

const MARKDOWN_PAGE = 'content-images-markdown/index.html';
const MARKDOWN_IMAGE_SRC = /\/_astro\/(?:content-image-local|relative-sample|root-sample)\./u;

function markdownPictures(html) {
  return (html.match(/<picture\b[\s\S]*?<\/picture>/gu) ?? []).filter((picture) => MARKDOWN_IMAGE_SRC.test(picture));
}

function verifyMarkdownPicture(picture, filename) {
  assert.match(picture, /<source\b[^>]*type="image\/avif"/u, `${filename} offers an AVIF source`);
  assert.match(picture, /<source\b[^>]*type="image\/webp"/u, `${filename} offers a WebP source`);
  const [img] = picture.match(/<img\b[^>]*>/u) ?? [];
  assert.ok(img, `${filename} keeps an img inside the picture`);
  assert.equal(markerCount(img), 1, `${filename} marks the img inside the picture`);
}

function verifyMarkdownPictures(read) {
  for (const filename of ['en-US/index.html', 'zh-CN/index.html']) {
    const pictures = markdownPictures(read(filename));
    assert.equal(pictures.length, 2, `${filename} wraps both Markdown snippet images`);
    for (const picture of pictures) verifyMarkdownPicture(picture, filename);
  }
}

function verifyMarkdownPage(read, enabled = true) {
  const pictures = markdownPictures(read(MARKDOWN_PAGE));
  if (!enabled) {
    assert.equal(pictures.length, 0, `${MARKDOWN_PAGE} renders no picture element when disabled`);
    return;
  }
  assert.equal(pictures.length, 2, `${MARKDOWN_PAGE} wraps both local Markdown images`);
  verifyMarkdownPicture(pictures[0], MARKDOWN_PAGE);
}

const MDX_PAGE = 'content-images-mdx/index.html';
const MDX_LOCAL_SRC = /\/_astro\/(?:content-image-local|relative-sample)\./u;
const MDX_ROOT_SRC = '/content-images/root-sample.png';

function sourceSrcset(picture, type) {
  const source = [...picture.matchAll(/<source\b[^>]*>/gu)].map(([tag]) => tag).find((tag) => attributeOf(tag, 'type') === type);
  assert.ok(source, `${MDX_PAGE} offers a ${type} source`);
  return attributeOf(source, 'srcset');
}

function verifyMdxPicture(picture, read) {
  assert.deepEqual(
    [...picture.matchAll(/<source\b[^>]*\btype="([^"]+)"/gu)].map(([, type]) => type),
    ['image/avif', 'image/webp'],
    `${MDX_PAGE} lists the AVIF source first, the WebP source second, and no other source`,
  );
  const avif = sourceSrcset(picture, 'image/avif');
  const webp = sourceSrcset(picture, 'image/webp');
  assert.match(avif, /\.avif$/u, `${MDX_PAGE} AVIF source points at an .avif file`);
  assert.match(webp, /\.webp$/u, `${MDX_PAGE} WebP source points at a .webp file`);
  assert.equal(sniffImageFormat(read.bytes(avif)), 'avif', `${avif} is an AVIF file`);
  assert.equal(sniffImageFormat(read.bytes(webp)), 'webp', `${webp} is a WebP file`);
  const [img] = picture.match(/<img\b[^>]*>/u) ?? [];
  assert.ok(img, `${MDX_PAGE} keeps an img inside the picture`);
  assert.equal(attributeOf(img, 'src'), webp, `${MDX_PAGE} falls back to the WebP file`);
  assert.equal(attributeOf(img, 'loading'), 'lazy', `${MDX_PAGE} lazy-loads the picture img`);
  assert.equal(attributeOf(img, 'decoding'), 'async', `${MDX_PAGE} decodes the picture img asynchronously`);
  assert.equal(markerCount(img), 1, `${MDX_PAGE} marks the picture img`);
  assert.ok(attributeOf(img, 'alt')?.trim(), `${MDX_PAGE} gives the picture img a non-empty alt`);
}

function verifyMdxPage(read, enabled = true) {
  const html = read(MDX_PAGE);
  const allPictures = html.match(/<picture\b[\s\S]*?<\/picture>/gu) ?? [];
  const pictures = allPictures.filter((picture) => MDX_LOCAL_SRC.test(picture));
  if (!enabled) {
    assert.equal(pictures.length, 0, `${MDX_PAGE} renders no picture element when disabled`);
    assert.ok(imageTags(html).every((tag) => markerCount(tag) === 0), `${MDX_PAGE} renders no content-image marker when disabled`);
    return;
  }
  assert.equal(pictures.length, 2, `${MDX_PAGE} wraps both local Markdown-syntax images`);
  for (const picture of pictures) verifyMdxPicture(picture, read);
  const rootImages = imageTags(html).filter((tag) => attributeOf(tag, 'src') === MDX_ROOT_SRC);
  assert.equal(rootImages.length, 2, `${MDX_PAGE} renders the Markdown and raw site-root images`);
  for (const tag of rootImages) {
    assert.ok(allPictures.every((picture) => !picture.includes(tag)), `${MDX_PAGE} keeps the site-root image outside picture`);
    assert.equal(attributeOf(tag, 'loading'), 'lazy', `${MDX_PAGE} lazy-loads the site-root ${attributeOf(tag, 'alt')}`);
    assert.equal(attributeOf(tag, 'decoding'), 'async', `${MDX_PAGE} decodes the site-root image asynchronously`);
    assert.equal(markerCount(tag), 1, `${MDX_PAGE} carries the content-image marker on the site-root image`);
  }
}

const defaultFeeds = build({}, DEMO_DIST);
verifyDefaultFeeds(defaultFeeds);
verifySeoOutput(defaultFeeds);
for (const page of ['index.html', 'zh-CN/index.html']) verifyBuildInfo(defaultFeeds(page), `Starlight ${page}`);
await verifyShowcaseOutput(defaultFeeds);
verifyBodyImages(defaultFeeds);
verifyMarkdownPage(defaultFeeds);
verifyMdxPage(defaultFeeds);
// Every built page and bundle text of a built example, for string checks on shipped code.
function builtText(dir) {
  assert.ok(existsSync(dir), `${dir} is built`);
  return readdirSync(dir, { recursive: true })
    .filter((file) => /\.(?:js|html)$/u.test(file))
    .map((file) => readFileSync(join(dir, file), 'utf8'))
    .join('\n');
}
verifyPromotoAnalytics(builtText(join(root, 'examples/demo-starlight-web/dist')), 'Starlight example');
verifyPromotoAnalytics(builtText(join(root, 'examples/demo-docusaurus-web/build')), 'Docusaurus example');
const englishHome = readFileSync(join(root, 'examples/demo-starlight-web/dist/index.html'), 'utf8');
assert.doesNotMatch(englishHome, /data-root-transit/u, 'the non-opted-in Starlight consumer keeps its root content');
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

// One build per distinct configuration; independent toggles share a build. The RSS include
// filters are unit-tested in test/starlight-rss.test.mjs, so only the base-path case is built.
const blogOnly = build({
  HAGILIGHT_EXAMPLE_BASE: '/rss-blog-only/',
  HAGILIGHT_RSS_INCLUDE_DOCS: 'false',
}, join(EXAMPLE_OUTPUT_ROOT, 'blog-only'));
verifySeoOutput(blogOnly, '/rss-blog-only/');
const blogOnlyLinks = itemLinks(blogOnly('rss.xml'));
assert.ok(blogOnlyLinks.length > 0);
assert.ok(blogOnlyLinks.every((link) => /\/rss-blog-only\/blog\//u.test(link)));

const unifiedDiscoveryFeeds = build({
  HAGILIGHT_EXAMPLE_MARKDOWN_PROCESSOR: 'unified',
  HAGILIGHT_EXAMPLE_DISCOVERY: 'true',
}, join(EXAMPLE_OUTPUT_ROOT, 'unified-discovery'));
verifyBodyImages(unifiedDiscoveryFeeds);
verifyMarkdownPage(unifiedDiscoveryFeeds);
verifyMdxPage(unifiedDiscoveryFeeds);

// Plain-Astro hagilight() registered before and after the Starlight plugin: one metadata file,
// written by Starlight, with the same content either way (builtAt aside).
const discoveryFirstFeeds = build({
  HAGILIGHT_EXAMPLE_DISCOVERY: 'first',
}, join(EXAMPLE_OUTPUT_ROOT, 'discovery-first'));
verifySiteMetadataCoexistence(unifiedDiscoveryFeeds, discoveryFirstFeeds);
// With the Starlight plugin opted out, the plain-Astro integration writes the file itself.
const starlightMetadataOff = build({
  HAGILIGHT_EXAMPLE_DISCOVERY: 'true',
  HAGILIGHT_EXAMPLE_METADATA: 'false',
}, join(EXAMPLE_OUTPUT_ROOT, 'starlight-metadata-off'));
assert.equal(readSiteMetadata(starlightMetadataOff).generator.name, '@hagicode/hagilight');
// Analytics flags follow the resolved options: all true by default, all false when each provider is disabled.
assert.deepEqual(readSiteMetadata(discoveryFirstFeeds).analytics, { googleAnalytics: true, fiftyOneLa: true, posthog: true });
const analyticsOff = build({
  HAGILIGHT_EXAMPLE_ANALYTICS: 'off',
}, join(EXAMPLE_OUTPUT_ROOT, 'analytics-off'));
assert.deepEqual(readSiteMetadata(analyticsOff).analytics, { googleAnalytics: false, fiftyOneLa: false, posthog: false });

const disabledDist = join(EXAMPLE_OUTPUT_ROOT, 'disabled');
const disabledFeeds = build({
  HAGILIGHT_EXAMPLE_PROMOTION: 'false',
  HAGILIGHT_EXAMPLE_CONTENT_IMAGES: 'off',
}, disabledDist);
verifyShowcaseDisabled(disabledFeeds, disabledDist);
verifyContentImagesDisabled(disabledFeeds);
verifyMarkdownPage(disabledFeeds, false);
verifyMdxPage(disabledFeeds, false);
const coreFooterFeeds = buildCoreFooter();
verifyCoreFooterOutput(coreFooterFeeds);
for (const page of ['en-US/index.html', 'zh-CN/index.html']) verifyBuildInfo(coreFooterFeeds(page), `core footer ${page}`);
verifyMarkdownPictures(coreFooterFeeds);
assert.deepEqual(showcaseFilesIn(CORE_DIST), [], 'the core-only demo emits no showcase image');
