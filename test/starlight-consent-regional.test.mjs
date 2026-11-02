import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import hagilight from '@hagicode/hagilight-starlight';

const root = fileURLToPath(new URL('../', import.meta.url));
// Inside the example's node_modules so the fixture resolves the workspace packages, as build-example.mjs does.
const FIXTURE_ROOT = join(root, 'examples/demo-starlight-web/node_modules/.hagilight-regional-fixture');
const FIXTURE_CONFIG = join(FIXTURE_ROOT, 'astro.config.mjs');
const ASTRO_BIN = join(createRequire(import.meta.url).resolve('astro/package.json'), '..', 'bin', 'astro.mjs');

function configure(options = {}) {
  const integrations = [];
  let updated;
  hagilight(options).hooks['config:setup']({
    astroConfig: { site: 'https://example.com/', base: '/' },
    config: { components: {}, logo: undefined },
    updateConfig: (value) => { updated = value; },
    addIntegration: (integration) => integrations.push(integration),
  });
  return { updated, integrations };
}

function integrationVitePlugins(integration, routes = []) {
  let config;
  integration.hooks['astro:config:setup']({
    config: { root: pathToFileURL('/nonexistent-hagilight/'), markdown: { processor: { name: 'satteri', options: { hastPlugins: [] } } } },
    logger: { warn() {} },
    injectRoute: (route) => routes.push(route),
    updateConfig: (value) => { config = value; },
  });
  return config.vite.plugins;
}

/** The generated source of one virtual component (`Footer.astro`, `options`), as the Starlight build compiles it. */
function generatedSource(result, componentId) {
  const [vite] = integrationVitePlugins(result.integrations[0]);
  return vite.load(vite.resolveId(componentId.replace(/^\0/u, '')));
}

function configuredOptions(result) {
  const footerId = result.updated.components.Footer;
  const source = generatedSource(result, `${footerId.slice(0, footerId.lastIndexOf('/'))}/options`);
  return JSON.parse(source.match(/^export default (.*);$/mu)[1]);
}

test('a regional option resolves to the core shape with its defaults and keeps a global site unchanged', () => {
  const regional = configuredOptions(configure({ analytics: { consent: { regions: ['DE', 'FR'] } } }));
  assert.deepEqual(regional.consentRegional, { regions: ['DE', 'FR'], settingsEntry: 'requiredOnly', sessionReplay: 'optIn' });

  const explicit = configuredOptions(configure({
    analytics: { consent: { regions: 'default', countryCode: 'DE', settingsEntry: 'always', sessionReplay: 'projectDefault' } },
  }));
  assert.deepEqual(explicit.consentRegional, {
    regions: 'default',
    countryCode: 'DE',
    settingsEntry: 'always',
    sessionReplay: 'projectDefault',
  });

  const global = configuredOptions(configure({}));
  assert.equal('consentRegional' in global, false, 'no regional option leaves the options module without regional data');
});

test('regional options fail with the core messages that name the option', () => {
  const cases = [
    [{ regions: 'eu' }, /analytics\.consent\.regions must be "default"/u],
    [{ regions: [] }, /analytics\.consent\.regions must be/u],
    [{ regions: ['de'] }, /analytics\.consent\.regions must be/u],
    [{ countryCode: 'DE' }, /analytics\.consent\.countryCode needs analytics\.consent\.regions/u],
    [{ regions: 'default', countryCode: 'XX' }, /analytics\.consent\.countryCode must be one upper-case/u],
    [{ regions: 'default', regionHook: 'siteRegion()' }, /analytics\.consent\.regionHook must be the name of a function/u],
    [{ regions: 'default', settingsEntry: 'sometimes' }, /analytics\.consent\.settingsEntry must be/u],
    [{ regions: 'default', sessionReplay: 'on' }, /analytics\.consent\.sessionReplay must be/u],
    [{ regions: 'default', enabled: false }, /analytics\.consent\.regions cannot be set while analytics\.consent\.enabled is false/u],
  ];
  for (const [consent, message] of cases) {
    assert.throws(() => configure({ analytics: { consent } }), message, JSON.stringify(consent));
  }
});

test('the footer marks regional entries hidden for the popup to reveal, and only on regional sites', () => {
  const regional = configure({ analytics: { consent: { regions: 'default' } } });
  const footer = generatedSource(regional, regional.updated.components.Footer);
  assert.match(footer, /^\s+regional=\{true\}$/mu);
  assert.match(footer, /^\s+replayEntry=\{true\}$/mu, 'optIn is the default, so the replay entry is rendered');
  assert.match(footer, /<CookieConsent [^>]*regional=\{options\.consentRegional\}/u);

  const noReplay = configure({ analytics: { consent: { regions: 'default', sessionReplay: 'off' } } });
  const noReplayFooter = generatedSource(noReplay, noReplay.updated.components.Footer);
  assert.match(noReplayFooter, /^\s+replayEntry=\{false\}$/mu);

  const global = configure({});
  const globalFooter = generatedSource(global, global.updated.components.Footer);
  assert.doesNotMatch(globalFooter, /regional/u);
  assert.doesNotMatch(globalFooter, /replayEntry/u);
  assert.match(globalFooter, /<CookieConsent providers=\{options\.consentProviders\} privacyUrl=\{options\.consentPrivacyUrl\} policyVersion=\{options\.consentPolicyVersion\} locale=\{Astro\.locals\?\.starlightRoute\?\.locale\} \/>/u);
});

function writeFixture() {
  mkdirSync(join(FIXTURE_ROOT, 'src/content/docs'), { recursive: true });
  writeFileSync(join(FIXTURE_ROOT, 'src/content.config.ts'), `import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
`);
  writeFileSync(join(FIXTURE_ROOT, 'src/content/docs/index.mdx'), '---\ntitle: Regional fixture\ndescription: Home page.\n---\n\nHome.\n');
  writeFileSync(join(FIXTURE_ROOT, 'src/content/docs/guide.mdx'), '---\ntitle: Guide\ndescription: A regular page.\n---\n\nGuide.\n');
  // The options come from the environment so one config serves every variant.
  writeFileSync(FIXTURE_CONFIG, `import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import hagilight from '@hagicode/hagilight-starlight';

const here = fileURLToPath(new URL('.', import.meta.url));
const variant = process.env.HAGILIGHT_FIXTURE_VARIANT;
export default defineConfig({
  root: here,
  site: 'https://example.com/',
  base: '/',
  cacheDir: join(here, '.cache-' + variant),
  outDir: join(here, 'dist-' + variant),
  integrations: [starlight({
    title: 'Regional fixture',
    plugins: [hagilight(JSON.parse(process.env.HAGILIGHT_FIXTURE_OPTIONS))],
  })],
});
`);
}

/** Builds the fixture with the given plugin options and returns the output directory's page reader. */
function buildFixture(variant, options) {
  writeFixture();
  const outDir = join(FIXTURE_ROOT, `dist-${variant}`);
  rmSync(outDir, { recursive: true, force: true });
  execFileSync(process.execPath, [ASTRO_BIN, 'build', '--config', 'astro.config.mjs'], {
    cwd: FIXTURE_ROOT,
    env: { ...process.env, HAGILIGHT_FIXTURE_VARIANT: variant, HAGILIGHT_FIXTURE_OPTIONS: JSON.stringify(options) },
    stdio: 'pipe',
    timeout: 600000,
  });
  return (file) => readFileSync(join(outDir, file), 'utf8');
}

/** The pages a regional build must cover: a regular page, a nested page and the 404 page. */
const PAGES = ['index.html', 'guide/index.html', '404.html'];

function consentDescriptor(html, label) {
  const match = html.match(/<script[^>]*\bid="hagilight-consent-config"[^>]*>([\s\S]*?)<\/script>/u);
  assert.ok(match, `${label} carries the consent descriptor`);
  return JSON.parse(match[1]);
}

/** A button's opening tag, found by one of its attributes. */
function buttonTag(html, attribute) {
  return html.match(new RegExp(`<button\\b(?=[^>]*\\s${attribute}(?=[\\s>=]))[^>]*>`, 'u'))?.[0];
}

// Each variant is built once and shared by the tests that read it.
const builds = new Map();
function readBuild(variant, options) {
  if (!builds.has(variant)) builds.set(variant, buildFixture(variant, options));
  return builds.get(variant);
}

test('a regional build renders the Cookie settings and replay entries hidden on regular and 404 pages', { timeout: 900000 }, () => {
  const read = readBuild('regional', { analytics: { consent: { regions: 'default' } } });
  for (const page of PAGES) {
    const html = read(page);
    const settings = buttonTag(html, 'data-consent-entry="settings"');
    assert.ok(settings, `${page} renders the Cookie settings entry`);
    assert.match(settings, /\shidden(?=[\s>=])/u, `${page} renders the Cookie settings entry hidden`);
    const replay = buttonTag(html, 'data-consent-entry="replay"');
    assert.ok(replay, `${page} renders the replay entry`);
    assert.match(replay, /\shidden(?=[\s>=])/u, `${page} renders the replay entry hidden`);
    assert.match(replay, /data-consent-mode="replay"/u, `${page} marks the replay entry`);
  }
});

// Needs core's CookieConsent to accept `regional` and pass it to consentDescriptor and renderConsentMarkup.
test('a regional build renders the regional descriptor and the replay section on regular and 404 pages', { timeout: 900000 }, () => {
  const read = readBuild('regional', { analytics: { consent: { regions: 'default' } } });
  for (const page of PAGES) {
    const html = read(page);
    const descriptor = consentDescriptor(html, page);
    assert.equal(descriptor.mode, 'regional', `${page} descriptor is regional`);
    assert.equal(descriptor.regions, 'default', `${page} carries the default country set`);
    assert.equal(descriptor.settingsEntry, 'requiredOnly', `${page} uses the default settings entry`);
    assert.equal(descriptor.sessionReplay, 'optIn', `${page} uses the default replay option`);
    assert.match(html, /data-hagilight-consent-replay/u, `${page} renders the hidden replay section`);
  }
});

test('a global build keeps the global descriptor and renders no regional entries', { timeout: 900000 }, () => {
  const read = readBuild('global', {});
  for (const page of PAGES) {
    const html = read(page);
    const descriptor = consentDescriptor(html, page);
    assert.deepEqual(Object.keys(descriptor), ['policyVersion', 'privacyUrl', 'providers', 'locale'], `${page} has no regional keys`);
    assert.doesNotMatch(html, /"mode":"regional"/u, `${page} is not regional`);
    assert.doesNotMatch(html, /data-consent-entry=/u, `${page} renders no regional entries`);
    const preferences = buttonTag(html, 'data-consent-preferences');
    assert.ok(preferences, `${page} keeps the visible Cookie settings entry`);
    assert.doesNotMatch(preferences, /\shidden(?=[\s>=])/u, `${page} shows the Cookie settings entry`);
  }
});
