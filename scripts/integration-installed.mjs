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

const temp = mkdtempSync(join(tmpdir(), 'hagilight-integration-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
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
    'https://hagilight.hagicode.com/rss.xml',
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
    assert.ok(feed.includes('https://hagilight.hagicode.com/'));
    assert.ok(feed.includes('https://hagilight.hagicode.com/blog/rss-example/'));
    assert.ok(!feed.includes('https://hagilight.hagicode.com/en-us/'));
    assert.match(html, /rel="alternate"[^>]*type="application\/rss\+xml"/u);
    assert.ok(!html.includes('https://hagilight.hagicode.com/rss.zh-CN.xml'));
    assert.ok(chineseHtml.includes('https://hagilight.hagicode.com/rss.zh-CN.xml'));
    assert.ok(!chineseHtml.includes('https://hagilight.hagicode.com/rss.en.xml'));
    const englishAlias = readFileSync(join(temp, 'dist', 'rss.en.xml'), 'utf8');
    const chineseFeed = readFileSync(join(temp, 'dist', 'rss.zh-CN.xml'), 'utf8');
    assert.equal(feed, englishAlias);
    assert.match(feed, /<language>en-US<\/language>/u);
    assert.match(chineseFeed, /<language>zh-CN<\/language>/u);
    assert.match(traditionalChineseFeed, /<language>zh-Hant<\/language>/u);
    assert.ok(traditionalChineseFeed.includes('https://hagilight.hagicode.com/zh-Hant/blog/rss-example/'));
    assert.ok(!feed.includes('Chinese RSS blog example'));
    assert.ok(!feed.includes('Excluded from RSS'));
    assert.ok(!feed.includes('RSS draft'));
    assert.ok(!chineseFeed.includes('English RSS blog example'));
    assert.ok(!chineseFeed.includes('Excluded from RSS'));
    assert.ok(!chineseFeed.includes('RSS draft'));
    assert.ok(chineseFeed.includes('https://hagilight.hagicode.com/zh-CN/blog/rss-example/'));
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

function verifyCoreFooter(tarball, astroVersion) {
  const coreTemp = join(temp, 'core-only');
  mkdirSync(coreTemp);
  writeFileSync(join(coreTemp, 'package.json'), JSON.stringify({
    name: 'hagilight-core-footer-example',
    private: true,
    type: 'module',
  }));
  cpSync('test/fixtures/core-footer/astro.config.mjs', join(coreTemp, 'astro.config.mjs'));
  cpSync('test/fixtures/core-footer/src', join(coreTemp, 'src'), { recursive: true });
  execFileSync(npm, ['install', '--prefix', coreTemp, '--no-save', tarball, `astro@${astroVersion}`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const nodeModules = join(coreTemp, 'node_modules');
  assert.ok(!existsSync(join(nodeModules, '@astrojs', 'starlight')), 'Core-only site must not install Starlight');
  const astro = join(nodeModules, 'astro', 'bin', 'astro.mjs');
  execFileSync(process.execPath, [astro, 'build'], { cwd: coreTemp, stdio: 'inherit' });

  const englishHtml = readFileSync(join(coreTemp, 'dist', 'index.html'), 'utf8');
  const chineseHtml = readFileSync(join(coreTemp, 'dist', 'zh-CN', 'index.html'), 'utf8');
  assert.ok(englishHtml.includes('Quick Links'));
  assert.ok(englishHtml.includes('Community'));
  assert.ok(!englishHtml.includes('Ecosystem Sites'));
  assert.ok(!englishHtml.includes('rss.xml'));
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

  const assets = join(coreTemp, 'dist', '_astro');
  const css = [
    ...[englishHtml, chineseHtml].flatMap((html) => [
      ...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gu),
    ].map(([, style]) => style)),
    ...(existsSync(assets)
      ? listFiles(assets)
        .filter((path) => path.endsWith('.css'))
        .map((path) => readFileSync(path, 'utf8'))
      : []),
  ]
    .join('\n');
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fit/u);
  assert.match(css, /@media\s*\((?:max-width:\s*40rem|width\s*<=\s*40rem)\)/u);
  assert.match(css, /grid-template-columns:\s*1fr/u);
  assert.ok(css.includes(':focus-visible'), 'Footer links must retain a visible keyboard-focus style');
}

try {
  const tarballs = [];
  for (const workspace of ['@hagicode/hagilight', '@hagicode/hagilight-starlight']) {
    const output = execFileSync(npm, ['pack', '--json', '-w', workspace, '--pack-destination', temp], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    tarballs.push(join(temp, JSON.parse(output)[0].filename));
  }
  const example = JSON.parse(readFileSync('examples/starlight/package.json', 'utf8'));
  verifyCoreFooter(tarballs[0], example.dependencies.astro);
  const configPath = join(temp, 'astro.config.mjs');
  const enabledConfig = readFileSync('examples/starlight/astro.config.mjs', 'utf8');
  cpSync('examples/starlight/package.json', join(temp, 'package.json'));
  writeFileSync(configPath, enabledConfig);
  cpSync('examples/starlight/src', join(temp, 'src'), { recursive: true });
  cpSync('examples/starlight/public', join(temp, 'public'), { recursive: true });
  execFileSync(npm, ['install', '--prefix', temp, '--no-save', ...tarballs,
    `astro@${example.dependencies.astro}`, `@astrojs/starlight@${example.dependencies['@astrojs/starlight']}`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
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

  const analyticsConfig = enabledConfig.replace(
    'hagilight({',
    "hagilight({ analytics: { googleAnalytics: { measurementId: 'G-TEST123' }, fiftyOneLa: { siteId: 'test-site-51la' } },",
  );
  if (analyticsConfig === enabledConfig) throw new Error('Example config does not contain the Hagilight plugin');
  writeFileSync(configPath, analyticsConfig);
  execFileSync(process.execPath, [astro, 'build'], { cwd: temp, stdio: 'inherit' });
  verifyBannerBuild(true);
  verifyAnalyticsBuild();

  const developmentHtml = await fetchDevelopmentPage(astro);
  assert.ok(!developmentHtml.includes('googletagmanager.com'));
  assert.ok(!developmentHtml.includes('sdk.51.la'));
  assert.ok(!developmentHtml.includes('LA.init('));

  const seoSetting = `        seo: {
          enabled: true,
          image: '/share-card.svg',
          organization: {
            name: 'Hagilight',
            url: 'https://hagilight.hagicode.com/',
          },
        },
`;
  if (!enabledConfig.includes(seoSetting)) throw new Error('Example config does not contain its SEO defaults');
  const customHeadConfig = enabledConfig
    .replace(seoSetting, '        seo: { enabled: false },\n')
    .replace(
      'hagilight({',
      'hagilight({ analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } },',
    )
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
