import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  ENGINE_STORAGE_KEY,
  isMermaidEngine,
  readStoredEngine,
  resolveEngine,
  writeStoredEngine,
} from '../packages/mermaid/dist/engine.js';

const hadStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

/** An in-memory stand-in for `localStorage` that records every write. */
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values,
    writes,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => {
      writes.push([key, value]);
      values.set(key, String(value));
    },
  };
}

function useStorage(storage) {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
}

function restoreStorage() {
  if (hadStorage) Object.defineProperty(globalThis, 'localStorage', hadStorage);
  else delete globalThis.localStorage;
}

beforeEach(() => restoreStorage());
afterEach(() => restoreStorage());

test('the storage key is the documented hagilight-mermaid engine key', () => {
  assert.equal(ENGINE_STORAGE_KEY, 'hagilight-mermaid:engine');
});

test('an explicit option wins over a stored choice', () => {
  useStorage(memoryStorage({ [ENGINE_STORAGE_KEY]: 'pele' }));
  assert.equal(resolveEngine('mermaid'), 'mermaid');
  assert.equal(resolveEngine('pele'), 'pele');
});

test('a stored choice wins over the default when no option is given', () => {
  useStorage(memoryStorage({ [ENGINE_STORAGE_KEY]: 'pele' }));
  assert.equal(resolveEngine(), 'pele');
  assert.equal(resolveEngine(undefined), 'pele');
});

test('the default is mermaid when nothing is stored and no option is given', () => {
  useStorage(memoryStorage());
  assert.equal(resolveEngine(), 'mermaid');
  restoreStorage();
  assert.equal(resolveEngine(), 'mermaid');
});

test('an unrecognized option is ignored and the stored choice decides', () => {
  useStorage(memoryStorage({ [ENGINE_STORAGE_KEY]: 'pele' }));
  assert.equal(resolveEngine('sepia'), 'pele');
  assert.equal(resolveEngine(42), 'pele');
});

test('an unrecognized stored value counts as absent and the default applies', () => {
  useStorage(memoryStorage({ [ENGINE_STORAGE_KEY]: 'sepia' }));
  assert.equal(readStoredEngine(), undefined);
  assert.equal(resolveEngine(), 'mermaid');
  assert.equal(resolveEngine('bogus'), 'mermaid');
});

test('isMermaidEngine accepts only mermaid and pele', () => {
  assert.equal(isMermaidEngine('mermaid'), true);
  assert.equal(isMermaidEngine('pele'), true);
  for (const value of ['Pele', 'mermaid ', '', null, undefined, 1, {}]) {
    assert.equal(isMermaidEngine(value), false, `${String(value)} is not an engine`);
  }
});

test('a throwing storage is ignored: reads give no choice and rendering still resolves', () => {
  useStorage({
    getItem: () => {
      throw new DOMException('blocked', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('blocked', 'SecurityError');
    },
  });
  assert.equal(readStoredEngine(), undefined);
  assert.equal(resolveEngine(), 'mermaid');
  assert.equal(resolveEngine('pele'), 'pele');
  assert.doesNotThrow(() => writeStoredEngine('pele'));
});

test('an absent storage is ignored: reads give no choice and writes do nothing', () => {
  delete globalThis.localStorage;
  assert.equal(readStoredEngine(), undefined);
  assert.equal(resolveEngine(), 'mermaid');
  assert.doesNotThrow(() => writeStoredEngine('pele'));
});

test('writeStoredEngine stores a recognized engine under the key', () => {
  const storage = memoryStorage();
  useStorage(storage);
  writeStoredEngine('pele');
  assert.deepEqual(storage.writes, [[ENGINE_STORAGE_KEY, 'pele']]);
  assert.equal(resolveEngine(), 'pele');
});

test('writeStoredEngine ignores an unrecognized value and writes nothing', () => {
  const storage = memoryStorage();
  useStorage(storage);
  writeStoredEngine('sepia');
  assert.deepEqual(storage.writes, []);
  assert.equal(storage.values.has(ENGINE_STORAGE_KEY), false);
});
