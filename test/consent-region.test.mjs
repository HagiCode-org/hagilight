import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adaptHookValue, classifyTimeZone, DEFAULT_REQUIRED_COUNTRIES, getRegionDecision, isAssignedCountryCode,
  onRegionDecision, parseTraceCountry, requiredCountrySet, resolveRegionDecision, startRegionResolution,
} from '../packages/core/dist/consent-region.js';

const PAGE = 'https://docs.hagicode.com/en-US/';

/** A fake fetch that records every call and answers with the handler's response. */
function fakeFetch(handler) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  fetch.calls = calls;
  return fetch;
}
const traceResponse = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain' } });
/** A request that only ends when the abort signal fires, like a stalled trace endpoint. */
const stalled = (url, init) => new Promise((_, reject) => {
  init.signal.addEventListener('abort', () => reject(new Error('aborted')));
});
const envWith = (overrides = {}) => ({ href: PAGE, fetch: fakeFetch(() => traceResponse('')), timeZone: () => 'UTC', holder: {}, ...overrides });

// Task 2.1: the default set, the override and the exclusion of CN, KR and IN.
test('the default set holds EU27, the EEA, GB, CH and BR and nothing else', () => {
  const set = requiredCountrySet('default');
  assert.equal(DEFAULT_REQUIRED_COUNTRIES.length, 33);
  for (const code of ['AT', 'DE', 'FR', 'IE', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH', 'BR']) assert.ok(set.has(code), code);
  for (const code of ['CN', 'KR', 'IN', 'US', 'JP', 'AU']) assert.ok(!set.has(code), code);
});

test('an override list replaces the whole default set', () => {
  const set = requiredCountrySet(['DE', 'FR']);
  assert.deepEqual([...set].sort(), ['DE', 'FR']);
  assert.ok(!set.has('BR'));
});

test('CN, KR and IN resolve to notRequired under the default set', async () => {
  for (const country of ['CN', 'KR', 'IN']) {
    const fetch = fakeFetch(() => traceResponse(`loc=${country}`));
    const decision = await resolveRegionDecision({ regions: 'default' }, envWith({ fetch }));
    assert.equal(decision, 'notRequired', country);
  }
});

test('isAssignedCountryCode accepts only upper-case assigned codes', () => {
  assert.equal(isAssignedCountryCode('DE'), true);
  for (const bad of ['de', 'DEU', 'XX', 'T1', 'QQ', 'EU', 'UK', 'XK', '', 'D', undefined, 42]) {
    assert.equal(isAssignedCountryCode(bad), false, String(bad));
  }
});

// Task 2.2: the trace reader.
test('the trace reader accepts only an assigned upper-case loc line', () => {
  assert.equal(parseTraceCountry('fl=1\nloc=DE\nts=1'), 'DE');
  assert.equal(parseTraceCountry('loc=XX'), undefined);
  assert.equal(parseTraceCountry('loc=T1'), undefined);
  assert.equal(parseTraceCountry('loc=de'), undefined);
  assert.equal(parseTraceCountry('loc=DEU'), undefined);
  assert.equal(parseTraceCountry('loc=QQ'), undefined);
  assert.equal(parseTraceCountry('loc='), undefined);
});

test('an HTML 200 body without a loc line yields no country', () => {
  assert.equal(parseTraceCountry('<!doctype html><html><body>Not found</body></html>'), undefined);
});

test('the trace request is same-origin, uncached and carries no credentials', async () => {
  const fetch = fakeFetch(() => traceResponse('loc=DE'));
  await resolveRegionDecision({ regions: 'default' }, envWith({ fetch }));
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].url, 'https://docs.hagicode.com/cdn-cgi/trace');
  assert.equal(fetch.calls[0].init.cache, 'no-store');
  assert.equal(fetch.calls[0].init.credentials, 'omit');
  assert.equal(fetch.calls[0].init.redirect, 'error');
});

test('an unusable trace value, a non-success status, a network error, an HTML body and a timeout all fall back to the time zone', async () => {
  const cases = {
    'loc=XX': fakeFetch(() => traceResponse('loc=XX')),
    'loc=T1': fakeFetch(() => traceResponse('loc=T1')),
    'lower case': fakeFetch(() => traceResponse('loc=de')),
    'three letters': fakeFetch(() => traceResponse('loc=DEU')),
    'unassigned': fakeFetch(() => traceResponse('loc=QQ')),
    'HTML 200': fakeFetch(() => traceResponse('<html>ok</html>')),
    'status 500': fakeFetch(() => traceResponse('loc=DE', 500)),
    'network error': fakeFetch(() => Promise.reject(new TypeError('Failed to fetch'))),
    timeout: fakeFetch(stalled),
  };
  for (const [name, fetch] of Object.entries(cases)) {
    const decision = await resolveRegionDecision(
      { regions: 'default' },
      envWith({ fetch, timeZone: () => 'America/New_York', traceTimeoutMs: 50 }),
    );
    assert.equal(decision, 'notRequired', name);
  }
});

test('the IP line is never returned or stored', async () => {
  assert.equal(parseTraceCountry('ip=203.0.113.9\nloc=US'), 'US');
  assert.equal(parseTraceCountry('ip=203.0.113.9'), undefined);
  const env = envWith({ fetch: fakeFetch(() => traceResponse('ip=203.0.113.9\nloc=US')) });
  const decision = await resolveRegionDecision({ regions: 'default' }, env);
  assert.equal(decision, 'notRequired');
  assert.equal(Object.keys(env).sort().join(','), 'fetch,holder,href,timeZone');
});

// Task 2.3: the time-zone table.
test('classifyTimeZone follows the design table', () => {
  const table = {
    'Europe/Berlin': 'required',
    'Atlantic/Reykjavik': 'required',
    'Atlantic/Canary': 'required',
    'Asia/Nicosia': 'required',
    'America/Sao_Paulo': 'required',
    'America/Cayenne': 'required',
    'America/New_York': 'notRequired',
    'Asia/Shanghai': 'notRequired',
    'Australia/Sydney': 'notRequired',
    UTC: 'unknown',
    'Africa/Lagos': 'unknown',
    '': 'unknown',
    undefined: 'unknown',
  };
  for (const [zone, expected] of Object.entries(table)) {
    assert.equal(classifyTimeZone(zone === 'undefined' ? undefined : zone), expected, zone);
  }
});

test('a throwing Intl clock is unreadable and yields unknown', async () => {
  const env = envWith({ fetch: fakeFetch(() => Promise.reject(new TypeError('offline'))), timeZone: () => { throw new RangeError('no Intl'); } });
  assert.equal(await resolveRegionDecision({ regions: 'default' }, env), 'unknown');
});

test('a time-zone fallback runs when the trace has no country', async () => {
  const env = envWith({ fetch: fakeFetch(() => traceResponse('loc=XX')), timeZone: () => 'Europe/Berlin' });
  assert.equal(await resolveRegionDecision({ regions: 'default' }, env), 'required');
});

// Task 2.4: source order, hooks, deadline, shared resolution.
test('an explicit countryCode wins and the trace is not requested', async () => {
  const fetch = fakeFetch(() => traceResponse('loc=DE'));
  assert.equal(await resolveRegionDecision({ regions: 'default', countryCode: 'US' }, envWith({ fetch })), 'notRequired');
  assert.equal(fetch.calls.length, 0);
});

test('an invalid countryCode stops at unknown and consults no later source', async () => {
  const fetch = fakeFetch(() => traceResponse('loc=US'));
  assert.equal(await resolveRegionDecision({ regions: 'default', countryCode: 'Germany' }, envWith({ fetch })), 'unknown');
  assert.equal(fetch.calls.length, 0);
});

test('a custom hook wins over detection', async () => {
  const fetch = fakeFetch(() => traceResponse('loc=US'));
  const decision = await resolveRegionDecision({ regions: 'default', regionHook: () => 'required' }, envWith({ fetch }));
  assert.equal(decision, 'required');
  assert.equal(fetch.calls.length, 0);
});

test('hook adapters: states, booleans, promises, rejections and unrecognized values', async () => {
  const run = (hook) => resolveRegionDecision({ regions: 'default', regionHook: hook }, envWith({ fetch: fakeFetch(() => traceResponse('loc=DE')) }));
  assert.equal(await run(() => 'notRequired'), 'notRequired');
  assert.equal(await run(() => 'unknown'), 'unknown');
  assert.equal(await run(() => false), 'notRequired');
  assert.equal(await run(() => true), 'required');
  assert.equal(await run(() => Promise.resolve('notRequired')), 'notRequired');
  assert.equal(await run(() => Promise.reject(new Error('nope'))), 'unknown');
  assert.equal(await run(() => { throw new Error('boom'); }), 'unknown');
  assert.equal(await run(() => 'maybe'), 'unknown');
  assert.equal(await run(() => undefined), 'unknown');
  assert.equal(adaptHookValue(null), 'unknown');
});

test('a hook that never settles resolves to required at the deadline', async () => {
  const started = Date.now();
  const decision = await resolveRegionDecision(
    { regions: 'default', regionHook: () => new Promise(() => {}) },
    envWith({ deadlineMs: 60 }),
  );
  assert.equal(decision, 'required');
  assert.ok(Date.now() - started < 1000);
});

test('a late answer after the deadline does not change the decision', async () => {
  const decision = await resolveRegionDecision(
    { regions: 'default', regionHook: () => new Promise((resolve) => setTimeout(() => resolve('notRequired'), 150)) },
    envWith({ deadlineMs: 40 }),
  );
  assert.equal(decision, 'required');
});

test('an unconfigured site makes no request and reads no time zone', async () => {
  const fetch = fakeFetch(() => traceResponse('loc=US'));
  let read = false;
  const decision = await resolveRegionDecision({}, envWith({ fetch, timeZone: () => { read = true; return 'America/New_York'; } }));
  assert.equal(decision, 'required');
  assert.equal(fetch.calls.length, 0);
  assert.equal(read, false);
});

test('a configured site without a page resolves to unknown and makes no request', async () => {
  const decision = await resolveRegionDecision({ regions: 'default' }, { holder: {} });
  assert.equal(decision, 'unknown');
});

test('no request goes to any origin other than the page', async () => {
  const fetch = fakeFetch(() => traceResponse('ip=1.2.3.4\nloc=US'));
  await resolveRegionDecision({ regions: 'default' }, envWith({ fetch }));
  for (const call of fetch.calls) assert.equal(new URL(call.url).origin, new URL(PAGE).origin);
});

test('the resolution runs once per document and every consumer receives the same result', async () => {
  const fetch = fakeFetch(() => traceResponse('loc=US'));
  const env = envWith({ fetch });
  assert.equal(getRegionDecision(env), 'pending');
  const seen = [];
  onRegionDecision((decision) => seen.push(`first:${decision}`), env);
  const first = startRegionResolution({ regions: 'default' }, env);
  const second = startRegionResolution({ regions: 'default' }, env);
  assert.equal(first, second);
  assert.equal(await first, 'notRequired');
  assert.equal(await second, 'notRequired');
  assert.equal(fetch.calls.length, 1);
  assert.deepEqual(seen, ['first:notRequired']);
  onRegionDecision((decision) => seen.push(`late:${decision}`), env);
  assert.deepEqual(seen, ['first:notRequired', 'late:notRequired']);
  assert.equal(getRegionDecision(env), 'notRequired');
});

test('a second bundle on the same page shares the first resolution', async () => {
  const holder = {};
  const fetch = fakeFetch(() => traceResponse('loc=DE'));
  startRegionResolution({ regions: 'default' }, envWith({ fetch, holder }));
  const decision = await startRegionResolution({ regions: 'default' }, envWith({ fetch: fakeFetch(() => traceResponse('loc=US')), holder }));
  assert.equal(decision, 'required');
  assert.equal(fetch.calls.length, 1);
});

test('a pending read receives no value until resolution completes', () => {
  const env = envWith({ fetch: fakeFetch(() => new Promise(() => {})), traceTimeoutMs: 100 });
  void startRegionResolution({ regions: 'default' }, env);
  assert.equal(getRegionDecision(env), 'pending');
});
