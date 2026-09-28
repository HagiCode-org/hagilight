import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateRssFeed } from '../packages/starlight/rss-renderer.mjs';
import { rssSchema } from '../packages/starlight/rss-schema.mjs';
import {
  isBlogEntry,
  resolveRssLocales,
  resolveRssOptions,
  selectRssEntries,
} from '../packages/starlight/rss-utils.mjs';

const locales = resolveRssLocales({
  root: { lang: 'zh-CN' },
  'en-us': { lang: 'en-US' },
});
const options = resolveRssOptions();

function entry(id, data = {}) {
  return { id, data: { title: id, description: `${id} description`, ...data } };
}

test('defaults RSS content-type switches and rejects invalid values', () => {
  assert.deepEqual(resolveRssOptions(), { includeDocs: true, includeBlog: true });
  assert.deepEqual(resolveRssOptions({ includeDocs: false }), {
    includeDocs: false,
    includeBlog: true,
  });
  assert.throws(() => resolveRssOptions(null), /rss options must be an object/);
  assert.throws(() => resolveRssOptions({ includeDocs: 1 }), /includeDocs option must be a boolean/);
  assert.throws(() => resolveRssOptions({ includeBlog: 'true' }), /includeBlog option must be a boolean/);
});

test('exports an optional boolean RSS frontmatter schema', () => {
  assert.deepEqual(rssSchema.parse({}), {});
  assert.deepEqual(rssSchema.parse({ rss: true }), { rss: true });
  assert.deepEqual(rssSchema.parse({ rss: false }), { rss: false });
  assert.throws(() => rssSchema.parse({ rss: 'false' }));
});

test('maps English aliases and rejects invalid or colliding locale tags', () => {
  assert.deepEqual(resolveRssLocales(undefined), [{ route: 'root', lang: 'en', filename: 'en' }]);
  assert.deepEqual(resolveRssLocales({ root: { lang: 'zh-CN' }, 'en-us': { lang: 'en-US' } }), [
    { route: 'root', lang: 'zh-CN', filename: 'zh-CN' },
    { route: 'en-us', lang: 'en-US', filename: 'en' },
  ]);
  assert.deepEqual(resolveRssLocales({ root: { lang: 'zh-CN' }, 'pt-br': { label: 'Português' } })[1], {
    route: 'pt-br',
    lang: 'pt-BR',
    filename: 'pt-BR',
  });
  assert.throws(
    () => resolveRssLocales({ root: { lang: 'en' }, 'en-us': { lang: 'en-US' } }),
    /collide on the "en" feed filename/,
  );
  assert.throws(() => resolveRssLocales({ root: { lang: '../en' } }), /valid language tag/);
  assert.throws(() => resolveRssLocales({ root: { lang: 'not a tag' } }), /valid language tag/);
});

test('keeps English root and explicit Chinese routes in separate RSS feeds', () => {
  const exampleLocales = resolveRssLocales({
    root: { lang: 'en-US' },
    'zh-cn': { lang: 'zh-CN' },
  });
  const entries = [
    entry('blog/english-home'),
    entry('zh-cn/blog/chinese-home'),
  ];

  assert.deepEqual(exampleLocales, [
    { route: 'root', lang: 'en-US', filename: 'en' },
    { route: 'zh-cn', lang: 'zh-CN', filename: 'zh-CN' },
  ]);
  assert.deepEqual(
    selectRssEntries(entries, { filename: 'en', locales: exampleLocales, options }).map(({ id }) => id),
    ['blog/english-home'],
  );
  assert.deepEqual(
    selectRssEntries(entries, { filename: 'zh-CN', locales: exampleLocales, options }).map(({ id }) => id),
    ['zh-cn/blog/chinese-home'],
  );
});

test('classifies locale-relative blog articles without treating blog indexes as posts', () => {
  assert.equal(isBlogEntry('blog/article'), true);
  assert.equal(isBlogEntry('blog/article/index'), true);
  assert.equal(isBlogEntry('blog'), false);
  assert.equal(isBlogEntry('blog/index'), false);
  assert.equal(isBlogEntry('guide/blog/article'), false);
});

test('filters locale, drafts, article opt-outs, and independently enabled content types', () => {
  const entries = [
    entry('docs/introduction'),
    entry('blog/release', { lastUpdated: new Date('2026-09-10') }),
    entry('en-us/docs/introduction'),
    entry('en-us/docs/explicit-opt-in', { rss: true }),
    entry('en-us/blog/release'),
    entry('en-us/blog/draft-opt-in', { draft: true, rss: true }),
    entry('hidden', { rss: false }),
    entry('blog/draft', { draft: true }),
    entry('en-us/blog/opted-out', { rss: false }),
  ];

  assert.deepEqual(
    selectRssEntries(entries, { filename: 'zh-CN', locales, options }).map(({ id }) => id),
    ['blog/release', 'docs/introduction'],
  );
  assert.deepEqual(
    selectRssEntries(entries, {
      filename: 'en',
      locales,
      options: { includeDocs: false, includeBlog: true },
    }).map(({ id }) => id),
    ['en-us/blog/release'],
  );
  const docsOnly = selectRssEntries(entries, {
    filename: 'en',
    locales,
    options: { includeDocs: true, includeBlog: false },
  }).map(({ id }) => id);
  assert.ok(docsOnly.includes('en-us/docs/explicit-opt-in'));
  assert.ok(!docsOnly.includes('en-us/blog/draft-opt-in'));
  assert.deepEqual(
    selectRssEntries(entries, {
      filename: 'zh-CN',
      locales,
      options: { includeDocs: false, includeBlog: false },
    }),
    [],
  );
  assert.throws(
    () => selectRssEntries([entry('bad', { rss: 'false' })], { filename: 'en', locales, options }),
    /frontmatter field "rss".*must be a boolean/,
  );
});

test('keeps an unconfigured English feed empty instead of substituting root content', async () => {
  const rootLocales = resolveRssLocales({ root: { lang: 'zh-CN' } });
  const response = await generateRssFeed({
    site: new URL('https://example.com/'),
    baseUrl: '/',
    filename: 'en',
    locales: rootLocales,
    options,
    entries: [entry('guide', { title: 'Chinese guide' })],
  });
  const xml = await response.text();

  assert.match(xml, /<language>en<\/language>/u);
  assert.doesNotMatch(xml, /<item>/u);
});

test('renders language metadata, ordered dated entries, undated entries, and base-aware links', async () => {
  const response = await generateRssFeed({
    site: new URL('https://example.com/'),
    baseUrl: '/manual/',
    filename: 'en',
    locales,
    options,
    entries: [
      entry('en-us/undated'),
      entry('en-us/blog/newer', { lastUpdated: new Date('2026-09-20') }),
      entry('en-us/older', { lastUpdated: new Date('2026-09-01') }),
      entry('docs/chinese-only'),
    ],
  });
  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map(([, item]) => item);
  const links = items.map((item) => item.match(/<link>([^<]+)<\/link>/u)[1]);

  assert.match(xml, /<language>en-US<\/language>/u);
  assert.deepEqual(links, [
    'https://example.com/manual/en-us/blog/newer/',
    'https://example.com/manual/en-us/older/',
    'https://example.com/manual/en-us/undated/',
  ]);
  const undated = items.find((item) => item.includes('https://example.com/manual/en-us/undated/'));
  assert.doesNotMatch(undated, /<pubDate>/u);
});
