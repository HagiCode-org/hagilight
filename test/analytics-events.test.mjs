import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GA_CATEGORIES,
  GA_CATEGORY_ACTIONS,
  GA_LOCATIONS,
  TRACKED_SITE_LINKS,
  gaEventAttributes,
  handleGaClick,
  installGaEventTracking,
  siteLinkGaAttributes,
} from '@hagicode/hagilight-core/analytics-events';
import { resolveSiteLinks } from '@hagicode/hagilight-core/links';

class FakeElement extends EventTarget {
  constructor(attributes = {}, props = {}) {
    super();
    this.attributes = attributes;
    Object.assign(this, props);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
}

const tag = (category, label, location = 'footer', url) => new FakeElement({
  'data-ga-category': category,
  'data-ga-label': label,
  'data-ga-location': location,
  ...(url ? { 'data-ga-url': url } : {}),
});
const clickPath = (...path) => ({ composedPath: () => path });

function collect(event) {
  const sent = [];
  handleGaClick(event, (action, params) => sent.push([action, params]));
  return sent;
}

test('vocabulary derives the GA4 event name from the category', () => {
  assert.deepEqual([...GA_CATEGORIES], ['download', 'navigation', 'community', 'promotion']);
  assert.deepEqual({ ...GA_CATEGORY_ACTIONS }, {
    download: 'download_click',
    navigation: 'link_click',
    community: 'link_click',
    promotion: 'link_click',
  });
  assert.deepEqual([...GA_LOCATIONS], ['header', 'footer', 'article_promotion', 'promoto_banner']);
});

test('tracked site link inventory is a reviewed snapshot', () => {
  assert.deepEqual({ ...TRACKED_SITE_LINKS }, {
    home: 'navigation',
    blog: 'navigation',
    support: 'navigation',
    downloadClient: 'download',
    microsoftStore: 'download',
    dockerCompose: 'navigation',
    productDocs: 'navigation',
    blogPosts: 'navigation',
    github: 'community',
    discord: 'community',
    issueFeedback: 'community',
  });
  assert.ok(Object.isFrozen(TRACKED_SITE_LINKS));
});

test('gaEventAttributes builds data attributes and rejects malformed tags', () => {
  assert.deepEqual(gaEventAttributes({ category: 'download', label: 'downloadClient', location: 'footer' }), {
    'data-ga-category': 'download',
    'data-ga-label': 'downloadClient',
    'data-ga-location': 'footer',
  });
  assert.deepEqual(
    gaEventAttributes({ category: 'promotion', label: 'spring', location: 'promoto_banner', url: 'https://example.test/' }),
    {
      'data-ga-category': 'promotion',
      'data-ga-label': 'spring',
      'data-ga-location': 'promoto_banner',
      'data-ga-url': 'https://example.test/',
    },
  );

  const valid = { category: 'navigation', label: 'home', location: 'header' };
  assert.throws(() => gaEventAttributes({ ...valid, category: 'purchase' }), TypeError);
  assert.throws(() => gaEventAttributes({ ...valid, category: undefined }), TypeError);
  assert.throws(() => gaEventAttributes({ ...valid, label: '' }), TypeError);
  assert.throws(() => gaEventAttributes({ ...valid, label: '   ' }), TypeError);
  assert.throws(() => gaEventAttributes({ ...valid, location: '' }), TypeError);
  assert.throws(() => gaEventAttributes({ ...valid, url: '' }), TypeError);
});

test('siteLinkGaAttributes tags exactly the tracked catalog links', () => {
  const resolved = resolveSiteLinks('en-US', {
    rssFeedUrl: '/rss.xml',
    rssLocaleFeedUrl: '/rss.en.xml',
    extraLinks: {
      quick: [{ id: 'constructor', label: 'Custom', href: 'https://example.test/' }, { label: 'Unnamed', href: '/x' }],
    },
  });
  const links = [...resolved.header, ...resolved.quick, ...resolved.community, ...resolved.filings];
  const tracked = links.filter((link) => Object.keys(siteLinkGaAttributes(link, 'footer')).length > 0);

  assert.deepEqual(
    [...new Set(tracked.map((link) => link.id))].sort(),
    Object.keys(TRACKED_SITE_LINKS).sort(),
  );
  for (const id of ['rss', 'rssLocale', 'sitemap', 'about', 'contactEmail', 'qqGroup', 'icpFiling',
    'publicSecurityFiling', 'constructor', 'quick-custom-2']) {
    assert.deepEqual(siteLinkGaAttributes({ id }, 'footer'), {}, `${id} is not tracked`);
    assert.ok(links.some((link) => link.id === id), `${id} was exercised`);
  }
  for (const site of resolved.relatedSites) {
    assert.deepEqual(siteLinkGaAttributes(site, 'footer'), {}, `${site.id} related site is not tracked`);
  }
});

test('labels are stable ids that survive locale and destination overrides', () => {
  const english = resolveSiteLinks('en-US').quick.find((link) => link.id === 'downloadClient');
  const chinese = resolveSiteLinks('zh-CN').quick.find((link) => link.id === 'downloadClient');
  assert.notEqual(english.label, chinese.label);
  assert.deepEqual(siteLinkGaAttributes(english, 'footer'), siteLinkGaAttributes(chinese, 'footer'));
  assert.equal(siteLinkGaAttributes(english, 'footer')['data-ga-label'], 'downloadClient');

  const overridden = resolveSiteLinks('en-US', { overrides: { github: { href: 'https://example.test/repo' } } })
    .community.find((link) => link.id === 'github');
  assert.equal(overridden.href, 'https://example.test/repo');
  assert.deepEqual(siteLinkGaAttributes(overridden, 'footer'), {
    'data-ga-category': 'community',
    'data-ga-label': 'github',
    'data-ga-location': 'footer',
  });
});

test('handleGaClick sends one event with the contract parameters', () => {
  const anchor = tag('download', 'downloadClient', 'footer');
  anchor.href = 'https://www.hagicode.com/en-US/desktop/';
  const sent = collect(clickPath(new FakeElement(), anchor, new FakeElement(), {}));

  assert.deepEqual(sent, [[
    'download_click',
    {
      event_category: 'download',
      event_label: 'downloadClient',
      link_location: 'footer',
      link_url: 'https://www.hagicode.com/en-US/desktop/',
      transport_type: 'beacon',
    },
  ]]);

  const [[navigationAction, navigation]] = collect(clickPath(
    Object.assign(tag('navigation', 'blog', 'header'), { href: 'https://docs.hagicode.com/blog/' }),
  ));
  assert.equal(navigationAction, 'link_click');
  assert.equal(navigation.event_category, 'navigation');
  assert.equal(navigation.link_location, 'header');
});

test('handleGaClick falls back from href property to the href attribute', () => {
  const [[, params]] = collect(clickPath(new FakeElement({
    'data-ga-category': 'community',
    'data-ga-label': 'discord',
    'data-ga-location': 'footer',
    href: '/relative',
  })));
  assert.equal(params.link_url, '/relative');
});

test('handleGaClick ignores untagged clicks and malformed tags without throwing', () => {
  assert.deepEqual(collect(clickPath(new FakeElement({ href: '/x' }), {})), []);
  assert.deepEqual(collect(clickPath()), []);
  assert.deepEqual(collect(clickPath(tag('purchase', 'x'))), []);
  assert.deepEqual(collect(clickPath(tag('download', ''))), []);
  assert.deepEqual(collect(clickPath(tag('download', 'x', ''))), []);
  assert.deepEqual(collect({ composedPath: () => { throw new Error('boom'); } }), []);
  assert.doesNotThrow(() => handleGaClick(clickPath(tag('download', 'x')), () => { throw new Error('boom'); }));
});

test('handleGaClick resolves nested tags to the first tagged element only', () => {
  const inner = tag('navigation', 'home', 'article_promotion', 'https://www.hagicode.com/');
  const outer = tag('download', 'downloadClient');
  const sent = collect(clickPath(inner, outer));
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1].event_label, 'home');

  const invalidInner = collect(clickPath(tag('purchase', 'x'), outer));
  assert.deepEqual(invalidInner, [], 'an invalid inner tag does not fall through to an ancestor');
});

test('Store badge host reports its data-ga-url for the badge and the fallback link', () => {
  const store = 'https://apps.microsoft.com/detail/9N3PM0N3SVDW';
  const host = tag('download', 'microsoftStore', 'article_promotion', store);
  const fallback = new FakeElement({ href: store }, { href: store });
  for (const path of [[new FakeElement(), host], [fallback, new FakeElement(), host]]) {
    const sent = collect(clickPath(...path));
    assert.equal(sent.length, 1);
    assert.deepEqual(
      [sent[0][0], sent[0][1].event_label, sent[0][1].link_location, sent[0][1].link_url],
      ['download_click', 'microsoftStore', 'article_promotion', store],
    );
  }
});

test('handleGaClick never cancels or alters the event', () => {
  let touched = false;
  const event = {
    composedPath: () => [tag('download', 'x')],
    preventDefault: () => { touched = true; },
    stopPropagation: () => { touched = true; },
    stopImmediatePropagation: () => { touched = true; },
  };
  handleGaClick(event, () => {});
  assert.equal(touched, false);
});

test('installGaEventTracking is idempotent per document and silent without gtag', () => {
  const document = new FakeElement();
  let listeners = 0;
  const addEventListener = document.addEventListener.bind(document);
  document.addEventListener = (...args) => { listeners += 1; addEventListener(...args); };
  const calls = [];
  let gtag;
  const getGtag = () => gtag;

  assert.equal(installGaEventTracking(document, getGtag), true);
  assert.equal(installGaEventTracking(document, getGtag), false);
  assert.equal(listeners, 1);

  const click = () => document.dispatchEvent(new Event('click'));
  Object.assign(document.attributes, {
    'data-ga-category': 'community',
    'data-ga-label': 'github',
    'data-ga-location': 'footer',
    'data-ga-url': 'https://github.com/HagiCode-org/site',
  });

  assert.doesNotThrow(click, 'no gtag, no event, no error');
  gtag = 'not a function';
  assert.doesNotThrow(click);
  gtag = (...args) => calls.push(args);
  click();

  assert.deepEqual(calls, [[
    'event',
    'link_click',
    {
      event_category: 'community',
      event_label: 'github',
      link_location: 'footer',
      link_url: 'https://github.com/HagiCode-org/site',
      transport_type: 'beacon',
    },
  ]]);

  const other = new FakeElement();
  assert.equal(installGaEventTracking(other, getGtag), true, 'a different document gets its own listener');
});
