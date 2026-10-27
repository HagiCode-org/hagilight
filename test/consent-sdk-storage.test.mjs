import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const gate = readFileSync(new URL('../packages/core/src/consent-gate.ts', import.meta.url), 'utf8');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/consent-sdk-storage.json', import.meta.url), 'utf8'));

test('every observed PostHog storage name is recorded in the gate comment table', () => {
  for (const name of [...fixture.posthog.cookies, ...fixture.posthog.localStorage, ...fixture.posthog.sessionStorage, ...fixture.posthog.calls]) {
    assert.ok(gate.includes(name), `consent-gate.ts is missing ${name}`);
  }
});

test('every observed Google Analytics cookie and the disable flag are recorded in the gate comment table', () => {
  for (const name of [...fixture.googleAnalytics.cookies, fixture.googleAnalytics.disableFlag]) {
    assert.ok(gate.includes(name), `consent-gate.ts is missing ${name}`);
  }
});

test('the fixture keeps Google Analytics out of stop-in-place until it is verified', () => {
  assert.equal(fixture.googleAnalytics.stopInPlace, false);
  assert.match(fixture.fiftyOneLa.status, /not observed/u);
});
