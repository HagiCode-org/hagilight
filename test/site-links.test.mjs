import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSiteLinks } from '../packages/astro/site-links.ts';

test('resolves localized links with nonempty fallback labels', () => {
  const traditional = resolveSiteLinks('zh-Hant');
  const unknown = resolveSiteLinks('de-DE');

  assert.equal(traditional.header[0].label, '首頁');
  assert.equal(unknown.header[0].label, 'Home');
  assert.equal(unknown.header[1].label, 'Blog');
  assert.equal(traditional.header[1].href, 'https://docs.hagicode.com/zh-Hant/blog/');
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
  const links = resolveSiteLinks('en-US');
  const github = links.community.find((link) => link.id === 'github');

  assert.equal(github.target, '_blank');
  assert.equal(github.rel, 'noopener noreferrer');
  assert.throws(
    () => resolveSiteLinks('en-US', { overrides: { blog: { href: 'javascript:alert(1)' } } }),
    /Unsupported link protocol/,
  );
});
