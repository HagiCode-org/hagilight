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

test('the replay opt-in section renders only for a regional site with sessionReplay optIn, with equal actions', () => {
  const regional = renderConsentMarkup({ providers: ['googleAnalytics', 'posthog'], regional: { regions: 'default', settingsEntry: 'requiredOnly', sessionReplay: 'optIn' } });
  assert.match(regional, /data-hagilight-consent-replay hidden>/u);
  assert.match(regional, /<div class="hagilight-consent__main" data-consent-main>/u);
  const allow = regional.match(/<button type="button" class="([^"]+)" data-consent-replay-allow>/u);
  const decline = regional.match(/<button type="button" class="([^"]+)" data-consent-replay-decline>/u);
  assert.ok(allow && decline, 'both replay actions render');
  assert.equal(allow[1], decline[1], 'Allow and Not now share one class');
  assert.match(regional, /Allow session replay/u);
  assert.match(regional, /Not now/u);
  assert.doesNotMatch(regional, /data-consent-replay-allow[^>]*>[^<]*<\/button><\/div>[\s\S]*data-consent-replay-decline=/u, 'the actions sit in one row');

  for (const sessionReplay of ['projectDefault', 'off']) {
    const markup = renderConsentMarkup({ providers: ['googleAnalytics'], regional: { regions: 'default', settingsEntry: 'requiredOnly', sessionReplay } });
    assert.doesNotMatch(markup, /data-hagilight-consent-replay/u, sessionReplay);
  }
});

test('a regional site without a privacy URL has no privacy link in the replay section', () => {
  const markup = renderConsentMarkup({ providers: ['posthog'], regional: { regions: 'default', settingsEntry: 'requiredOnly', sessionReplay: 'optIn' } });
  assert.equal((markup.match(/hagilight-consent__privacy/gu) ?? []).length, 0);
  const withPrivacy = renderConsentMarkup({ providers: ['posthog'], privacyUrl: '/privacy', regional: { regions: 'default', settingsEntry: 'requiredOnly', sessionReplay: 'optIn' } });
  assert.equal((withPrivacy.match(/hagilight-consent__privacy/gu) ?? []).length, 2, 'privacy link in main and replay sections only when configured');
});

test('a global site renders exactly the markup of the previous release', () => {
  const markup = renderConsentMarkup({ providers: ['googleAnalytics', 'posthog'] });
  assert.doesNotMatch(markup, /data-consent-main|data-hagilight-consent-replay/u);
  assert.match(markup, /^<section class="hagilight-consent" data-hagilight-consent data-state="undecided" role="region" aria-labelledby="hagilight-consent-title" hidden><h2 class="hagilight-consent__title" id="hagilight-consent-title">/u);
});

// Task 4.1: validators and descriptor for the regional options.
import { resolveRegionalOptions, validateCountryCode, validateHookName, validateRegions, validateSessionReplay, validateSettingsEntry } from '../packages/core/dist/consent-markup.js';

test('valid regional options resolve with their defaults', () => {
  assert.deepEqual(resolveRegionalOptions({ regions: 'default' }), { regions: 'default', settingsEntry: 'requiredOnly', sessionReplay: 'optIn' });
  assert.deepEqual(resolveRegionalOptions({ regions: ['DE', 'FR'], settingsEntry: 'always', sessionReplay: 'off', countryCode: 'DE', regionHook: 'siteRegion' }), {
    regions: ['DE', 'FR'], countryCode: 'DE', regionHook: 'siteRegion', settingsEntry: 'always', sessionReplay: 'off',
  });
  assert.equal(validateRegions('default'), 'default');
  assert.equal(validateSettingsEntry('always'), 'always');
  assert.equal(validateSessionReplay('projectDefault'), 'projectDefault');
  assert.equal(validateHookName('window.site.region'), 'window.site.region');
});

test('invalid country codes name the option', () => {
  for (const bad of ['de', 'Germany', 'DEU', 'XX', 'EU', '']) {
    assert.throws(() => validateCountryCode(bad), /analytics\.consent\.countryCode/u, bad);
  }
  for (const bad of [['Germany'], ['de'], [], 'DE']) {
    assert.throws(() => validateRegions(bad), /analytics\.consent\.regions/u, JSON.stringify(bad));
  }
});

test('a hook name that contains code is rejected and names the option', () => {
  for (const bad of ['x(); alert(1)', 'a-b', '1abc', '', 'window..x', 42]) {
    assert.throws(() => validateHookName(bad), /analytics\.consent\.regionHook/u, String(bad));
  }
});

test('a regional-only option without regions fails and says regions is required', () => {
  assert.throws(() => resolveRegionalOptions({ countryCode: 'US' }), /analytics\.consent\.countryCode.*regions is required/u);
  assert.throws(() => resolveRegionalOptions({ sessionReplay: 'off' }), /analytics\.consent\.sessionReplay.*regions is required/u);
});

test('regions with consent disabled fails and names regions', () => {
  assert.throws(() => resolveRegionalOptions({ regions: 'default' }, false), /analytics\.consent\.regions/u);
});

test('an unconfigured site resolves to no regional options and keeps the previous descriptor', () => {
  assert.equal(resolveRegionalOptions({}), undefined);
  assert.equal(resolveRegionalOptions(undefined), undefined);
  assert.equal(
    consentDescriptor({ providers: ['posthog'], locale: 'en-US' }),
    '{"policyVersion":"1","privacyUrl":null,"providers":["posthog"],"locale":"en-US"}',
  );
});

test('a regional descriptor carries the mode and the regional data, and no executable code', () => {
  const text = consentDescriptor({
    providers: ['posthog'],
    locale: 'en-US',
    regional: { regions: ['DE'], countryCode: 'DE', regionHook: 'siteRegion', settingsEntry: 'always', sessionReplay: 'optIn' },
  });
  const parsed = JSON.parse(text);
  assert.equal(parsed.mode, 'regional');
  assert.deepEqual(parsed.regions, ['DE']);
  assert.equal(parsed.regionHook, 'siteRegion');
  assert.equal(parsed.settingsEntry, 'always');
  assert.equal(parsed.sessionReplay, 'optIn');
  assert.doesNotMatch(text, /function|=>|</u);
});
