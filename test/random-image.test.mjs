import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  R2_IMAGE_ORIGIN,
  RANDOM_IMAGE_TIMEOUT_MS,
  FAN_DECK_CARDS,
  FAN_TURN_MS,
  fanSlot,
  mountRandomFans,
  mountRandomImages,
  pickRandomEntries,
  pickRandomEntry,
  poolImageUrl,
  preloadImage,
  validateRandomPool,
} = await import(new URL('../packages/core/dist/random-image.js', import.meta.url).href);

const KEYS = Array.from({ length: 46 }, (_, index) => `cat-head-gallery/key-${String(index).padStart(2, '0')}.avif`);

/** A linear congruential generator in [0, 1), so every run makes the same picks. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** A fake `Image`: the test decides when it loads or fails. */
function fakeImageFactory() {
  const images = [];
  return {
    images,
    createImage() {
      const image = { src: '', onload: null, onerror: null };
      images.push(image);
      return image;
    },
  };
}

/** Fake timers: the test fires them. Returns the same shape as `setTimeout` for `preloadImage`. */
function fakeTimers() {
  const pending = new Set();
  return {
    pending,
    setTimer(callback, ms) {
      const handle = { callback, ms };
      pending.add(handle);
      return handle;
    },
    clearTimer(handle) {
      pending.delete(handle);
    },
    fire() {
      for (const handle of [...pending]) {
        pending.delete(handle);
        handle.callback();
      }
    },
  };
}

function fakeElement(attributes = {}) {
  const attrs = new Map(Object.entries(attributes));
  return {
    attrs,
    getAttribute: (name) => (attrs.has(name) ? attrs.get(name) : null),
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: (name) => attrs.delete(name),
  };
}

/** A `<picture>` slot with two `<source>` children and an `<img>` at the default size. */
function fakeSlot(pool) {
  const slot = fakeElement({ 'data-random-pool': pool === undefined ? undefined : JSON.stringify(pool) });
  if (pool === undefined) slot.attrs.delete('data-random-pool');
  const sources = [
    { type: 'image/avif', srcset: '/_astro/avatar.avif', remove() { sources.splice(sources.indexOf(this), 1); } },
    { type: 'image/webp', srcset: '/_astro/avatar.webp', remove() { sources.splice(sources.indexOf(this), 1); } },
  ];
  const img = { ...fakeElement({ width: '64', height: '64', alt: '', 'aria-hidden': 'true', srcset: 'x 1x' }), src: '/_astro/avatar.webp' };
  slot.img = img;
  slot.sources = sources;
  slot.querySelectorAll = (selector) => (selector === 'source' ? [...sources] : []);
  slot.querySelector = (selector) => (selector === 'img' ? img : null);
  return slot;
}

/** The root only returns slots that carry a pool and have not been picked yet, as the picker's selector asks. */
function fakeRoot(slots) {
  return {
    querySelectorAll: () => slots.filter((slot) => slot.getAttribute('data-random-pool') !== null && slot.getAttribute('data-random-state') === null),
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const POOL = KEYS.slice(0, 12).map((key) => key);

test('the pool validator accepts 12 to 200 unique objects from one album', () => {
  assert.equal(validateRandomPool(KEYS).length, 46);
  assert.equal(validateRandomPool(KEYS.slice(0, 12)).length, 12);
  const large = Array.from({ length: 200 }, (_, index) => `cat-head-gallery/k${index}.avif`);
  assert.equal(validateRandomPool(large).length, 200);
});

test('the pool validator rejects a pool outside 12 to 200 entries, mixed albums and bad paths', () => {
  assert.throws(() => validateRandomPool(KEYS.slice(0, 11)), TypeError);
  assert.throws(() => validateRandomPool(Array.from({ length: 201 }, (_, index) => `cat-head-gallery/k${index}.avif`)), TypeError);
  assert.throws(() => validateRandomPool(null), TypeError);
  assert.throws(() => validateRandomPool([...KEYS.slice(0, 11), 'other-album/k.avif']), /one album/u);
  assert.throws(() => validateRandomPool([...KEYS.slice(0, 11), 'cat-head-gallery/../escape.avif']), TypeError);
  assert.throws(() => validateRandomPool([...KEYS.slice(0, 11), 'https://example.com/x.avif']), TypeError);
  assert.throws(() => validateRandomPool([...KEYS.slice(0, 11), 'cat-head-gallery/image.png']), TypeError);
  assert.throws(() => validateRandomPool([...KEYS.slice(0, 11), KEYS[0]]), /unique/u);
});

test('the uniform pick gives every entry an equal share, within test tolerance', () => {
  const draws = 46 * 400;
  const tally = new Map(KEYS.map((key) => [key, 0]));
  const random = seeded(20261021);
  for (let index = 0; index < draws; index += 1) {
    const key = pickRandomEntry(KEYS, random);
    tally.set(key, tally.get(key) + 1);
  }
  const expected = draws / KEYS.length;
  for (const count of tally.values()) assert.ok(count > expected * 0.7 && count < expected * 1.3, `count ${count} near ${expected}`);
});

test('the pick clamps out-of-range random values to a valid entry', () => {
  assert.equal(pickRandomEntry(POOL, () => Number.NaN), POOL[0]);
  assert.equal(pickRandomEntry(POOL, () => -1), POOL[0]);
  assert.equal(pickRandomEntry(POOL, () => 1), POOL[POOL.length - 1]);
  assert.equal(pickRandomEntry(POOL, () => 0.5), POOL[6]);
});

test('the pool URL is built on the R2 origin and never fetches an album index', () => {
  assert.equal(R2_IMAGE_ORIGIN, 'https://img-gen.hagicode.com');
  assert.equal(poolImageUrl('cat-head-gallery/g002-ukiyo-e-01.avif'), 'https://img-gen.hagicode.com/cat-head-gallery/g002-ukiyo-e-01.avif');
});

test('preloadImage resolves true only when the image loads before the timeout', async () => {
  const images = fakeImageFactory();
  const timers = fakeTimers();
  const pending = preloadImage('https://img-gen.hagicode.com/cat-head-gallery/a.avif', { ...images, ...timers });
  assert.equal(images.images.length, 1);
  assert.equal(images.images[0].src, 'https://img-gen.hagicode.com/cat-head-gallery/a.avif');
  assert.equal(timers.pending.size, 1);
  images.images[0].onload();
  assert.equal(await pending, true);
  assert.equal(timers.pending.size, 0, 'the timeout is cleared after a load');
});

test('preloadImage resolves false on error, on timeout and when the image cannot be created', async () => {
  const errorImages = fakeImageFactory();
  const errorTimers = fakeTimers();
  const onError = preloadImage('https://img-gen.hagicode.com/cat-head-gallery/a.avif', { ...errorImages, ...errorTimers });
  errorImages.images[0].onerror();
  assert.equal(await onError, false);

  const lateImages = fakeImageFactory();
  const lateTimers = fakeTimers();
  const late = preloadImage('https://img-gen.hagicode.com/cat-head-gallery/b.avif', { ...lateImages, ...lateTimers });
  lateTimers.fire();
  assert.equal(await late, false);
  assert.equal(RANDOM_IMAGE_TIMEOUT_MS, 3000);
  lateImages.images[0].onload();
  assert.equal(await late, false, 'a load after the timeout does not change the outcome');

  assert.equal(await preloadImage('https://img-gen.hagicode.com/x.avif', { createImage: () => { throw new Error('no Image'); }, ...fakeTimers() }), false);
});

test('a slot swaps to the loaded pool image and keeps its box, alt text and decorative markup', async () => {
  const images = fakeImageFactory();
  const timers = fakeTimers();
  const slot = fakeSlot(POOL);
  const random = seeded(7);
  const swapped = mountRandomImages(fakeRoot([slot]), { random, ...images, ...timers, saveData: () => false });
  await tick();
  assert.equal(images.images.length, 1, 'one pool image is requested');
  const expected = pickRandomEntry(POOL, seeded(7));
  assert.equal(images.images[0].src, poolImageUrl(expected));
  images.images[0].onload();
  assert.equal(await swapped, 1);
  assert.equal(slot.img.src, poolImageUrl(expected));
  assert.equal(slot.sources.length, 0, 'the sources are removed so the swapped src is used');
  assert.equal(slot.img.attrs.has('srcset'), false);
  assert.equal(slot.img.attrs.get('width'), '64');
  assert.equal(slot.img.attrs.get('height'), '64');
  assert.equal(slot.img.attrs.get('alt'), '');
  assert.equal(slot.img.attrs.get('aria-hidden'), 'true');
  assert.equal(slot.getAttribute('data-random-state'), 'swapped');
});

test('an error or a timeout keeps the vendored default and never retries', async () => {
  for (const outcome of ['error', 'timeout']) {
    const images = fakeImageFactory();
    const timers = fakeTimers();
    const slot = fakeSlot(POOL);
    const swapped = mountRandomImages(fakeRoot([slot]), { random: seeded(3), ...images, ...timers, saveData: () => false });
    await tick();
    if (outcome === 'error') images.images[0].onerror();
    else timers.fire();
    assert.equal(await swapped, 0);
    assert.equal(images.images.length, 1, `${outcome} makes no retry`);
    assert.equal(slot.img.src, '/_astro/avatar.webp');
    assert.equal(slot.sources.length, 2, 'the default sources stay in the markup');
    assert.equal(slot.getAttribute('data-random-state'), 'default');
  }
});

test('a data-saver preference makes no pool request and keeps the default', async () => {
  const images = fakeImageFactory();
  const slot = fakeSlot(POOL);
  const swapped = await mountRandomImages(fakeRoot([slot]), { random: seeded(1), ...images, ...fakeTimers(), saveData: () => true });
  assert.equal(swapped, 0);
  assert.equal(images.images.length, 0);
  assert.equal(slot.img.src, '/_astro/avatar.webp');
});

test('a slot without a pool attribute, the option turned off, makes no request at all', async () => {
  const images = fakeImageFactory();
  const slot = fakeSlot(undefined);
  const swapped = await mountRandomImages(fakeRoot([slot]), { ...images, ...fakeTimers(), saveData: () => false });
  assert.equal(swapped, 0);
  assert.equal(images.images.length, 0);
  assert.equal(slot.getAttribute('data-random-state'), null);
});

test('an invalid pool attribute keeps the default and does not throw', async () => {
  const images = fakeImageFactory();
  const slot = fakeElement({ 'data-random-pool': '["cat-head-gallery/only-one.avif"]' });
  Object.assign(slot, { querySelectorAll: () => [], querySelector: () => null });
  const swapped = await mountRandomImages(fakeRoot([slot]), { ...images, ...fakeTimers(), saveData: () => false });
  assert.equal(swapped, 0);
  assert.equal(images.images.length, 0);
  const broken = fakeElement({ 'data-random-pool': 'not json' });
  Object.assign(broken, { querySelectorAll: () => [], querySelector: () => null });
  assert.equal(await mountRandomImages(fakeRoot([broken]), { ...images, ...fakeTimers(), saveData: () => false }), 0);
});

test('each slot is picked once per page view, so a second mount does not re-pick', async () => {
  const images = fakeImageFactory();
  const timers = fakeTimers();
  const slot = fakeSlot(POOL);
  const root = fakeRoot([slot]);
  const first = mountRandomImages(root, { random: seeded(9), ...images, ...timers, saveData: () => false });
  await tick();
  images.images[0].onload();
  await first;
  await mountRandomImages(root, { random: seeded(9), ...images, ...timers, saveData: () => false });
  assert.equal(images.images.length, 1);
});

/** A `<picture>` slot for the fan: a default `<img>`, an `append` that records the stage and cards the picker builds. */
function fakeFanSlot(pool) {
  const slot = fakeElement({ 'data-random-fan': JSON.stringify(pool) });
  const defaultImg = { ...fakeElement({ width: '64', height: '64', alt: '', 'aria-hidden': 'true', loading: 'lazy' }), src: '/_astro/avatar.webp' };
  const makeNode = (tag) => {
    const node = { tag, children: [], ...fakeElement() };
    node.append = (child) => node.children.push(child);
    node.cloneNode = () => makeNode('img');
    return node;
  };
  defaultImg.cloneNode = () => makeNode('img');
  slot.ownerDocument = { createElement: makeNode };
  slot.stages = [];
  slot.append = (stage) => slot.stages.push(stage);
  slot.querySelector = (selector) => (selector === 'img' ? defaultImg : null);
  slot.defaultImg = defaultImg;
  slot.offsetWidth = 0;
  return slot;
}

function fanRoot(slots) {
  return {
    querySelectorAll: () => slots.filter((slot) => slot.getAttribute('data-random-fan') !== null && slot.getAttribute('data-random-state') === null),
  };
}

/** A fan environment whose watcher, timer and image loads the test drives. */
function fanEnvironment(overrides = {}) {
  const images = fakeImageFactory();
  const watchers = [];
  const turns = [];
  return {
    images,
    watchers,
    turns,
    env: {
      random: seeded(7),
      ...images,
      ...fakeTimers(),
      saveData: () => false,
      reducedMotion: () => false,
      tabHidden: () => false,
      watch: (_slot, onChange) => watchers.push(onChange),
      every: (callback, ms) => {
        turns.push({ callback, ms });
        return () => { turns.length = 0; };
      },
      ...overrides,
    },
  };
}

const loadAll = (images) => images.images.forEach((image) => image.onload());

test('the fan slot rotates left to right with one card leaving and one entering per turn', () => {
  assert.deepEqual(Array.from({ length: 6 }, (_, card) => fanSlot(card, 0)), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from({ length: 6 }, (_, card) => fanSlot(card, 1)), [5, 0, 1, 2, 3, 4]);
  assert.deepEqual(Array.from({ length: 6 }, (_, card) => fanSlot(card, 6)), [0, 1, 2, 3, 4, 5]);
  for (let turn = 0; turn < 12; turn += 1) {
    const visible = Array.from({ length: 6 }, (_, card) => fanSlot(card, turn)).filter((slot) => slot < 3).sort();
    assert.deepEqual(visible, [0, 1, 2], `turn ${turn} shows exactly one card per fan slot`);
  }
});

test('pickRandomEntries returns distinct entries, never more than the pool holds, and each run differs by seed', () => {
  const picked = pickRandomEntries(KEYS, 6, seeded(3));
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked).size, 6);
  assert.ok(picked.every((key) => KEYS.includes(key)));
  assert.notDeepEqual(picked, pickRandomEntries(KEYS, 6, seeded(4)));
  assert.equal(pickRandomEntries(KEYS.slice(0, 4), 6).length, 4);
  assert.deepEqual(pickRandomEntries(KEYS, 0), []);
  assert.equal(KEYS.length, 46, 'the source list is not shuffled in place');
  assert.equal(KEYS[0], 'cat-head-gallery/key-00.avif');
  const tally = new Map(KEYS.map((key) => [key, 0]));
  const random = seeded(20261022);
  for (let run = 0; run < 46 * 200; run += 1) for (const key of pickRandomEntries(KEYS, 6, random)) tally.set(key, tally.get(key) + 1);
  const expected = (46 * 200 * 6) / 46;
  for (const count of tally.values()) assert.ok(count > expected * 0.85 && count < expected * 1.15, `count ${count} near ${expected}`);
});

test('the fan waits until the footer nears the viewport before it fetches anything', async () => {
  const { env, images, watchers } = fanEnvironment();
  const slot = fakeFanSlot(POOL);
  const [mounted] = mountRandomFans(fanRoot([slot]), env);
  await tick();
  assert.equal(images.images.length, 0, 'no request before the slot is near');
  watchers[0](false);
  await tick();
  assert.equal(images.images.length, 0);
  watchers[0](true);
  await tick();
  assert.equal(images.images.length, FAN_DECK_CARDS, 'six distinct images are preloaded');
  assert.equal(new Set(images.images.map((image) => image.src)).size, FAN_DECK_CARDS);
  assert.ok(images.images.every((image) => image.src.startsWith('https://img-gen.hagicode.com/cat-head-gallery/')));
  loadAll(images);
  assert.equal(await mounted, true);
});

test('six loaded images deal a fan of three and turn it on a timer', async () => {
  const { env, images, watchers, turns } = fanEnvironment();
  const slot = fakeFanSlot(POOL);
  const [mounted] = mountRandomFans(fanRoot([slot]), env);
  watchers[0](true);
  await tick();
  loadAll(images);
  assert.equal(await mounted, true);
  assert.equal(slot.getAttribute('data-random-state'), 'fan');
  const [stage] = slot.stages;
  assert.equal(stage.children.length, 6);
  assert.deepEqual(stage.children.map((card) => card.getAttribute('data-slot')), ['0', '1', '2', '3', '4', '5']);
  assert.deepEqual(stage.children.map((card) => card.getAttribute('src')), images.images.map((image) => image.src));
  assert.ok(stage.children.every((card) => card.getAttribute('class') === 'hagilight-fan__card'));
  assert.equal(slot.defaultImg.getAttribute('data-fan-out'), '', 'the vendored default fades out');
  assert.equal(turns.length, 1);
  assert.equal(turns[0].ms, FAN_TURN_MS);
  turns[0].callback();
  assert.deepEqual(stage.children.map((card) => card.getAttribute('data-slot')), ['5', '0', '1', '2', '3', '4']);
  turns[0].callback();
  assert.deepEqual(stage.children.map((card) => card.getAttribute('data-slot')), ['4', '5', '0', '1', '2', '3']);
});

test('the fan pauses off screen and in a hidden tab, and resumes without skipping', async () => {
  let hidden = false;
  const { env, images, watchers, turns } = fanEnvironment({ tabHidden: () => hidden });
  const slot = fakeFanSlot(POOL);
  const [mounted] = mountRandomFans(fanRoot([slot]), env);
  watchers[0](true);
  await tick();
  loadAll(images);
  await mounted;
  const slots = () => slot.stages[0].children.map((card) => card.getAttribute('data-slot')).join('');
  watchers[0](false);
  turns[0].callback();
  assert.equal(slots(), '012345', 'off screen: no turn');
  watchers[0](true);
  hidden = true;
  turns[0].callback();
  assert.equal(slots(), '012345', 'hidden tab: no turn');
  hidden = false;
  turns[0].callback();
  assert.equal(slots(), '501234');
});

test('a detached slot stops its own timer', async () => {
  const { env, images, watchers, turns } = fanEnvironment();
  const slot = fakeFanSlot(POOL);
  const [mounted] = mountRandomFans(fanRoot([slot]), env);
  watchers[0](true);
  await tick();
  loadAll(images);
  await mounted;
  slot.isConnected = false;
  turns[0].callback();
  assert.equal(turns.length, 0, 'the stop function ran');
});

test('reduced motion or a short deck deals a still fan of three; fewer than three keep the default', async () => {
  const reduced = fanEnvironment({ reducedMotion: () => true });
  const stillSlot = fakeFanSlot(POOL);
  const [still] = mountRandomFans(fanRoot([stillSlot]), reduced.env);
  reduced.watchers[0](true);
  await tick();
  assert.equal(reduced.images.images.length, 3, 'only the three still cards are fetched');
  loadAll(reduced.images);
  assert.equal(await still, true);
  assert.equal(stillSlot.stages[0].children.length, 3);
  assert.equal(reduced.turns.length, 0, 'no timer under reduced motion');

  const short = fanEnvironment();
  const shortSlot = fakeFanSlot(POOL);
  const [partial] = mountRandomFans(fanRoot([shortSlot]), short.env);
  short.watchers[0](true);
  await tick();
  short.images.images.slice(0, 4).forEach((image) => image.onload());
  short.images.images.slice(4).forEach((image) => image.onerror());
  assert.equal(await partial, true);
  assert.equal(shortSlot.stages[0].children.length, 3);
  assert.equal(short.turns.length, 0, 'a short deck does not turn');

  const failing = fanEnvironment();
  const failSlot = fakeFanSlot(POOL);
  const [failed] = mountRandomFans(fanRoot([failSlot]), failing.env);
  failing.watchers[0](true);
  await tick();
  failing.images.images.slice(0, 2).forEach((image) => image.onload());
  failing.images.images.slice(2).forEach((image) => image.onerror());
  assert.equal(await failed, false);
  assert.equal(failSlot.stages.length, 0);
  assert.equal(failSlot.defaultImg.getAttribute('data-fan-out'), null, 'the default stays');
  assert.equal(failSlot.getAttribute('data-random-state'), 'default');
});

test('data saver and a bad pool keep the default without a request, and a slot is dealt once', async () => {
  const saver = fanEnvironment({ saveData: () => true });
  const [saved] = mountRandomFans(fanRoot([fakeFanSlot(POOL)]), saver.env);
  assert.equal(await saved, false);
  assert.equal(saver.watchers.length, 0);
  assert.equal(saver.images.images.length, 0);

  const bad = fanEnvironment();
  const badSlot = fakeFanSlot(POOL);
  badSlot.setAttribute('data-random-fan', '["cat-head-gallery/only-one.avif"]');
  assert.equal(await mountRandomFans(fanRoot([badSlot]), bad.env)[0], false);
  assert.equal(bad.images.images.length, 0);

  const once = fanEnvironment();
  const slot = fakeFanSlot(POOL);
  const root = fanRoot([slot]);
  mountRandomFans(root, once.env);
  assert.equal(mountRandomFans(root, once.env).length, 0, 'a handled slot is not picked again');
});
