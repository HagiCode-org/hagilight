import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import {
  CONSENT_CHANGE_EVENT, CONSENT_COOKIE, CONSENT_MAX_AGE_SECONDS, CONSENT_PREFERENCES_EVENT, CONSENT_STORAGE_KEY,
  configureConsent, decisionFromRecord, formatConsentRecord, getConsent, isConsentRequired, openConsentPreferences,
  onConsentChange, parseConsentRecord, readCookieValue, setConsent,
} from '@hagicode/hagilight-core/consent';

const DAY = 24 * 60 * 60;
const NOW = Math.floor(Date.now() / 1000);

// Fresh module instances keep the in-memory session copy and subscriber list isolated between tests.
const loadFresh = () => import(new URL(`../packages/core/dist/consent.js?case=${Math.random()}`, import.meta.url));

/** A fake browser: window with localStorage, a location and a storage listener; document with a cookie jar and events. */
function installBrowser({ hostname = 'localhost', storage = true, cookies = true, dom = true, windowPresent = true } = {}) {
  const jar = new Map();
  const rawCookieWrites = [];
  const events = [];
  const storageListeners = [];
  const values = new Map();
  const localStorage = storage ? {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
  } : undefined;
  const document = dom ? {
    get cookie() {
      if (!cookies) throw new Error('cookies blocked');
      return [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
    },
    set cookie(text) {
      if (!cookies) throw new Error('cookies blocked');
      rawCookieWrites.push(text);
      const pair = text.split(';')[0];
      const index = pair.indexOf('=');
      jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    },
    getElementById: () => null,
    dispatchEvent: (event) => {
      events.push(event);
      return true;
    },
  } : undefined;
  globalThis.window = windowPresent ? {
    location: { hostname },
    localStorage,
    addEventListener: (type, listener) => storageListeners.push({ type, listener }),
  } : undefined;
  globalThis.document = document;
  return { jar, rawCookieWrites, events, values, storageListeners };
}

function removeBrowser() {
  delete globalThis.window;
  delete globalThis.document;
}

afterEach(removeBrowser);

test('the record is a four-field compact string that formats and parses back', () => {
  const text = formatConsentRecord({ state: 'granted', time: 1700000000, policyVersion: '1' });
  assert.equal(text, '1|granted|1700000000|1');
  assert.deepEqual(parseConsentRecord(text), { state: 'granted', time: 1700000000, policyVersion: '1' });
  assert.equal(formatConsentRecord({ state: 'denied', time: 1700000001, policyVersion: 'policy.v2_x-3' }), '1|denied|1700000001|policy.v2_x-3');
});

test('malformed records parse to no decision and never throw', () => {
  for (const value of [
    '', null, undefined, 42, '1|granted|1700000000', '1|granted|1700000000|1|extra', '2|granted|1700000000|1',
    '1|maybe|1700000000|1', '1|granted|17e9|1', '1|granted|-1|1', '1|granted|1700000000|bad policy', '1|granted|1700000000|',
    '1|granted|1700000000|a|b', '1|granted|1700000000|x'.repeat(4),
  ]) {
    assert.equal(parseConsentRecord(value), null, `should reject ${JSON.stringify(value)}`);
  }
});

test('oversized values and unsafe policy versions are refused on both parse and format', () => {
  assert.equal(parseConsentRecord('x'.repeat(65)), null);
  assert.equal(parseConsentRecord(`1|granted|1700000000|${'a'.repeat(33)}`), null);
  assert.equal(formatConsentRecord({ state: 'granted', time: 1700000000, policyVersion: 'a'.repeat(33) }), null);
  assert.equal(formatConsentRecord({ state: 'granted', time: 1700000000, policyVersion: 'has space' }), null);
  assert.equal(formatConsentRecord({ state: 'granted', time: 1700000000, policyVersion: 'a|b' }), null);
});

test('a record is valid for 180 days and not after, and a far-future timestamp is invalid', () => {
  const record = (time, policyVersion = '1') => ({ state: 'granted', time, policyVersion });
  assert.equal(CONSENT_MAX_AGE_SECONDS, 180 * DAY);
  assert.equal(decisionFromRecord(record(NOW - 181 * DAY), NOW, '1'), 'undecided', 'expired after 181 days');
  assert.equal(decisionFromRecord(record(NOW - 179 * DAY), NOW, '1'), 'granted', 'still valid at 179 days');
  assert.equal(decisionFromRecord(record(NOW - 180 * DAY), NOW, '1'), 'granted', 'valid at exactly 180 days');
  assert.equal(decisionFromRecord(record(NOW + 60), NOW, '1'), 'granted', 'small clock skew is tolerated');
  assert.equal(decisionFromRecord(record(NOW + 3600), NOW, '1'), 'undecided', 'an hour in the future is invalid');
  assert.equal(decisionFromRecord(null, NOW, '1'), 'undecided');
});

test('a changed policy version makes an old record no decision', () => {
  const old = { state: 'denied', time: NOW - DAY, policyVersion: '1' };
  assert.equal(decisionFromRecord(old, NOW, '1'), 'denied');
  assert.equal(decisionFromRecord(old, NOW, '2'), 'undecided');
});

test('readCookieValue finds one named cookie and ignores lookalike names', () => {
  assert.equal(readCookieValue('a=1; hagicode_consent=1|granted|1|1; b=2', CONSENT_COOKIE), '1|granted|1|1');
  assert.equal(readCookieValue('x_hagicode_consent=1|granted|1|1', CONSENT_COOKIE), null);
  assert.equal(readCookieValue('', CONSENT_COOKIE), null);
});

test('docs.hagicode.com and hagicode.com share a Domain cookie, and both also keep localStorage', async () => {
  for (const hostname of ['docs.hagicode.com', 'hagicode.com']) {
    const browser = installBrowser({ hostname });
    const consent = await loadFresh();
    consent.setConsent({ analytics: true });
    assert.equal(consent.getConsent().analytics, 'granted');
    const cookieWrite = browser.rawCookieWrites.at(-1);
    assert.match(cookieWrite, /^hagicode_consent=1\|granted\|\d+\|1; Domain=\.hagicode\.com; Path=\/; SameSite=Lax; Secure; Max-Age=15552000$/u);
    assert.match(browser.values.get(CONSENT_STORAGE_KEY), /^1\|granted\|\d+\|1$/u);
    removeBrowser();
  }
});

test('localhost stores the choice only in localStorage and writes no cookie', async () => {
  const browser = installBrowser({ hostname: 'localhost' });
  const consent = await loadFresh();
  consent.setConsent({ analytics: false });
  assert.equal(browser.rawCookieWrites.length, 0);
  assert.equal(browser.values.has(CONSENT_STORAGE_KEY), true);
  assert.equal(consent.getConsent().analytics, 'denied');
});

test('lookalike hosts neither write nor read the shared cookie', async () => {
  for (const hostname of ['evilhagicode.com', 'hagicode.com.evil.test']) {
    const browser = installBrowser({ hostname });
    browser.jar.set(CONSENT_COOKIE, `1|denied|${NOW}|1`);
    const consent = await loadFresh();
    assert.equal(consent.getConsent().analytics, 'undecided', `${hostname} must not read the shared cookie`);
    consent.setConsent({ analytics: true });
    assert.equal(browser.rawCookieWrites.length, 0);
    removeBrowser();
  }
});

test('when the cookie and localStorage disagree, the newer valid copy wins', async () => {
  const browser = installBrowser({ hostname: 'hagicode.com' });
  browser.jar.set(CONSENT_COOKIE, `1|granted|${NOW - 100}|1`);
  browser.values.set(CONSENT_STORAGE_KEY, `1|denied|${NOW - 500}|1`);
  const consent = await loadFresh();
  assert.equal(consent.getConsent().analytics, 'granted');

  browser.values.set(CONSENT_STORAGE_KEY, `1|denied|${NOW}|1`);
  const later = await loadFresh();
  assert.equal(later.getConsent().analytics, 'denied');
});

test('an expired stored record is no decision even when it is the only copy', async () => {
  const browser = installBrowser({ hostname: 'localhost' });
  browser.values.set(CONSENT_STORAGE_KEY, `1|granted|${NOW - 181 * DAY}|1`);
  const consent = await loadFresh();
  assert.equal(consent.getConsent().analytics, 'undecided');
});

test('getConsent reports necessary as granted and analytics as undecided before any choice', async () => {
  installBrowser();
  const consent = await loadFresh();
  assert.deepEqual(consent.getConsent(), { necessary: 'granted', analytics: 'undecided' });
});

test('a choice notifies once, dispatches one DOM event, and a repeated choice is silent', async () => {
  const browser = installBrowser();
  const consent = await loadFresh();
  const received = [];
  consent.onConsentChange((state) => received.push(state));

  consent.setConsent({ analytics: true });
  assert.deepEqual(received, [{ necessary: 'granted', analytics: 'granted' }]);
  assert.equal(browser.events.length, 1);
  assert.equal(browser.events[0].type, CONSENT_CHANGE_EVENT);
  assert.deepEqual(browser.events[0].detail, { necessary: 'granted', analytics: 'granted' });

  consent.setConsent({ analytics: true });
  assert.equal(received.length, 1, 'no callback for an unchanged decision');
  assert.equal(browser.events.length, 1, 'no event for an unchanged decision');

  consent.setConsent({ analytics: false });
  assert.equal(received.at(-1).analytics, 'denied');
});

test('invalid choice arguments change nothing and do not throw', async () => {
  installBrowser();
  const consent = await loadFresh();
  consent.setConsent({ analytics: true });
  for (const bad of [undefined, null, 'yes', {}, { analytics: 'true' }, { analytics: 1 }]) {
    assert.doesNotThrow(() => consent.setConsent(bad));
  }
  assert.equal(consent.getConsent().analytics, 'granted');
});

test('an unsubscribed callback receives no further changes', async () => {
  installBrowser();
  const consent = await loadFresh();
  const seen = [];
  const stop = consent.onConsentChange((state) => seen.push(state.analytics));
  consent.setConsent({ analytics: true });
  stop();
  consent.setConsent({ analytics: false });
  assert.deepEqual(seen, ['granted']);
});

test('a throwing subscriber does not stop the others or the DOM event', async () => {
  const browser = installBrowser();
  const consent = await loadFresh();
  const seen = [];
  consent.onConsentChange(() => {
    throw new Error('subscriber failure');
  });
  consent.onConsentChange((state) => seen.push(state.analytics));
  consent.setConsent({ analytics: true });
  assert.deepEqual(seen, ['granted']);
  assert.equal(browser.events.length, 1);
});

test('a choice survives unavailable storage for the page session only', async () => {
  installBrowser({ cookies: false });
  globalThis.window.localStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  const consent = await loadFresh();
  consent.setConsent({ analytics: true });
  assert.equal(consent.getConsent().analytics, 'granted', 'the page session keeps the choice');
  const reloaded = await loadFresh();
  assert.equal(reloaded.getConsent().analytics, 'undecided', 'a reload reports undecided');
});

test('a storage event from another tab is observed and notified', async () => {
  const browser = installBrowser({ hostname: 'localhost' });
  const consent = await loadFresh();
  const seen = [];
  consent.onConsentChange((state) => seen.push(state.analytics));
  const [{ listener }] = browser.storageListeners;
  browser.values.set(CONSENT_STORAGE_KEY, `1|denied|${NOW + 1}|1`);
  listener({ key: CONSENT_STORAGE_KEY });
  assert.deepEqual(seen, ['denied']);
  listener({ key: 'unrelated' });
  assert.deepEqual(seen, ['denied']);
});

test('every export is non-throwing and safe without window, document or storage', async () => {
  const environments = [
    {},
    { storage: false },
    { windowPresent: false },
    { cookies: false },
    { dom: false },
    { storage: false, dom: false, hostname: 'docs.hagicode.com' },
  ];
  for (const options of environments) {
    installBrowser(options);
    const consent = await loadFresh();
    assert.doesNotThrow(() => consent.getConsent());
    assert.doesNotThrow(() => consent.setConsent({ analytics: true }));
    assert.doesNotThrow(() => consent.setConsent(null));
    assert.doesNotThrow(() => consent.onConsentChange(() => {}));
    assert.doesNotThrow(() => consent.onConsentChange(null));
    assert.doesNotThrow(() => consent.openConsentPreferences());
    assert.doesNotThrow(() => consent.configureConsent({ regionHook: () => { throw new Error('x'); } }));
    assert.doesNotThrow(() => consent.isConsentRequired());
    removeBrowser();
  }
  removeBrowser();
  const bare = await loadFresh();
  assert.deepEqual(bare.getConsent(), { necessary: 'granted', analytics: 'undecided' });
  assert.doesNotThrow(() => bare.setConsent({ analytics: false }));
  assert.doesNotThrow(() => bare.openConsentPreferences());
});

test('openConsentPreferences dispatches the preferences event on document', async () => {
  const browser = installBrowser();
  const consent = await loadFresh();
  consent.openConsentPreferences();
  assert.equal(browser.events.at(-1).type, CONSENT_PREFERENCES_EVENT);
});

test('consent is required unless the region hook answers false', async () => {
  installBrowser();
  const consent = await loadFresh();
  assert.equal(consent.isConsentRequired(), true, 'no hook requires consent');
  consent.configureConsent({ regionHook: () => false });
  assert.equal(consent.isConsentRequired(), false);
  consent.configureConsent({ regionHook: () => true });
  assert.equal(consent.isConsentRequired(), true);
  consent.configureConsent({ regionHook: () => undefined });
  assert.equal(consent.isConsentRequired(), true, 'an unclear answer requires consent');
  consent.configureConsent({ regionHook: () => { throw new Error('region service down'); } });
  assert.equal(consent.isConsentRequired(), true, 'a throwing hook requires consent');
  consent.configureConsent({ regionHook: 'not a function' });
  assert.equal(consent.isConsentRequired(), true);
});

test('the policy version comes from the config descriptor and falls back to 1', async () => {
  const browser = installBrowser({ hostname: 'localhost' });
  const descriptor = { textContent: '{"policyVersion":"2026-10"}' };
  globalThis.document.getElementById = (id) => (id === 'hagilight-consent-config' ? descriptor : null);
  const consent = await loadFresh();
  consent.setConsent({ analytics: true });
  assert.match(browser.values.get(CONSENT_STORAGE_KEY), /\|2026-10$/u);

  descriptor.textContent = '{"policyVersion":"bad version"}';
  const fallback = await loadFresh();
  assert.equal(fallback.getConsent().analytics, 'undecided', 'the stored 2026-10 record is no decision under policy 1');
  descriptor.textContent = 'not json';
  assert.doesNotThrow(() => fallback.setConsent({ analytics: false }));
  assert.match(browser.values.get(CONSENT_STORAGE_KEY), /\|1$/u);
});
