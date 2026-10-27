import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const discovery = await import(new URL('../packages/docusaurus/dist/discovery.js', import.meta.url).href);
const { hagilightDocusaurus } = await import(new URL('../packages/docusaurus/dist/index.js', import.meta.url).href);
const { resolveOptions } = await import(new URL('../packages/docusaurus/dist/options.js', import.meta.url).href);

const roots = [];
after(async () => {
  await Promise.all(roots.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'hagilight-discovery-'));
  roots.push(dir);
  return dir;
}

async function exists(path) {
  return access(path).then(() => true, () => false);
}

const i18n = {
  defaultLocale: 'en-US',
  locales: ['en-US', 'zh-CN'],
  currentLocale: 'en-US',
  path: 'i18n',
  localeConfigs: {
    'en-US': { label: 'English', htmlLang: 'en-US', direction: 'ltr', baseUrl: '/' },
    'zh-CN': { label: '简体中文', htmlLang: 'zh-CN', direction: 'ltr', baseUrl: '/zh-CN/' },
  },
};
const zh = { i18n: { ...i18n, currentLocale: 'zh-CN' }, baseUrl: '/zh-CN/' };

function site(siteDir, overrides = {}) {
  return {
    title: 'HagiCode',
    tagline: 'Docs for HagiCode',
    url: 'https://example.com',
    baseUrl: '/',
    siteDir,
    i18n,
    ...overrides,
  };
}

function reporter() {
  const messages = { warn: [], info: [] };
  return {
    messages,
    report: { warn: (message) => messages.warn.push(message), info: (message) => messages.info.push(message) },
  };
}

const BUILD_INFO = { branch: 'main', commit: 'a1b2c3d4e5f6071829304a5b6c7d8e9f01234567', builtAt: '2026-10-17T08:12:34Z' };

async function run({ options = {}, siteOverrides = {}, outDir, siteDir, production = true, plugins = [], routesPaths = ['/'], routesBuildMetadata = {}, feedItems = [] } = {}) {
  const resolvedSiteDir = siteDir ?? (await tempDir());
  const resolvedOutDir = outDir ?? (await tempDir());
  const { messages, report } = reporter();
  await discovery.writeDiscoveryOutputs({
    options: resolveOptions(options),
    site: site(resolvedSiteDir, siteOverrides),
    generatorVersion: '0.1.0',
    buildInfo: BUILD_INFO,
    outDir: resolvedOutDir,
    production,
    plugins,
    routesPaths,
    routesBuildMetadata,
    feedItems,
    report,
  });
  return messages;
}

const METADATA = '.well-known/hagilight.metadata.json';
async function readMetadata(outDir) {
  return JSON.parse(await readFile(join(outDir, METADATA), 'utf8'));
}

const doc = (title, permalink, extra = {}) => ({ title, permalink, description: `About ${title}`, ...extra });
const post = (title, permalink, extra = {}) => ({
  id: title,
  metadata: { title, permalink, description: `About ${title}`, date: new Date('2026-10-01T00:00:00Z'), ...extra },
});
const docsContent = (docs) => ({
  'docusaurus-plugin-content-docs': {
    default: {
      loadedVersions: [
        { versionName: 'current', isLast: true, docs },
        { versionName: '1.0', isLast: false, docs: [doc('Old', '/docs/1.0/old')] },
      ],
    },
  },
});
const blogContent = (blogPosts) => ({ 'docusaurus-plugin-content-blog': { default: { blogPosts } } });
const rss = (overrides = {}) => ({ enabled: true, includeDocs: true, includeBlog: true, ...overrides });

test('sitemap, robots, and RSS default on and switch off independently', () => {
  const defaults = resolveOptions();
  assert.equal(defaults.sitemap, true);
  assert.equal(defaults.robots, true);
  assert.deepEqual(defaults.rss, { enabled: true, includeDocs: true, includeBlog: true });

  const off = resolveOptions({ sitemap: { enabled: false }, rss: { includeBlog: false } });
  assert.equal(off.sitemap, false);
  assert.equal(off.robots, true);
  assert.deepEqual(off.rss, { enabled: true, includeDocs: true, includeBlog: false });
});

test('the official sitemap plugin keeps the fallback sitemap out of the build', async () => {
  const outDir = await tempDir();
  await run({ outDir, plugins: [{ name: 'docusaurus-plugin-sitemap' }] });
  assert.equal(await exists(join(outDir, 'sitemap.xml')), false);
});

test('the fallback sitemap lists indexable routes with absolute URLs', async () => {
  const outDir = await tempDir();
  await run({
    outDir,
    routesPaths: ['/', '/docs/intro', '/404.html', '/private'],
    routesBuildMetadata: { '/private': { noIndex: true } },
  });
  const xml = await readFile(join(outDir, 'sitemap.xml'), 'utf8');
  assert.deepEqual(
    [...xml.matchAll(/<loc>(.*?)<\/loc>/gu)].map((match) => match[1]),
    ['https://example.com/', 'https://example.com/docs/intro'],
  );
});

test('a localized sitemap omits its own 404 page and keeps ordinary routes named 404', async () => {
  const outDir = await tempDir();
  await run({
    outDir,
    siteOverrides: zh,
    routesPaths: ['/zh-CN/', '/zh-CN/404.html', '/zh-CN/docs/404'],
  });
  const xml = await readFile(join(outDir, 'sitemap.xml'), 'utf8');
  assert.deepEqual(
    [...xml.matchAll(/<loc>(.*?)<\/loc>/gu)].map((match) => match[1]),
    ['https://example.com/zh-CN/', 'https://example.com/zh-CN/docs/404'],
  );
});

test('the fallback sitemap is skipped outside production, when disabled, and under noIndex', async () => {
  for (const [name, args] of [
    ['development', { production: false }],
    ['disabled', { options: { sitemap: { enabled: false } } }],
    ['noIndex', { options: { noIndex: true } }],
  ]) {
    const outDir = await tempDir();
    await run({ outDir, ...args });
    assert.equal(await exists(join(outDir, 'sitemap.xml')), false, name);
  }
});

test('robots.txt is written by the default locale build with a sitemap per locale', async () => {
  const outDir = await tempDir();
  await run({ outDir });
  assert.equal(
    await readFile(join(outDir, 'robots.txt'), 'utf8'),
    'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\nSitemap: https://example.com/zh-CN/sitemap.xml\n',
  );
});

test('a non-default locale build leaves robots.txt to the default build and warns when it is missing', async () => {
  const root = await tempDir();
  const zhOut = join(root, 'zh-CN');
  await mkdir(zhOut);

  const missing = await run({ outDir: zhOut, siteOverrides: zh });
  assert.equal(await exists(join(zhOut, 'robots.txt')), false);
  // The metadata file also warns in a non-default build; this test is about robots.txt only.
  const robotsWarnings = missing.warn.filter((message) => /robots\.txt/u.test(message));
  assert.equal(robotsWarnings.length, 1);
  assert.match(robotsWarnings[0], /default locale/u);

  await writeFile(join(root, 'robots.txt'), 'User-agent: *\n');
  const present = await run({ outDir: zhOut, siteOverrides: zh });
  assert.equal(present.warn.some((message) => /robots\.txt/u.test(message)), false);
});

test('a site-owned static/robots.txt takes precedence over the generated file', async () => {
  const siteDir = await tempDir();
  await mkdir(join(siteDir, 'static'));
  await writeFile(join(siteDir, 'static', 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  const outDir = await tempDir();
  const messages = await run({ siteDir, outDir });
  assert.equal(await exists(join(outDir, 'robots.txt')), false);
  assert.deepEqual(messages.warn, []);
});

test('RSS maps the current docs version and blog posts, skipping drafts and unlisted entries', () => {
  const allContent = {
    ...docsContent([
      doc('Intro', '/docs/intro', { lastUpdatedAt: Date.UTC(2026, 9, 2) }),
      doc('Hidden', '/docs/hidden', { unlisted: true }),
      doc('Draft', '/docs/draft', { draft: true }),
    ]),
    ...blogContent([
      post('Launch', '/blog/launch'),
      post('Hidden post', '/blog/hidden', { unlisted: true }),
      post('Draft post', '/blog/draft', { draft: true }),
    ]),
  };
  const { report } = reporter();
  const items = discovery.collectFeedItems(allContent, site('/unused'), rss(), report);

  assert.deepEqual(items.map((item) => item.title), ['Launch', 'Intro']);
  assert.equal(items[0].link, 'https://example.com/blog/launch');
  assert.equal(items[0].description, 'About Launch');
  assert.deepEqual(items[0].date, new Date('2026-10-01T00:00:00Z'));
  assert.equal(items[1].date, Date.UTC(2026, 9, 2));
});

test('RSS include options drop their content source', () => {
  const allContent = {
    ...docsContent([doc('Intro', '/docs/intro')]),
    ...blogContent([post('Launch', '/blog/launch')]),
  };
  const { report } = reporter();
  const site0 = site('/unused');
  assert.deepEqual(
    discovery.collectFeedItems(allContent, site0, rss({ includeDocs: false }), report).map((item) => item.title),
    ['Launch'],
  );
  assert.deepEqual(
    discovery.collectFeedItems(allContent, site0, rss({ includeBlog: false }), report).map((item) => item.title),
    ['Intro'],
  );
  assert.deepEqual(discovery.collectFeedItems(allContent, site0, rss({ enabled: false }), report), []);
});

test('RSS is written with the locale language tag', async () => {
  const outDir = join(await tempDir(), 'zh-CN');
  await mkdir(outDir, { recursive: true });
  await run({
    outDir,
    siteOverrides: zh,
    feedItems: [{ title: 'Launch', link: 'https://example.com/zh-CN/blog/launch', description: 'About' }],
  });
  const xml = await readFile(join(outDir, 'rss.xml'), 'utf8');
  assert.match(xml, /<language>zh-CN<\/language>/u);
  assert.match(xml, /<title>Launch<\/title>/u);
});

test('RSS is skipped with a message when there is no content, and when the site owns rss.xml', async () => {
  const outDir = await tempDir();
  const empty = await run({ outDir, feedItems: [] });
  assert.equal(await exists(join(outDir, 'rss.xml')), false);
  assert.equal(empty.info.filter((message) => /RSS feed/u.test(message)).length, 1);

  const siteDir = await tempDir();
  await mkdir(join(siteDir, 'static'));
  await writeFile(join(siteDir, 'static', 'rss.xml'), '<rss version="2.0"/>');
  const owned = await run({
    siteDir,
    outDir,
    feedItems: [{ title: 'Launch', link: 'https://example.com/blog/launch' }],
  });
  assert.equal(await exists(join(outDir, 'rss.xml')), false);
  // The first run already wrote the metadata file into this output, so the owned RSS check only
  // concerns rss.xml: no RSS message is expected, and the metadata file is kept as written.
  assert.equal(owned.info.filter((message) => /rss/iu.test(message)).length, 0);
});

test('unexpected content shapes degrade to warnings instead of failing the build', () => {
  const first = reporter();
  const items = discovery.collectFeedItems(
    {
      'docusaurus-plugin-content-docs': { default: { loadedVersions: 'nope' } },
      'docusaurus-plugin-content-blog': 'unexpected',
    },
    site('/unused'),
    rss(),
    first.report,
  );
  assert.deepEqual(items, []);
  assert.equal(first.messages.warn.length, 2);

  const second = reporter();
  const partial = discovery.collectFeedItems(
    {
      'docusaurus-plugin-content-blog': {
        default: { blogPosts: [{ metadata: { description: 'no title' } }, post('Ok', '/blog/ok')] },
      },
    },
    site('/unused'),
    rss({ includeDocs: false }),
    second.report,
  );
  assert.deepEqual(partial.map((item) => item.title), ['Ok']);
  assert.match(second.messages.warn[0], /1 blog entries/u);
});

test('the feed link is injected only when a feed is written or site-owned', () => {
  assert.deepEqual(discovery.feedHeadTags(site('/unused'), rss(), 0), []);
  assert.deepEqual(discovery.feedHeadTags(site('/unused'), rss({ enabled: false }), 3), []);
  assert.deepEqual(discovery.feedHeadTags(site('/unused', { baseUrl: '/zh-CN/' }), rss(), 2), [
    {
      tagName: 'link',
      attributes: {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: 'HagiCode',
        href: 'https://example.com/zh-CN/rss.xml',
      },
    },
  ]);
});

test('noIndex also skips robots.txt', async () => {
  const outDir = await tempDir();
  await run({ outDir, options: { noIndex: true } });
  assert.equal(await exists(join(outDir, 'robots.txt')), false);
});

test('a site without docs or blog plugins yields no feed items and no warnings', () => {
  const { messages, report } = reporter();
  assert.deepEqual(discovery.collectFeedItems({}, site('/unused'), rss(), report), []);
  assert.deepEqual(messages.warn, []);
});

test('the plugin lifecycle captures feed items, writes outputs in postBuild, and injects the feed link', async () => {
  const siteDir = await tempDir();
  const outDir = await tempDir();
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const plugin = hagilightDocusaurus({})({
      siteDir,
      siteConfig: {
        title: 'HagiCode',
        tagline: 'Docs',
        url: 'https://example.com',
        baseUrl: '/',
        themeConfig: { image: 'img/social.png' },
      },
      i18n,
      baseUrl: '/',
    });
    plugin.allContentLoaded({ allContent: blogContent([post('Launch', '/blog/launch')]) });
    const { headTags } = plugin.injectHtmlTags({ content: undefined });
    assert.ok(headTags.some((tag) => tag.tagName === 'link' && tag.attributes?.href === 'https://example.com/rss.xml'));

    await plugin.postBuild({
      outDir,
      plugins: [],
      routesPaths: ['/', '/blog/launch'],
      routesBuildMetadata: {},
    });
    assert.match(await readFile(join(outDir, 'rss.xml'), 'utf8'), /<title>Launch<\/title>/u);
    assert.match(await readFile(join(outDir, 'sitemap.xml'), 'utf8'), /https:\/\/example\.com\/blog\/launch/u);
    assert.match(await readFile(join(outDir, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example\.com\/sitemap\.xml/u);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});

test('the metadata file is written last, lists the discovery artifacts present, and reports production analytics', async () => {
  const outDir = await tempDir();
  await run({ outDir, feedItems: [{ title: 'Post', link: 'https://example.com/post/' }] });
  const metadata = await readMetadata(outDir);
  assert.equal(metadata.schemaVersion, 1);
  assert.equal(metadata.generator.name, '@hagicode/hagilight-docusaurus');
  assert.equal(metadata.generator.version, '0.1.0');
  assert.deepEqual(metadata.site, {
    name: 'HagiCode',
    url: 'https://example.com/',
    base: '/',
    description: 'Docs for HagiCode',
  });
  assert.deepEqual(metadata.languages, {
    default: 'en-US',
    locales: [
      { code: 'en-US', lang: 'en-US', path: '/' },
      { code: 'zh-CN', lang: 'zh-CN', path: '/zh-CN/' },
    ],
  });
  assert.deepEqual(metadata.build, BUILD_INFO);
  assert.deepEqual(metadata.discovery, { sitemap: '/sitemap.xml', robots: '/robots.txt', rss: '/rss.xml' });
  assert.deepEqual(metadata.analytics, { googleAnalytics: true, fiftyOneLa: true, posthog: true });
  assert.deepEqual(metadata.features, { seo: true, promoto: true, consent: true });
});

test('metadata options override the name and description, and metadata: false writes nothing', async () => {
  const outDir = await tempDir();
  await run({ outDir, options: { metadata: { name: 'Docs Hub', description: 'Manual description' } } });
  const metadata = await readMetadata(outDir);
  assert.equal(metadata.site.name, 'Docs Hub');
  assert.equal(metadata.site.description, 'Manual description');

  const off = await tempDir();
  await run({ outDir: off, options: { metadata: false } });
  assert.equal(await exists(join(off, METADATA)), false);
});

test('analytics flags are false outside production builds, and no analytics identifiers are written', async () => {
  const outDir = await tempDir();
  await run({ outDir, production: false });
  const metadata = await readMetadata(outDir);
  assert.deepEqual(metadata.analytics, { googleAnalytics: false, fiftyOneLa: false, posthog: false });
  const serialized = await readFile(join(outDir, METADATA), 'utf8');
  for (const secret of ['G-EN03FMT2Q4', 'L6b88a5yK4h2Xnci', 'phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5']) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test('a non-default locale build skips the metadata file and warns when the default build has none', async () => {
  const root = await tempDir();
  const zhOut = join(root, 'zh-CN');
  await mkdir(zhOut);
  const missing = await run({ outDir: zhOut, siteOverrides: zh });
  assert.equal(await exists(join(zhOut, METADATA)), false);
  assert.ok(missing.warn.some((message) => /hagilight\.metadata\.json is written only by the default locale build/u.test(message)));

  await mkdir(join(root, '.well-known'));
  await writeFile(join(root, METADATA), '{}\n');
  const present = await run({ outDir: zhOut, siteOverrides: zh });
  assert.equal(await exists(join(zhOut, METADATA)), false);
  assert.equal(present.warn.some((message) => message.includes(METADATA)), false);
});

test('a site-owned static/.well-known metadata file is kept untouched', async () => {
  const siteDir = await tempDir();
  await mkdir(join(siteDir, 'static', '.well-known'), { recursive: true });
  await writeFile(join(siteDir, 'static', METADATA), '{"site":"owned"}\n');
  const outDir = await tempDir();
  const messages = await run({ outDir, siteDir });
  assert.equal(await exists(join(outDir, METADATA)), false);
  assert.ok(messages.info.some((message) => /already exists.*untouched/u.test(message)));
});
