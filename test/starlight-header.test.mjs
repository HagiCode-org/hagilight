import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import hagilight from '../packages/starlight/index.mjs';

function configure(options = {}, components = {}) {
  const config = { components };
  const integrations = [];
  let updated;
  hagilight(options).hooks['config:setup']({
    config,
    updateConfig: (value) => { updated = value; },
    addIntegration: (integration) => integrations.push(integration),
  });
  return { updated, integrations };
}

function getVitePlugin(integration) {
  let config;
  integration.hooks['astro:config:setup']({
    updateConfig: (value) => { config = value; },
  });
  return config.vite.plugins[0];
}

function optionsModuleId(componentId) {
  return `${componentId.slice(0, componentId.lastIndexOf('/'))}/options`;
}

test('registers Header by default and forwards the existing links options', () => {
  const { updated, integrations } = configure({
    links: { siteId: 'example', extraLinks: {} },
  }, { Search: './Search.astro' });
  const vite = getVitePlugin(integrations[0]);
  const headerModule = vite.load(vite.resolveId(updated.components.Header));
  const optionsModule = vite.load(vite.resolveId(optionsModuleId(updated.components.Header)));

  assert.match(updated.components.Header, /\/Header\.astro$/);
  assert.match(updated.components.Footer, /\/Footer\.astro$/);
  assert.equal(updated.components.Search, './Search.astro');
  assert.match(headerModule, /Header links=\{options\.links\}/);
  assert.match(optionsModule, /"siteId":"example"/);
});

test('rejects a conflicting Header override but supports explicit opt-out', () => {
  assert.throws(
    () => configure({}, { Header: './CustomHeader.astro' }),
    /existing Starlight Header override.*header: \{ enabled: false \}/,
  );

  const { updated } = configure(
    { header: { enabled: false } },
    { Header: './CustomHeader.astro' },
  );
  assert.equal(updated.components.Header, './CustomHeader.astro');
  assert.match(updated.components.Footer, /\/Footer\.astro$/);
});

test('validates the header option shape', () => {
  assert.throws(() => configure({ header: false }), /header options must be an object/);
  assert.throws(
    () => configure({ header: { enabled: 'no' } }),
    /header enabled option must be a boolean/,
  );
});

test('publishes Header and its chooser implementation files', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../packages/starlight/package.json', import.meta.url), 'utf8'),
  );
  const chooser = await readFile(
    new URL('../packages/starlight/LanguageChooser.astro', import.meta.url),
    'utf8',
  );

  assert.equal(packageJson.exports['./Header'], './Header.astro');
  assert.ok(packageJson.files.includes('*.astro'));
  assert.ok(packageJson.files.includes('*.mjs'));
  assert.match(chooser, /import \{\s*getKeyboardTargetIndex/s);
  assert.match(chooser, /showModal\(\)/);
  assert.match(chooser, /addEventListener\('cancel'/);
  assert.match(chooser, /trigger\.focus\(\)/);
});
