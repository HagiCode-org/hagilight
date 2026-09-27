import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSiteLinks } from '../packages/astro/site-links.ts';

test('resolves localized links with nonempty fallback labels', () => {
  const traditional = resolveSiteLinks('zh-Hant');
  const unknown = resolveSiteLinks('de-DE');

  assert.equal(traditional.header[0].label, '首頁');
  assert.equal(unknown.header[0].label, 'Startseite');
  assert.equal(unknown.header[1].label, 'Blog');
  assert.equal(resolveSiteLinks('zh-CN').header[1].href, 'https://docs.hagicode.com/blog/');
  assert.equal(traditional.header[1].href, 'https://docs.hagicode.com/zh-Hant/blog/');
  assert.equal(resolveSiteLinks('ja-jp').header[1].href, 'https://docs.hagicode.com/ja-JP/blog/');
  assert.equal(unknown.header[1].href, 'https://docs.hagicode.com/de-DE/blog/');
  assert.equal(resolveSiteLinks('unsupported').header[1].href, 'https://docs.hagicode.com/en-US/blog/');
  assert.equal(traditional.header[0].href, 'https://www.hagicode.com/zh-Hant/');
  assert.equal(unknown.header[2].href, 'https://www.hagicode.com/de-DE/about/');
  assert.ok(!resolveSiteLinks('ja-JP').quick.some((link) => link.id === 'rss'));
  assert.equal(resolveSiteLinks('ja-JP', { rssFeedUrl: 'https://example.com/feed.xml' })
    .quick.find((link) => link.id === 'rss').href, 'https://example.com/feed.xml');
});

test('matches Docs footer destinations, order, and localized link copy', () => {
  const links = resolveSiteLinks('en-US', { rssFeedUrl: 'https://docs.example.com/feed.xml' });
  assert.deepEqual(links.quick.map(({ id }) => id), [
    'downloadClient', 'microsoftStore', 'dockerCompose', 'productDocs', 'blogPosts', 'rss', 'about',
  ]);
  assert.deepEqual(links.community.map(({ id }) => id), [
    'github', 'discord', 'issueFeedback', 'contactEmail', 'qqGroup',
  ]);
  assert.deepEqual(links.relatedSites.map(({ id }) => id), [
    'hagitask', 'costCalculator',
    'hagicode-main', 'newbe-blog', 'index-data', 'compose-builder', 'status-page',
    'awesome-design-gallery', 'soul-builder', 'trait-builder', 'openspec-docs', 'omniroute-docs',
  ]);
  assert.equal(links.quick[0].label, 'Download Hagicode');
  assert.equal(links.quick[1].label, 'Download Hagicode for Windows');
  assert.equal(links.quick.at(-1).label, 'About HagiCode');
  assert.equal(links.relatedSites[0].href, 'https://tasks.hagicode.com/');
  assert.equal(links.relatedSites[1].href, 'https://cost.hagicode.com');
  assert.equal(links.quick.find(({ id }) => id === 'microsoftStore').href,
    'https://apps.microsoft.com/detail/9N3PM0N3SVDW');
  assert.equal(links.community.find(({ id }) => id === 'issueFeedback').href,
    'https://github.com/HagiCode-org/site/issues');
  assert.equal(links.community.find(({ id }) => id === 'contactEmail').href,
    'mailto:support@hagicode.com');
  const mainSite = links.relatedSites.find(({ id }) => id === 'hagicode-main');
  assert.equal(mainSite.name, 'HagiCode Main Site');
  assert.equal(mainSite.description, 'Primary product entry.');
  assert.equal(mainSite.href, 'https://www.hagicode.com/en-US/');
  assert.equal(links.relatedSites.find(({ id }) => id === 'openspec-docs').href,
    'https://openspec.hagicode.com/en-US/');
  assert.equal(links.relatedSites.find(({ id }) => id === 'omniroute-docs').href,
    'https://omniroute.hagicode.com/en-US/');
  assert.equal(links.relatedSites.find(({ id }) => id === 'awesome-design-gallery').href,
    'https://design.hagicode.com/en-US/');
  assert.deepEqual(links.filings.map(({ href }) => href), [
    'https://beian.miit.gov.cn/',
    'http://www.beian.gov.cn/portal/registerSystemInfo',
  ]);
});

test('uses localized paths for marked related sites and leaves other sites unchanged', () => {
  const links = resolveSiteLinks('zh-Hant');

  assert.equal(links.relatedSites.find(({ id }) => id === 'openspec-docs').href,
    'https://openspec.hagicode.com/zh-Hant/');
  assert.equal(links.relatedSites.find(({ id }) => id === 'omniroute-docs').href,
    'https://omniroute.hagicode.com/zh-Hant/');
  assert.equal(links.relatedSites.find(({ id }) => id === 'awesome-design-gallery').href,
    'https://design.hagicode.com/zh-Hant/');
  assert.equal(links.relatedSites.find(({ id }) => id === 'newbe-blog').href,
    'https://newbe.hagicode.com/');
});

test('localizes the renamed download entries and ecosystem defaults', () => {
  const links = resolveSiteLinks('zh-CN', { rssFeedUrl: '/rss.xml' });

  assert.deepEqual(links.quick.slice(0, 2).map(({ label }) => label), [
    '下载 Hagicode',
    '下载 Hagicode Windows 版本',
  ]);
  assert.equal(links.relatedSites[0].name, 'HagiTask');
  assert.equal(links.relatedSites[0].description, '任务与工作流管理');
  assert.equal(links.relatedSites[1].name, '算一算，AI会不会淘汰我');
});

test('uses consumer-owned localized destinations and labels', () => {
  const links = resolveSiteLinks('en-US', {
    overrides: {
      blog: {
        href: { 'en-US': '/journal/', 'zh-CN': '/cn/journal/' },
        label: { 'en-US': 'Journal' },
      },
    },
  });

  assert.equal(links.header[1].href, '/journal/');
  assert.equal(links.header[1].label, 'Journal');
  assert.equal(links.quick.find((link) => link.id === 'blogPosts').href, '/journal/');
});

test('filters related-site self, rendered destinations, and duplicate URLs', () => {
  const links = resolveSiteLinks('en-US', {
    siteId: 'current',
    siteUrl: 'https://current.example/docs/',
    relatedSites: [
      { id: 'current', name: 'Current', url: 'https://elsewhere.example/' },
      { id: 'home', name: 'Home', url: 'https://www.hagicode.com' },
      { id: 'self-url', name: 'Self URL', url: 'https://current.example/docs/#top' },
      { id: 'first', name: 'First', url: 'https://related.example/site/' },
      { id: 'duplicate', name: 'Duplicate', url: 'https://related.example/site/#section' },
    ],
  });

  assert.deepEqual(links.relatedSites.map(({ id }) => id), ['home', 'first']);
});

test('an empty related-site override disables the bundled Docs-derived list', () => {
  assert.equal(resolveSiteLinks('en-US', { relatedSites: [] }).relatedSites.length, 0);
});

test('composes additions and ID removals independently across all footer sections', () => {
  const links = resolveSiteLinks('zh-CN', {
    removeLinks: {
      relatedSites: ['hagitask'],
      quick: ['downloadClient'],
      community: ['github'],
    },
    extraLinks: {
      relatedSites: [{
        id: 'consumer-ecosystem',
        name: { 'zh-CN': '自有站点', 'en-US': 'Consumer site' },
        description: { 'zh-CN': '自有说明', 'en-US': 'Consumer description' },
        url: 'https://consumer.example/',
      }],
      quick: [{ id: 'consumer-quick', href: '/install/', label: { 'zh-CN': '安装', 'en-US': 'Install' } }],
      community: [{ id: 'consumer-community', href: 'https://community.example/', label: 'Community', external: true }],
    },
  });

  assert.ok(!links.relatedSites.some(({ id }) => id === 'hagitask'));
  assert.equal(links.relatedSites.at(-1).name, '自有站点');
  assert.equal(links.relatedSites.at(-1).description, '自有说明');
  assert.ok(!links.quick.some(({ id }) => id === 'downloadClient'));
  assert.equal(links.quick.at(-1).id, 'consumer-quick');
  assert.equal(links.quick.at(-1).label, '安装');
  assert.ok(!links.community.some(({ id }) => id === 'github'));
  assert.equal(links.community.at(-1).id, 'consumer-community');
  assert.equal(links.community.at(-1).target, '_blank');
  assert.equal(links.community.at(-1).rel, 'noopener noreferrer');
});

test('composes ecosystem additions with related-site replacement and removal', () => {
  const links = resolveSiteLinks('en-US', {
    relatedSites: [
      { id: 'replace-me', name: 'Replace me', url: 'https://replace.example/' },
      { id: 'keep-me', name: 'Keep me', url: 'https://keep.example/' },
    ],
    removeLinks: { relatedSites: ['replace-me'] },
    extraLinks: {
      relatedSites: [{ id: 'appended', name: 'Appended', url: 'https://append.example/' }],
    },
  });

  assert.deepEqual(links.relatedSites.map(({ id }) => id), ['keep-me', 'appended']);
});

test('keeps first IDs and destinations when additions collide with existing entries', () => {
  const links = resolveSiteLinks('en-US', {
    relatedSites: [],
    extraLinks: {
      quick: [
        { id: 'downloadClient', href: 'https://custom.example/', label: 'ID collision' },
        { id: 'same-url', href: 'https://docs.hagicode.com/en-US/product-overview/', label: 'URL collision' },
        { id: 'first', href: 'https://custom.example/', label: 'First custom' },
        { id: 'duplicate', href: 'https://custom.example/#section', label: 'Duplicate custom' },
      ],
      relatedSites: [
        { id: 'duplicate-site', name: 'Quick link duplicate', url: 'https://custom.example/' },
        { id: 'first-site', name: 'First site', url: 'https://unique.example/' },
        { id: 'duplicate-site-two', name: 'Duplicate site', url: 'https://unique.example/#section' },
      ],
    },
  });

  assert.ok(!links.quick.some(({ label }) => ['ID collision', 'URL collision', 'Duplicate custom'].includes(label)));
  assert.equal(links.quick.find(({ id }) => id === 'first').label, 'First custom');
  assert.deepEqual(links.relatedSites.map(({ id }) => id), ['first-site']);
});

test('applies ID removals to the effective replacement list before appending sites', () => {
  const links = resolveSiteLinks('en-US', {
    relatedSites: [{ id: 'custom-default', name: 'Custom default', url: 'https://default.example/' }],
    removeLinks: { relatedSites: ['custom-default'] },
    extraLinks: { relatedSites: [{ id: 'custom-addition', name: 'Custom addition', url: 'https://added.example/' }] },
  });

  assert.deepEqual(links.relatedSites.map(({ id }) => id), ['custom-addition']);
});

test('filters the bundled Docs sites by the consumer ID and URL', () => {
  const links = resolveSiteLinks('en-US', {
    siteId: 'newbe-blog',
    siteUrl: 'https://index.hagicode.com/data/',
  });

  assert.ok(!links.relatedSites.some(({ id }) => id === 'newbe-blog'));
  assert.ok(!links.relatedSites.some(({ id }) => id === 'index-data'));
});

test('external links open safely in a new tab and unsafe protocols are rejected', () => {
  const links = resolveSiteLinks('en-US', {
    extraLinks: { community: [{ href: 'https://example.com/community', label: 'Community', external: true }] },
  });
  const github = links.community.find((link) => link.id === 'github');
  const custom = links.community.find((link) => link.id === 'community-custom-1');

  assert.equal(github.target, '_blank');
  assert.equal(github.rel, 'noopener noreferrer');
  assert.equal(custom.target, '_blank');
  assert.equal(custom.rel, 'noopener noreferrer');
  assert.equal(links.filings[0].target, '_blank');
  assert.equal(links.filings[0].rel, 'noopener noreferrer');
  assert.equal(links.filings[0].ariaLabel, 'View ICP filing information');
  assert.throws(
    () => resolveSiteLinks('en-US', { overrides: { blog: { href: 'javascript:alert(1)' } } }),
    /Unsupported link protocol/,
  );
  assert.throws(
    () => resolveSiteLinks('en-US', {
      extraLinks: { relatedSites: [{ id: 'unsafe', name: 'Unsafe', url: 'javascript:alert(1)' }] },
    }),
    /Unsupported link protocol/,
  );
  assert.throws(
    () => resolveSiteLinks('en-US', {
      extraLinks: { quick: [{ id: 'unsafe', href: 'javascript:alert(1)', label: 'Unsafe' }] },
    }),
    /Unsupported link protocol/,
  );
});

test('uses RSS override before configured feed and omits RSS when neither exists', () => {
  const absent = resolveSiteLinks('en-US');
  const configured = resolveSiteLinks('en-US', {
    rssFeedUrl: 'https://example.com/configured.xml',
    overrides: { rss: { href: 'https://example.com/override.xml' } },
  });
  const overrideOnly = resolveSiteLinks('en-US', {
    overrides: { rss: { href: '/feeds/site.xml' } },
  });

  assert.ok(!absent.quick.some(({ id }) => id === 'rss'));
  assert.equal(configured.quick.find(({ id }) => id === 'rss').href, 'https://example.com/override.xml');
  assert.equal(overrideOnly.quick.find(({ id }) => id === 'rss').href, '/feeds/site.xml');
  assert.throws(
    () => resolveSiteLinks('en-US', { rssFeedUrl: 'javascript:alert(1)' }),
    /Unsupported link protocol/,
  );
});
