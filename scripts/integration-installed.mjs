import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
  for (const link of [
    'https://www.hagicode.com/en-US/',
    'https://www.hagicode.com/en-US/desktop/',
    'https://apps.microsoft.com/detail/9N3PM0N3SVDW',
    'https://www.hagicode.com/en-US/about/',
    'https://docs.hagicode.com/en-US/blog/',
    'https://github.com/HagiCode-org/site',
    'https://discord.gg/qY662sJK',
    'https://github.com/HagiCode-org/site/issues',
    'mailto:support@hagicode.com',
    'https://qm.qq.com/q/Fwb0o094kw',
    'https://cost.hagicode.com',
    'https://docs.hagicode.com/en-US/installation/docker-compose/',
    'https://docs.hagicode.com/en-US/product-overview/',
    'https://docs.hagicode.com/blog/rss.en-US.xml',
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
  assert.ok(!html.includes('store.steampowered.com'));
  assert.ok(html.includes('Quick links'));
  assert.ok(html.includes('<h2') && html.includes('>Community</h2>'));
  assert.ok(!html.includes('hagilight-site-description'));
  assert.match(
    html,
    /href="https:\/\/github\.com\/HagiCode-org\/site"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/u,
  );
  assert.ok(html.includes('googletagmanager.com/gtag/js?id=G-EN03FMT2Q4'));
  assert.ok(html.includes("gtag('config', measurementId)"));
  assert.ok(html.includes('sdk.51.la/js-sdk-pro.min.js'));
  assert.ok(html.includes('L6b88a5yK4h2Xnci'));
}

function verifyContentFeatures() {
  const rootHtml = readFileSync(join(temp, 'dist', 'index.html'), 'utf8');
  const translatedHtml = readFileSync(join(temp, 'dist', 'en-us', 'index.html'), 'utf8');
  const notFoundHtml = readFileSync(join(temp, 'dist', '404.html'), 'utf8');

  assert.match(rootHtml, /data-hagilight-content-width-choice="wide"/u);
  assert.match(rootHtml, /data-hagilight-content-width-choice="narrow"/u);
  assert.match(rootHtml, /aria-label="内容宽度"/u);
  assert.match(rootHtml, /hagilight-content-width/u);
  const headHtml = rootHtml.slice(0, rootHtml.indexOf('</head>'));
  assert.ok(headHtml.includes("localStorage.getItem('hagilight-content-width')"));
  assert.ok(headHtml.includes('document.documentElement.dataset.hagilightContentWidth'));
  assert.ok(!rootHtml.includes('本文内容由 AI 辅助创作。'));
  assert.ok(!rootHtml.includes('This post was translated with AI.'));
  assert.ok(!notFoundHtml.includes('This content was created with AI assistance.'));
  assert.ok(!notFoundHtml.includes('This post was translated with AI.'));

  const authorNotice = 'This content was created with AI assistance.';
  const translationNotice = 'This post was translated with AI.';
  assert.ok(translatedHtml.includes(authorNotice));
  assert.ok(translatedHtml.includes(translationNotice));
  assert.ok(translatedHtml.includes('href="/"'));
  assert.ok(translatedHtml.indexOf(authorNotice) < translatedHtml.indexOf('<div class="sl-markdown-content">'));
  assert.ok(translatedHtml.indexOf(translationNotice) > translatedHtml.indexOf('</div>'));
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
  const configPath = join(temp, 'astro.config.mjs');
  const enabledConfig = readFileSync('examples/starlight/astro.config.mjs', 'utf8');
  cpSync('examples/starlight/package.json', join(temp, 'package.json'));
  writeFileSync(configPath, enabledConfig);
  cpSync('examples/starlight/src', join(temp, 'src'), { recursive: true });
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
} finally {
  rmSync(temp, { recursive: true, force: true });
}
