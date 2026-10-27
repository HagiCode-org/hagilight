import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NECESSARY_STORAGE, PROVIDER_STORAGE, consentDetails } from '../packages/core/dist/consent-details.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/consent-sdk-storage.json', import.meta.url), 'utf8'));

/** Documented names from the fixture that the details do not list, as `kind name` strings. */
function missingDocumentedNames({ PROVIDER_STORAGE: storage }) {
  const documented = [
    ...fixture.posthog.cookies.map((name) => ['posthog', 'cookie', name]),
    ...fixture.posthog.localStorage.map((name) => ['posthog', 'localStorage', name]),
    ...fixture.posthog.sessionStorage.map((name) => ['posthog', 'sessionStorage', name]),
    ...fixture.googleAnalytics.cookies.map((name) => ['googleAnalytics', 'cookie', name]),
  ];
  return documented
    .filter(([provider, kind, name]) => !(storage[provider] ?? []).some((entry) => entry.kind === kind && entry.name === name))
    .map(([provider, kind, name]) => `${provider} ${kind} ${name}`);
}

test('every storage name documented in the verified fixture appears in the details data', () => {
  assert.deepEqual(missingDocumentedNames({ PROVIDER_STORAGE }), []);
});

test('the check fails when a documented name is removed from the details', () => {
  const withoutGa = { PROVIDER_STORAGE: { ...PROVIDER_STORAGE, googleAnalytics: PROVIDER_STORAGE.googleAnalytics.slice(1) } };
  const missing = missingDocumentedNames(withoutGa);
  assert.deepEqual(missing, ['googleAnalytics cookie _ga']);
});

test('the details name only the enabled providers and their storage', () => {
  const gaOnly = consentDetails(['googleAnalytics']);
  assert.deepEqual(gaOnly.analytics.providers, ['googleAnalytics']);
  assert.deepEqual(gaOnly.analytics.storage, PROVIDER_STORAGE.googleAnalytics);

  const none = consentDetails([]);
  assert.deepEqual(none.analytics.providers, []);
  assert.deepEqual(none.analytics.storage, []);
  assert.deepEqual(none.necessary, NECESSARY_STORAGE);

  const duplicated = consentDetails(['posthog', 'posthog']);
  assert.deepEqual(duplicated.analytics.providers, ['posthog']);
  assert.equal(duplicated.analytics.storage.length, PROVIDER_STORAGE.posthog.length);
});

test('the necessary category lists the consent record and the functional site storage', () => {
  const names = NECESSARY_STORAGE.map((entry) => entry.name);
  for (const name of [
    'hagicode_consent', 'hagicode:consent', 'hagicode_locale_monitor', 'hagicode:locale-monitor',
    'hagilight-theme', 'hagilight-content-width', 'hagilight:promoto-banner:dismissed-signature', 'starlight-route',
  ]) {
    assert.ok(names.includes(name), `${name} is listed as necessary`);
  }
});
