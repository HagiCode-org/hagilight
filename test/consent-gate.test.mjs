import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installConsentGate, onPostHogStarted, readDescriptors } from '../packages/core/dist/consent-gate.js';

const GA_ID = 'G-EN03FMT2Q4';
const LA_ID = 'L6b88a5yK4h2Xnci';
const PH_KEY = 'phc_test123';
const PH_LOADER = '(() => { window.__fakePosthogLoaded = (window.__fakePosthogLoaded || 0) + 1; })();';

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.attributes = {};
    this.listeners = {};
    this.textContent = '';
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }
  fire(type) {
    for (const listener of this.listeners[type] ?? []) listener();
  }
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    has: (key) => map.has(key),
  };
}

function descriptorElement(provider, payload) {
  return {
    getAttribute: (name) => (name === 'data-hagilight-analytics' ? provider : null),
    textContent: typeof payload === 'string' ? payload : JSON.stringify(payload),
  };
}

function fakeBrowser({ storage = {}, cookies = {}, descriptors = fullDescriptors(), posthog = undefined } = {}) {
  const appended = [];
  const jar = new Map(Object.entries(cookies));
  const reloads = { count: 0 };
  const win = {
    localStorage: fakeStorage(storage.local),
    sessionStorage: fakeStorage(storage.session),
    location: { hostname: 'docs.example.test' },
    posthog,
    LA: undefined,
    addEventListener: () => {},
  };
  const doc = {
    head: { appendChild: (element) => appended.push(element) },
    body: { appendChild: (element) => appended.push(element) },
    createElement: (tag) => new FakeElement(tag),
    querySelectorAll: () => descriptors,
    get cookie() {
      return [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
    },
    set cookie(text) {
      const [pair, ...attributes] = text.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      if (attributes.some((attribute) => attribute.trim() === 'Max-Age=0')) jar.delete(name);
      else jar.set(name, pair.slice(index + 1));
    },
  };
  return {
    env: { document: doc, window: win, reload: () => { reloads.count += 1; } },
    appended,
    jar,
    win,
    reloads,
  };
}

function fullDescriptors() {
  return [
    descriptorElement('googleAnalytics', { measurementId: GA_ID }),
    descriptorElement('fiftyOneLa', { siteId: LA_ID }),
    descriptorElement('posthog', { apiKey: PH_KEY, loader: PH_LOADER }),
  ];
}

function fakeConsent(initial = 'undecided') {
  let state = initial;
  const listeners = new Set();
  return {
    api: {
      getConsent: () => ({ necessary: 'granted', analytics: state }),
      onConsentChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    set(analytics) {
      if (analytics === state) return;
      state = analytics;
      for (const listener of [...listeners]) listener({ necessary: 'granted', analytics });
    },
  };
}

const scriptsWithSource = (appended, prefix) => appended.filter((element) => typeof element.attributes.src === 'string' && element.attributes.src.startsWith(prefix));

test('an undecided visitor gets no provider script, no gtag, no LA.init and no PostHog loader', () => {
  const browser = fakeBrowser();
  const consent = fakeConsent('undecided');
  const gate = installConsentGate(browser.env, consent.api);
  assert.deepEqual(gate.started(), []);
  assert.equal(browser.appended.length, 0);
  assert.equal(browser.win.gtag, undefined);
  assert.equal(browser.win.dataLayer, undefined);
  assert.equal(browser.win.__fakePosthogLoaded, undefined);
  assert.equal(browser.reloads.count, 0);
});

test('a stored denial starts nothing, and a granted choice loads each provider once', () => {
  const denied = fakeBrowser();
  installConsentGate(denied.env, fakeConsent('denied').api);
  assert.equal(denied.appended.length, 0);

  const granted = fakeBrowser();
  const gate = installConsentGate(granted.env, fakeConsent('granted').api);
  assert.deepEqual(gate.started(), ['googleAnalytics', 'fiftyOneLa', 'posthog']);
  assert.equal(scriptsWithSource(granted.appended, `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`).length, 1);
  assert.equal(scriptsWithSource(granted.appended, 'https://sdk.51.la/js-sdk-pro.min.js').length, 1);
  assert.equal(granted.appended.filter((element) => element.textContent === PH_LOADER).length, 1);
});

test('gtag is configured after gtag.js loads, and LA.init runs after the SDK loads with screen recording on', () => {
  const browser = fakeBrowser();
  browser.win.LA = { init: (options) => { browser.win.laOptions = options; } };
  installConsentGate(browser.env, fakeConsent('granted').api);
  assert.equal(browser.win.gtag, undefined, 'gtag is defined only once the script has loaded');
  const gaScript = scriptsWithSource(browser.appended, 'https://www.googletagmanager.com/')[0];
  gaScript.fire('load');
  assert.equal(typeof browser.win.gtag, 'function');
  assert.equal(browser.win.dataLayer.at(-1)[0], 'config');
  assert.equal(browser.win.dataLayer.at(-1)[1], GA_ID);
  browser.appended.find((element) => element.attributes.id === 'LA_COLLECT').fire('load');
  assert.deepEqual(browser.win.laOptions, { id: LA_ID, ck: LA_ID, autoTrack: true, hashMode: true, screenRecord: true });
});

test('accepting on the current page starts the providers without a reload', () => {
  const browser = fakeBrowser();
  const consent = fakeConsent('undecided');
  const gate = installConsentGate(browser.env, consent.api);
  consent.set('granted');
  assert.deepEqual(gate.started(), ['googleAnalytics', 'fiftyOneLa', 'posthog']);
  assert.equal(browser.reloads.count, 0);
});

test('a provider never starts twice in one document, even after a grant, denial and grant', () => {
  const browser = fakeBrowser();
  const consent = fakeConsent('undecided');
  installConsentGate(browser.env, consent.api);
  consent.set('granted');
  consent.set('granted');
  consent.set('denied');
  consent.set('granted');
  assert.equal(scriptsWithSource(browser.appended, 'https://www.googletagmanager.com/').length, 1);
  assert.equal(browser.appended.filter((element) => element.textContent === PH_LOADER).length, 1);
});

test('withdrawal stops PostHog and clears its ph_ storage, disables GA, removes its cookies, and reloads for 51LA', () => {
  const opted = { optOut: 0 };
  const browser = fakeBrowser({
    cookies: { [`_ga`]: 'GA1.1', [`_ga_EN03FMT2Q4`]: 'GS1', [`ph_${PH_KEY}_posthog`]: 'x', other: 'keep' },
    storage: { local: { [`ph_${PH_KEY}_posthog`]: '{}', [`__ph_opt_in_out_${PH_KEY}`]: '1', 'hagicode:consent': 'kept' } },
    posthog: { opt_out_capturing: () => { opted.optOut += 1; } },
  });
  const consent = fakeConsent('granted');
  installConsentGate(browser.env, consent.api);
  consent.set('denied');
  assert.equal(opted.optOut, 1);
  assert.equal(browser.win[`ga-disable-${GA_ID}`], true);
  assert.equal(browser.jar.has('_ga'), false);
  assert.equal(browser.jar.has('_ga_EN03FMT2Q4'), false);
  assert.equal(browser.jar.has(`ph_${PH_KEY}_posthog`), false);
  assert.equal(browser.jar.get('other'), 'keep');
  assert.equal(browser.win.localStorage.has(`ph_${PH_KEY}_posthog`), false);
  assert.equal(browser.win.localStorage.has('hagicode:consent'), true, 'the necessary record is never removed');
  assert.equal(browser.reloads.count, 1, 'a reload follows because providers are not stoppable in place');
});

test('a PostHog opt-out key is cleared before a re-grant initializes PostHog', () => {
  const browser = fakeBrowser({ storage: { local: { [`__ph_opt_in_out_${PH_KEY}`]: '1' } } });
  installConsentGate(browser.env, fakeConsent('granted').api);
  assert.equal(browser.win.localStorage.has(`__ph_opt_in_out_${PH_KEY}`), false);
  assert.equal(browser.appended.filter((element) => element.textContent === PH_LOADER).length, 1);
});

test('a provider with a malformed descriptor is ignored and the rest still start', () => {
  const browser = fakeBrowser({
    descriptors: [descriptorElement('googleAnalytics', 'not json'), descriptorElement('posthog', { apiKey: PH_KEY, loader: PH_LOADER })],
  });
  assert.deepEqual(Object.keys(readDescriptors(browser.env.document)), ['posthog']);
  const gate = installConsentGate(browser.env, fakeConsent('granted').api);
  assert.deepEqual(gate.started(), ['posthog']);
});

test('the PostHog post-grant hook runs after the loader is injected, and a failing hook does not stop the rest', () => {
  let calls = 0;
  onPostHogStarted(() => { throw new Error('hook failure'); });
  onPostHogStarted(() => { calls += 1; });
  const browser = fakeBrowser({ descriptors: [descriptorElement('posthog', { apiKey: PH_KEY, loader: PH_LOADER })] });
  installConsentGate(browser.env, fakeConsent('granted').api);
  assert.equal(calls, 1, 'the working hook runs once although an earlier hook throws');
});

test('nothing from the undecided period is buffered into the page after the grant', () => {
  const browser = fakeBrowser();
  const consent = fakeConsent('undecided');
  installConsentGate(browser.env, consent.api);
  assert.equal(browser.win.dataLayer, undefined, 'no dataLayer before the grant');
  consent.set('granted');
  const gaScript = scriptsWithSource(browser.appended, 'https://www.googletagmanager.com/')[0];
  gaScript.fire('load');
  assert.deepEqual(browser.win.dataLayer.map((entry) => entry[0]), ['js', 'config']);
});
