import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_LOCALE, SITE_LOCALES, normalizeTransitLocale, resolveTransitLocale,
} from '@hagicode/hagilight-core/root-transit';

test('the monitor knows the ten site locales and the English default', () => {
  assert.deepEqual(SITE_LOCALES.map((locale) => locale.code), [
    'en-US', 'zh-CN', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU',
  ]);
  assert.equal(DEFAULT_LOCALE, 'en-US');
});

test('each input wins in the reference order, and the evidence names it', () => {
  const query = resolveTransitLocale({ requestedLang: 'zh-CN', storedLocale: 'fr-FR', clientLanguages: ['de-DE'] });
  assert.deepEqual([query.locale, query.source], ['zh-CN', 'query']);

  const stored = resolveTransitLocale({ storedLocale: 'ja-JP', clientLanguages: ['zh-CN'] });
  assert.deepEqual([stored.locale, stored.source], ['ja-JP', 'stored']);

  const browser = resolveTransitLocale({ clientLanguages: ['xx', 'de-AT', 'fr'] });
  assert.deepEqual([browser.locale, browser.source], ['de-DE', 'browser']);
  assert.deepEqual(browser.evidence.browser, { raw: 'de-AT', locale: 'de-DE' });

  const fallback = resolveTransitLocale({ clientLanguages: ['xx'] });
  assert.deepEqual([fallback.locale, fallback.source], ['en-US', 'default']);
});

test('the legacy lang key is read only when the current key holds nothing supported', () => {
  const legacy = resolveTransitLocale({ legacyStoredLocale: 'zh-TW', clientLanguages: ['de'] });
  assert.deepEqual([legacy.locale, legacy.source], ['zh-Hant', 'stored']);
  assert.deepEqual(legacy.evidence.stored, { raw: 'zh-TW', locale: 'zh-Hant' });

  const current = resolveTransitLocale({ storedLocale: 'ja-JP', legacyStoredLocale: 'zh-TW' });
  assert.equal(current.locale, 'ja-JP');
  assert.equal(current.evidence.stored.raw, 'ja-JP');

  const unsupported = resolveTransitLocale({ storedLocale: 'xx', legacyStoredLocale: 'ko' });
  assert.deepEqual(unsupported.evidence.stored, { raw: 'ko', locale: 'ko-KR' });
  assert.equal(unsupported.locale, 'ko-KR');
});

test('an unsupported ?lang= falls through without being used, and its raw value stays visible', () => {
  const result = resolveTransitLocale({ requestedLang: 'xx', storedLocale: 'fr-FR', clientLanguages: ['ja-JP'] });
  assert.deepEqual([result.locale, result.source], ['fr-FR', 'stored']);
  assert.deepEqual(result.evidence.query, { raw: 'xx', locale: null });
});

test('regional and legacy forms normalize to the supported locale', () => {
  for (const [input, expected] of [
    ['zh-TW', 'zh-Hant'], ['zh_CN', 'zh-CN'], ['pt', 'pt-BR'], ['EN-us', 'en-US'], ['de-AT', 'de-DE'],
  ]) {
    assert.equal(resolveTransitLocale({ requestedLang: input }).locale, expected, input);
    assert.equal(normalizeTransitLocale(input), expected, input);
  }
});

test('an empty or unusable browser list falls back to the default with no raw value', () => {
  const empty = resolveTransitLocale({ clientLanguages: [] });
  assert.deepEqual([empty.locale, empty.source], ['en-US', 'default']);
  assert.deepEqual(empty.evidence.browser, { raw: null, locale: null });

  const junk = resolveTransitLocale({ clientLanguages: [null, undefined, ''] });
  assert.deepEqual([junk.locale, junk.source], ['en-US', 'default']);
  assert.equal(junk.evidence.browser.raw, null);
});

test('markup-looking query text is kept as data and never resolves', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const result = resolveTransitLocale({ requestedLang: payload });
  assert.equal(result.locale, 'en-US');
  assert.equal(result.evidence.query.raw, payload);
  assert.equal(result.evidence.query.locale, null);
});

test('reads that were never made (null) behave like absent inputs', () => {
  const result = resolveTransitLocale({ requestedLang: null, storedLocale: null, legacyStoredLocale: null, clientLanguages: null });
  assert.deepEqual([result.locale, result.source], ['en-US', 'default']);
});

/** Expected values taken by running the official normalizeSiteLocale() from repos/site/src/i18n/locale-metadata.ts. */
const OFFICIAL_PARITY = [
  ['en', 'en-US'], ['en-US', 'en-US'], ['en_us', 'en-US'], ['EN-us', 'en-US'],
  ['zh', 'zh-CN'], ['zh-CN', 'zh-CN'], ['zh_CN', 'zh-CN'], ['zh-Hans', 'zh-CN'], ['zh-SG', 'zh-CN'],
  ['zh-TW', 'zh-Hant'], ['zh-HK', 'zh-Hant'], ['zh-MY', 'zh-Hant'], ['zh-Hant-TW', 'zh-Hant'],
  // The official page resolves a script-tagged Simplified tag to Traditional. Mirrored on purpose so the two agree.
  ['zh-Hans-CN', 'zh-Hant'], ['zh-Hans-SG', 'zh-Hant'],
  ['ja-JP', 'ja-JP'], ['ja', 'ja-JP'], ['ko', 'ko-KR'], ['ko-KR', 'ko-KR'],
  ['de', 'de-DE'], ['de-AT', 'de-DE'], ['fr-CA', 'fr-FR'], ['es-MX', 'es-ES'],
  ['pt', 'pt-BR'], ['pt-PT', 'pt-BR'], ['ru-RU', 'ru-RU'], ['ru-RU-x-foo', 'ru-RU'],
  ['xx', null], ['', null], ['und', null], ['de DE', null], ['<img src=x onerror=alert(1)>', null],
];

test('normalization matches the official page for the shared parity table', () => {
  for (const [input, expected] of OFFICIAL_PARITY) {
    assert.equal(normalizeTransitLocale(input), expected, JSON.stringify(input));
  }
});
