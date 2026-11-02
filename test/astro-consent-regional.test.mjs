import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hagilight } from '@hagicode/hagilight/integration';
import { consentDescriptor, resolveRegionalOptions } from '@hagicode/hagilight-core/consent-markup';

const root = fileURLToPath(new URL('../', import.meta.url));
const variants = join(root, 'node_modules/.hagilight-variants/astro-consent-regional');
const astroCli = join(root, 'node_modules/astro/bin/astro.mjs');

const SAMPLE = { regions: ['DE', 'FR'], regionHook: 'siteRegion', settingsEntry: 'always', sessionReplay: 'off' };

const PAGE = `---
import Footer from '@hagicode/hagilight/Footer';
---
<html lang="en-US">
  <head><meta charset="utf-8" /><title>Regional consent</title></head>
  <body><Footer locale="en-US" consent={true} /></body>
</html>
`;

function config(options) {
  return `import { defineConfig } from 'astro/config';
import { hagilight } from '@hagicode/hagilight/integration';

export default defineConfig({ site: 'https://consent.example.com', integrations: [hagilight(${options})] });
`;
}

function buildFixture(name, options) {
  const dir = join(variants, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'src/pages'), { recursive: true });
  writeFileSync(join(dir, 'astro.config.mjs'), config(options));
  writeFileSync(join(dir, 'src/pages/index.astro'), PAGE);
  execFileSync(process.execPath, [astroCli, 'build', '--root', dir], {
    cwd: root,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    stdio: 'pipe',
    timeout: 600000,
    killSignal: 'SIGKILL',
  });
  return readFileSync(join(dir, 'dist/index.html'), 'utf8');
}

/** Runs the integration's setup hook with stubs and records what it injects, adds and configures. */
function setupOf(options, command = 'build') {
  const captured = { scripts: [], middleware: [], plugins: [] };
  try {
    hagilight(options).hooks['astro:config:setup']({
      command,
      config: { root: new URL('../', import.meta.url), site: 'https://consent.example.com', integrations: [] },
      injectRoute() {},
      injectScript: (stage, code) => captured.scripts.push({ stage, code }),
      addMiddleware: (middleware) => captured.middleware.push(middleware),
      updateConfig: (update) => captured.plugins.push(...(update.vite?.plugins ?? [])),
      logger: { warn() {}, info() {}, error() {} },
    });
  } catch {
    // Unrelated setup steps may need a full Astro config; only the recorded injections matter here.
  }
  return captured;
}

/** The consent descriptor the head script inserts, parsed back from the injected script text. */
function descriptorOf(scripts) {
  const head = scripts.find(({ stage }) => stage === 'head-inline');
  assert.ok(head, 'the head script is injected');
  let inserted = '';
  new Function('document', head.code)({
    head: { insertAdjacentHTML: (_position, html) => { inserted = html; } },
  });
  const match = inserted.match(/<script type="application\/json" id="hagilight-consent-config">([\s\S]*?)<\/script>/u);
  assert.ok(match, 'the descriptor script is inserted');
  return JSON.parse(match[1]);
}

/** The error the core validator throws for the same options, which every integration must reproduce. */
function coreError(consent) {
  try {
    resolveRegionalOptions(consent, consent.enabled !== false);
  } catch (error) {
    return error;
  }
  throw new Error(`the core accepted ${JSON.stringify(consent)}`);
}

const count = (text, needle) => text.split(needle).length - 1;
const isConsentMiddleware = ({ entrypoint }) => entrypoint.endsWith('consent-middleware.js');
const isConsentFooterPlugin = ({ name }) => name === '@hagicode/hagilight:consent-footer';

function footerButton(html, entry) {
  return html.match(new RegExp(`<button\\b[^>]*data-consent-entry="${entry}"[^>]*>`, 'u'))?.[0];
}

test('the regional options reach the head descriptor unchanged', () => {
  const written = descriptorOf(setupOf({ analytics: { consent: SAMPLE } }).scripts);
  assert.equal(written.mode, 'regional');
  assert.deepEqual(written.regions, ['DE', 'FR']);
  assert.equal(written.regionHook, 'siteRegion');
  assert.equal(written.settingsEntry, 'always');
  assert.equal(written.sessionReplay, 'off');
  assert.equal(Object.hasOwn(written, 'countryCode'), false, 'an unset countryCode is absent');
});

test('the Astro descriptor matches the core descriptor for one options object', () => {
  const regional = resolveRegionalOptions(SAMPLE, true);
  const expected = JSON.parse(consentDescriptor({ providers: ['posthog'], policyVersion: '1', regional }));
  assert.deepEqual(descriptorOf(setupOf({ analytics: { consent: SAMPLE } }).scripts), expected);
});

test('the default regional options are written with their defaults', () => {
  const written = descriptorOf(setupOf({ analytics: { consent: { regions: 'default' } } }).scripts);
  assert.equal(written.regions, 'default');
  assert.equal(written.settingsEntry, 'requiredOnly');
  assert.equal(written.sessionReplay, 'optIn');
});

test('without a regional option the descriptor keeps the global shape and no footer state is added', () => {
  const setup = setupOf({});
  const written = descriptorOf(setup.scripts);
  assert.equal(Object.hasOwn(written, 'mode'), false);
  assert.deepEqual(written, JSON.parse(consentDescriptor({ providers: ['posthog'], policyVersion: '1' })));
  assert.equal(setup.middleware.some(isConsentMiddleware), false);
  assert.equal(setup.plugins.some(isConsentFooterPlugin), false);
});

test('a regional site adds the footer state middleware and its virtual module', () => {
  const setup = setupOf({ analytics: { consent: { regions: 'default' } } });
  assert.equal(setup.middleware.filter(isConsentMiddleware).length, 1);
  const plugin = setup.plugins.find(isConsentFooterPlugin);
  assert.ok(plugin, 'the footer state plugin is configured');
  const id = plugin.resolveId('virtual:hagilight/consent-footer');
  assert.equal(plugin.load(id), 'export default {"regional":true,"replayEntry":true};');
  const off = setupOf({ analytics: { consent: { regions: 'default', sessionReplay: 'off' } } });
  const offPlugin = off.plugins.find(isConsentFooterPlugin);
  assert.equal(offPlugin.load(offPlugin.resolveId('virtual:hagilight/consent-footer')), 'export default {"regional":true,"replayEntry":false};');
});

test('regional options stay out of dev and preview', () => {
  for (const command of ['dev', 'preview']) {
    const setup = setupOf({ analytics: { consent: SAMPLE } }, command);
    assert.equal(setup.scripts.length, 0, `${command} injects nothing`);
    assert.equal(setup.middleware.some(isConsentMiddleware), false, `${command} adds no footer middleware`);
  }
});

test('invalid regional options fail with the core validator message', () => {
  const cases = [
    [{ regions: ['DE'], countryCode: 'de' }, 'analytics.consent.countryCode'],
    [{ regions: ['Germany'] }, 'analytics.consent.regions'],
    [{ regions: [] }, 'analytics.consent.regions'],
    [{ regions: 'default', regionHook: 'x(); alert(1)' }, 'analytics.consent.regionHook'],
    [{ countryCode: 'US' }, 'analytics.consent.countryCode'],
    [{ regions: 'default', settingsEntry: 'sometimes' }, 'analytics.consent.settingsEntry'],
    [{ regions: 'default', sessionReplay: 'on' }, 'analytics.consent.sessionReplay'],
    [{ regions: 'default', enabled: false }, 'analytics.consent.regions'],
  ];
  for (const [consent, option] of cases) {
    const expected = coreError(consent);
    assert.ok(expected.message.includes(option), `the core names ${option}`);
    assert.throws(() => hagilight({ analytics: { consent } }), (error) => {
      assert.ok(error instanceof TypeError);
      assert.equal(error.message, expected.message);
      return true;
    });
  }
});

test('a regional build puts the regional descriptor and the hidden footer entries on the page', () => {
  const html = buildFixture('default', `{ analytics: { consent: { regions: 'default' } } }`);
  assert.equal(count(html, 'id="hagilight-consent-config"'), 1);
  assert.ok(html.includes('"mode":"regional"'));
  assert.ok(html.includes('"regions":"default"'));
  const settings = footerButton(html, 'settings');
  assert.ok(settings, 'the settings entry is rendered');
  assert.match(settings, /\shidden(?=[\s>=])/u, 'the settings entry starts hidden');
  const replay = footerButton(html, 'replay');
  assert.ok(replay, 'the replay entry is rendered with sessionReplay optIn');
  assert.match(replay, /\shidden(?=[\s>=])/u, 'the replay entry starts hidden');
  assert.match(replay, /data-consent-mode="replay"/u);
});

test('a regional build with session replay off renders the settings entry but no replay entry', () => {
  const html = buildFixture('replay-off', `{ analytics: { consent: { regions: ['DE'], sessionReplay: 'off' } } }`);
  assert.ok(html.includes('"mode":"regional"'));
  assert.ok(footerButton(html, 'settings'));
  assert.equal(footerButton(html, 'replay'), undefined);
});

test('a global build keeps the cookie settings entry visible with no regional markup', () => {
  const html = buildFixture('global', `{ analytics: { consent: {} } }`);
  assert.equal(html.includes('"mode"'), false);
  assert.equal(html.includes('data-consent-entry'), false);
  const entry = html.match(/<button\b[^>]*hagilight-footer__consent[^>]*>/u)?.[0];
  assert.ok(entry, 'the cookie settings entry is rendered');
  assert.doesNotMatch(entry, /\shidden(?=[\s>=])/u);
});
