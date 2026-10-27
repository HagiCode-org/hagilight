import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSiteLinks } from '@hagicode/hagilight-core/links';

const FEEDS = { rssFeedUrl: 'https://docs.example.com/feed.xml', rssLocaleFeedUrl: 'https://docs.example.com/en/feed.xml' };

function entryIds(links) {
  return links.columns.flatMap((column) => column.entries.map(({ id }) => id));
}

test('the default footer lists four purpose-based columns that stay level', () => {
  const links = resolveSiteLinks('en-US', FEEDS);
  assert.deepEqual(links.columns.map(({ id }) => id), ['start', 'learn', 'build', 'community']);
  const sizes = links.columns.map((column) => column.entries.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `column sizes ${sizes} differ by more than one`);
  assert.ok(Math.max(...sizes) <= 8, 'no column grows into a long list');
});

test('every quick link, community link and ecosystem site appears exactly once; feeds leave the columns', () => {
  const links = resolveSiteLinks('en-US', FEEDS);
  assert.deepEqual(links.feeds.map(({ id }) => id), ['rss', 'rssLocale', 'sitemap']);
  const expected = [
    ...links.quick.filter(({ id }) => !['rss', 'rssLocale', 'sitemap'].includes(id)).map(({ id }) => id),
    ...links.community.map(({ id }) => id),
    ...links.relatedSites.map(({ id }) => id),
  ];
  const placed = entryIds(links);
  assert.equal(new Set(placed).size, placed.length, 'no entry is shown twice');
  assert.deepEqual([...placed].sort(), [...expected].sort());
});

test('column entries keep their destinations, rel and source', () => {
  const links = resolveSiteLinks('zh-CN', { ...FEEDS, siteId: 'docs' });
  const all = links.columns.flatMap((column) => column.entries);
  const download = all.find(({ id }) => id === 'downloadClient');
  assert.equal(download.source, 'link');
  assert.equal(download.href, links.quick.find(({ id }) => id === 'downloadClient').href);
  const tasks = all.find(({ id }) => id === 'hagitask');
  assert.equal(tasks.source, 'site');
  assert.equal(tasks.target, '_blank');
  assert.equal(tasks.rel, links.relatedSites.find(({ id }) => id === 'hagitask').rel);
  assert.equal(tasks.label, 'HagiTask');
});

test('column headings are localized in every supported locale', () => {
  for (const locale of ['zh-CN', 'zh-Hant', 'en-US', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU']) {
    const { labels } = resolveSiteLinks(locale);
    for (const id of ['start', 'learn', 'build', 'community']) {
      assert.ok(labels.columns[id].trim(), `${locale} ${id} heading`);
    }
    assert.ok(labels.navigation.feeds.trim(), `${locale} feeds label`);
  }
  assert.equal(resolveSiteLinks('zh-CN').labels.columns.start, '开始使用');
  assert.equal(resolveSiteLinks('xx-YY').labels.columns.build, 'Tools & Resources');
});

test('removed links and the current site leave their column without emptying the footer', () => {
  const links = resolveSiteLinks('en-US', {
    ...FEEDS,
    siteId: 'impeccable-site',
    removeLinks: { relatedSites: ['gallery'], quick: ['microsoftStore'] },
  });
  const ids = entryIds(links);
  assert.ok(!ids.includes('impeccable-site'));
  assert.ok(!ids.includes('gallery'));
  assert.ok(!ids.includes('microsoftStore'));
  assert.equal(links.columns.length, 4);
});

test('a column with no entries is dropped', () => {
  const links = resolveSiteLinks('en-US', {
    relatedSites: [],
    removeLinks: { community: ['github', 'discord', 'issueFeedback', 'contactEmail', 'qqGroup'] },
  });
  assert.ok(!links.columns.some(({ id }) => id === 'community'));
  assert.ok(!links.columns.some(({ id }) => id === 'build'));
});

test('unknown entries still render: extra links join their natural column, other sites the shortest', () => {
  const links = resolveSiteLinks('en-US', {
    ...FEEDS,
    extraLinks: {
      quick: [{ id: 'pricing', label: 'Pricing', href: 'https://example.com/pricing' }],
      community: [{ id: 'forum', label: 'Forum', href: 'https://example.com/forum', external: true }],
      relatedSites: [{ id: 'lab', name: 'Lab', url: 'https://lab.example.com/' }],
    },
  });
  const column = (id) => links.columns.find((entry) => entry.id === id).entries.map(({ id: entryId }) => entryId);
  assert.ok(column('start').includes('pricing'));
  assert.ok(column('community').includes('forum'));
  assert.ok(entryIds(links).includes('lab'));
  const sizes = links.columns.map((entry) => entry.entries.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 2, `fallback keeps columns level: ${sizes}`);
});

test('a consumer site whose id matches a tracked link id never reports a GA event from a column', () => {
  const links = resolveSiteLinks('en-US', {
    relatedSites: [{ id: 'home', name: 'Elsewhere', url: 'https://elsewhere.example.com/' }],
  });
  const entry = links.columns.flatMap((column) => column.entries).find(({ id }) => id === 'home');
  assert.equal(entry.source, 'site', 'the view reads `source` to keep sites untagged');
});
