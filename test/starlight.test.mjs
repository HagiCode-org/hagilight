import assert from 'node:assert/strict';
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

test('registers a configured footer without discarding other overrides', () => {
  const { updated, integrations } = configure({}, { Header: './Header.astro' });

  assert.equal(updated.components.Header, './Header.astro');
  assert.match(updated.components.Footer, /^virtual:hagilight-starlight\/.+\/Footer\.astro$/);
  assert.equal(updated.components.Head, undefined);
  assert.equal(integrations.length, 1);
});

test('passes disabled promotion configuration to the footer wrapper', () => {
  const { updated, integrations } = configure({ promoto: { enabled: false } });

  assert.match(updated.components.Footer, /\/Footer\.astro$/);
  assert.equal(updated.components.Head, undefined);
  assert.equal(integrations.length, 1);
});

test('rejects an existing footer override instead of replacing it', () => {
  assert.throws(
    () => configure({}, { Footer: './CustomFooter.astro' }),
    /existing Starlight Footer override/,
  );
});

test('enables each analytics provider independently and delivers options per plugin instance', () => {
  const google = configure({
    analytics: { googleAnalytics: { measurementId: 'G-TEST123' } },
  });
  const la = configure({
    analytics: { fiftyOneLa: { siteId: 'site_123' } },
  });
  const googleHead = google.updated.components.Head;
  const googleFooter = google.updated.components.Footer;
  const laFooter = la.updated.components.Footer;

  assert.match(googleHead, /^virtual:hagilight-starlight\/.+\/Head\.astro$/);
  assert.equal(la.updated.components.Head, undefined);

  const [googleVite] = integrationVitePlugins(google.integrations[0]);
  const [laVite] = integrationVitePlugins(la.integrations[0]);
  const googleFooterModule = googleVite.load(googleVite.resolveId(googleFooter));
  const laFooterModule = laVite.load(laVite.resolveId(laFooter));
  assert.match(googleFooterModule, /PromotoBanner/);
  assert.match(laFooterModule, /Analytics51LA/);
  assert.notEqual(googleFooter, laFooter);
  assert.match(googleVite.load(googleVite.resolveId(googleHead)), /GoogleAnalytics/);
});

test('requires valid IDs when analytics providers are enabled', () => {
  assert.throws(
    () => configure({ analytics: { googleAnalytics: { enabled: true } } }),
    /measurementId is missing/,
  );
  assert.throws(
    () => configure({ analytics: { fiftyOneLa: { enabled: true } } }),
    /siteId is missing/,
  );
  assert.throws(
    () => configure({ analytics: { googleAnalytics: { measurementId: 'not-an-id' } } }),
    /invalid format/,
  );
});

test('rejects an existing head override only when Google Analytics is enabled', () => {
  assert.doesNotThrow(() => configure({}, { Head: './CustomHead.astro' }));
  assert.throws(
    () => configure(
      { analytics: { googleAnalytics: { measurementId: 'G-TEST123' } } },
      { Head: './CustomHead.astro' },
    ),
    /existing Starlight Head override/,
  );
});

test('virtual options module contains safe defaults and independent provider settings', () => {
  const defaults = configure();
  const enabled = configure({
    analytics: {
      googleAnalytics: { measurementId: 'G-TEST123' },
      fiftyOneLa: { siteId: 'site_123' },
    },
    links: { siteId: 'docs', relatedSites: [] },
  });
  const [defaultVite] = integrationVitePlugins(defaults.integrations[0]);
  const [enabledVite] = integrationVitePlugins(enabled.integrations[0]);
  const defaultSource = defaultVite.load(defaultVite.resolveId(optionsModuleId(defaults.updated.components.Footer)));
  const enabledSource = enabledVite.load(enabledVite.resolveId(optionsModuleId(enabled.updated.components.Footer)));

  assert.match(defaultSource, /"promotoEnabled":true/);
  assert.doesNotMatch(defaultSource, /measurementId|site_123/);
  assert.match(enabledSource, /"googleAnalyticsMeasurementId":"G-TEST123"/);
  assert.match(enabledSource, /"fiftyOneLaId":"site_123"/);
});

function integrationVitePlugins(integration) {
  let config;
  integration.hooks['astro:config:setup']({
    updateConfig: (value) => { config = value; },
  });
  return config.vite.plugins;
}

function optionsModuleId(componentId) {
  return `${componentId.slice(0, componentId.lastIndexOf('/'))}/options`;
}
