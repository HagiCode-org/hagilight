import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONSENT_DESCRIPTOR_ID, consentDescriptor, renderConsentMarkup, validatePolicyVersion, validatePrivacyUrl,
} from '../packages/core/dist/consent-markup.js';

test('the privacy URL is an absolute HTTP(S) URL or a site-relative path, and anything else names the option', () => {
  assert.equal(validatePrivacyUrl('https://example.com/privacy'), 'https://example.com/privacy');
  assert.equal(validatePrivacyUrl('/privacy/'), '/privacy/');
  assert.equal(validatePrivacyUrl(undefined), undefined);
  assert.equal(validatePrivacyUrl(''), undefined);
  for (const bad of ['javascript:alert(1)', '//evil.example/x', 'privacy', 'https://exa mple.com', 42]) {
    assert.throws(() => validatePrivacyUrl(bad), (error) => error instanceof TypeError && /privacyUrl/u.test(error.message), `rejects ${bad}`);
  }
});

test('the policy version is 1 to 32 safe characters and a spaced value names the option', () => {
  assert.equal(validatePolicyVersion(undefined), '1');
  assert.equal(validatePolicyVersion('2026-10.1_b'), '2026-10.1_b');
  assert.throws(() => validatePolicyVersion('has space'), /analytics\.consent\.policyVersion/u);
  assert.throws(() => validatePolicyVersion('a'.repeat(33)), /analytics\.consent\.policyVersion/u);
});

test('the markup is a hidden labelled region with two equal actions and no link without privacyUrl', () => {
  const markup = renderConsentMarkup({ providers: ['googleAnalytics', 'posthog'], locale: 'en-US' });
  assert.match(markup, /^<section class="hagilight-consent" data-hagilight-consent data-state="undecided" role="region" aria-labelledby="hagilight-consent-title" hidden>/u);
  assert.equal(markup.match(/<button type="button" class="hagilight-consent__button"/gu).length, 2, 'accept and reject share one class');
  assert.match(markup, /data-consent-toggle aria-expanded="false"/u);
  assert.doesNotMatch(markup, /<a /u);
  assert.doesNotMatch(markup, /<script/u);
});

test('a configured privacy URL is the only link, with exactly that href', () => {
  const markup = renderConsentMarkup({ providers: ['posthog'], privacyUrl: 'https://example.com/privacy' });
  assert.deepEqual([...markup.matchAll(/<a href="([^"]+)"/gu)].map((match) => match[1]), ['https://example.com/privacy']);
});

test('details list the providers the site enables and their storage, and no disabled provider', () => {
  const gaOnly = renderConsentMarkup({ providers: ['googleAnalytics'] });
  assert.match(gaOnly, /Google Analytics/u);
  assert.match(gaOnly, /<code>_ga<\/code>/u);
  assert.doesNotMatch(gaOnly, /PostHog/u);
  assert.doesNotMatch(gaOnly, /ph_&lt;key&gt;|ph_<key>/u);
});

test('the descriptor carries only policy, privacy, providers and locale, and cannot close its script element', () => {
  assert.equal(CONSENT_DESCRIPTOR_ID, 'hagilight-consent-config');
  const descriptor = consentDescriptor({ providers: ['posthog'], privacyUrl: '/privacy', policyVersion: '2', locale: 'de-DE' });
  assert.deepEqual(JSON.parse(descriptor), { policyVersion: '2', privacyUrl: '/privacy', providers: ['posthog'], locale: 'de-DE' });
  assert.doesNotMatch(consentDescriptor({ providers: [], privacyUrl: '/</script><b>' }), /<\/script/u);
});

test('an unsupported page locale renders en-US copy and the descriptor names en-US', () => {
  const markup = renderConsentMarkup({ providers: ['posthog'], locale: 'it-IT' });
  assert.match(markup, /Cookies and analytics/u);
  assert.equal(JSON.parse(consentDescriptor({ providers: ['posthog'], locale: 'it-IT' })).locale, 'en-US');
});
