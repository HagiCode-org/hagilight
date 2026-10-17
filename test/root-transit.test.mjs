import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ROOT_TRANSIT_DELAY_MS, resolveTransitDestination, resolveTransitNavigation, mountRootTransit,
} from '@hagicode/hagilight-core/root-transit';

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

function harness(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const anchor = Object.assign(new EventTarget(), { href: '/en-US/', getAttribute() { return this.href; } });
  const alternative = Object.assign(new EventTarget(), { href: '/zh-CN/', getAttribute() { return this.href; } });
  const page = { dataset: { base: '/' }, querySelector: () => anchor, querySelectorAll: () => [alternative] };
  const doc = Object.assign(new EventTarget(), { querySelector: () => page, documentElement: { dataset: {} } });
  const navigations = [];
  const win = Object.assign(new EventTarget(), {
    document: doc,
    location: { href: `${site}/?utm=test#deep`, replace: (url) => navigations.push(url) },
    setTimeout, clearTimeout,
  });
  return { win, anchor, alternative, page, navigations };
}

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
