import assert from 'node:assert/strict';
import { test } from 'node:test';

const client = await import(new URL('../packages/docusaurus/dist/client/analytics.js', import.meta.url).href);

function fakeTarget() {
  const listeners = [];
  return {
    listeners,
    addEventListener(type, listener, capture) {
      listeners.push({ type, listener, capture });
    },
  };
}

const route = (pathname) => ({ pathname, search: '', hash: '' });

test('click tracking is installed once per document across repeated installs', () => {
  const target = fakeTarget();
  assert.equal(client.installClickTracking(target), true);
  assert.equal(client.installClickTracking(target), false);
  assert.equal(target.listeners.length, 1);
  assert.equal(target.listeners[0].type, 'click');
  assert.equal(target.listeners[0].capture, true);
});

test('the initial page load does not send a duplicate page_view', () => {
  const sent = [];
  const scheduled = [];
  client.handleRouteDidUpdate(
    { location: route('/'), previousLocation: null },
    {
      getGtag: () => (...args) => sent.push(args),
      readPage: () => ({ title: 'Home', location: 'https://example.com/', path: '/' }),
      schedule: (task) => scheduled.push(task),
    },
  );
  assert.equal(scheduled.length, 0);
  assert.deepEqual(sent, []);
});

test('each client route change sends exactly one page_view after the title is set', () => {
  const sent = [];
  const scheduled = [];
  let title = 'Docs';
  client.handleRouteDidUpdate(
    { location: route('/docs/intro'), previousLocation: route('/') },
    {
      getGtag: () => (...args) => sent.push(args),
      readPage: () => ({ title, location: 'https://example.com/docs/intro', path: '/docs/intro' }),
      schedule: (task) => scheduled.push(task),
    },
  );
  assert.equal(scheduled.length, 1);
  assert.deepEqual(sent, [], 'nothing is sent until the deferred task runs');

  title = 'Intro | HagiCode';
  scheduled[0]();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], [
    'event',
    'page_view',
    { page_title: 'Intro | HagiCode', page_location: 'https://example.com/docs/intro', page_path: '/docs/intro' },
  ]);
});

test('route changes stay silent without gtag', () => {
  const scheduled = [];
  client.handleRouteDidUpdate(
    { location: route('/blog'), previousLocation: route('/') },
    {
      getGtag: () => undefined,
      readPage: () => ({ title: 'Blog', location: 'https://example.com/blog', path: '/blog' }),
      schedule: (task) => scheduled.push(task),
    },
  );
  assert.doesNotThrow(() => scheduled[0]());
});

test('reportPageView reports nothing when gtag is not a function', () => {
  assert.equal(client.reportPageView(undefined, { title: '', location: '', path: '' }), false);
  assert.equal(client.reportPageView('gtag', { title: '', location: '', path: '' }), false);
});
