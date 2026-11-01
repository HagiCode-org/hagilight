import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { resolveMode, watchMode, watcherCount } from '../packages/mermaid/dist/mode.js';
import { fakeBlock, fakeNode, installMermaidStub, restoreMermaidStub, settle } from './support/mermaid-dom-stub.mjs';

const hadStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

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

// Engine resolution through the public entry points. The loaders are injected, so the test sees which
// module each render asked for; the DOM stub is in test/support/mermaid-dom-stub.mjs.
const { renderMermaid } = await import('../packages/mermaid/dist/render.js');
const { mountMermaidDiagrams } = await import('../packages/mermaid/dist/mount.js');
const { ENGINE_STORAGE_KEY } = await import('../packages/mermaid/dist/engine.js');

let storedEngine = null;
const probeStubOptions = () => ({ storageKey: ENGINE_STORAGE_KEY, storedEngine });

/** Loaders that record their calls and then stop: the render is judged by which module was requested. */
function probeLoaders() {
  const calls = { mermaid: 0, pele: 0 };
  const loadMermaid = async () => {
    calls.mermaid += 1;
    throw new Error('mermaid probe');
  };
  const peleLoader = async () => {
    calls.pele += 1;
    throw new Error('pele probe');
  };
  return { calls, loadMermaid, peleLoader };
}

beforeEach(() => {
  storedEngine = null;
  installMermaidStub(probeStubOptions());
});

afterEach(() => restoreMermaidStub(hadStorage));

test('the engine option selects the loader through renderMermaid', async () => {
  const probe = probeLoaders();
  renderMermaid(fakeNode(), 'flowchart LR; A-->B', { engine: 'pele', ...probe });
  await settle();
  assert.deepEqual(probe.calls, { mermaid: 0, pele: 1 });
});

test('a stored engine selects the loader when no option is given', async () => {
  storedEngine = 'pele';
  restoreMermaidStub(hadStorage);
  installMermaidStub(probeStubOptions());
  const probe = probeLoaders();
  renderMermaid(fakeNode(), 'flowchart LR; A-->B', probe);
  await settle();
  assert.deepEqual(probe.calls, { mermaid: 0, pele: 1 });
});

test('an explicit mermaid engine outranks a stored pele choice', async () => {
  storedEngine = 'pele';
  restoreMermaidStub(hadStorage);
  installMermaidStub(probeStubOptions());
  const probe = probeLoaders();
  renderMermaid(fakeNode(), 'flowchart LR; A-->B', { engine: 'mermaid', ...probe });
  await settle();
  assert.deepEqual(probe.calls, { mermaid: 1, pele: 0 });
});

test('with nothing selected, renderMermaid loads mermaid as before', async () => {
  const probe = probeLoaders();
  renderMermaid(fakeNode(), 'flowchart LR; A-->B', probe);
  await settle();
  assert.deepEqual(probe.calls, { mermaid: 1, pele: 0 });
});

test('an unrecognized engine option falls through to the stored choice', async () => {
  storedEngine = 'pele';
  restoreMermaidStub(hadStorage);
  installMermaidStub(probeStubOptions());
  const probe = probeLoaders();
  renderMermaid(fakeNode(), 'flowchart LR; A-->B', { engine: 'sepia', ...probe });
  await settle();
  assert.deepEqual(probe.calls, { mermaid: 0, pele: 1 });
});

test('mountMermaidDiagrams forwards engine and peleLoader to every block', async () => {
  const probe = probeLoaders();
  const mounted = mountMermaidDiagrams({ querySelectorAll: () => [fakeBlock('pie title Pets\n  "Dogs" : 386')] }, { engine: 'pele', ...probe });
  await settle();
  assert.equal(mounted.handles.length, 1);
  assert.deepEqual(probe.calls, { mermaid: 0, pele: 1 });
});

test('mountMermaidDiagrams with a stored engine and no option renders with Pele', async () => {
  storedEngine = 'pele';
  restoreMermaidStub(hadStorage);
  installMermaidStub(probeStubOptions());
  const probe = probeLoaders();
  mountMermaidDiagrams({ querySelectorAll: () => [fakeBlock('pie title Pets\n  "Dogs" : 386')] }, probe);
  await settle();
  assert.deepEqual(probe.calls, { mermaid: 0, pele: 1 });
});

test('an explicit engine on render and on update never writes the stored choice', async () => {
  const writes = [];
  globalThis.localStorage = {
    getItem: () => null,
    setItem: (key, value) => writes.push([key, value]),
  };
  const probe = probeLoaders();
  const handle = renderMermaid(fakeNode(), 'flowchart LR; A-->B', { engine: 'pele', ...probe });
  await settle();
  handle.update({ engine: 'mermaid', loadMermaid: probe.loadMermaid });
  await settle();
  assert.deepEqual(writes, [], 'no write reaches storage');
});
