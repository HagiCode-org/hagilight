import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import {
  DEFAULT_POSTHOG_API_KEY,
  POSTHOG_API_HOST,
  POSTHOG_DEFAULTS,
  posthogInitScript,
} from '@hagicode/hagilight-core/posthog';

function browser() {
  const scripts = [];
  const anchor = { parentNode: { insertBefore(script, before) {
    assert.equal(before, anchor);
    scripts.push(script);
  } } };
  const context = createContext({
    document: {
      createElement(tag) { assert.equal(tag, 'script'); return {}; },
      getElementsByTagName(tag) { assert.equal(tag, 'script'); return [anchor]; },
    },
  });
  context.window = context;
  return { context, scripts, execute: (script = posthogInitScript()) => runInContext(script, context) };
}

test('default initialization queues the exact supplied config and inserts an asynchronous anonymous SDK', () => {
  const { context, scripts, execute } = browser();
  execute();
  assert.deepEqual(JSON.parse(JSON.stringify(context.posthog._i)), [[
    'phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5',
    { api_host: 'https://us.i.posthog.com', defaults: '2026-05-30' },
    'posthog',
  ]]);
  assert.equal(context.posthog._i[0][0], DEFAULT_POSTHOG_API_KEY);
  assert.deepEqual(scripts, [{
    type: 'text/javascript', crossOrigin: 'anonymous', async: true,
    src: 'https://us-assets.i.posthog.com/static/array.js',
  }]);
  assert.equal(String(context.posthog), 'posthog (stub)');
  assert.equal(String(context.posthog.people), 'posthog.people (stub)');
  assert.equal(context.posthog.length, 0, 'Hagilight queues no capture calls');
});

test('a custom project key retains the fixed host and defaults', () => {
  const { context, execute } = browser();
  execute(posthogInitScript('phc_Custom123'));
  assert.equal(context.posthog._i[0][0], 'phc_Custom123');
  assert.equal(context.posthog._i[0][1].api_host, POSTHOG_API_HOST);
  assert.equal(context.posthog._i[0][1].defaults, POSTHOG_DEFAULTS);
  assert.ok(!posthogInitScript('phc_Custom123').includes(DEFAULT_POSTHOG_API_KEY));
});

test('invalid and injection keys fail before emitting a script', () => {
  for (const key of ['', 'phc_', 'bad', ' phc_Test', 'phc_Test\n', 'phc_中文', 'phc_Test-1', '</script><script>alert(1)</script>', null, 1, {}, []]) {
    assert.throws(() => posthogInitScript(key), /PostHog apiKey/u, JSON.stringify(key));
  }
  assert.doesNotMatch(posthogInitScript(), /<\/script/iu);
});

test('repeated execution before and after SDK replacement initializes only once per document', () => {
  const { context, scripts, execute } = browser();
  execute();
  execute();
  execute(posthogInitScript('phc_Other123'));
  assert.equal(context.posthog._i.length, 1);
  assert.equal(scripts.length, 1);
  let calls = 0;
  context.posthog = { init() { calls++; } };
  execute();
  assert.equal(calls, 0);
  assert.equal(scripts.length, 1);

  const fresh = browser();
  fresh.execute();
  assert.equal(fresh.context.posthog._i.length, 1);
  assert.equal(fresh.scripts.length, 1);
});

test('a preloaded SDK is initialized once without adding a loader', () => {
  const { context, scripts, execute } = browser();
  const calls = [];
  context.posthog = { __SV: 1, init(...args) { calls.push(args); } };
  execute();
  execute();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], DEFAULT_POSTHOG_API_KEY);
  assert.equal(scripts.length, 0);
});
