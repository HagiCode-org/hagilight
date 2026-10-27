import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONSENT_COPY, resolveConsentCopy } from '../packages/core/dist/consent-copy/index.js';
import { SITE_LOCALE_CODES } from '../packages/core/dist/root-transit-locale.js';

const BRANDS = ['HagiCode', 'Google Analytics', 'PostHog', '51LA'];
const english = CONSENT_COPY['en-US'];
const keys = Object.keys(english);

test('every SITE_LOCALES code has a catalog entry and no extra locale', () => {
  assert.deepEqual(Object.keys(CONSENT_COPY).sort(), [...SITE_LOCALE_CODES].sort());
});

test('every locale has every copy key with a non-empty string', () => {
  for (const locale of SITE_LOCALE_CODES) {
    for (const key of keys) {
      const value = CONSENT_COPY[locale][key];
      assert.equal(typeof value, 'string', `${locale}.${key} must be a string`);
      assert.ok(value.trim().length > 0, `${locale}.${key} must not be empty`);
    }
    assert.deepEqual(Object.keys(CONSENT_COPY[locale]).sort(), [...keys].sort(), `${locale} has no extra or missing keys`);
  }
});

test('a brand name in the English copy stays in every translation', () => {
  for (const brand of BRANDS) {
    for (const key of keys) {
      if (!english[key].includes(brand)) continue;
      for (const locale of SITE_LOCALE_CODES) {
        assert.ok(CONSENT_COPY[locale][key].includes(brand), `${locale}.${key} must keep ${brand}`);
      }
    }
  }
  assert.ok(keys.some((key) => english[key].includes('HagiCode')), 'the copy names HagiCode somewhere');
});

test('the page locale selects its copy and an unsupported locale renders en-US', () => {
  assert.equal(resolveConsentCopy('zh-CN'), CONSENT_COPY['zh-CN']);
  assert.equal(resolveConsentCopy('fr-FR'), CONSENT_COPY['fr-FR']);
  assert.equal(resolveConsentCopy('it-IT'), CONSENT_COPY['en-US']);
  assert.equal(resolveConsentCopy(undefined), CONSENT_COPY['en-US']);
  assert.equal(resolveConsentCopy(42), CONSENT_COPY['en-US']);
});
