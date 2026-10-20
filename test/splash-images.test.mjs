import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SPLASH_IMAGE_DEFAULTS,
  loadSplashImage,
  pickSplashIndex,
  resolveSplashConfig,
  splashImagePath,
  splashImageUrl,
  splashKey,
  storeSplashImage,
} from '@hagicode/hagilight-core/splash-images';

const BASE = 'https://img-gen.hagicode.com';
const TYPE_ERROR = { name: 'TypeError', message: /^Hagilight RootTransit: / };

class FakeCache {
  entries = new Map();

  async match(url) {
    return this.entries.get(url)?.clone();
  }

  async put(url, response) {
    this.entries.set(url, response);
  }

  async delete(url) {
    return this.entries.delete(typeof url === 'string' ? url : url.url);
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

function fakeStorage(caches = new Map()) {
  return {
    caches,
    async open(name) {
      if (!caches.has(name)) caches.set(name, new FakeCache());
      return caches.get(name);
    },
  };
}

const avif = (bytes = 'avif') => new Response(new Blob([bytes], { type: 'image/avif' }), { status: 200 });

test('defaults are the 600-image collection and are frozen', () => {
  assert.equal(SPLASH_IMAGE_DEFAULTS.baseUrl, BASE);
  assert.equal(SPLASH_IMAGE_DEFAULTS.prefix, 'startup-splash');
  assert.equal(SPLASH_IMAGE_DEFAULTS.count, 600);
  assert.equal(SPLASH_IMAGE_DEFAULTS.cacheName, 'hagilight.rootTransit.splash');
  assert.equal(SPLASH_IMAGE_DEFAULTS.readBudgetMs, 100);
  assert.equal(SPLASH_IMAGE_DEFAULTS.maxEntries, 30);
  assert.ok(Object.isFrozen(SPLASH_IMAGE_DEFAULTS));
  assert.throws(() => { 'use strict'; SPLASH_IMAGE_DEFAULTS.count = 1; }, TypeError);
});

test('index 1, 7 and 600 map to zero-padded keys, paths and URLs', () => {
  assert.equal(splashKey(1), 'hagicode-splash-001');
  assert.equal(splashKey(7), 'hagicode-splash-007');
  assert.equal(splashKey(600), 'hagicode-splash-600');
  assert.equal(splashImagePath(7), 'startup-splash/hagicode-splash-007.avif');
  assert.equal(splashImagePath('hagicode-splash-007'), 'startup-splash/hagicode-splash-007.avif');
  assert.equal(splashImageUrl(600), `${BASE}/startup-splash/hagicode-splash-600.avif`);
});

test('out-of-range and malformed indexes and keys are refused with a TypeError', () => {
  for (const index of [0, 601, 1.5, -1, Number.NaN, '7', null]) {
    assert.throws(() => splashKey(index), TYPE_ERROR, String(index));
    assert.throws(() => splashImagePath(index), TYPE_ERROR, String(index));
  }
  for (const key of ['hagicode-splash-1', 'hagicode-splash-0600', 'hagicode-splash-000', 'hagicode-splash-601', 'hagicode-splash-007.avif', 'other-007', '']) {
    assert.throws(() => splashImagePath(key), TYPE_ERROR, key);
    assert.throws(() => splashImageUrl(key), TYPE_ERROR, key);
  }
});

test('the picker stays within 1 to count for the bounds of its random source', () => {
  assert.equal(pickSplashIndex(() => 0), 1);
  assert.equal(pickSplashIndex(() => 1 - Number.EPSILON), 600);
  assert.equal(pickSplashIndex(() => 1), 600);
  assert.equal(pickSplashIndex(() => -3), 1);
  assert.equal(pickSplashIndex(() => Number.NaN), 1);
  assert.equal(pickSplashIndex(() => 0.5, 10), 6);
  assert.equal(pickSplashIndex(() => 0.999, 1), 1);
  for (let i = 0; i < 1000; i += 1) {
    const index = pickSplashIndex(Math.random);
    assert.ok(Number.isInteger(index) && index >= 1 && index <= 600);
  }
});

test('the default configuration and explicit overrides resolve', () => {
  assert.deepEqual({ ...resolveSplashConfig() }, { baseUrl: BASE, prefix: 'startup-splash', count: 600, cacheName: 'hagilight.rootTransit.splash' });
  assert.equal(resolveSplashConfig(false), null);
  const custom = resolveSplashConfig({ baseUrl: 'https://cdn.example.com/', prefix: 'boot/art', count: 12, cacheName: 'custom.cache' });
  assert.deepEqual({ ...custom }, { baseUrl: 'https://cdn.example.com', prefix: 'boot/art', count: 12, cacheName: 'custom.cache' });
  assert.equal(splashImageUrl(12, custom), 'https://cdn.example.com/boot/art/hagicode-splash-012.avif');
  assert.ok(Object.isFrozen(custom));
  assert.throws(() => splashImageUrl(13, custom), TYPE_ERROR);
});

test('invalid splash options are rejected with the Hagilight RootTransit prefix', () => {
  for (const input of [
    null, 'yes', 0,
    { count: 0 }, { count: 10000 }, { count: 1.5 }, { count: '600' },
    { baseUrl: 'http://img.example.com' }, { baseUrl: 'not a url' }, { baseUrl: 'https://user:pw@img.example.com' },
    { baseUrl: 'https://img.example.com/?v=1' }, { baseUrl: 'https://img.example.com/#x' },
    { prefix: '' }, { prefix: '/abs' }, { prefix: 'a/../b' }, { prefix: 'a//b' }, { prefix: '..' }, { prefix: 'a b' },
    { cacheName: '' }, { cacheName: '   ' },
    { keyPattern: 'x' },
  ]) assert.throws(() => resolveSplashConfig(input), TYPE_ERROR, JSON.stringify(input));
});

test('a cache hit returns the stored blob', async () => {
  const storage = fakeStorage();
  await storage.open(SPLASH_IMAGE_DEFAULTS.cacheName).then((cache) => cache.put(splashImageUrl(3), avif('three')));
  const loaded = await loadSplashImage(splashImageUrl(3), { storage });
  assert.equal(loaded.source, 'cache');
  assert.equal(await loaded.blob.text(), 'three');
});

test('a miss, an empty entry and a different URL all read as a miss', async () => {
  const storage = fakeStorage();
  assert.deepEqual(await loadSplashImage(splashImageUrl(1), { storage }), { source: 'miss' });
  const cache = await storage.open(SPLASH_IMAGE_DEFAULTS.cacheName);
  await cache.put(splashImageUrl(2), new Response(new Blob([]), { status: 200 }));
  assert.deepEqual(await loadSplashImage(splashImageUrl(2), { storage }), { source: 'miss' });
  await cache.put(splashImageUrl(4), avif());
  assert.deepEqual(await loadSplashImage(`${BASE}/other-prefix/hagicode-splash-004.avif`, { storage }), { source: 'miss' });
});

test('a read that does not settle within the budget is a miss', async () => {
  const storage = { open: () => new Promise(() => {}) };
  const started = Date.now();
  assert.deepEqual(await loadSplashImage(splashImageUrl(1), { storage, budgetMs: 5 }), { source: 'miss' });
  assert.ok(Date.now() - started < 1000);
});

test('a throwing cache, an absent Cache API and no storage all resolve as a miss', async () => {
  const throwing = { open: async () => { throw new Error('quota'); } };
  assert.deepEqual(await loadSplashImage(splashImageUrl(1), { storage: throwing }), { source: 'miss' });
  assert.deepEqual(await loadSplashImage(splashImageUrl(1), { storage: null }), { source: 'miss' });
  assert.deepEqual(await loadSplashImage(splashImageUrl(1)), { source: 'miss' });
});

test('a failed or empty download stores nothing and never rejects', async () => {
  const storage = fakeStorage();
  const url = splashImageUrl(5);
  assert.equal(await storeSplashImage(url, { storage, fetchImage: async () => new Response('gone', { status: 404 }) }), false);
  assert.equal(await storeSplashImage(url, { storage, fetchImage: async () => new Response(new Blob([]), { status: 200 }) }), false);
  assert.equal(await storeSplashImage(url, { storage, fetchImage: async () => { throw new TypeError('Failed to fetch'); } }), false);
  assert.equal(await storeSplashImage(url, { storage: null, fetchImage: async () => avif() }), false);
  assert.equal((await storage.open(SPLASH_IMAGE_DEFAULTS.cacheName)).entries.size, 0);
});

test('a stored image is read back under its URL and the cache is trimmed to 30 entries, oldest first', async () => {
  const storage = fakeStorage();
  const fetchImage = async (url) => avif(url.slice(-12));
  assert.equal(await storeSplashImage(splashImageUrl(1), { storage, fetchImage }), true);
  assert.equal((await loadSplashImage(splashImageUrl(1), { storage })).source, 'cache');
  for (let index = 2; index <= 31; index += 1) {
    assert.equal(await storeSplashImage(splashImageUrl(index), { storage, fetchImage }), true);
  }
  const cache = await storage.open(SPLASH_IMAGE_DEFAULTS.cacheName);
  assert.equal(cache.entries.size, 30);
  assert.equal((await loadSplashImage(splashImageUrl(1), { storage })).source, 'miss');
  assert.equal((await loadSplashImage(splashImageUrl(31), { storage })).source, 'cache');
});

test('the README image path section documents the configured base URL, prefix, range and worked example', () => {
  const readme = readFileSync(fileURLToPath(new URL('../packages/core/README.md', import.meta.url)), 'utf8');
  const start = readme.indexOf('## Image paths from img-gen');
  assert.ok(start >= 0, 'the section exists');
  const next = readme.indexOf('\n## ', start + 1);
  const section = readme.slice(start, next === -1 ? undefined : next);

  assert.ok(section.includes(`| Base URL | \`${SPLASH_IMAGE_DEFAULTS.baseUrl}\` |`), 'base URL row');
  assert.ok(section.includes(`| Prefix | \`${SPLASH_IMAGE_DEFAULTS.prefix}\` |`), 'prefix row');
  assert.ok(section.includes(`| Range | 1 to ${SPLASH_IMAGE_DEFAULTS.count} |`), 'range row');
  assert.ok(section.includes(`${splashImageUrl(7)}\``), 'worked example URL');
  assert.equal(splashImageUrl(7), `${SPLASH_IMAGE_DEFAULTS.baseUrl}/${SPLASH_IMAGE_DEFAULTS.prefix}/hagicode-splash-007.avif`);
});

test('the loader module imports no Node built-in and touches no file system', () => {
  const source = readFileSync(fileURLToPath(new URL('../packages/core/src/splash-images.ts', import.meta.url)), 'utf8');
  assert.doesNotMatch(source, /from\s+['"](?:node:|fs|path)/u);
  assert.doesNotMatch(source, /\bprocess\./u);
});
