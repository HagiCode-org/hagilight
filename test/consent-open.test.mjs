import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const loadFresh = () => import(new URL(`../packages/core/dist/consent-open.js?case=${Math.random()}`, import.meta.url));

/** A document with a root element that tracks attributes, and listeners for the events the module dispatches. */
function installDocument() {
  const attributes = new Set();
  const events = [];
  globalThis.document = {
    documentElement: {
      hasAttribute: (name) => attributes.has(name),
      toggleAttribute: (name, force) => {
        if (force) attributes.add(name);
        else attributes.delete(name);
      },
    },
    dispatchEvent: (event) => { events.push(event.type); return true; },
  };
  return { attributes, events };
}

afterEach(() => {
  delete globalThis.document;
});

test('the consent panel reads as closed until the popup announces it', async () => {
  installDocument();
  const { isConsentPanelOpen } = await loadFresh();
  assert.equal(isConsentPanelOpen(), false);
});

test('opening and closing set the root attribute and announce each change once', async () => {
  const { attributes, events } = installDocument();
  const { CONSENT_OPEN_ATTRIBUTE, CONSENT_OPEN_EVENT, isConsentPanelOpen, setConsentPanelOpen } = await loadFresh();
  setConsentPanelOpen(true);
  setConsentPanelOpen(true);
  assert.equal(isConsentPanelOpen(), true);
  assert.ok(attributes.has(CONSENT_OPEN_ATTRIBUTE));
  assert.deepEqual(events, [CONSENT_OPEN_EVENT]);
  setConsentPanelOpen(false);
  setConsentPanelOpen(false);
  assert.equal(isConsentPanelOpen(), false);
  assert.deepEqual(events, [CONSENT_OPEN_EVENT, CONSENT_OPEN_EVENT]);
});

test('closing a panel that was never open announces nothing', async () => {
  const { events } = installDocument();
  const { setConsentPanelOpen } = await loadFresh();
  setConsentPanelOpen(false);
  assert.deepEqual(events, []);
});

test('without a document the helpers do nothing and report closed', async () => {
  delete globalThis.document;
  const { isConsentPanelOpen, setConsentPanelOpen } = await loadFresh();
  assert.doesNotThrow(() => setConsentPanelOpen(true));
  assert.equal(isConsentPanelOpen(), false);
});

test('the popup publishes the panel as open until it has left, and the banner reads that signal', async () => {
  const { readFile } = await import('node:fs/promises');
  const popup = await readFile(new URL('../packages/core/src/consent-popup.ts', import.meta.url), 'utf8');
  const publish = popup.slice(popup.indexOf('function publishClearance'), popup.indexOf('/**\n * Reveals the footer'));
  assert.ok(publish.indexOf('setConsentPanelOpen(!panel.hidden)') < publish.indexOf('panel.dataset.leaving'), 'presence is set before the leaving shortcut, so it holds until the panel is hidden');
  const banner = await readFile(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');
  assert.match(banner, /from '\.\/consent-open\.js'/u);
  assert.doesNotMatch(banner, /from '\.\/consent-popup\.js'/u, 'the banner never imports the popup');
});
