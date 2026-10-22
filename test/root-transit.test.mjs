import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ROOT_TRANSIT_DELAY_MS, resolveTransitDestination, resolveTransitNavigation, mountRootTransit,
} from '@hagicode/hagilight-core/root-transit';
import { detectedRows, localeMonitorFake } from './support/locale-monitor-fake.mjs';

const site = 'https://consumer.example';

test('destination resolution applies the deployment base once and accepts same-origin HTTP(S)', () => {
  for (const [destination, base, expected] of [
    ['/en-US/', '/', '/en-US/'],
    ['en-US/', '/manual/', '/manual/en-US/'],
    ['/en-US/', '/manual/', '/manual/en-US/'],
    ['/manual/en-US/', '/manual/', '/manual/en-US/'],
    ['https://consumer.example/manual/en-US/', '/manual/', '/manual/en-US/'],
    ['/manual/en-US/?view=all#start', '/manual', '/manual/en-US/?view=all#start'],
  ]) assert.equal(resolveTransitDestination(destination, { site, base }), expected);
  assert.equal(resolveTransitDestination('/en-US/', { site: 'http://localhost:4321' }), '/en-US/');
});

test('invalid, external, escaping and self-targeting routes fail during rendering', () => {
  assert.throws(() => resolveTransitDestination('.', { site, base: '/caf%C3%A9/' }), /transit root/u);
  for (const base of ['/', '/manual/']) {
    for (const destination of [
      undefined, '', ' ', '/', '.', './', './?lang=zh-CN#start', 'index.html', '%69ndex.html',
      'a/../', '%2e/', 'javascript:alert(1)', 'data:text/html,no', 'mailto:a@example.com',
      'https://other.example/en-US/', '//other.example/en-US/', '/%2f', '/%5c', '/broken%xx',
      'https://user:password@consumer.example/en-US/', '\\other.example', '/en\n-US/',
      ...(base === '/' ? [] : ['/manual', '/manual/', '/manual/index.html', '../outside/', `${site}/outside/`]),
    ]) assert.throws(() => resolveTransitDestination(destination, { site, base }), TypeError, `${base}: ${destination}`);
  }
});

test('browser search and fragment are carried without allowing incoming parameters to select a route', () => {
  assert.equal(resolveTransitNavigation('/en-US/', new URL(`${site}/?next=https://evil.test&lang=zh-CN#features`)), '/en-US/?next=https://evil.test&lang=zh-CN#features');
  assert.equal(resolveTransitNavigation('/manual/en-US/?default=1#intro', new URL(`${site}/manual/?utm=a&utm=b#deep`), '/manual/'), '/manual/en-US/?utm=a&utm=b#deep');
  assert.equal(resolveTransitNavigation('/en-US/?default=1#intro', new URL(site)), '/en-US/?default=1#intro');
});

function harness(t, splash = null, monitor = null) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const anchor = Object.assign(new EventTarget(), { href: '/en-US/', getAttribute() { return this.href; } });
  const alternative = Object.assign(new EventTarget(), { href: '/zh-CN/', getAttribute() { return this.href; } });
  const page = { dataset: { base: '/' }, querySelector: () => anchor, querySelectorAll: () => [alternative] };
  const doc = Object.assign(new EventTarget(), {
    querySelector: (selector) => {
      if (selector === '[data-splash]') return splash?.figure ?? null;
      if (selector === '[data-locale-monitor]') return monitor?.panel ?? null;
      return page;
    },
    documentElement: { dataset: {} },
  });
  if (monitor) Object.defineProperty(doc, 'cookie', { get: () => monitor.doc.cookie, set: (value) => { monitor.doc.cookie = value; } });
  const navigations = [];
  const win = Object.assign(new EventTarget(), {
    document: doc,
    location: { href: `${site}/?utm=test#deep`, replace: (url) => navigations.push(url), ...monitor?.win.location },
    setTimeout, clearTimeout,
    caches: splash?.caches,
    fetch: splash?.fetch,
    requestIdleCallback: splash?.requestIdleCallback,
    localStorage: monitor?.win.localStorage,
    navigator: monitor?.win.navigator,
  });
  return { win, anchor, alternative, page, navigations };
}

/** A splash figure with its image and the data attributes that RootTransit.astro renders. */
function splashFigure() {
  const img = Object.assign(new EventTarget(), {
    src: undefined,
    removeAttribute(name) { if (name === 'src') this.src = undefined; },
  });
  const figure = Object.assign(new EventTarget(), {
    dataset: { splashBase: 'https://img-gen.hagicode.com', splashPrefix: 'startup-splash', splashCount: '600', splashCache: 'hagilight.rootTransit.splash' },
    querySelector: (selector) => (selector === 'img' ? img : null),
    remove() { this.removed = true; },
    removed: false,
  });
  return { figure, img };
}

function fakeCaches(entries = new Map()) {
  const cache = {
    entries,
    match: async (url) => entries.get(url)?.clone(),
    put: async (url, response) => { entries.set(url, response); },
    delete: async (url) => entries.delete(typeof url === 'string' ? url : url.url),
    keys: async () => [...entries.keys()].map((url) => new Request(url)),
  };
  return { open: async () => cache, cache };
}

// Response bodies are read across several macrotasks, so one turn is not enough to let a load finish.
const settle = async () => { for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setImmediate(resolve)); };
const never = () => new Promise(() => {});
const SPLASH_READ_BUDGET_MS = 100;
const splashPattern = /^https:\/\/img-gen\.hagicode\.com\/startup-splash\/hagicode-splash-\d{3}\.avif$/u;

test('the reference timer replaces once, is independent of effects, and mounts once per page', (t) => {
  const { win, anchor, navigations } = harness(t);
  assert.equal(mountRootTransit(win), mountRootTransit(win));
  assert.equal(anchor.href, '/en-US/?utm=test#deep');
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS - 1);
  assert.deepEqual(navigations, []);
  t.mock.timers.tick(1);
  t.mock.timers.tick(10000);
  assert.deepEqual(navigations, ['/en-US/?utm=test#deep']);
});

test('manual activation bypasses the timer and uses the same history replacement target', (t) => {
  const { win, anchor, navigations } = harness(t);
  mountRootTransit(win);
  const click = Object.assign(new Event('click', { cancelable: true }), { button: 0 });
  anchor.dispatchEvent(click);
  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(navigations, [anchor.href]);
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS);
  assert.equal(navigations.length, 1);
});

for (const event of ['pagehide', 'astro:before-swap']) {
  test(`${event} cancels pending forwarding`, (t) => {
    const { win, navigations } = harness(t);
    mountRootTransit(win);
    (event === 'pagehide' ? win : win.document).dispatchEvent(new Event(event));
    t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS);
    assert.deepEqual(navigations, []);
  });
}

test('modified continuation clicks keep native browser behavior', (t) => {
  const { win, anchor, navigations } = harness(t);
  mountRootTransit(win);
  const click = Object.assign(new Event('click', { cancelable: true }), { button: 0, ctrlKey: true });
  anchor.dispatchEvent(click);
  assert.equal(click.defaultPrevented, false);
  assert.deepEqual(navigations, []);
});

test('manual language alternatives preserve their configured route and also replace transit history', (t) => {
  const { win, alternative, navigations } = harness(t);
  mountRootTransit(win);
  alternative.dispatchEvent(Object.assign(new Event('click', { cancelable: true }), { button: 0 }));
  assert.deepEqual(navigations, ['/zh-CN/?utm=test#deep']);
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS);
  assert.equal(navigations.length, 1);
});

test('a splash that never settles leaves the forward timer and the continuation click on time', async (t) => {
  const { figure, img } = splashFigure();
  const { win, anchor, navigations } = harness(t, { figure, caches: { open: never }, fetch: never, requestIdleCallback: undefined });
  mountRootTransit(win);
  t.mock.timers.tick(0);
  t.mock.timers.tick(SPLASH_READ_BUDGET_MS);
  await settle();
  assert.match(img.src, splashPattern, 'the network image is requested once the read budget ends');
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS - 1 - SPLASH_READ_BUDGET_MS);
  assert.deepEqual(navigations, []);
  t.mock.timers.tick(1);
  assert.deepEqual(navigations, ['/en-US/?utm=test#deep']);
  assert.equal(anchor.href, '/en-US/?utm=test#deep');
});

test('a continuation click forwards at once while the splash is still pending', async (t) => {
  const { figure } = splashFigure();
  const { win, anchor, navigations } = harness(t, { figure, caches: { open: never }, fetch: never });
  mountRootTransit(win);
  t.mock.timers.tick(0);
  anchor.dispatchEvent(Object.assign(new Event('click', { cancelable: true }), { button: 0 }));
  assert.deepEqual(navigations, ['/en-US/?utm=test#deep']);
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS);
  assert.equal(navigations.length, 1);
});

test('a throwing cache and a failing image never delay forwarding and raise no rejection', async (t) => {
  const { figure, img } = splashFigure();
  const { win, navigations } = harness(t, { figure, caches: { open: async () => { throw new Error('denied'); } }, fetch: async () => { throw new TypeError('Failed to fetch'); } });
  mountRootTransit(win);
  t.mock.timers.tick(0);
  await settle();
  img.dispatchEvent(new Event('error'));
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS - 1);
  assert.deepEqual(navigations, []);
  t.mock.timers.tick(1);
  assert.deepEqual(navigations, ['/en-US/?utm=test#deep']);
});

test('a cached image is shown from an object URL, with no network request', async (t) => {
  const { figure, img } = splashFigure();
  const cache = fakeCaches(new Map([['https://img-gen.hagicode.com/startup-splash/hagicode-splash-001.avif', new Response(new Blob(['cached']))]]));
  t.mock.method(Math, 'random', () => 0);
  let fetches = 0;
  const { win } = harness(t, { figure, caches: cache, fetch: async () => { fetches += 1; return new Response(new Blob(['x'])); } });
  mountRootTransit(win);
  t.mock.timers.tick(0);
  await settle();
  assert.match(img.src, /^blob:/u);
  img.dispatchEvent(new Event('load'));
  assert.equal(figure.dataset.state, 'shown');
  assert.equal(fetches, 0);
});

test('a network image is shown, then stored under its URL when idle, and a second failure removes the figure', async (t) => {
  const { figure, img } = splashFigure();
  const cache = fakeCaches();
  t.mock.method(Math, 'random', () => 0);
  const idle = [];
  const fetched = [];
  const { win } = harness(t, {
    figure,
    caches: cache,
    fetch: async (url, init) => { fetched.push([url, init]); return new Response(new Blob(['avif-bytes'])); },
    requestIdleCallback: (task) => idle.push(task),
  });
  mountRootTransit(win);
  t.mock.timers.tick(0);
  await settle();
  const first = 'https://img-gen.hagicode.com/startup-splash/hagicode-splash-001.avif';
  assert.equal(img.src, first);
  img.dispatchEvent(new Event('load'));
  assert.equal(figure.dataset.state, 'shown');
  assert.equal(idle.length, 1);
  idle[0]();
  await settle();
  assert.deepEqual(fetched, [[first, { mode: 'cors', credentials: 'omit' }]]);
  assert.ok(cache.cache.entries.has(first));
});

test('one failed image retries with another key, and a second failure removes the figure', async (t) => {
  const { figure, img } = splashFigure();
  t.mock.method(Math, 'random', () => 0);
  const { win } = harness(t, { figure, caches: fakeCaches() });
  mountRootTransit(win);
  t.mock.timers.tick(0);
  await settle();
  assert.equal(img.src, 'https://img-gen.hagicode.com/startup-splash/hagicode-splash-001.avif');
  img.dispatchEvent(new Event('error'));
  assert.equal(img.src, 'https://img-gen.hagicode.com/startup-splash/hagicode-splash-002.avif');
  assert.equal(figure.removed, false);
  img.dispatchEvent(new Event('error'));
  assert.equal(figure.removed, true);
  assert.equal(img.src, undefined);
});

test('pagehide detaches the splash and mounting one page still returns one cleanup', async (t) => {
  const { figure, img } = splashFigure();
  const { win } = harness(t, { figure, caches: { open: never }, fetch: never });
  const cleanup = mountRootTransit(win);
  assert.equal(mountRootTransit(win), cleanup);
  t.mock.timers.tick(0);
  t.mock.timers.tick(SPLASH_READ_BUDGET_MS);
  await settle();
  assert.ok(img.src);
  win.dispatchEvent(new Event('pagehide'));
  assert.equal(img.src, undefined);
  img.dispatchEvent(new Event('load'));
  assert.equal(figure.dataset.state, undefined);
});

test('without a splash figure the mount is unchanged', (t) => {
  const { win, navigations } = harness(t);
  mountRootTransit(win);
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS);
  assert.deepEqual(navigations, ['/en-US/?utm=test#deep']);
});

test('a store that never settles after a loaded image does not move forwarding', async (t) => {
  const { figure, img } = splashFigure();
  t.mock.method(Math, 'random', () => 0);
  const { win, navigations } = harness(t, { figure, caches: fakeCaches(), fetch: never, requestIdleCallback: (task) => task() });
  mountRootTransit(win);
  t.mock.timers.tick(0);
  await settle();
  img.dispatchEvent(new Event('load'));
  assert.equal(figure.dataset.state, 'shown');
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS - 1);
  assert.deepEqual(navigations, []);
  t.mock.timers.tick(1);
  assert.deepEqual(navigations, ['/en-US/?utm=test#deep']);
});

test('the locale monitor reports a detected ?lang= but forwards to the configured target at the same time', (t) => {
  const monitor = localeMonitorFake({ href: `${site}/?lang=zh-CN`, languages: ['de-AT'] });
  const { win, anchor, alternative, navigations } = harness(t, null, monitor);
  mountRootTransit(win);
  assert.equal(monitor.rows.query.value.textContent, 'zh-CN');
  assert.deepEqual(detectedRows(monitor.rows), ['query']);
  assert.equal(anchor.href, '/en-US/?lang=zh-CN');
  assert.equal(alternative.href, '/zh-CN/?lang=zh-CN', 'the configured language link keeps its own target');
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS - 1);
  assert.deepEqual(navigations, []);
  t.mock.timers.tick(1);
  assert.deepEqual(navigations, ['/en-US/?lang=zh-CN']);
});

test('a foreign shared marker and an unsupported browser list leave the target and the links unchanged', (t) => {
  const monitor = localeMonitorFake({
    href: `${site}/`,
    languages: ['xx'],
    cookie: 'hagicode_locale_monitor=ja-JP|stored|docs.hagicode.com|1761000000',
  });
  const { win, anchor, alternative, navigations } = harness(t, null, monitor);
  mountRootTransit(win);
  assert.deepEqual(detectedRows(monitor.rows), ['default']);
  assert.equal(monitor.rows.shared.value.textContent, 'ja-JP · hagicode:site-locale · docs.hagicode.com');
  assert.equal(anchor.href, '/en-US/');
  assert.equal(alternative.href, '/zh-CN/');
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS);
  assert.deepEqual(navigations, ['/en-US/']);
});

test('the monitor writes only its own two keys and never the official locale keys', (t) => {
  const storage = { 'hagicode:site-locale': 'fr-FR', lang: 'de-DE' };
  const monitor = localeMonitorFake({ href: 'https://docs.hagicode.com/?lang=ja-JP', storage });
  const { win, navigations } = harness(t, null, monitor);
  mountRootTransit(win);
  assert.deepEqual(monitor.storageWrites.map(([key]) => key), ['hagicode:locale-monitor']);
  assert.deepEqual(monitor.cookieWrites.map((cookie) => cookie.split('=')[0]), ['hagicode_locale_monitor']);
  assert.equal(storage['hagicode:site-locale'], 'fr-FR');
  assert.equal(storage.lang, 'de-DE');
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS);
  assert.deepEqual(navigations, ['/en-US/?lang=ja-JP']);
});

for (const [name, options] of [
  ['throwing storage', { failStorage: true }],
  ['a blocked cookie', { cookieMode: 'block' }],
  ['a throwing cookie write', { cookieMode: 'throw' }],
]) {
  test(`${name} with the monitor on still forwards on time`, (t) => {
    const monitor = localeMonitorFake({ href: 'https://docs.hagicode.com/', ...options });
    const { win, navigations } = harness(t, null, monitor);
    assert.doesNotThrow(() => mountRootTransit(win));
    t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS - 1);
    assert.deepEqual(navigations, []);
    t.mock.timers.tick(1);
    assert.deepEqual(navigations, ['/en-US/']);
  });
}

test('a monitor that throws while mounting still forwards on time and keeps the continue link', (t) => {
  const monitor = localeMonitorFake({ href: `${site}/?lang=ko` });
  monitor.panel.querySelector = () => { throw new Error('broken panel'); };
  const { win, anchor, navigations } = harness(t, null, monitor);
  assert.doesNotThrow(() => mountRootTransit(win));
  assert.equal(anchor.href, '/en-US/?lang=ko');
  t.mock.timers.tick(ROOT_TRANSIT_DELAY_MS);
  assert.deepEqual(navigations, ['/en-US/?lang=ko']);
});
