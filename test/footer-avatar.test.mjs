import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const {
  FOOTER_AVATAR_DISPLAY_PX,
  footerAvatarImageAttributes,
  FOOTER_AVATAR_MIN_CONTAINER_PX,
  FOOTER_AVATAR_SOURCE_PX,
  resolveFooterAvatarOptions,
} = await import(new URL('../packages/core/dist/footer-avatar.js', import.meta.url).href);
const { randomPoolAttribute, randomPoolFromManifest } = await import(new URL('../packages/core/dist/random-image.js', import.meta.url).href);

const manifest = JSON.parse(readFileSync(new URL('../packages/core/assets/footer/manifest.json', import.meta.url), 'utf8'));

test('the footer avatar is on by default, with the random option on', () => {
  assert.deepEqual(resolveFooterAvatarOptions(undefined), { avatar: true, randomAvatar: true });
  assert.deepEqual(resolveFooterAvatarOptions({}), { avatar: true, randomAvatar: true });
});

test('avatar false removes the element and its random pool, and randomAvatar false keeps the default', () => {
  assert.deepEqual(resolveFooterAvatarOptions({ avatar: false }), { avatar: false, randomAvatar: false });
  assert.deepEqual(resolveFooterAvatarOptions({ avatar: false, randomAvatar: true }), { avatar: false, randomAvatar: false });
  assert.deepEqual(resolveFooterAvatarOptions({ randomAvatar: false }), { avatar: true, randomAvatar: false });
});

test('a bad avatar option value throws a TypeError', () => {
  for (const input of [{ avatar: 'no' }, { avatar: 0 }, { avatar: null }, { randomAvatar: 'yes' }, { randomAvatar: {} }]) {
    assert.throws(() => resolveFooterAvatarOptions(input), TypeError, JSON.stringify(input));
  }
  for (const input of ['false', 0, null, [], true]) {
    assert.throws(() => resolveFooterAvatarOptions(input), TypeError, `non-object ${JSON.stringify(input)}`);
  }
});

test('the decorative image attributes hide the avatar from assistive technology and reserve its box', () => {
  assert.equal(FOOTER_AVATAR_DISPLAY_PX, 64);
  assert.equal(FOOTER_AVATAR_SOURCE_PX, 128);
  assert.equal(FOOTER_AVATAR_MIN_CONTAINER_PX, 360);
  const attributes = footerAvatarImageAttributes();
  assert.notEqual(footerAvatarImageAttributes(), attributes, 'a fresh object on every call');
  assert.deepEqual({ ...attributes }, {
    width: 64,
    height: 64,
    alt: '',
    'aria-hidden': 'true',
    loading: 'lazy',
    decoding: 'async',
  });
});

test('the footer manifest pool builds a validated pool of R2 object paths', () => {
  const pool = randomPoolFromManifest(manifest.pool);
  assert.equal(pool.length, manifest.pool.entries.length);
  assert.ok(pool.length >= 12 && pool.length <= 200);
  assert.ok(pool.every((path) => path.startsWith('hero-avatars/') && path.endsWith('.avif')));
  const attribute = randomPoolAttribute(pool);
  assert.deepEqual(JSON.parse(attribute), [...pool]);
});

test('a pool entry over the byte cap or a pool that is too small fails the build', () => {
  const oversized = { ...manifest.pool, entries: [...manifest.pool.entries.slice(0, 11), { key: 'big', bytes: manifest.pool.maxBytes + 1 }] };
  assert.throws(() => randomPoolFromManifest(oversized), /over the .* byte cap/u);
  assert.throws(() => randomPoolFromManifest({ ...manifest.pool, entries: manifest.pool.entries.slice(0, 11) }), TypeError);
});
