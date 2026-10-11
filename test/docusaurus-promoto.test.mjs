import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { PROMOTO_SHELL_MARKUP } = await import(
  new URL('../packages/docusaurus/dist/client/promoto-markup.js', import.meta.url).href
);
const { mountPromotoBanner, onRouteDidUpdate } = await import(
  new URL('../packages/docusaurus/dist/client/promoto.js', import.meta.url).href
);

const CORE_ELEMENT_SOURCE = readFileSync(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');
const PROMOTO_CSS = readFileSync(new URL('../packages/docusaurus/promoto.css', import.meta.url), 'utf8');

function fakeDocument({ footer = null, lang = 'en-US' } = {}) {
  const nodes = [];
  const doc = {
    footer,
    nodes,
    documentElement: { lang },
    body: {
      append(node) {
        node.isConnected = true;
        nodes.push(node);
      },
    },
    querySelector: () => doc.footer,
    querySelectorAll: () => nodes.filter((node) => node.isConnected),
    createElement: () => ({
      className: '',
      dataset: {},
      hidden: false,
      innerHTML: '',
      isConnected: false,
      remove() {
        this.isConnected = false;
      },
    }),
  };
  return doc;
}

const connectedBanners = (doc) => doc.nodes.filter((node) => node.isConnected);

test('mounting appends one hidden banner with the locale and the shared markup', () => {
  const doc = fakeDocument({ lang: 'zh-CN' });
  mountPromotoBanner(doc, 'zh-CN');
  const [banner] = connectedBanners(doc);
  assert.equal(connectedBanners(doc).length, 1);
  assert.equal(banner.className, 'hagilight-promoto');
  assert.equal(banner.dataset.locale, 'zh-CN');
  assert.equal(banner.hidden, true);
  assert.equal(banner.innerHTML, PROMOTO_SHELL_MARKUP);
});

test('repeated route updates on the same footer keep a single banner', () => {
  const doc = fakeDocument({ footer: {} });
  mountPromotoBanner(doc, 'en-US');
  mountPromotoBanner(doc, 'en-US');
  assert.equal(doc.nodes.length, 1, 'no second banner was appended');
  assert.equal(connectedBanners(doc).length, 1);
});

test('a different footer node remounts exactly one banner', () => {
  const doc = fakeDocument({ footer: {} });
  mountPromotoBanner(doc, 'en-US');
  const [first] = connectedBanners(doc);
  doc.footer = {};
  mountPromotoBanner(doc, 'en-US');
  assert.equal(first.isConnected, false);
  assert.equal(connectedBanners(doc).length, 1);
  assert.notEqual(connectedBanners(doc)[0], first);
});

test('a locale change remounts the banner with the new data-locale', () => {
  const doc = fakeDocument({ footer: {} });
  mountPromotoBanner(doc, 'en-US');
  mountPromotoBanner(doc, 'zh-CN');
  assert.deepEqual(connectedBanners(doc).map((node) => node.dataset.locale), ['zh-CN']);
});

test('a banner removed from the page is mounted again', () => {
  const doc = fakeDocument({ footer: {} });
  mountPromotoBanner(doc, 'en-US');
  connectedBanners(doc)[0].remove();
  mountPromotoBanner(doc, 'en-US');
  assert.equal(connectedBanners(doc).length, 1);
});

test('duplicate banners left on the page collapse to one', () => {
  const doc = fakeDocument({ footer: {} });
  doc.body.append(doc.createElement());
  doc.body.append(doc.createElement());
  mountPromotoBanner(doc, 'en-US');
  assert.equal(connectedBanners(doc).length, 1);
});

test('the route hook uses the document language and falls back to en-US', () => {
  const doc = fakeDocument({ footer: {}, lang: '' });
  globalThis.document = doc;
  try {
    onRouteDidUpdate();
    assert.deepEqual(connectedBanners(doc).map((node) => node.dataset.locale), ['en-US']);
    doc.documentElement.lang = 'ja-JP';
    onRouteDidUpdate();
    assert.deepEqual(connectedBanners(doc).map((node) => node.dataset.locale), ['ja-JP']);
  } finally {
    delete globalThis.document;
  }
});

test('shared markup declares every data-promoto hook that core queries', () => {
  const queried = new Set(CORE_ELEMENT_SOURCE.match(/data-promoto-[a-z]+/gu));
  assert.ok(queried.size > 0, 'core source queries promote hooks');
  const missing = [...queried].filter((hook) => !PROMOTO_SHELL_MARKUP.includes(hook));
  assert.deepEqual(missing, []);
});

test('promote styles use Infima tokens and no Starlight tokens or hard-coded white', () => {
  assert.doesNotMatch(PROMOTO_CSS, /--sl-/u);
  assert.doesNotMatch(PROMOTO_CSS, /#fff\b/iu);
  assert.match(PROMOTO_CSS, /--hagilight-promoto-cta-text: var\(--ifm-color-white\)/u);
  assert.match(PROMOTO_CSS, /data-state='footer-hidden'/u);
  assert.match(PROMOTO_CSS, /prefers-reduced-motion: reduce/u);
});
