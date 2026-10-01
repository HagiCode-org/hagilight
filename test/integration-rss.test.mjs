import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';
import { test } from 'node:test';
import { hagilight } from '@hagicode/hagilight/integration';
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
  const integration = hagilight({ rss: { locales, getFeed } });
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

function rssVirtualPlugin(updated) {
  const viteUpdate = updated.find((entry) => entry.vite);
  return viteUpdate.vite.plugins[0];
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

test('hagilight() validates the rss option shape', () => {
  assert.throws(() => hagilight({ rss: 'yes' }), /RSS option must be a boolean or an options object/u);
  assert.throws(() => hagilight({ rss: { locales: 'nope' } }), /locales must be an object/u);
});

test('integration injects localized static routes and base-aware footer URLs', () => {
  const { routes, middlewares, updated } = makeSetup();
  assert.deepEqual(
    routes
      .filter(({ pattern }) => pattern.startsWith('/rss'))
      .map(({ pattern, prerender }) => [pattern, prerender]),
    [
      ['/rss.xml', true],
      ['/rss.[language].xml', true],
    ],
  );
  assert.equal(middlewares.length, 1);
  assert.equal(middlewares[0].order, 'pre');
  const plugin = rssVirtualPlugin(updated);
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
  assert.throws(() => makeSetup({ site: '/relative' }), /absolute HTTP\(S\) Astro site URL/u);
});

test('plain-Astro and Starlight integrations coordinate a single RSS owner independent of list order', () => {
  for (const order of ['before', 'after']) {
    const starlightIntegration = createStarlightRssIntegration();
    // The plain-Astro hagilight() must defer to Starlight for RSS routes.
    const core = makeSetup({ integrations: [starlightIntegration] });
    assert.equal(core.routes.filter(({ pattern }) => pattern.startsWith('/rss')).length, 0);
    assert.equal(core.middlewares.length, 0);
    assert.ok(core.updated.every((entry) => entry.vite === undefined));

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
    void order;
  }
});

test('Starlight-only RSS stays enabled, plain-Astro RSS owns routes, and disabled Starlight defers to core', () => {
  const starlightOnly = createStarlightRssIntegration();
  const starlightRoutes = [];
  starlightOnly.hooks['astro:config:setup']({
    injectRoute: (route) => starlightRoutes.push(route),
    updateConfig() {},
  });
  assert.equal(starlightRoutes.length, 2);
  starlightOnly.hooks['astro:config:done']();

  const coreOnly = makeSetup();
  assert.deepEqual(
    coreOnly.routes.filter(({ pattern }) => pattern.startsWith('/rss')).map(({ pattern }) => pattern),
    ['/rss.xml', '/rss.[language].xml'],
  );
  assert.equal(coreOnly.middlewares.length, 1);

  const disabledStarlight = createStarlightRssIntegration(false);
  const core = makeSetup({ integrations: [disabledStarlight] });
  assert.deepEqual(
    core.routes.filter(({ pattern }) => pattern.startsWith('/rss')).map(({ pattern }) => pattern),
    ['/rss.xml', '/rss.[language].xml'],
  );
  assert.equal(core.middlewares.length, 1);
  assert.ok(core.updated.some((entry) => entry.vite));
});

test('real Astro builds keep Starlight as the sole owner', () => {
  execFileSync(npm, ['run', 'build', '-w', 'hagilight-example'], {
    cwd: repositoryRoot,
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