import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHagilightFaviconDataUri } from '@hagicode/hagilight-core/favicon';
import { hagilightFavicon } from '@hagicode/hagilight/integration';

function setup(options = {}, head = []) {
  const config = { head };
  let updated;
  hagilightFavicon(options).hooks['astro:config:setup']({
    config,
    updateConfig: (value) => { updated = value; },
  });
  return { config, updated };
}

test('bundled favicon resolves to an inline x-icon data URI', () => {
  const dataUri = getHagilightFaviconDataUri();
  assert.match(dataUri, /^data:image\/x-icon;base64,/u);
  // memoized: identical on repeat calls
  assert.equal(getHagilightFaviconDataUri(), dataUri);
});

test('injects the bundled favicon into an empty head', () => {
  const { updated } = setup();
  const favicon = updated.head.find(
    (entry) => entry.tag === 'link' && entry.attrs.rel === 'icon',
  );
  assert.ok(favicon);
  assert.match(favicon.attrs.href, /^data:image\/x-icon;base64,/u);
  assert.equal(favicon.attrs.type, 'image/x-icon');
});

test('honors a consumer-provided favicon href override', () => {
  const { updated } = setup({ href: '/my-brand.ico' });
  const favicon = updated.head.find(
    (entry) => entry.tag === 'link' && entry.attrs.rel === 'icon',
  );
  assert.ok(favicon);
  assert.equal(favicon.attrs.href, '/my-brand.ico');
  assert.equal(favicon.attrs.type, undefined);
});

test('skips injection when the consumer already declares an icon link', () => {
  const consumerIcon = {
    tag: 'link',
    attrs: { rel: 'icon', href: '/existing.ico', type: 'image/x-icon' },
  };
  const { config } = setup({}, [consumerIcon]);
  assert.deepEqual(config.head, [consumerIcon]);
});

test('skips injection for a legacy shortcut icon link too', () => {
  const shortcut = {
    tag: 'link',
    attrs: { rel: 'shortcut icon', href: '/favicon.svg', type: 'image/svg+xml' },
  };
  const { config } = setup({}, [shortcut]);
  assert.deepEqual(config.head, [shortcut]);
});

test('rejects non-object options', () => {
  assert.throws(() => setup('nope'), /favicon options must be an object/);
});