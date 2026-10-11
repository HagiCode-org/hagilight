import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const starlightSource = readFileSync(new URL('../packages/starlight/src/index.ts', import.meta.url), 'utf8');
const { locales: starlightLocales } = await import(new URL('../packages/starlight/dist/locales.js', import.meta.url).href);
const analytics = await import(new URL('../packages/docusaurus/dist/analytics.js', import.meta.url).href);
const catalog = await import(new URL('../packages/docusaurus/dist/locales.js', import.meta.url).href);

function starlightStringConstant(name) {
  const value = starlightSource.match(new RegExp(`const ${name} = '([^']*)';`, 'u'))?.[1];
  assert.notEqual(value, undefined, `Starlight declares ${name}`);
  return value;
}

function starlightPatternConstant(name) {
  const literal = starlightSource.match(new RegExp(`const ${name} = (/.+/[a-z]*);`, 'u'))?.[1];
  assert.notEqual(literal, undefined, `Starlight declares ${name}`);
  const flagsStart = literal.lastIndexOf('/');
  return new RegExp(literal.slice(1, flagsStart), literal.slice(flagsStart + 1));
}

test('default analytics IDs match the Starlight package', () => {
  assert.equal(analytics.DEFAULT_GOOGLE_ANALYTICS_ID, starlightStringConstant('DEFAULT_GOOGLE_ANALYTICS_ID'));
  assert.equal(analytics.DEFAULT_FIFTY_ONE_LA_ID, starlightStringConstant('DEFAULT_51LA_ID'));
});

test('analytics ID patterns match the Starlight package', () => {
  const googlePattern = starlightPatternConstant('GOOGLE_ID_PATTERN');
  const fiftyOnePattern = starlightPatternConstant('FIFTY_ONE_LA_ID_PATTERN');
  assert.equal(analytics.GOOGLE_ANALYTICS_ID_PATTERN.source, googlePattern.source);
  assert.equal(analytics.GOOGLE_ANALYTICS_ID_PATTERN.flags, googlePattern.flags);
  assert.equal(analytics.FIFTY_ONE_LA_ID_PATTERN.source, fiftyOnePattern.source);
  assert.equal(analytics.FIFTY_ONE_LA_ID_PATTERN.flags, fiftyOnePattern.flags);
});

test('the locale catalog matches the Starlight locales', () => {
  const starlightToDocusaurus = (key) => (key === 'root' ? 'en-US' : key);
  assert.deepEqual(
    [...catalog.locales].sort(),
    Object.keys(starlightLocales).map(starlightToDocusaurus).sort(),
  );
  for (const [key, entry] of Object.entries(starlightLocales)) {
    const configured = catalog.localeConfigs[starlightToDocusaurus(key)];
    assert.equal(configured.label, entry.label, `${key} label`);
    assert.equal(configured.htmlLang, entry.lang, `${key} lang`);
  }
  assert.equal(catalog.defaultLocale, 'en-US');
  assert.equal(catalog.i18n.defaultLocale, 'en-US');
});
