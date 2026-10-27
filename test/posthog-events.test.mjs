import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installGaEventTracking } from '@hagicode/hagilight-core/analytics-events';
import {
  POSTHOG_CONTENT_WIDTHS,
  POSTHOG_EVENTS,
  POSTHOG_FRAMEWORKS,
  POSTHOG_PAGE_TYPES,
  POSTHOG_REDIRECT_REASONS,
  POSTHOG_REQUIRED_PROPERTIES,
  POSTHOG_SUPER_PROPERTIES,
  capturePostHogEvent,
  classifyPagePath,
  destinationOf,
  installPostHogClickTracking,
  referrerDomain,
  resolvePageType,
  sanitizePath,
  sanitizePostHogProperties,
} from '@hagicode/hagilight-core/posthog-events';

const PAGE = 'https://hagilight.example/docs/intro/';
const CTA = { category: 'download', label: 'downloadClient', location: 'footer' };

class FakeElement {
  constructor(attributes = {}, props = {}) {
    this.attributes = attributes;
    Object.assign(this, props);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
}

const tag = (label = 'downloadClient', { category = 'download', location = 'footer', url, href } = {}) => new FakeElement({
  'data-ga-category': category,
  'data-ga-label': label,
  'data-ga-location': location,
  ...(url ? { 'data-ga-url': url } : {}),
}, href ? { href } : {});

/** A click whose composed path is `path`; records whether anything cancelled or stopped it. */
function clickPath(...path) {
  return {
    composedPath: () => path,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
  };
}

function fakeSdk(state = {}) {
  const calls = [];
  const sdk = {
    calls,
    __loaded: state.loaded ?? true,
    capture(name, properties) { calls.push([name, properties]); },
    has_opted_out_capturing() { return state.optedOut === true; },
    // Must never be reached: Hagilight calls only `capture` and the opt-out query.
    identify() { throw new Error('identify must not be called'); },
    opt_in_capturing() { throw new Error('opt_in_capturing must not be called'); },
    opt_out_capturing() { throw new Error('opt_out_capturing must not be called'); },
    startSessionRecording() { throw new Error('session replay must not be started'); },
  };
  return sdk;
}

function fakeTarget() {
  const listeners = [];
  return { listeners, addEventListener(type, listener, options) { listeners.push({ type, listener, options }); } };
}

function dispatch(target, event) {
  for (const { type, listener } of target.listeners) if (type === 'click') listener(event);
}

function withPage(href, run) {
  const previous = globalThis.location;
  globalThis.location = { href };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.location;
    else globalThis.location = previous;
  }
}

test('the vocabulary is a deliberate snapshot: changing it fails here until this list is updated', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(POSTHOG_EVENTS)), {
    cta_click: ['category', 'label', 'location', 'destination_host', 'is_external'],
    promoto_impression: ['promo_id', 'position', 'rotating'],
    promoto_dismissed: ['promo_id', 'visible_ms', 'seen_count'],
    promoto_paged: ['from', 'to', 'method'],
    not_found_viewed: ['path', 'referrer_domain'],
    search_used: ['query_length', 'results_count', 'locale', 'query'],
    search_result_clicked: ['rank', 'results_count'],
    code_copied: ['language', 'page_type', 'is_install_page'],
    article_promotion_impression: ['variant', 'path'],
    locale_changed: ['from', 'to'],
    locale_redirected: ['from', 'to', 'reason'],
    theme_changed: ['theme'],
    content_width_changed: ['choice'],
  });
  assert.deepEqual([...POSTHOG_SUPER_PROPERTIES], ['site_id', 'site_framework', 'hagilight_version', 'locale', 'page_type']);
  assert.deepEqual([...POSTHOG_PAGE_TYPES], ['home', 'docs', 'blog', 'compare', '404', 'other']);
  assert.deepEqual([...POSTHOG_FRAMEWORKS], ['astro', 'starlight', 'docusaurus']);
  assert.ok(Object.isFrozen(POSTHOG_EVENTS));
});

test('destinations keep only a lowercase host and an external flag', () => {
  assert.deepEqual(destinationOf('https://GitHub.com/HagiCode-org/releases/latest?ref=x#y', PAGE), { host: 'github.com', isExternal: true });
  assert.deepEqual(destinationOf('/support/?a=b#c', PAGE), { host: 'hagilight.example', isExternal: false });
  assert.deepEqual(destinationOf('https://hagilight.example/blog/', PAGE), { host: 'hagilight.example', isExternal: false });
  assert.deepEqual(destinationOf('https://user:secret@docs.example.test:8443/x', PAGE), { host: 'docs.example.test', isExternal: true });
  assert.deepEqual(destinationOf('mailto:team@example.test', PAGE), { isExternal: false });
  assert.deepEqual(destinationOf('javascript:alert(1)', PAGE), { isExternal: false });
  assert.deepEqual(destinationOf('http://[::', PAGE), { isExternal: false });
  assert.deepEqual(destinationOf(undefined, PAGE), { isExternal: false });
});

test('sanitizing keeps only allowlisted primitive values and reduces URL values to hosts', () => {
  assert.deepEqual(sanitizePostHogProperties('cta_click', {
    category: 'download',
    label: 'downloadClient',
    location: 'footer',
    destination_host: 'https://u:p@evil.example/a?q=1#h',
    is_external: true,
    extra: 'dropped',
    nan: Number.NaN,
    object: {},
  }), { category: 'download', label: 'downloadClient', location: 'footer', destination_host: 'evil.example', is_external: true });
  assert.deepEqual(sanitizePostHogProperties('cta_click', { destination_host: 'Evil.Example/path?x' }), {});
  assert.deepEqual(sanitizePostHogProperties('cta_click', { is_external: Number.POSITIVE_INFINITY, label: 'x' }), { label: 'x' });
  assert.deepEqual(sanitizePostHogProperties('unknown_event', { label: 'x' }), {});
  assert.deepEqual(sanitizePostHogProperties('cta_click', null), {});
});

test('page types fall back to other, and classification never yields 404', () => {
  assert.equal(resolvePageType('compare'), 'compare');
  assert.equal(resolvePageType('404'), '404');
  assert.equal(resolvePageType('nope'), 'other');
  assert.equal(resolvePageType(undefined), 'other');
  assert.equal(classifyPagePath('/'), 'home');
  assert.equal(classifyPagePath('/getting-started/'), 'docs');
  assert.equal(classifyPagePath('/blog/launch/'), 'blog');
  assert.equal(classifyPagePath('/compare/alternative/'), 'compare');
  assert.equal(classifyPagePath('/zh-CN/blog/x/', { locales: ['zh-CN'] }), 'blog');
  assert.equal(classifyPagePath('/zh-CN/', { locales: ['zh-CN'] }), 'home');
  assert.equal(classifyPagePath('/hagilight/blog/x', { base: '/hagilight/' }), 'blog');
  assert.equal(classifyPagePath('/hagilight/', { base: '/hagilight/' }), 'home');
  for (const path of ['/', '/404', '/x/404/', '/blog/404']) assert.notEqual(classifyPagePath(path), '404', path);
});

test('the capture helper sends nothing without PostHog, without capture, when opted out, or when nothing survives sanitizing', () => {
  assert.doesNotThrow(() => capturePostHogEvent('cta_click', CTA, undefined));
  const opted = fakeSdk({ optedOut: true });
  capturePostHogEvent('cta_click', CTA, opted);
  assert.deepEqual(opted.calls, []);
  capturePostHogEvent('cta_click', CTA, {});
  capturePostHogEvent('unknown_event', CTA, fakeSdk());
  const empty = fakeSdk();
  capturePostHogEvent('cta_click', { unlisted: 'x' }, empty);
  assert.deepEqual(empty.calls, []);
});

test('the capture helper sends one allowlisted call and never identifies or changes consent', () => {
  const sdk = fakeSdk();
  capturePostHogEvent('cta_click', { ...CTA, destination_host: 'github.com', is_external: true, path: '/secret', query: '?a=b' }, sdk);
  assert.deepEqual(sdk.calls, [['cta_click', { ...CTA, destination_host: 'github.com', is_external: true }]]);
});

test('the opt-out query is skipped while the SDK is still a stub, so the capture queues', () => {
  let optOutChecks = 0;
  const stub = {
    __loaded: false,
    queued: [],
    capture(name, properties) { this.queued.push([name, properties]); },
    has_opted_out_capturing() { optOutChecks++; return true; },
  };
  capturePostHogEvent('cta_click', CTA, stub);
  assert.equal(optOutChecks, 0);
  assert.equal(stub.queued.length, 1);
});

test('the capture helper swallows SDK failures', () => {
  assert.doesNotThrow(() => capturePostHogEvent('cta_click', CTA, { capture() { throw new Error('boom'); } }));
  assert.doesNotThrow(() => capturePostHogEvent('cta_click', CTA, {
    __loaded: true,
    capture() {},
    has_opted_out_capturing() { throw new Error('boom'); },
  }));
});

test('cta_click carries the destination host and external flag for external, internal and nested links', () => {
  withPage(PAGE, () => {
    const runClick = (...path) => {
      const sdk = fakeSdk();
      const target = fakeTarget();
      installPostHogClickTracking(target, () => sdk);
      dispatch(target, clickPath(...path));
      return sdk.calls;
    };

    const external = runClick(tag('download', { url: 'https://github.com/HagiCode-org/releases/latest?ref=x#y' }));
    assert.deepEqual(external, [['cta_click', { category: 'download', label: 'download', location: 'footer', destination_host: 'github.com', is_external: true }]]);

    const internal = runClick(tag('support', { category: 'navigation', url: '/support/?ref=a#b' }));
    assert.deepEqual(internal, [['cta_click', { category: 'navigation', label: 'support', location: 'footer', destination_host: 'hagilight.example', is_external: false }]]);

    const inner = tag('inner', { url: 'https://docs.example.test/x' });
    const outer = tag('outer', { url: 'https://other.example.test/' });
    const nested = runClick(inner, outer);
    assert.equal(nested.length, 1, 'only the innermost first-in-path element is reported');
    assert.equal(nested[0][1].label, 'inner');

    const fromHref = runClick(tag('docs', { href: 'https://docs.example.test/page' }));
    assert.equal(fromHref[0][1].destination_host, 'docs.example.test');
    assert.equal(fromHref[0][1].is_external, true);

    for (const [, properties] of [...external, ...internal, ...nested, ...fromHref]) {
      const text = JSON.stringify(properties);
      assert.doesNotMatch(text, /[/?#]/u, `no path, query or hash in ${text}`);
    }
  });
});

test('malformed or non-HTTP destinations omit the host and report not external', () => {
  withPage(PAGE, () => {
    for (const url of ['javascript:alert(1)', 'mailto:team@example.test', 'http://[::', 'data:text/html,hi']) {
      const sdk = fakeSdk();
      const target = fakeTarget();
      installPostHogClickTracking(target, () => sdk);
      dispatch(target, clickPath(tag('odd', { url })));
      assert.deepEqual(sdk.calls[0][1], { category: 'download', label: 'odd', location: 'footer', is_external: false }, url);
    }
  });
});

test('clicks with no marked element, an unknown category, or a missing label or location send nothing', () => {
  withPage(PAGE, () => {
    const sdk = fakeSdk();
    const target = fakeTarget();
    installPostHogClickTracking(target, () => sdk);
    dispatch(target, clickPath(new FakeElement({}), new FakeElement({ 'data-ga-category': 'download' })));
    dispatch(target, clickPath(tag('x', { category: 'unknown' })));
    dispatch(target, clickPath(new FakeElement({ 'data-ga-category': 'download', 'data-ga-label': 'x' })));
    assert.deepEqual(sdk.calls, []);
  });
});

test('the PostHog sink captures with gtag undefined and stays silent without PostHog', () => {
  withPage(PAGE, () => {
    const sdk = fakeSdk();
    const target = fakeTarget();
    installPostHogClickTracking(target, () => sdk);
    dispatch(target, clickPath(tag()));
    assert.equal(sdk.calls.length, 1);

    const absent = fakeTarget();
    installPostHogClickTracking(absent, () => undefined);
    assert.doesNotThrow(() => dispatch(absent, clickPath(tag())));
  });
});

test('Google Analytics and PostHog both receive their own event on one click', () => {
  withPage(PAGE, () => {
    const gaSent = [];
    const sdk = fakeSdk();
    const target = fakeTarget();
    installGaEventTracking(target, () => (...args) => gaSent.push(args));
    installPostHogClickTracking(target, () => sdk);
    dispatch(target, clickPath(tag('downloadClient', { url: 'https://github.com/x' })));
    assert.equal(gaSent.length, 1);
    assert.equal(gaSent[0][1], 'download_click');
    assert.equal(sdk.calls.length, 1);
    assert.equal(sdk.calls[0][0], 'cta_click');
  });
});

test('opting out silences the sink, and a later opt-in is captured without reinstalling', () => {
  withPage(PAGE, () => {
    const state = { optedOut: true };
    const sdk = fakeSdk(state);
    const target = fakeTarget();
    assert.equal(installPostHogClickTracking(target, () => sdk), true);
    dispatch(target, clickPath(tag()));
    assert.deepEqual(sdk.calls, []);
    state.optedOut = false;
    dispatch(target, clickPath(tag()));
    assert.equal(sdk.calls.length, 1);
    assert.equal(target.listeners.filter(({ type }) => type === 'click').length, 1);
  });
});

test('the sink is installed once per document and never cancels or stops a click', () => {
  const target = fakeTarget();
  assert.equal(installPostHogClickTracking(target, () => undefined), true);
  assert.equal(installPostHogClickTracking(target, () => undefined), false);
  assert.equal(installPostHogClickTracking(target, () => undefined), false);
  const clicks = target.listeners.filter(({ type }) => type === 'click');
  assert.equal(clicks.length, 1);
  assert.deepEqual(clicks[0].options, { capture: true, passive: true });

  withPage(PAGE, () => {
    const sdk = fakeSdk();
    const fresh = fakeTarget();
    installPostHogClickTracking(fresh, () => sdk);
    const event = clickPath(tag());
    dispatch(fresh, event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(event.propagationStopped, false);
  });
});

const INTERACTION_EVENTS = [
  'not_found_viewed', 'search_used', 'search_result_clicked', 'code_copied',
  'article_promotion_impression', 'locale_changed', 'locale_redirected', 'theme_changed', 'content_width_changed',
];

test('the interaction vocabulary has the reviewed closed value lists and required properties', () => {
  assert.deepEqual([...POSTHOG_REDIRECT_REASONS], ['query', 'stored', 'browser', 'default']);
  assert.deepEqual([...POSTHOG_CONTENT_WIDTHS], ['narrow', 'wide']);
  assert.deepEqual(POSTHOG_REQUIRED_PROPERTIES.search_used, ['query_length', 'results_count', 'locale']);
  assert.deepEqual(POSTHOG_REQUIRED_PROPERTIES.locale_redirected, ['from', 'to', 'reason']);
  for (const name of INTERACTION_EVENTS) {
    for (const required of POSTHOG_REQUIRED_PROPERTIES[name] ?? []) {
      assert.ok(POSTHOG_EVENTS[name].includes(required), `${name}.${required} must be allowlisted`);
    }
  }
});

test('path drops the query and fragment, and referrers reduce to a host name', () => {
  assert.equal(sanitizePath('/docs/a?token=1#top'), '/docs/a');
  assert.equal(sanitizePath('https://hagilight.example/docs/b/?x=1'), '/docs/b/');
  assert.equal(sanitizePath('docs/relative'), undefined);
  assert.equal(sanitizePath(42), undefined);
  assert.equal(referrerDomain('https://Example.org/path?q=secret#frag'), 'example.org');
  assert.equal(referrerDomain(''), undefined);
  assert.equal(referrerDomain('not a url'), undefined);
  assert.equal(referrerDomain(undefined), undefined);
});

test('not_found_viewed sends the path without query or fragment and an optional referrer domain', () => {
  const sdk = fakeSdk();
  capturePostHogEvent('not_found_viewed', { path: '/docs/a?token=1#top', referrer_domain: 'example.org' }, sdk);
  capturePostHogEvent('not_found_viewed', { path: '/docs/missing/' }, sdk);
  capturePostHogEvent('not_found_viewed', { referrer_domain: 'example.org' }, sdk);
  assert.deepEqual(sdk.calls, [
    ['not_found_viewed', { path: '/docs/a', referrer_domain: 'example.org' }],
    ['not_found_viewed', { path: '/docs/missing/' }],
  ]);
});

test('a required property that is missing or invalid drops the whole event', () => {
  const sdk = fakeSdk();
  capturePostHogEvent('search_used', { query_length: 4, results_count: -1, locale: 'en-US' }, sdk);
  capturePostHogEvent('search_used', { query_length: '4', results_count: 2, locale: 'en-US' }, sdk);
  capturePostHogEvent('search_used', { query_length: 4, results_count: 2 }, sdk);
  capturePostHogEvent('search_result_clicked', { rank: 0, results_count: 3 }, sdk);
  capturePostHogEvent('locale_changed', { from: 'en-US', to: 'not a locale!' }, sdk);
  capturePostHogEvent('locale_redirected', { from: 'root', to: 'zh-CN', reason: 'guess' }, sdk);
  capturePostHogEvent('theme_changed', { theme: 'Ocean Light!' }, sdk);
  capturePostHogEvent('content_width_changed', { choice: 'huge' }, sdk);
  assert.deepEqual(sdk.calls, []);
});

test('every capture passes the send-beacon transport option', () => {
  const seen = [];
  const sdk = {
    __loaded: true,
    capture(name, properties, options) { seen.push(options); },
    has_opted_out_capturing() { return false; },
  };
  capturePostHogEvent('locale_changed', { from: 'en-US', to: 'zh-CN' }, sdk);
  assert.deepEqual(seen, [{ transport: 'sendBeacon' }]);
});

test('enumerated and numeric properties reject free text, so no search text or code can enter an event', () => {
  const canary = 'Sec ret/?#CANARY';
  const sdk = fakeSdk();
  for (const name of INTERACTION_EVENTS) {
    const input = Object.fromEntries(POSTHOG_EVENTS[name].map((property) => [property, canary]));
    capturePostHogEvent(name, input, sdk);
  }
  assert.deepEqual(sdk.calls, []);
  assert.doesNotMatch(JSON.stringify(sdk.calls), /CANARY/u);
});

test('a numeric property receiving a fraction or negative number is dropped', () => {
  assert.deepEqual(sanitizePostHogProperties('search_used', { query_length: 1.5, results_count: -2, locale: 'en' }), { locale: 'en' });
  assert.deepEqual(sanitizePostHogProperties('search_result_clicked', { rank: 1, results_count: 0 }), { rank: 1, results_count: 0 });
});
