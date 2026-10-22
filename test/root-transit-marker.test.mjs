import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOCALE_MONITOR_COOKIE, LOCALE_MONITOR_STORAGE_KEY, formatLocaleMarker, mountLocaleMonitor, parseLocaleMarker,
  resolveLocaleMonitor,
} from '@hagicode/hagilight-core/root-transit';
import { detectedRows, localeMonitorFake, rowTexts } from './support/locale-monitor-fake.mjs';

const MARKER = 'zh-CN|query|docs.hagicode.com|1761000000';
const COOKIE_TAIL = 'Domain=.hagicode.com; Path=/; SameSite=Lax; Secure; Max-Age=15552000';

test('the marker is four fields, formats and parses back, and stays small', () => {
  assert.equal(formatLocaleMarker({ locale: 'zh-CN', source: 'query', host: 'docs.hagicode.com', time: 1761000000 }), MARKER);
  assert.deepEqual(parseLocaleMarker(MARKER), { locale: 'zh-CN', source: 'query', host: 'docs.hagicode.com', time: 1761000000 });
  assert.ok(MARKER.length < 80);
});

test('the strict parser rejects malformed, unsupported, unknown and oversized markers', () => {
  for (const value of [
    '', 'zh-CN|query|docs.hagicode.com', 'zh-CN|query|docs.hagicode.com|1761000000|extra',
    'zh-tw|query|docs.hagicode.com|1761000000', 'xx-XX|query|docs.hagicode.com|1761000000', 'zh-Hant-TW|query|docs.hagicode.com|1761000000',
    'zh-CN|desktop|docs.hagicode.com|1761000000', 'zh-CN|query|bad host|1761000000', 'zh-CN|query||1761000000',
    'zh-CN|query|docs.hagicode.com|17610a0000', 'zh-CN|query|docs.hagicode.com|', 'zh-CN|query|docs.hagicode.com|1761000000000',
    `zh-CN|query|${'a'.repeat(120)}.hagicode.com|1761000000`, '<img src=x onerror=alert(1)>',
  ]) {
    assert.equal(parseLocaleMarker(value), null, value);
  }
});

test('a single-label host such as localhost is a valid marker host, and an unusable host writes nothing', () => {
  assert.equal(parseLocaleMarker('ja-JP|stored|localhost|1761000000')?.host, 'localhost');
  assert.equal(formatLocaleMarker({ locale: 'ja-JP', source: 'stored', host: '', time: 1761000000 }), null);
});

test('the shared-host gate matches hagicode.com and its subdomains only', () => {
  const cookiesWrittenOn = (host) => {
    const env = localeMonitorFake({ href: `https://${host}/` });
    mountLocaleMonitor(env.win, env.doc);
    return env.cookieWrites;
  };
  for (const host of ['hagicode.com', 'docs.hagicode.com', 'www.hagicode.com']) {
    const writes = cookiesWrittenOn(host);
    assert.equal(writes.length, 1, host);
    assert.ok(writes[0].startsWith(`${LOCALE_MONITOR_COOKIE}=`), host);
    assert.ok(writes[0].endsWith(COOKIE_TAIL), host);
  }
  for (const host of ['evilhagicode.com', 'hagicode.com.evil.test', 'localhost']) {
    assert.deepEqual(cookiesWrittenOn(host), [], host);
  }
});

test('the cookie is named, scoped and bounded as specified, and the local copy uses its own key', () => {
  const env = localeMonitorFake({ href: 'https://docs.hagicode.com/?lang=zh-CN' });
  mountLocaleMonitor(env.win, env.doc);
  assert.deepEqual(env.storageWrites.map(([key]) => key), [LOCALE_MONITOR_STORAGE_KEY]);
  assert.equal(env.storage[LOCALE_MONITOR_STORAGE_KEY].split('|').slice(0, 3).join('|'), 'zh-CN|query|docs.hagicode.com');
  assert.match(env.cookieWrites[0], new RegExp(`^${LOCALE_MONITOR_COOKIE}=zh-CN\\|query\\|docs\\.hagicode\\.com\\|\\d+; `, 'u'));
});

test('sharedDomain false writes the cookie nowhere, only the same-origin copy', () => {
  const env = localeMonitorFake({ href: 'https://docs.hagicode.com/', sharedDomain: false });
  mountLocaleMonitor(env.win, env.doc);
  assert.deepEqual(env.cookieWrites, []);
  assert.equal(env.storageWrites.length, 1);
  assert.equal(resolveLocaleMonitor({ sharedDomain: false }).sharedDomain, null);
});

test('localeMonitor options: unset or false is off, the default domain is hagicode.com, and a bad domain fails at render', () => {
  assert.equal(resolveLocaleMonitor(undefined), null);
  assert.equal(resolveLocaleMonitor(false), null);
  assert.deepEqual(resolveLocaleMonitor(true), { sharedDomain: 'hagicode.com' });
  assert.deepEqual(resolveLocaleMonitor({}), { sharedDomain: 'hagicode.com' });
  assert.deepEqual(resolveLocaleMonitor({ sharedDomain: 'Example.Test' }), { sharedDomain: 'example.test' });
  for (const sharedDomain of ['', 'localhost', '.hagicode.com', 'bad domain.test']) {
    assert.throws(() => resolveLocaleMonitor({ sharedDomain }), TypeError, sharedDomain);
  }
});

test('a shared marker from another subdomain is read from the cookie, else from the local copy', () => {
  const fromCookie = localeMonitorFake({
    href: 'https://www.hagicode.com/',
    cookie: `${LOCALE_MONITOR_COOKIE}=${MARKER}`,
    storage: { [LOCALE_MONITOR_STORAGE_KEY]: 'ja-JP|stored|www.hagicode.com|1761000001' },
  });
  mountLocaleMonitor(fromCookie.win, fromCookie.doc);
  assert.equal(fromCookie.rows.shared.value.textContent, 'zh-CN · ?lang= · docs.hagicode.com');
  assert.equal(fromCookie.rows.shared.dataset.state, 'idle');

  const fallback = localeMonitorFake({
    href: 'https://www.hagicode.com/',
    storage: { [LOCALE_MONITOR_STORAGE_KEY]: 'ja-JP|stored|docs.hagicode.com|1761000001' },
  });
  mountLocaleMonitor(fallback.win, fallback.doc);
  assert.equal(fallback.rows.shared.value.textContent, 'ja-JP · hagicode:site-locale · docs.hagicode.com');
});

test('a tampered cookie is shown as unavailable and never changes detection', () => {
  const env = localeMonitorFake({
    href: 'https://www.hagicode.com/',
    languages: ['de-AT'],
    cookie: `${LOCALE_MONITOR_COOKIE}=ja-JP|query|evil.test`,
  });
  mountLocaleMonitor(env.win, env.doc);
  assert.equal(env.rows.shared.value.textContent, 'unavailable');
  assert.deepEqual(detectedRows(env.rows), ['browser']);
  assert.equal(env.rows.browser.value.textContent, 'de-AT → de-DE');
});

test('a blocked cookie still leaves the same-origin copy written and the rows filled', () => {
  const env = localeMonitorFake({ href: 'https://docs.hagicode.com/?lang=ja-JP', cookieMode: 'block' });
  assert.doesNotThrow(() => mountLocaleMonitor(env.win, env.doc));
  assert.equal(env.storageWrites.length, 1);
  assert.equal(env.rows.query.value.textContent, 'ja-JP');
});

test('a throwing cookie write and throwing storage each fail quietly, and only the affected row says so', () => {
  const throwingCookie = localeMonitorFake({ href: 'https://docs.hagicode.com/', cookieMode: 'throw', languages: ['ko-KR'] });
  assert.doesNotThrow(() => mountLocaleMonitor(throwingCookie.win, throwingCookie.doc));
  assert.equal(throwingCookie.storageWrites.length, 1);

  const blockedStorage = localeMonitorFake({ href: 'https://docs.hagicode.com/?lang=fr', failStorage: true, languages: ['ja-JP'] });
  assert.doesNotThrow(() => mountLocaleMonitor(blockedStorage.win, blockedStorage.doc));
  assert.equal(blockedStorage.rows.stored.value.textContent, 'unavailable');
  assert.equal(blockedStorage.rows.shared.value.textContent, 'unavailable');
  assert.equal(blockedStorage.rows.query.value.textContent, 'fr → fr-FR');
  assert.deepEqual(detectedRows(blockedStorage.rows), ['query']);
  assert.equal(rowTexts(blockedStorage.rows).browser, 'ja-JP');
});

test('markup-looking ?lang= text is written to the row as exact text', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const env = localeMonitorFake({ href: `https://consumer.example/?lang=${encodeURIComponent(payload)}` });
  mountLocaleMonitor(env.win, env.doc);
  assert.equal(env.rows.query.value.textContent, payload);
  assert.equal(env.rows.query.dataset.state, 'idle');
  assert.equal(env.rows.default.value.textContent, 'en-US');
});

test('a missing monitor panel makes the mount a no-op', () => {
  const env = localeMonitorFake();
  const doc = { querySelector: () => null, cookie: '' };
  assert.doesNotThrow(() => mountLocaleMonitor(env.win, doc));
  assert.deepEqual(env.storageWrites, []);
  assert.deepEqual(env.cookieWrites, []);
});
