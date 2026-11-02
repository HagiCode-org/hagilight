import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { after, before, test } from 'node:test';
import { consentDescriptor, resolveRegionalOptions } from '@hagicode/hagilight-core/consent-markup';
import { resolveConsentCopy } from '@hagicode/hagilight-core/consent-copy';

const dist = new URL('../packages/docusaurus/dist/', import.meta.url).href;
const { hagilightDocusaurus } = await import(`${dist}index.js`);
const { FooterView } = await import(`${dist}theme/Footer/FooterView.js`);
const { resolveFooterConsent, resolveFooterLinks } = await import(`${dist}footer.js`);

const PROVIDERS = ['googleAnalytics', 'fiftyOneLa', 'posthog'];
const i18n = {
  defaultLocale: 'en-US',
  locales: ['en-US'],
  currentLocale: 'en-US',
  path: 'i18n',
  localeConfigs: { 'en-US': { label: 'English', htmlLang: 'en-US', direction: 'ltr' } },
};
const site = {
  siteDir: '/nonexistent-hagilight-regional-site',
  siteConfig: { title: 'HagiCode', url: 'https://example.com', themeConfig: { image: 'img/social.png' } },
  i18n,
  baseUrl: '/',
};

const originalWarn = console.warn;
const originalNodeEnv = process.env.NODE_ENV;
before(() => {
  console.warn = () => {};
  process.env.NODE_ENV = 'production';
});
after(() => {
  console.warn = originalWarn;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function headTagsFor(consent) {
  const options = consent === undefined ? undefined : { analytics: { consent } };
  return hagilightDocusaurus(options)(site).injectHtmlTags({ content: undefined }).headTags;
}

const configTag = (tags) => tags.find((tag) => tag.attributes?.id === 'hagilight-consent-config');

/** The opening tag of the footer button whose text is `label`. */
function buttonFor(html, label) {
  return html.match(new RegExp(`<button[^>]*>${label}</button>`, 'u'))?.[0];
}

test('regional options reach the head descriptor unchanged, with the core serializer', () => {
  const config = configTag(headTagsFor({ regions: ['DE', 'FR'], regionHook: 'siteRegion', settingsEntry: 'always', sessionReplay: 'off' }));
  assert.equal(config.innerHTML, consentDescriptor({
    providers: PROVIDERS,
    policyVersion: '1',
    regional: { regions: ['DE', 'FR'], regionHook: 'siteRegion', settingsEntry: 'always', sessionReplay: 'off' },
  }));
  assert.deepEqual(JSON.parse(config.innerHTML), {
    policyVersion: '1',
    privacyUrl: null,
    providers: PROVIDERS,
    locale: 'en-US',
    mode: 'regional',
    regions: ['DE', 'FR'],
    regionHook: 'siteRegion',
    settingsEntry: 'always',
    sessionReplay: 'off',
  });
});

test('regions "default" with no other regional option applies the documented defaults', () => {
  const data = JSON.parse(configTag(headTagsFor({ regions: 'default' })).innerHTML);
  assert.deepEqual(data, {
    policyVersion: '1',
    privacyUrl: null,
    providers: PROVIDERS,
    locale: 'en-US',
    mode: 'regional',
    regions: 'default',
    settingsEntry: 'requiredOnly',
    sessionReplay: 'optIn',
  });
});

test('without a regional option the descriptor keeps the global shape and bytes', () => {
  for (const consent of [undefined, {}, { privacyUrl: '/privacy' }]) {
    const config = configTag(headTagsFor(consent));
    const data = JSON.parse(config.innerHTML);
    assert.equal(Object.hasOwn(data, 'mode'), false, JSON.stringify(consent));
    assert.equal(config.innerHTML, consentDescriptor({
      providers: PROVIDERS,
      policyVersion: '1',
      privacyUrl: consent?.privacyUrl,
    }), JSON.stringify(consent));
  }
});

test('regional option errors match the core validator message for message', () => {
  const coreMessage = (input, enabled = true) => {
    try {
      resolveRegionalOptions(input, enabled);
    } catch (error) {
      return error.message;
    }
    throw new Error(`the core validator accepted ${JSON.stringify(input)}`);
  };
  const cases = [
    [{ countryCode: 'DE' }],
    [{ sessionReplay: 'optIn' }],
    [{ regions: 'EU' }],
    [{ regions: [] }],
    [{ regions: ['de'] }],
    [{ regions: ['XX'] }],
    [{ regions: 'default', countryCode: 'Germany' }],
    [{ regions: 'default', regionHook: 'window.siteRegion()' }],
    [{ regions: 'default', settingsEntry: 'sometimes' }],
    [{ regions: 'default', sessionReplay: 'on' }],
    [{ enabled: false, regions: 'default' }, false],
  ];
  for (const [consent, enabled] of cases) {
    const expected = coreMessage(Object.fromEntries(Object.entries(consent).filter(([key]) => key !== 'enabled')), enabled ?? true);
    assert.match(expected, /^analytics\.consent\./u);
    assert.throws(
      () => hagilightDocusaurus({ analytics: { consent } }),
      (error) => error instanceof TypeError && error.message === expected,
      JSON.stringify(consent),
    );
  }
});

test('the footer hides the settings entry and, for opt-in replay, the replay entry; the labels follow the locale', () => {
  const consent = {
    enabled: true,
    privacyUrl: undefined,
    policyVersion: '1',
    providers: ['posthog'],
    regional: { regions: 'default', settingsEntry: 'requiredOnly', sessionReplay: 'optIn' },
  };
  const en = resolveConsentCopy('en-US');
  assert.deepEqual(resolveFooterConsent(consent, 'en-US'), {
    consentLabel: en.footerEntry,
    regional: true,
    replayLabel: en.replayEntry,
  });
  const zh = resolveConsentCopy('zh-CN');
  assert.equal(resolveFooterConsent(consent, 'zh-CN').replayLabel, zh.replayEntry);
  assert.notEqual(zh.replayEntry, en.replayEntry);

  const links = resolveFooterLinks({ locale: 'en-US', baseUrl: '/', links: {}, rssEnabled: true });
  const html = renderToStaticMarkup(createElement(FooterView, { links, version: '0.1.0', year: 2026, ...resolveFooterConsent(consent, 'en-US') }));
  const settings = buttonFor(html, en.footerEntry);
  assert.match(settings, /data-consent-entry="settings"/u);
  assert.match(settings, /hidden=""/u);
  const replay = buttonFor(html, en.replayEntry);
  assert.match(replay, /data-consent-mode="replay"/u);
  assert.match(replay, /data-consent-entry="replay"/u);
  assert.match(replay, /hidden=""/u);
});

test('replay stays out of the footer unless the regional site opts in, and a global site has no hidden entries', () => {
  const en = resolveConsentCopy('en-US');
  const regional = (sessionReplay) => ({
    enabled: true,
    privacyUrl: undefined,
    policyVersion: '1',
    providers: ['posthog'],
    regional: { regions: 'default', settingsEntry: 'requiredOnly', sessionReplay },
  });
  assert.equal(resolveFooterConsent(regional('off'), 'en-US').replayLabel, undefined);
  assert.equal(resolveFooterConsent(regional('projectDefault'), 'en-US').replayLabel, undefined);

  const global = { enabled: true, privacyUrl: undefined, policyVersion: '1', providers: ['posthog'] };
  assert.deepEqual(resolveFooterConsent(global, 'en-US'), { consentLabel: en.footerEntry, regional: false, replayLabel: undefined });
  const links = resolveFooterLinks({ locale: 'en-US', baseUrl: '/', links: {}, rssEnabled: true });
  const html = renderToStaticMarkup(createElement(FooterView, { links, version: '0.1.0', year: 2026, ...resolveFooterConsent(global, 'en-US') }));
  assert.doesNotMatch(html, /data-consent-entry/u);
  assert.doesNotMatch(html, /hidden=""/u);
  assert.match(buttonFor(html, en.footerEntry), /^<button type="button" class="hagilight-footer__consent" data-consent-preferences="true">/u);

  const off = { enabled: false, privacyUrl: undefined, policyVersion: '1', providers: [] };
  assert.deepEqual(resolveFooterConsent(off, 'en-US'), { consentLabel: undefined, regional: false, replayLabel: undefined });
});

test('the client module resolves the region once and starts each provider once across repeated mounts', async () => {
  const config = JSON.stringify({
    policyVersion: '1',
    privacyUrl: null,
    providers: ['googleAnalytics'],
    locale: 'en-US',
    mode: 'regional',
    regions: ['DE'],
    settingsEntry: 'requiredOnly',
    sessionReplay: 'optIn',
  });
  const gaDescriptor = {
    getAttribute: (name) => (name === 'data-hagilight-analytics' ? 'googleAnalytics' : null),
    textContent: JSON.stringify({ measurementId: 'G-EN03FMT2Q4' }),
  };
  const headAppended = [];
  const traces = [];
  let markupInserts = 0;
  let panelInserted = false;
  const body = {
    insertAdjacentHTML() {
      markupInserts += 1;
      panelInserted = true;
    },
    appendChild() {},
  };
  const panel = {
    hidden: true,
    dataset: {},
    parentElement: body,
    closest: () => null,
    querySelector: () => null,
    addEventListener() {},
    style: { setProperty() {} },
    getBoundingClientRect: () => ({ height: 0 }),
  };
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const doc = {
    documentElement: { lang: 'en-US', style: { setProperty() {} } },
    body,
    head: { appendChild: (element) => headAppended.push(element) },
    cookie: '',
    getElementById: (id) => (id === 'hagilight-consent-config' ? { textContent: config } : null),
    querySelector: (selector) => (selector === '[data-hagilight-consent]' && panelInserted ? panel : null),
    querySelectorAll: (selector) => (selector.includes('data-hagilight-analytics') ? [gaDescriptor] : []),
    createElement: (tag) => ({ tagName: tag, attributes: {}, setAttribute(name, value) { this.attributes[name] = String(value); }, addEventListener() {} }),
    addEventListener() {},
  };
  const win = {
    location: { href: 'https://docs.example.test/guide/', hostname: 'docs.example.test' },
    localStorage: storage,
    sessionStorage: storage,
    fetch: async (url) => {
      traces.push(url);
      return { ok: true, text: async () => 'loc=US\n' };
    },
    addEventListener() {},
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  globalThis.window = win;
  globalThis.document = doc;
  try {
    // Importing the client module mounts consent once, as the first page load does.
    await import(new URL('../packages/docusaurus/dist/client/consent.js', import.meta.url).href);
    await settle();
    const gate = win.__hagilightConsentGate;
    assert.deepEqual(traces, ['https://docs.example.test/cdn-cgi/trace']);
    assert.equal(markupInserts, 1);
    assert.deepEqual(gate.started(), ['googleAnalytics']);

    // A client-side navigation mounts again with the same document and window.
    const { mountConsent } = await import(new URL('../packages/core/dist/consent-mount.js', import.meta.url).href);
    mountConsent(doc, win);
    mountConsent(doc, win);
    await settle();
    assert.equal(traces.length, 1, 'the region is not resolved again in the same document');
    assert.equal(markupInserts, 1, 'the popup markup is inserted once');
    assert.equal(win.__hagilightConsentGate, gate, 'the gate is installed once');
    assert.deepEqual(gate.started(), ['googleAnalytics']);
    assert.equal(headAppended.filter((element) => String(element.attributes.src).includes('googletagmanager.com')).length, 1, 'the analytics loader starts once');
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});
