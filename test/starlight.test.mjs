import assert from 'node:assert/strict';
import { test } from 'node:test';
import hagilight from '../packages/starlight/index.mjs';

test('registers the shared footer without discarding other overrides', () => {
  const config = { components: { Header: './Header.astro' } };
  let updated;
  hagilight().hooks['config:setup']({ config, updateConfig: (value) => { updated = value; } });

  assert.equal(updated.components.Header, config.components.Header);
  assert.match(updated.components.Footer, /packages\/starlight\/Footer\.astro$/);
});

test('rejects an existing footer override instead of replacing it', () => {
  assert.throws(
    () => hagilight().hooks['config:setup']({
      config: { components: { Footer: './CustomFooter.astro' } },
      updateConfig: () => assert.fail('should not update'),
    }),
    /existing Starlight Footer override/,
  );
});
