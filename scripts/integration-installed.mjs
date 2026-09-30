import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CORE_PACKAGE, PACKAGES, assertPackageGraph, buildPackages, npm, root } from './packages.mjs';

const temp = mkdtempSync(join(tmpdir(), 'hagilight-integration-'));
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function verifyBannerBuild(expected) {
  const html = readFileSync(join(temp, 'dist', 'index.html'), 'utf8');
  const bundles = listFiles(join(temp, 'dist', '_astro'))
    .filter((path) => path.endsWith('.js'))
    .map((path) => readFileSync(path, 'utf8'));
  const hasBannerMarkup = html.includes('<hagilight-promoto-banner');
  const hasBannerScript = bundles.some((bundle) => bundle.includes('hagilight-promoto-banner'));
  if (hasBannerMarkup !== expected || hasBannerScript !== expected) {
    throw new Error(`Installed example banner output mismatch (expected ${expected ? 'enabled' : 'disabled'})`);
  }
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

function withAnalyticsConfig(config, analyticsOptions) {
  const updated = config.replace(
    /        analytics: process\.env\.HAGILIGHT_VIEWPORT_TEST === 'true'\r?\n          \? \{ googleAnalytics: \{ enabled: false \}, fiftyOneLa: \{ enabled: false \} \}\r?\n          : undefined,/u,
    `        analytics: ${analyticsOptions},`,
  );
  if (updated === config) throw new Error('Could not replace the example analytics configuration');
  return updated;
}

function verifyDefaultLinksAndAnalytics() {
  const html = readFileSync(join(temp, 'dist', 'index.html'), 'utf8');
  const chineseHtml = readFileSync(join(temp, 'dist', 'zh-CN', 'index.html'), 'utf8');
  for (const link of [
    'https://www.hagicode.com/en-US/',
    'https://www.hagicode.com/en-US/desktop/',
    'https://apps.microsoft.com/detail/9N3PM0N3SVDW',
    'https://www.hagicode.com/en-US/about/',
    'https://docs.hagicode.com/en-US/blog/',
    'https://tasks.hagicode.com/',
    'https://github.com/HagiCode-org/site',
    'https://discord.gg/qY662sJK',
    'https://github.com/HagiCode-org/site/issues',
    'mailto:support@hagicode.com',
    'https://qm.qq.com/q/Fwb0o094kw',
    'https://cost.hagicode.com',
    'https://docs.hagicode.com/en-US/installation/docker-compose/',
    'https://docs.hagicode.com/en-US/product-overview/',
    'https://hagistar.hagicode.com/rss.xml',
    'https://newbe.hagicode.com/',
    'https://index.hagicode.com/data/',
    'https://builder.hagicode.com/',
    'https://status.hagicode.com/',
    'https://design.hagicode.com/en-US/',
    'https://soul.hagicode.com/',
    'https://trait.hagicode.com/',
    'https://openspec.hagicode.com/en-US/',
    'https://omniroute.hagicode.com/en-US/',
    'https://beian.miit.gov.cn/',
    'http://www.beian.gov.cn/portal/registerSystemInfo',
  ]) {
    assert.ok(html.includes(link), `Expected built footer to include ${link}`);
  }
    const feed = readFileSync(join(temp, 'dist', 'rss.xml'), 'utf8');
    const traditionalChineseFeed = readFileSync(join(temp, 'dist', 'rss.zh-Hant.xml'), 'utf8');
    assert.match(feed, /<rss\b/u);
    assert.ok(feed.includes('https://hagistar.hagicode.com/'));
    assert.ok(feed.includes('https://hagistar.hagicode.com/blog/rss-example/'));
    assert.ok(!feed.includes('https://hagistar.hagicode.com/en-us/'));
    assert.match(html, /rel="alternate"[^>]*type="application\/rss\+xml"/u);
    assert.ok(!html.includes('https://hagistar.hagicode.com/rss.zh-CN.xml'));
    assert.ok(chineseHtml.includes('https://hagistar.hagicode.com/rss.zh-CN.xml'));
    assert.ok(!chineseHtml.includes('https://hagistar.hagicode.com/rss.en.xml'));
    const englishAlias = readFileSync(join(temp, 'dist', 'rss.en.xml'), 'utf8');
    const chineseFeed = readFileSync(join(temp, 'dist', 'rss.zh-CN.xml'), 'utf8');
    assert.equal(feed, englishAlias);
    assert.match(feed, /<language>en-US<\/language>/u);
    assert.match(chineseFeed, /<language>zh-CN<\/language>/u);
    assert.match(traditionalChineseFeed, /<language>zh-Hant<\/language>/u);
    assert.ok(traditionalChineseFeed.includes('https://hagistar.hagicode.com/zh-Hant/blog/rss-example/'));
    assert.ok(!feed.includes('Chinese RSS blog example'));
    assert.ok(!feed.includes('Excluded from RSS'));
    assert.ok(!feed.includes('RSS draft'));
    assert.ok(!chineseFeed.includes('English RSS blog example'));
    assert.ok(!chineseFeed.includes('Excluded from RSS'));
    assert.ok(!chineseFeed.includes('RSS draft'));
    assert.ok(chineseFeed.includes('https://hagistar.hagicode.com/zh-CN/blog/rss-example/'));
  assert.ok(!html.includes('store.steampowered.com'));
  assert.ok(html.includes('Download Hagicode'));
  assert.ok(html.includes('Download Hagicode for Windows'));
  assert.ok(html.includes('About HagiCode'));
  assert.ok(html.includes('Quick links'));
  assert.ok(html.includes('<h2') && html.includes('>Community</h2>'));
  assert.ok(html.includes('https://github.com/HagiCode-org/hagilight/edit/main/'));
  assert.ok(!html.includes('hagilight-site-description'));
  assert.match(
    html,
    /href="https:\/\/github\.com\/HagiCode-org\/site"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/u,
  );
  assert.match(
    html,
    /href="https:\/\/tasks\.hagicode\.com\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/u,
  );
  assert.ok(html.includes('googletagmanager.com/gtag/js?id=G-EN03FMT2Q4'));
  assert.ok(html.includes("gtag('config', measurementId)"));
  assert.ok(html.includes('sdk.51.la/js-sdk-pro.min.js'));
  assert.ok(html.includes('L6b88a5yK4h2Xnci'));
}

function verifyContentFeatures() {
  const rootHtml = readFileSync(join(temp, 'dist', 'index.html'), 'utf8');
  const translatedHtml = readFileSync(join(temp, 'dist', 'zh-CN', 'index.html'), 'utf8');
  const notFoundHtml = readFileSync(join(temp, 'dist', '404.html'), 'utf8');

  assert.match(rootHtml, /data-hagilight-content-width-choice="wide"/u);
  assert.match(rootHtml, /data-hagilight-content-width-choice="narrow"/u);
  assert.match(rootHtml, /aria-label="Content width"/u);
  assert.match(rootHtml, /hagilight-content-width/u);
  assert.match(translatedHtml, /aria-label="内容宽度"/u);
  const headHtml = rootHtml.slice(0, rootHtml.indexOf('</head>'));
  assert.ok(headHtml.includes("localStorage.getItem('hagilight-content-width')"));
  assert.ok(headHtml.includes('document.documentElement.dataset.hagilightContentWidth'));
  assert.ok(rootHtml.includes('This content was created with AI assistance.'));
  assert.ok(!rootHtml.includes('This post was translated with AI.'));
  assert.ok(!notFoundHtml.includes('This content was created with AI assistance.'));
  assert.ok(!notFoundHtml.includes('This post was translated with AI.'));

  const translationNotice = '本文由 AI 翻译。';
  assert.ok(!translatedHtml.includes('本文内容由 AI 辅助创作。'));
  assert.ok(translatedHtml.includes(translationNotice));
  assert.ok(translatedHtml.includes('href="/"'));
  assert.ok(translatedHtml.indexOf(translationNotice) > translatedHtml.indexOf('</div>'));
  const traditionalChineseHtml = readFileSync(join(temp, 'dist', 'zh-Hant', 'index.html'), 'utf8');
  assert.ok(traditionalChineseHtml.includes('本頁示範了覆寫'));
}

function verifySeoIntegration() {
  const english = readFileSync(join(temp, 'dist', 'index.html'), 'utf8');
  const blog = readFileSync(join(temp, 'dist', 'blog', 'rss-example', 'index.html'), 'utf8');
  const missingTranslation = readFileSync(join(temp, 'dist', 'rss-excluded', 'index.html'), 'utf8');
  const notFound = readFileSync(join(temp, 'dist', '404.html'), 'utf8');
  const head = english.slice(0, english.indexOf('</head>'));
  const canonicals = [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/gu)];
  assert.equal(canonicals.length, 1);
  assert.ok(canonicals[0][0].includes('href="https://hagistar.hagicode.com/"'));
  assert.ok(head.includes('property="og:title"'));
  assert.ok(head.includes('name="twitter:title"'));
  assert.ok(head.includes('rel="sitemap"'));
  assert.ok(head.includes('application/rss+xml'));
  assert.ok(english.includes('<h1 id="_top"'));

  const articleJsonLd = [...blog.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)]
    .map(([, json]) => JSON.parse(json));
  assert.ok(articleJsonLd.some(({ '@type': type }) => type === 'Article'));
  const availableLanguages = [...missingTranslation.matchAll(/<link\b[^>]*hreflang="([^"]+)"[^>]*>/gu)]
    .map(([, lang]) => lang);
  assert.deepEqual(availableLanguages, ['en-US', 'x-default']);
  assert.doesNotMatch(notFound, /<script type="application\/ld\+json">/u);
}

function verifyAnalyticsBuild() {
  const html = readFileSync(join(temp, 'dist', 'index.html'), 'utf8');
  const notFoundHtml = readFileSync(join(temp, 'dist', '404.html'), 'utf8');
  assert.equal(countOccurrences(html, 'googletagmanager.com/gtag/js?id=G-TEST123'), 1);
  assert.equal(countOccurrences(html, "gtag('config', measurementId)"), 1);
  assert.match(html, /measurementId\s*=\s*["']G-TEST123["']/u);
  assert.equal(countOccurrences(html, 'sdk.51.la/js-sdk-pro.min.js'), 1);
  assert.equal(countOccurrences(html, 'LA.init('), 1);
  assert.match(html, /siteId\s*=\s*["']test-site-51la["']/u);
  assert.ok(!notFoundHtml.includes('googletagmanager.com'));
  assert.ok(!notFoundHtml.includes("gtag('config',"));
  assert.equal(countOccurrences(notFoundHtml, 'LA.init('), 1);
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine an available port');
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return address.port;
}

async function fetchDevelopmentPage(astro) {
  const port = await availablePort();
  const server = spawn(process.execPath, [astro, 'dev', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: temp,
    stdio: 'ignore',
  });
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Astro dev server exited with status ${server.exitCode}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`);
        if (response.ok) return await response.text();
      } catch (error) {
        if (error.cause?.code !== 'ECONNREFUSED') throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Astro dev server did not become ready');
  } finally {
    if (server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await exited;
    }
  }
}

// Astro only compiles installed component packages that the consumer manifest
// declares, so each consumer lists its tarballs and registry packages explicitly.
function installConsumer(directory, dependencies, name = 'hagilight-installed-consumer') {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, private: true, type: 'module', dependencies }));
  execFileSync(npm, ['install', '--prefix', directory, '--no-audit', '--no-fund'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return join(directory, 'node_modules');
}

const tarballSpec = (path) => `file:${path}`;

function assertInstalled(nodeModules, { present = [], absent = [] }) {
  for (const name of present) {
    assert.ok(existsSync(join(nodeModules, ...name.split('/'))), `${name} must be installed`);
  }
  for (const name of absent) {
    assert.ok(!existsSync(join(nodeModules, ...name.split('/'))), `${name} must not be installed`);
  }
}

function typecheckConsumer(directory, fixtures) {
  const typesDirectory = join(directory, 'hagilight-types');
  mkdirSync(typesDirectory, { recursive: true });
  cpSync('test/types/tsconfig.json', join(typesDirectory, 'tsconfig.json'));
  for (const fixture of fixtures) cpSync(`test/types/${fixture}`, join(typesDirectory, fixture));
  execFileSync(process.execPath, [tsc, '-p', join(typesDirectory, 'tsconfig.json')], { stdio: 'inherit' });
}

function verifyCoreOnly(tarballs, astroVersion) {
  const coreOnly = join(temp, 'core-only');
  const nodeModules = installConsumer(coreOnly, {
    [CORE_PACKAGE]: tarballSpec(tarballs[CORE_PACKAGE]),
    astro: astroVersion,
  });
  assertInstalled(nodeModules, {
    present: [CORE_PACKAGE],
    absent: ['@hagicode/hagilight', '@hagicode/hagilight-starlight', '@astrojs/starlight'],
  });
  const manifest = JSON.parse(readFileSync(join(nodeModules, '@hagicode', 'hagilight-core', 'package.json'), 'utf8'));
  const specifiers = Object.entries(manifest.exports)
    .filter(([, target]) => typeof target === 'object')
    .map(([subpath]) => `${CORE_PACKAGE}/${subpath.slice(2)}`);
  writeFileSync(join(coreOnly, 'load-exports.mjs'), `
for (const specifier of ${JSON.stringify(specifiers)}) {
  const module = await import(specifier);
  if (Object.keys(module).length === 0) throw new Error(specifier + ' has no runtime exports');
}
const { resolveSiteLinks } = await import('${CORE_PACKAGE}/links');
if (!resolveSiteLinks('en-US').quick.some(({ id }) => id === 'sitemap')) throw new Error('core links are incomplete');
const { resolveFaviconHeadEntry } = await import('${CORE_PACKAGE}/favicon');
if (!resolveFaviconHeadEntry([])?.attrs.href.startsWith('data:image/x-icon;base64,')) throw new Error('core favicon is missing');
const { generateRssFeed } = await import('${CORE_PACKAGE}/rss');
const feed = await (await generateRssFeed({ site: 'https://example.test', title: 'Feed', description: 'Updates', items: [{ title: 'Post', link: '/post/' }] })).text();
if (!feed.includes('https://example.test/post/')) throw new Error('core RSS output is incomplete');
`);
  execFileSync(process.execPath, ['load-exports.mjs'], { cwd: coreOnly, stdio: 'inherit' });
  typecheckConsumer(coreOnly, ['core.ts']);
}

function verifyCoreFooter(tarballs, astroVersion) {
  const coreTemp = join(temp, 'astro-core');
  mkdirSync(coreTemp);
  cpSync('test/fixtures/core-footer/astro.config.mjs', join(coreTemp, 'astro.config.mjs'));
  cpSync('test/fixtures/core-footer/src', join(coreTemp, 'src'), { recursive: true });
  const nodeModules = installConsumer(coreTemp, {
    [CORE_PACKAGE]: tarballSpec(tarballs[CORE_PACKAGE]),
    astro: astroVersion,
  }, 'hagilight-core-footer-example');
  assertInstalled(nodeModules, {
    present: [CORE_PACKAGE],
    absent: ['@hagicode/hagilight', '@hagicode/hagilight-starlight', '@astrojs/starlight'],
  });
  typecheckConsumer(coreTemp, ['core.ts']);
  const astro = join(nodeModules, 'astro', 'bin', 'astro.mjs');
  execFileSync(process.execPath, [astro, 'build'], { cwd: coreTemp, stdio: 'inherit' });

  const englishHtml = readFileSync(join(coreTemp, 'dist', 'index.html'), 'utf8');
  const chineseHtml = readFileSync(join(coreTemp, 'dist', 'zh-CN', 'index.html'), 'utf8');
  const coreFeed = readFileSync(join(coreTemp, 'dist', 'rss.xml'), 'utf8');
  assert.ok(englishHtml.includes('Quick Links'));
  assert.ok(englishHtml.includes('Community'));
  assert.ok(!englishHtml.includes('Ecosystem Sites'));
  for (const [locale, html] of [['en-US', englishHtml], ['zh-CN', chineseHtml]]) {
    assert.ok(
      /<footer\b[^>]*class="hagilight-footer"/u.test(html),
      `${locale} page has the core Footer: ${html.slice(html.indexOf('<body'), html.indexOf('</body>') + 7)}`,
    );
    assert.equal([...html.matchAll(/application\/rss\+xml/gu)].length, 1);
  }
  assert.match(coreFeed, /<rss\b/u);
  assert.match(coreFeed, /<language>en-US<\/language>/u);
  assert.ok(coreFeed.includes('https://consumer.example.test/'));
  assert.ok(chineseHtml.includes('生态站点'));
  assert.ok(chineseHtml.includes('快速链接'));
  assert.ok(chineseHtml.includes('社区'));
  assert.ok(chineseHtml.includes('自有站点'));
  assert.ok(chineseHtml.includes('href="/news/"'));
  assert.ok(chineseHtml.includes('href="https://feeds.example/rss.xml"'));
  assert.ok(chineseHtml.includes('href="/install/"'));
  assert.match(
    chineseHtml,
    /href="https:\/\/community\.example\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/u,
  );
  assert.match(chineseHtml, /href="https:\/\/sites\.example\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/u);
  assert.ok(chineseHtml.includes('aria-label="查看备案信息"'));
  assert.ok(chineseHtml.includes(`© ${new Date().getFullYear()} HagiCode`));

  const css = readFileSync(join(nodeModules, '@hagicode', 'hagilight-core', 'Footer.astro'), 'utf8');
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fit/u);
  assert.match(css, /@media\s*\((?:max-width:\s*40rem|width\s*<=\s*40rem)\)/u);
  assert.match(css, /grid-template-columns:\s*1fr/u);
  assert.ok(css.includes(':focus-visible'), 'Footer links must retain a visible keyboard-focus style');
}

try {
  buildPackages();
  assertPackageGraph();
  const tarballs = {};
  for (const { name } of PACKAGES) {
    const output = execFileSync(npm, ['pack', '--json', '--ignore-scripts', '-w', name, '--pack-destination', temp], {
      cwd: root,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    tarballs[name] = join(temp, JSON.parse(output)[0].filename);
  }
  const example = JSON.parse(readFileSync('examples/demo-starlight-web/package.json', 'utf8'));
  verifyCoreOnly(tarballs, example.dependencies.astro);
  verifyCoreFooter(tarballs, example.dependencies.astro);
  const configPath = join(temp, 'astro.config.mjs');
  const enabledConfig = readFileSync('examples/demo-starlight-web/astro.config.mjs', 'utf8');
  writeFileSync(configPath, enabledConfig);
  cpSync('examples/demo-starlight-web/src', join(temp, 'src'), { recursive: true });
  cpSync('examples/demo-starlight-web/public', join(temp, 'public'), { recursive: true });
  const starlightModules = installConsumer(temp, {
    ...example.dependencies,
    [CORE_PACKAGE]: tarballSpec(tarballs[CORE_PACKAGE]),
    '@hagicode/hagilight-starlight': tarballSpec(tarballs['@hagicode/hagilight-starlight']),
  }, example.name);
  assertInstalled(starlightModules, {
    present: [CORE_PACKAGE, '@hagicode/hagilight-starlight', '@astrojs/starlight'],
    absent: ['@hagicode/hagilight'],
  });
  typecheckConsumer(temp, ['core.ts', 'starlight.ts']);
  const astro = join(temp, 'node_modules', 'astro', 'bin', 'astro.mjs');
  execFileSync(process.execPath, [astro, 'build'], { cwd: temp, stdio: 'inherit' });
  verifyBannerBuild(true);
  verifyDefaultLinksAndAnalytics();
  verifyContentFeatures();
  verifySeoIntegration();

  const disabledConfig = enabledConfig.replace('promoto: { enabled: true }', 'promoto: { enabled: false }');
  if (disabledConfig === enabledConfig) throw new Error('Example config does not explicitly enable the promotion banner');
  writeFileSync(configPath, disabledConfig);
  execFileSync(process.execPath, [astro, 'build'], { cwd: temp, stdio: 'inherit' });
  verifyBannerBuild(false);

  const analyticsConfig = withAnalyticsConfig(
    enabledConfig,
    "{ googleAnalytics: { measurementId: 'G-TEST123' }, fiftyOneLa: { siteId: 'test-site-51la' } }",
  );
  writeFileSync(configPath, analyticsConfig);
  execFileSync(process.execPath, [astro, 'build'], { cwd: temp, stdio: 'inherit' });
  verifyBannerBuild(true);
  verifyAnalyticsBuild();

  const developmentHtml = await fetchDevelopmentPage(astro);
  assert.ok(!developmentHtml.includes('googletagmanager.com'));
  assert.ok(!developmentHtml.includes('sdk.51.la'));
  assert.ok(!developmentHtml.includes('LA.init('));

  const customHeadConfig = withAnalyticsConfig(
    enabledConfig,
    '{ googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } }',
  )
    .replace(/        seo: \{\r?\n[\s\S]*?        \},\r?\n(?=        rss: \{)/u, '        seo: { enabled: false },\n')
    .replace('starlight({', "starlight({ components: { Head: './CustomHead.astro' },");
  if (customHeadConfig === enabledConfig) throw new Error('Could not prepare the consumer-owned Head fixture');
  writeFileSync(join(temp, 'CustomHead.astro'), `---
import DefaultHead from '@astrojs/starlight/components/Head.astro';
---

<DefaultHead />
<meta name="consumer-head" content="retained" />
`);
  writeFileSync(configPath, customHeadConfig);
  execFileSync(process.execPath, [astro, 'build'], { cwd: temp, stdio: 'inherit' });
  const customHeadHtml = readFileSync(join(temp, 'dist', 'index.html'), 'utf8');
  assert.ok(customHeadHtml.includes('name="consumer-head" content="retained"'));
  assert.doesNotMatch(customHeadHtml, /<script type="application\/ld\+json">/u);
  assert.ok(!customHeadHtml.includes('googletagmanager.com'));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
