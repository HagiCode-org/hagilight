import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sites = JSON.parse(readFileSync(new URL('../packages/core/src/related-sites.json', import.meta.url), 'utf8'));
const LOCALES = ['zh-CN', 'zh-Hant', 'en-US', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];

test('related site ids are unique and urls are https', () => {
  const ids = sites.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  for (const site of sites) assert.match(site.url, /^https:\/\//, site.id);
});

test('every related site has a name and a description in all ten locales', () => {
  for (const site of sites) {
    for (const field of ['name', 'description']) {
      assert.deepEqual(Object.keys(site[field] ?? {}).sort(), [...LOCALES].sort(), `${site.id}.${field}`);
      for (const locale of LOCALES) assert.ok(site[field][locale].trim(), `${site.id}.${field}.${locale}`);
    }
  }
});

test('docs.hagicode.com is listed without a locale path (its default locale has no prefix)', () => {
  const docs = sites.find(({ id }) => id === 'hagicode-docs');
  assert.ok(docs, 'hagicode-docs entry is missing');
  assert.equal(docs.url, 'https://docs.hagicode.com/');
  assert.ok(!docs.supportsLocalePath);
});
