import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { resolveMode, watchMode, watcherCount } from '../packages/mermaid/dist/mode.js';

/** A document root whose data-theme attribute and class list are set by the test. */
function root({ theme = null, dark = false } = {}) {
  return {
    getAttribute: (name) => (name === 'data-theme' ? theme : null),
    classList: { contains: (name) => name === 'dark' && dark },
  };
}

test('explicit light and dark win over every document and system signal', () => {
  const darkRoot = root({ theme: 'dark', dark: true });
  assert.equal(resolveMode('light', darkRoot, true), 'light');
  assert.equal(resolveMode('dark', root({ theme: 'light' }), false), 'dark');
});

test('auto reads data-theme first, including theme ids such as spring-dark', () => {
  assert.equal(resolveMode('auto', root({ theme: 'dark' }), false), 'dark');
  assert.equal(resolveMode('auto', root({ theme: 'spring-dark' }), false), 'dark');
  assert.equal(resolveMode('auto', root({ theme: 'light' }), true), 'light');
});

test('auto falls back to the dark class, then to prefers-color-scheme', () => {
  assert.equal(resolveMode('auto', root({ dark: true }), false), 'dark');
  assert.equal(resolveMode('auto', root(), true), 'dark');
  assert.equal(resolveMode('auto', root(), false), 'light');
});

test('data-theme takes precedence over the dark class and the system preference', () => {
  assert.equal(resolveMode('auto', root({ theme: 'light', dark: true }), true), 'light');
  assert.equal(resolveMode('auto', root({ theme: 'light' }), true), 'light');
});

test('auto with no document or preference is light', () => {
  assert.equal(resolveMode('auto', null, false), 'light');
  assert.equal(resolveMode(undefined, null, false), 'light');
});

test('one shared observer serves every listener and is removed with the last one', () => {
  const observers = [];
  const queryListeners = new Set();
  let matches = false;
  globalThis.document = { documentElement: root() };
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  };
  globalThis.matchMedia = () => ({
    get matches() {
      return matches;
    },
    addEventListener: (type, listener) => queryListeners.add(listener),
    removeEventListener: (type, listener) => queryListeners.delete(listener),
  });

  const calls = [];
  const stopFirst = watchMode(() => calls.push('first'));
  const stopSecond = watchMode(() => calls.push('second'));
  assert.equal(observers.length, 1, 'one MutationObserver for every auto diagram');
  assert.equal(queryListeners.size, 1);
  assert.equal(watcherCount(), 2);

  observers[0].callback();
  for (const listener of queryListeners) listener();
  assert.deepEqual(calls, ['first', 'second', 'first', 'second']);

  stopFirst();
  stopFirst();
  assert.equal(observers[0].disconnected, false, 'a listener is still registered');
  assert.equal(watcherCount(), 1);

  stopSecond();
  assert.equal(observers[0].disconnected, true);
  assert.equal(queryListeners.size, 0);
  assert.equal(watcherCount(), 0);
});

afterEach(() => {
  delete globalThis.document;
  delete globalThis.MutationObserver;
  delete globalThis.matchMedia;
});

beforeEach(() => {
  delete globalThis.document;
});
