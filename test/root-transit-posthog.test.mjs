import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROOT_TRANSIT_DELAY_MS, mountRootTransit, reportLocaleRedirect } from '@hagicode/hagilight-core/root-transit';

/** A PostHog double that records captures; `opted` makes it report opt-out. */
function sdk({ opted = false } = {}) {
  const calls = [];
  return {
    calls,
    __loaded: true,
    capture(name, properties, options) { calls.push({ name, properties, options }); },
    has_opted_out_capturing() { return opted; },
  };
}

/** A window double; without a supported browser language or stored value the resolver falls to `default`. */
function windowAt(url, { stored, languages = [], posthog } = {}) {
  const location = new URL(url);
  return Object.assign(new EventTarget(), {
    location: { href: location.href, search: location.search },
    localStorage: { getItem: (key) => (key === 'hagicode:site-locale' ? stored ?? null : null) },
    navigator: { languages },
    posthog,
  });
}

const ZH = 'zh-CN';
const JA = 'ja-JP';

test('an automatic forward to a known locale reports from root, the destination locale and the resolved reason', () => {
  const posthog = sdk();
  reportLocaleRedirect(windowAt('https://consumer.example/?utm=a', { posthog }), `/${ZH}/`, '/');
  assert.deepEqual(posthog.calls, [{
    name: 'locale_redirected',
    properties: { from: 'root', to: ZH, reason: 'default' },
    options: { transport: 'sendBeacon' },
  }]);
});

test('the reason follows the resolver: query, then stored, then browser, then default', () => {
  const reasons = [
    [windowAt(`https://consumer.example/?lang=${ZH}`, { posthog: sdk() }), 'query'],
    [windowAt('https://consumer.example/', { stored: ZH, posthog: sdk() }), 'stored'],
    [windowAt('https://consumer.example/', { languages: ['zh-CN'], posthog: sdk() }), 'browser'],
    [windowAt('https://consumer.example/', { languages: ['xx-YY'], posthog: sdk() }), 'default'],
    [windowAt('https://consumer.example/', { posthog: sdk() }), 'default'],
  ];
  for (const [win, reason] of reasons) {
    reportLocaleRedirect(win, `/${ZH}/`, '/');
    assert.equal(win.posthog.calls[0].properties.reason, reason);
  }
});

test('the locale is read after the deployment base, and unknown destinations send nothing', () => {
  const posthog = sdk();
  reportLocaleRedirect(windowAt('https://consumer.example/manual/', { posthog }), `/manual/${JA}/`, '/manual/');
  assert.equal(posthog.calls[0].properties.to, JA);
  reportLocaleRedirect(windowAt('https://consumer.example/', { posthog }), '/docs/getting-started/', '/');
  reportLocaleRedirect(windowAt('https://consumer.example/', { posthog }), '/xx-YY/', '/');
  assert.equal(posthog.calls.length, 1, 'only the known locale is reported');
});

test('no capture when PostHog is absent, opted out, or throws', () => {
  assert.doesNotThrow(() => reportLocaleRedirect(windowAt('https://consumer.example/', { posthog: undefined }), `/${ZH}/`, '/'));
  const opted = sdk({ opted: true });
  reportLocaleRedirect(windowAt('https://consumer.example/', { posthog: opted }), `/${ZH}/`, '/');
  assert.deepEqual(opted.calls, []);
  const throwing = windowAt('https://consumer.example/', { posthog: undefined });
  Object.defineProperty(throwing, 'posthog', { get() { throw new Error('getter failed'); } });
  assert.doesNotThrow(() => reportLocaleRedirect(throwing, `/${ZH}/`, '/'));
});

/** A root-transit page with one continue link and one alternative, as RootTransit.astro renders it. */
function transitPage(t, win) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const anchor = Object.assign(new EventTarget(), { href: `/${ZH}/`, getAttribute() { return this.href; } });
  const alternative = Object.assign(new EventTarget(), { href: '/en-US/', getAttribute() { return this.href; } });
  const page = { dataset: { base: '/' }, querySelector: () => anchor, querySelectorAll: () => [alternative] };
  const navigations = [];
  const doc = Object.assign(new EventTarget(), {
    querySelector: (selector) => (selector === '[data-splash]' || selector === '[data-locale-monitor]' ? null : page),
    documentElement: { dataset: {} },
  });
  Object.assign(win, {
    document: doc,
    location: { ...win.location, replace: (url) => navigations.push(url) },
    setTimeout, clearTimeout,
  });
  return { anchor, navigations };
}

test('the timer-driven forward reports the redirect once', (t) => {
  const posthog = sdk();
  const win = windowAt('https://consumer.example/?utm=test', { posthog });
  const { navigations } = transitPage(t, win);
  mountRootTransit(win);
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS);
  assert.equal(navigations.length, 1);
  assert.deepEqual(posthog.calls.map(({ name, properties }) => [name, properties]), [
    ['locale_redirected', { from: 'root', to: ZH, reason: 'default' }],
  ]);
});

test('a click-driven forward navigates without reporting a redirect', (t) => {
  const posthog = sdk();
  const win = windowAt('https://consumer.example/?utm=test', { posthog });
  const { anchor, navigations } = transitPage(t, win);
  mountRootTransit(win);
  anchor.dispatchEvent(Object.assign(new Event('click', { cancelable: true }), {
    button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
  }));
  assert.equal(navigations.length, 1, 'the click forward navigates');
  assert.deepEqual(posthog.calls, []);
});
