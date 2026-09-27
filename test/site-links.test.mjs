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
  assert.equal(resolveSiteLinks('ja-JP').quick.find((link) => link.id === 'rss').href,
    'https://docs.hagicode.com/blog/rss.ja-JP.xml');
});

test('matches Docs footer destinations, order, and localized link copy', () => {
  const links = resolveSiteLinks('en-US');
  assert.deepEqual(links.quick.map(({ id }) => id), [
    'downloadClient', 'microsoftStore', 'about', 'dockerCompose', 'productDocs', 'blogPosts', 'rss',
  ]);
  assert.deepEqual(links.community.map(({ id }) => id), [
    'github', 'discord', 'issueFeedback', 'contactEmail', 'qqGroup',
    'costCalculator',
  ]);
  assert.deepEqual(links.relatedSites.map(({ id }) => id), [
    'hagicode-main', 'newbe-blog', 'index-data', 'compose-builder', 'status-page',
    'awesome-design-gallery', 'soul-builder', 'trait-builder', 'openspec-docs', 'omniroute-docs',
  ]);
  assert.equal(links.quick.find(({ id }) => id === 'microsoftStore').href,
    'https://apps.microsoft.com/detail/9N3PM0N3SVDW');
  assert.equal(links.community.find(({ id }) => id === 'issueFeedback').href,
    'https://github.com/HagiCode-org/site/issues');
  assert.equal(links.community.find(({ id }) => id === 'contactEmail').href,
    'mailto:support@hagicode.com');
  assert.equal(links.relatedSites[0].name, 'HagiCode Main Site');
  assert.equal(links.relatedSites[0].description, 'Primary product entry.');
  assert.equal(links.relatedSites[0].href, 'https://www.hagicode.com/en-US/');
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
});
