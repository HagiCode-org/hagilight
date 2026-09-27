import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSiteLinks } from '../packages/astro/site-links.ts';

test('resolves localized links with nonempty fallback labels', () => {
  const traditional = resolveSiteLinks('zh-Hant');
  const unknown = resolveSiteLinks('de-DE');

  assert.equal(traditional.header[0].label, '首頁');
  assert.equal(unknown.header[0].label, 'Home');
  assert.equal(unknown.header[1].label, 'Blog');
  assert.equal(resolveSiteLinks('zh-CN').header[1].href, 'https://docs.hagicode.com/blog/');
  assert.equal(traditional.header[1].href, 'https://docs.hagicode.com/zh-Hant/blog/');
  assert.equal(resolveSiteLinks('ja-jp').header[1].href, 'https://docs.hagicode.com/ja-JP/blog/');
  assert.equal(unknown.header[1].href, 'https://docs.hagicode.com/de-DE/blog/');
  assert.equal(resolveSiteLinks('unsupported').header[1].href, 'https://docs.hagicode.com/en-US/blog/');
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
  assert.equal(links.quick.find((link) => link.id === 'blog').href, '/journal/');
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

  assert.deepEqual(links.relatedSites.map(({ id }) => id), ['first']);
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
  assert.throws(
    () => resolveSiteLinks('en-US', { overrides: { blog: { href: 'javascript:alert(1)' } } }),
    /Unsupported link protocol/,
  );
});
