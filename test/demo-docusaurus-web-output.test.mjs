import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultLocale, locales } from '../packages/docusaurus/dist/locales.js';
import { verifyBuildInfo } from '../scripts/build-info-assertions.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const variants = join(root, 'examples/demo-docusaurus-web/node_modules/.hagilight-variants');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const siteUrl = 'https://docusaurus.hagicode.com';
const pluginVersion = JSON.parse(readFileSync(join(root, 'packages/docusaurus/package.json'), 'utf8')).version;

function buildExample(outDir, analytics) {
  rmSync(outDir, { recursive: true, force: true });
  execFileSync(npm, ['run', 'build', '-w', 'hagilight-docusaurus-example', '--', '--out-dir', outDir], {
    cwd: root,
    env: { ...process.env, HAGILIGHT_DEMO_ANALYTICS: analytics },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
  return outDir;
}

const enabledDist = buildExample(join(variants, 'docusaurus-test'), 'on');
const disabledDist = buildExample(join(variants, 'analytics-off'), 'off');

const dirOf = (locale) => (locale === defaultLocale ? '' : `${locale}/`);
const read = (dist, file) => readFileSync(join(dist, file), 'utf8');
const headOf = (html) => html.slice(0, html.indexOf('</head>'));
const withoutReactComments = (html) => html.replaceAll('<!-- -->', '');

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function metaTags(html, attribute) {
  return [...html.matchAll(new RegExp(`<meta\\b[^>]*${attribute}[^>]*>`, 'gu'))].map(([tag]) => tag);
}

test('every locale home shows build info and the home pages carry canonical and hreflang metadata', () => {
  const linkValues = (head, attribute, rel) => [...head.matchAll(new RegExp(`<link\\b([^>]*\\brel="${rel}"[^>]*)>`, 'gu'))]
    .map(([, attrs]) => attrs.match(new RegExp(`\\b${attribute}="([^"]*)"`, 'u'))?.[1])
    .filter(Boolean);
  for (const locale of locales) verifyBuildInfo(read(enabledDist, `${dirOf(locale)}index.html`), `${locale} Docusaurus home`);
  const english = headOf(read(enabledDist, 'index.html'));
  assert.deepEqual(linkValues(english, 'hreflang', 'alternate').sort(), [...locales, 'x-default'].sort());
  assert.deepEqual(linkValues(english, 'href', 'canonical'), ['https://docusaurus.hagicode.com/']);
  assert.deepEqual(
    linkValues(headOf(read(enabledDist, 'zh-CN/index.html')), 'href', 'canonical'),
    ['https://docusaurus.hagicode.com/zh-CN/'],
  );
});

test('every locale home renders the footer with attribution for this plugin version', () => {
  for (const locale of locales) {
    const html = read(enabledDist, `${dirOf(locale)}index.html`);
    const footer = html.match(/<footer\b[\s\S]*?<\/footer>/u)?.[0];
    assert.ok(footer, `${locale} renders a footer`);
    assert.ok(footer.includes('hagilight-footer__copyright'), `${locale} footer has the copyright`);
    assert.ok(footer.includes('hagilight-footer__sections'), `${locale} footer has the link sections`);
    assert.ok(footer.includes('hagilight-footer__filings'), `${locale} footer has the filings`);
    assert.equal(
      withoutReactComments(footer).split(`Powered By hagilight-docusaurus@${pluginVersion}`).length - 1,
      1,
      `${locale} footer has exactly one attribution line`,
    );
  }
});

test('production head loads Google Analytics and 51LA with their configured ids', () => {
  const html = read(enabledDist, 'index.html');
  assert.ok(html.includes('https://www.googletagmanager.com/gtag/js?id=G-EN03FMT2Q4'), 'Google Analytics loads with its measurement id');
  assert.ok(html.includes('https://sdk.51.la/js-sdk-pro.min.js'), 'the 51LA SDK loads');
  assert.ok(html.includes('L6b88a5yK4h2Xnci'), 'the 51LA id is configured');
});

test('analytics disabled emits no tracker loader or analytics id in any page script or bundle', () => {
  const emitted = filesUnder(disabledDist).filter((file) => /\.(?:html|js)$/u.test(file));
  assert.ok(emitted.length > 0, 'the disabled build emits pages');
  for (const file of emitted) {
    const text = readFileSync(file, 'utf8');
    const name = relative(disabledDist, file);
    assert.doesNotMatch(text, /googletagmanager\.com\/gtag\/js|sdk\.51\.la\//u, `${name} loads no analytics script`);
    for (const [, body] of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gu)) {
      assert.ok(
        !body.includes('G-EN03FMT2Q4') && !body.includes('L6b88a5yK4h2Xnci'),
        `${name} script carries no analytics id`,
      );
    }
  }
});

test('client bundle mounts the promote banner', () => {
  const bundles = filesUnder(join(enabledDist, 'assets/js')).filter((file) => file.endsWith('.js'));
  assert.ok(bundles.some((file) => readFileSync(file, 'utf8').includes('hagilight-promoto-banner')));
});

test('every locale tree is emitted with the default locale at the root', () => {
  for (const locale of locales) {
    const dir = dirOf(locale);
    assert.ok(existsSync(join(enabledDist, `${dir}index.html`)), `${locale} home is emitted`);
    assert.ok(existsSync(join(enabledDist, `${dir}docs/features/index.html`)), `${locale} docs are emitted`);
  }
});

test('each locale sitemap lists only its own routes and omits the 404 page', () => {
  const localeDirs = locales.map(dirOf);
  for (const locale of locales) {
    const dir = dirOf(locale);
    const locs = [...read(enabledDist, `${dir}sitemap.xml`).matchAll(/<loc>([^<]+)<\/loc>/gu)].map(([, loc]) => loc);
    assert.ok(locs.length > 0, `${locale} sitemap lists routes`);
    const foreign = localeDirs.filter((other) => other !== dir && other !== '');
    for (const loc of locs) {
      assert.ok(loc.startsWith(`${siteUrl}/${dir}`), `${locale} sitemap entry ${loc} stays in its locale`);
      assert.ok(!foreign.some((other) => loc.startsWith(`${siteUrl}/${other}`)), `${locale} sitemap entry ${loc} is not foreign`);
      assert.doesNotMatch(loc, /\/404(?:\.html)?\/?$/u, `${locale} sitemap omits the 404 page`);
    }
  }
});

test('robots.txt lists the sitemap of every locale', () => {
  const lines = read(enabledDist, 'robots.txt').split('\n');
  assert.ok(lines.includes('Allow: /'));
  for (const locale of locales) {
    assert.ok(lines.includes(`Sitemap: ${siteUrl}/${dirOf(locale)}sitemap.xml`), `robots.txt lists ${locale}`);
  }
});

test('rss feeds for English and Chinese have items and their language', () => {
  for (const [file, language] of [['rss.xml', 'en-US'], ['zh-CN/rss.xml', 'zh-CN']]) {
    const xml = read(enabledDist, file);
    assert.match(xml, /^<\?xml/u, `${file} is XML`);
    assert.match(xml, /<rss\b[\s\S]*<\/rss>\s*$/u, `${file} is a complete RSS document`);
    assert.ok(xml.includes(`<language>${language}</language>`), `${file} declares ${language}`);
    const items = xml.match(/<item>/gu)?.length ?? 0;
    assert.ok(items > 0, `${file} has items`);
    assert.equal(xml.match(/<\/item>/gu)?.length, items, `${file} closes every item`);
  }
  assert.match(read(enabledDist, 'blog/rss.xml'), /<rss\b/u);
});

test('home page advertises both feeds and parses its organization structured data', () => {
  const html = read(enabledDist, 'index.html');
  const feeds = [...headOf(html).matchAll(/<link\b[^>]*application\/rss\+xml[^>]*>/gu)]
    .map(([tag]) => tag.match(/href="([^"]+)"/u)[1]);
  assert.ok(feeds.includes('/blog/rss.xml'), 'the blog feed is advertised');
  assert.ok(feeds.includes(`${siteUrl}/rss.xml`), 'the site feed is advertised');

  const structured = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)]
    .map(([, json]) => JSON.parse(json));
  const organization = structured.find((item) => item['@type'] === 'Organization');
  assert.ok(organization, 'the home page has Organization JSON-LD');
  assert.equal(organization.name, 'HagiCode');
});

test('blog post has exactly one og:image and it is the blog card', () => {
  const html = read(enabledDist, 'blog/introducing-hagilight-docusaurus/index.html');
  const images = metaTags(html, 'property="og:image"');
  assert.equal(images.length, 1, 'one og:image');
  assert.ok(images[0].includes(`${siteUrl}/img/blog-card.png`), 'the og:image is the blog card');
  const twitterImages = metaTags(html, 'name="twitter:image"');
  assert.equal(twitterImages.length, 1, 'one twitter:image');
  assert.ok(twitterImages[0].includes(`${siteUrl}/img/blog-card.png`), 'the twitter:image is the blog card');
});

test('every locale home, docs page, and blog post shows one branch, commit, and build-time span after the attribution, and each locale build shares one time', () => {
  for (const locale of locales) {
    const pages = [`${dirOf(locale)}index.html`, `${dirOf(locale)}docs/features/index.html`];
    if (locale === defaultLocale) pages.push('blog/introducing-hagilight-docusaurus/index.html');
    const builtAt = new Set();
    for (const page of pages) {
      const html = read(enabledDist, page);
      const footer = html.match(/<footer\b[\s\S]*?<\/footer>/u)?.[0];
      assert.ok(footer, `${page} renders a footer`);
      for (const field of ['branch', 'commit', 'builtAt']) {
        assert.equal(footer.split(`data-build-field="${field}"`).length - 1, 1, `${page} has one ${field} span`);
      }
      assert.ok(
        footer.indexOf('hagilight-footer__attribution') < footer.indexOf('data-build-field="branch"'),
        `${page} shows the build spans after the attribution`,
      );
      const time = footer.match(/<time\b[^>]*datetime="([^"]+)"/iu)?.[1];
      assert.match(time ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u, `${page} has a UTC build time`);
      builtAt.add(time);
    }
    assert.equal(builtAt.size, 1, `${locale} pages share one build time`);
  }
});
