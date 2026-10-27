import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import {
  DEFAULT_POSTHOG_API_KEY,
  POSTHOG_API_HOST,
  POSTHOG_DEFAULTS,
  POSTHOG_PERSON_PROFILES,
  POSTHOG_UI_HOST,
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
      documentElement: { lang: 'en-US' },
      createElement(tag) { assert.equal(tag, 'script'); return {}; },
      getElementsByTagName(tag) { assert.equal(tag, 'script'); return [anchor]; },
      querySelector() { return null; },
    },
  });
  context.window = context;
  context.location = { hostname: 'hagilight.example' };
  return { context, scripts, execute: (script = posthogInitScript()) => runInContext(script, context) };
}

/** Queued SDK calls, as `[method, ...args]` tuples, in order. */
const queued = (context) => JSON.parse(JSON.stringify(context.posthog));

test('default initialization queues the exact supplied config and inserts an asynchronous anonymous SDK', () => {
  const { context, scripts, execute } = browser();
  execute();
  assert.deepEqual(JSON.parse(JSON.stringify(context.posthog._i)), [[
    'phc_qiVVihsL925ovhPYNdLJWz4k7aoKVMwYCevgZPE6PER5',
    { api_host: 'https://t.hagicode.com', ui_host: 'https://us.posthog.com', defaults: '2026-05-30', person_profiles: 'identified_only', capture_exceptions: true },
    'posthog',
  ]]);
  assert.equal(context.posthog._i[0][0], DEFAULT_POSTHOG_API_KEY);
  assert.deepEqual(scripts, [{
    type: 'text/javascript', crossOrigin: 'anonymous', async: true,
    src: 'https://t.hagicode.com/static/array.js',
  }]);
  assert.doesNotMatch(posthogInitScript(), /us\.i\.posthog\.com|us-assets\.i\.posthog\.com/u);
  assert.equal(String(context.posthog), 'posthog (stub)');
  assert.equal(String(context.posthog.people), 'posthog.people (stub)');
  assert.deepEqual(queued(context).filter(([name]) => name === 'capture'), [], 'Hagilight queues no capture calls');
});

test('a custom project key retains the fixed host and defaults', () => {
  const { context, execute } = browser();
  execute(posthogInitScript('phc_Custom123'));
  assert.equal(context.posthog._i[0][0], 'phc_Custom123');
  assert.equal(context.posthog._i[0][1].api_host, POSTHOG_API_HOST);
  assert.equal(context.posthog._i[0][1].ui_host, POSTHOG_UI_HOST);
  assert.equal(context.posthog._i[0][1].defaults, POSTHOG_DEFAULTS);
  assert.equal(context.posthog._i[0][1].person_profiles, POSTHOG_PERSON_PROFILES);
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
  context.posthog = { __SV: 1, init(...args) { calls.push(args); }, register() {} };
  execute();
  execute();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], DEFAULT_POSTHOG_API_KEY);
  assert.equal(scripts.length, 0);
});

test('the site context is registered once, right after initialization, with empty values omitted', () => {
  const { context, execute } = browser();
  execute(posthogInitScript(DEFAULT_POSTHOG_API_KEY, { framework: 'starlight', version: '0.1.0', siteId: 'hagilight.example', pageType: 'docs' }));
  execute(posthogInitScript(DEFAULT_POSTHOG_API_KEY, { framework: 'starlight', version: '0.1.0', siteId: 'hagilight.example', pageType: 'docs' }));
  assert.equal(context.posthog._i.length, 1, 'repeats initialize nothing more');
  const calls = queued(context);
  assert.deepEqual(calls.map(([name]) => name), ['register'], 'one register, and repeats queue nothing');
  assert.deepEqual(calls[0], ['register', {
    site_id: 'hagilight.example',
    site_framework: 'starlight',
    hagilight_version: '0.1.0',
    locale: 'en-US',
    page_type: 'docs',
  }]);
});

test('registration falls back to the page-type meta element, then other, and omits empty values', () => {
  const { context, execute } = browser();
  context.document.querySelector = (selector) => {
    assert.equal(selector, 'meta[name="hagilight:page-type"]');
    return { getAttribute: () => 'not-a-page-type' };
  };
  context.document.documentElement.lang = '';
  context.location = { hostname: '' };
  execute();
  assert.deepEqual(queued(context).find(([name]) => name === 'register'), ['register', { page_type: 'other' }]);

  const meta = browser();
  meta.context.document.querySelector = () => ({ getAttribute: () => 'compare' });
  meta.execute();
  assert.deepEqual(queued(meta.context).find(([name]) => name === 'register'), ['register', {
    site_id: 'hagilight.example',
    locale: 'en-US',
    page_type: 'compare',
  }]);
});

test('the initialization config enables exception capture and nothing else changes', () => {
  const { context, execute } = browser();
  execute(posthogInitScript('phc_Custom123', { framework: 'astro', version: '1.0.0' }));
  assert.equal(context.posthog._i[0][1].capture_exceptions, true);
  assert.equal(context.posthog._i[0][1].person_profiles, POSTHOG_PERSON_PROFILES);
  assert.equal(context.posthog._i[0][1].api_host, POSTHOG_API_HOST);
});

test('context values cannot break out of the generated script', () => {
  const hostile = '</script><script>alert(1)</script>';
  const script = posthogInitScript(DEFAULT_POSTHOG_API_KEY, { framework: 'astro', version: hostile, siteId: hostile });
  assert.doesNotMatch(script, /<\/script/iu);
  assert.doesNotMatch(script, /<script/iu);
  const { context, execute } = browser();
  execute(script);
  assert.equal(queued(context).find(([name]) => name === 'register')[1].site_id, hostile);
});

test('an unknown framework or a malformed context fails before a script is emitted', () => {
  assert.throws(() => posthogInitScript(DEFAULT_POSTHOG_API_KEY, { framework: 'gatsby', version: '1' }), /framework/u);
  assert.throws(() => posthogInitScript(DEFAULT_POSTHOG_API_KEY, { framework: 'astro', version: '1', siteId: 42 }), /siteId/u);
  assert.throws(() => posthogInitScript(DEFAULT_POSTHOG_API_KEY, null), /site context/u);
});

test('the supplied loader is byte-identical to the previous release', () => {
  // SHA-256 of the loader line as it shipped before the site-context change; the loader stays untouched.
  const loader = posthogInitScript().split('\n').find((line) => line.startsWith('  !function'));
  assert.equal(createHash('sha256').update(`${loader.slice(2)}\n`).digest('hex'), '349073f6b0be9d1c9c2aaeab243248dcac6c326bc5d438d2c7154fdc28ef0a18');
});
