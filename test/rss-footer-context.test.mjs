import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSiteLinks } from '@hagicode/hagilight-core/links';
import { resolveRssFooterLinks } from '../packages/astro/dist/rss-footer-context.js';

const rssContext = {
  defaultFeedUrl: 'https://example.test/manual/rss.xml',
  localeFeedUrls: {
    'zh-CN': 'https://example.test/manual/rss.zh-CN.xml',
  },
  locales: [
    { route: 'root', lang: 'en-US', filename: 'en' },
    { route: 'zh-CN', lang: 'zh-CN', filename: 'zh-CN' },
  ],
};

function rssLinks(locale, options) {
  return resolveSiteLinks(locale, resolveRssFooterLinks({ hagilightRss: rssContext }, locale, options))
    .quick.filter(({ id }) => id === 'rss' || id === 'rssLocale');
}

test('generated Footer feeds are opt-in and default to the configured English feed', () => {
  const noIntegration = resolveRssFooterLinks({}, 'en-US');
  assert.deepEqual(noIntegration, {});
  assert.deepEqual(
    resolveSiteLinks('en-US', noIntegration).quick.filter(({ id }) => id === 'rss'),
    [],
  );
  assert.deepEqual(rssLinks('en-US').map(({ id, href }) => [id, href]), [
    ['rss', rssContext.defaultFeedUrl],
  ]);
});

test('localized Footer links match language tags rather than route keys', () => {
  assert.deepEqual(rssLinks('zh-cn').map(({ id, href }) => [id, href]), [
    ['rss', rssContext.defaultFeedUrl],
    ['rssLocale', rssContext.localeFeedUrls['zh-CN']],
  ]);
  assert.deepEqual(rssLinks('fr-FR').map(({ id, href }) => [id, href]), [
    ['rss', rssContext.defaultFeedUrl],
  ]);
});

test('explicit Footer links and existing removal rules override generated feeds', () => {
  assert.deepEqual(rssLinks('zh-CN', {
    rssFeedUrl: '/custom.xml',
    rssLocaleFeedUrl: '/custom-zh.xml',
  }).map(({ id, href }) => [id, href]), [
    ['rss', '/custom.xml'],
    ['rssLocale', '/custom-zh.xml'],
  ]);
  assert.deepEqual(rssLinks('zh-CN', { removeLinks: { quick: ['rss'] } }), []);
  assert.deepEqual(rssLinks('zh-CN', {
    overrides: { rss: { href: '/override.xml' } },
  }).map(({ id, href }) => [id, href]), [
    ['rss', '/override.xml'],
    ['rssLocale', rssContext.localeFeedUrls['zh-CN']],
  ]);
  assert.throws(
    () => resolveRssFooterLinks({ hagilightRss: null }, 'en-US'),
    /Footer context is malformed/u,
  );
  assert.throws(
    () => resolveRssFooterLinks({
      hagilightRss: { ...rssContext, localeFeedUrls: {} },
    }, 'zh-CN'),
    /no URL for "zh-CN"/u,
  );
});
