import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hagilightRss } from '@hagicode/hagilight/integration';
import { renderRssFeed } from '../packages/astro/dist/rss-runtime.js';
import hagilightStarlight from '@hagicode/hagilight-starlight';

const fixtureRoot = new URL('./fixtures/core-rss-integration/', import.meta.url);
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const baseLocales = {
  root: { label: 'English', lang: 'en-US' },
  'zh-CN': { label: '简体中文', lang: 'zh-CN' },
};

function makeSetup({
  root = fixtureRoot,
  locales = baseLocales,
  getFeed = './rss-feed.mjs',
  base = '/manual/',
  site = 'https://example.test',
  integrations,
} = {}) {
  const integration = hagilightRss({ locales, getFeed });
  const routes = [];
  const middlewares = [];
  const updated = [];
  integration.hooks['astro:config:setup']({
    config: {
      root,
      srcDir: new URL('src/', root),
      publicDir: new URL('public/', root),
      site,
      base,
      integrations: integrations ?? [integration],
    },
    injectRoute: (route) => routes.push(route),
    addMiddleware: (middleware) => middlewares.push(middleware),
    updateConfig: (config) => updated.push(config),
  });
  return { routes, middlewares, updated };
}

function createStarlightRssIntegration(enabled = true) {
  const plugin = hagilightStarlight({ rss: { enabled } });
  let integration;
  plugin.hooks['config:setup']({
    astroConfig: {
      site: 'https://example.test',
      base: '/',
      build: { format: 'directory' },
      trailingSlash: 'ignore',
    },
    config: {
      defaultLocale: 'root',
      locales: baseLocales,
      components: {},
      head: [],
      customCss: [],
    },
    addIntegration(value) {
      integration = value;
    },
    updateConfig() {},
  });
  return integration;
}

test('hagilightRss validates required configuration and locale filenames', () => {
  assert.throws(() => hagilightRss(), /options must be an object/u);
  assert.throws(() => hagilightRss({ getFeed: './rss-feed.mjs' }), /locales must contain/u);
  assert.throws(() => hagilightRss({ locales: baseLocales }), /getFeed must be a non-empty module path/u);
  assert.throws(() => hagilightRss({
    locales: { root: { lang: 'en' }, 'en-us': { lang: 'en-US' } },
    getFeed: './rss-feed.mjs',
  }), /collide on the "en" feed filename/u);
});

test('integration injects localized static routes and base-aware footer URLs', () => {
  const { routes, middlewares, updated } = makeSetup();
  assert.deepEqual(routes.map(({ pattern, prerender }) => [pattern, prerender]), [
    ['/rss.xml', true],
    ['/rss.[language].xml', true],
  ]);
  assert.equal(middlewares.length, 1);
  assert.equal(middlewares[0].order, 'pre');
  const plugin = updated[0].vite.plugins[0];
  const virtualId = plugin.resolveId('virtual:hagilight/rss-config');
  const moduleSource = plugin.load(virtualId);
  assert.ok(moduleSource.includes('baseUrl: "/manual/"'));
  assert.ok(moduleSource.includes('"defaultFeedUrl":"https://example.test/manual/rss.xml"'));
  assert.ok(moduleSource.includes('"zh-CN":"https://example.test/manual/rss.zh-CN.xml"'));
  assert.ok(moduleSource.includes(JSON.stringify(fileURLToPath(new URL('rss-feed.mjs', fixtureRoot)))));
});

test('integration rejects missing callback modules and consumer-owned RSS routes', () => {
  assert.throws(
    () => makeSetup({ getFeed: './missing.mjs' }),
    /getFeed module "\.\/missing\.mjs" was not found/u,
  );
  assert.throws(
    () => makeSetup({
      root: new URL('./fixtures/core-rss-collision/', import.meta.url),
    }),
    /route conflicts with consumer-owned file/u,
  );
  assert.throws(
    () => makeSetup({ root: new URL('./fixtures/core-rss-dynamic-collision/', import.meta.url) }),
    /route conflicts with consumer-owned file/u,
  );
  assert.throws(() => makeSetup({ site: '/relative' }), /absolute Astro site URL/u);
});

test('core and Starlight integrations coordinate a single RSS owner independent of list order', () => {
  const starlightIntegration = createStarlightRssIntegration();
  for (const integrations of [
    [hagilightRss({ locales: baseLocales, getFeed: './rss-feed.mjs' }), starlightIntegration],
    [starlightIntegration, hagilightRss({ locales: baseLocales, getFeed: './rss-feed.mjs' })],
  ]) {
    const coreIntegration = integrations.find(({ name }) => name === '@hagicode/hagilight:rss');
    const core = makeSetup({ integrations });
    assert.equal(core.routes.length, 0);
    assert.equal(core.middlewares.length, 0);
    assert.equal(core.updated.length, 0);

    const starlightRoutes = [];
    const starlightUpdated = [];
    starlightIntegration.hooks['astro:config:setup']({
      injectRoute: (route) => starlightRoutes.push(route),
      updateConfig: (config) => starlightUpdated.push(config),
    });
    assert.deepEqual(starlightRoutes.map(({ pattern }) => pattern), ['/rss.xml', '/rss.[language].xml']);
    assert.equal(starlightUpdated.length, 1);
    const starlightPlugin = starlightUpdated[0].vite.plugins[0];
    const rssConfigId = starlightPlugin.resolveId('virtual:hagilight-starlight/rss-config');
    assert.ok(starlightPlugin.load(rssConfigId).includes('"filename":"zh-CN"'));
    assert.ok(coreIntegration);
  }
});

test('Starlight-only RSS stays enabled, core-only RSS owns routes, and disabled Starlight is diagnosed', () => {
  const starlightOnly = createStarlightRssIntegration();
  const starlightRoutes = [];
  starlightOnly.hooks['astro:config:setup']({
    injectRoute: (route) => starlightRoutes.push(route),
    updateConfig() {},
  });
  assert.equal(starlightRoutes.length, 2);
  starlightOnly.hooks['astro:config:done']();

  const coreOnly = makeSetup();
  assert.equal(coreOnly.routes.length, 2);
  assert.equal(coreOnly.middlewares.length, 1);

  const disabledStarlight = createStarlightRssIntegration(false);
  const core = hagilightRss({ locales: baseLocales, getFeed: './rss-feed.mjs' });
  assert.throws(
    () => makeSetup({ integrations: [core, disabledStarlight] }),
    /Starlight RSS is explicitly disabled while hagilightRss\(\) requests feed generation/u,
  );
});

test('real Astro builds keep Starlight as the sole owner in either integration order', () => {
  for (const order of ['before', 'after']) {
    execFileSync(npm, ['run', 'build', '-w', 'hagilight-example'], {
      cwd: repositoryRoot,
      env: { ...process.env, HAGILIGHT_TEST_CORE_RSS_ORDER: order },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });

    const outputDir = join(repositoryRoot, 'examples/demo-starlight-web/dist');
    const english = readFileSync(join(outputDir, 'index.html'), 'utf8');
    const chinese = readFileSync(join(outputDir, 'zh-CN/index.html'), 'utf8');
    const englishLinks = english.match(/<div class="hagilight-site-links[^"]*">([\s\S]*?)<p class="hagilight-copyright[^"]*">/u)?.[1];
    const chineseLinks = chinese.match(/<div class="hagilight-site-links[^"]*">([\s\S]*?)<p class="hagilight-copyright[^"]*">/u)?.[1];
    assert.ok(englishLinks);
    assert.ok(chineseLinks);
    assert.deepEqual(
      [...englishLinks.matchAll(/href="([^"]*rss[^"]*)"/giu)].map(([, href]) => href),
      ['https://hagistar.hagicode.com/rss.xml'],
    );
    assert.deepEqual(
      [...chineseLinks.matchAll(/href="([^"]*rss[^"]*)"/giu)].map(([, href]) => href),
      [
        'https://hagistar.hagicode.com/rss.xml',
        'https://hagistar.hagicode.com/rss.zh-CN.xml',
      ],
    );
    assert.ok(readFileSync(join(outputDir, 'rss.xml'), 'utf8').includes('English RSS blog example'));
    assert.ok(readFileSync(join(outputDir, 'rss.zh-CN.xml'), 'utf8').includes('Chinese RSS blog example'));
    assert.ok(!readFileSync(join(outputDir, 'rss.xml'), 'utf8').includes('English-language feed for this site.'));
  }
});

test('RSS rendering keeps English aliases empty without English content and validates callbacks', async () => {
  let callbackCalls = 0;
  const noEnglish = {
    site: 'https://example.test',
    baseUrl: '/manual/',
    locales: [{ route: 'root', lang: 'zh-CN', filename: 'zh-CN' }],
    getFeed: async () => {
      callbackCalls += 1;
      return { title: 'Chinese', description: 'Chinese items', items: [{ title: '中文', link: '/zh-CN/' }] };
    },
  };
  for (const filename of ['en', 'en']) {
    const xml = await (await renderRssFeed(noEnglish, filename)).text();
    assert.match(xml, /<language>en<\/language>/u);
    assert.match(xml, /<title>Hagilight RSS Feed<\/title>/u);
    assert.doesNotMatch(xml, /<item>/u);
  }
  assert.equal(callbackCalls, 0);

  const withLocales = {
    ...noEnglish,
    locales: [
      { route: 'root', lang: 'en-US', filename: 'en' },
      { route: 'zh-CN', lang: 'zh-CN', filename: 'zh-CN' },
    ],
    getFeed: async ({ route, lang }) => ({
      title: `${route} ${lang}`,
      description: `${lang} feed`,
      items: [{ title: lang, link: '/guide/' }],
    }),
  };
  const localizedXml = await (await renderRssFeed(withLocales, 'zh-CN')).text();
  assert.match(localizedXml, /<language>zh-CN<\/language>/u);
  assert.match(localizedXml, /https:\/\/example\.test\/manual\/guide\//u);

  for (const result of [undefined, null, [], { title: 'Feed', description: 'Description' }]) {
    await assert.rejects(
      renderRssFeed({ ...withLocales, getFeed: async () => result }, 'en'),
      /getFeed callback .* (?:object|items array)/u,
    );
  }
  await assert.rejects(
    renderRssFeed({ ...withLocales, getFeed: undefined }, 'en'),
    /must default-export a callback function/u,
  );
});
