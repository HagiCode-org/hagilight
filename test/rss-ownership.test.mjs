import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RSS_OWNER,
  registerStarlightRssOwner,
  resolvePlainAstroRssOwner,
} from '@hagicode/hagilight-core/rss-ownership';

test('plain Astro owns RSS routes when no Starlight claim exists', () => {
  assert.equal(resolvePlainAstroRssOwner(), 'astro');
  assert.equal(resolvePlainAstroRssOwner([{ name: 'other' }, null, { [RSS_OWNER]: { package: 'astro', enabled: true } }]), 'astro');
});

test('a registered enabled Starlight claim takes ownership once and is then consumed', () => {
  registerStarlightRssOwner(true);
  assert.equal(resolvePlainAstroRssOwner([]), 'starlight');
  assert.equal(resolvePlainAstroRssOwner([]), 'astro');
});

test('claims advertised on integration objects are honored without registration', () => {
  assert.equal(resolvePlainAstroRssOwner([{ [RSS_OWNER]: { package: 'starlight', enabled: true } }]), 'starlight');
});

test('ambiguous or disabled Starlight ownership is diagnosed', () => {
  registerStarlightRssOwner(true);
  registerStarlightRssOwner(true);
  assert.throws(() => resolvePlainAstroRssOwner(), /multiple Starlight RSS integrations/u);
  registerStarlightRssOwner(false);
  // A disabled Starlight claim lets the plain-Astro integration own the routes.
  assert.equal(resolvePlainAstroRssOwner(), 'astro');
});

test('withdrawn claims no longer affect ownership and invalid flags are rejected', () => {
  const unregister = registerStarlightRssOwner(true);
  unregister();
  assert.equal(resolvePlainAstroRssOwner(), 'astro');
  assert.throws(() => registerStarlightRssOwner('yes'), /must be a boolean/u);
});