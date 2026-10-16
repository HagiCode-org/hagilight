import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { PROMOTO_SHELL_MARKUP } = await import(
  new URL('../packages/docusaurus/dist/client/promoto-markup.js', import.meta.url).href
);
const { mountPromotoBanner, onRouteDidUpdate, syncPromotoInsets } = await import(
  new URL('../packages/docusaurus/dist/client/promoto.js', import.meta.url).href
);

const CORE_ELEMENT_SOURCE = readFileSync(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');
const PROMOTO_CSS = readFileSync(new URL('../packages/docusaurus/promoto.css', import.meta.url), 'utf8');
const DOCUSAURUS_CLIENT_SOURCE = readFileSync(new URL('../packages/docusaurus/src/client/promoto.ts', import.meta.url), 'utf8');

function fakeDocument({ footer = null, lang = 'en-US', siteId } = {}) {
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
    querySelector: (selector) => {
      if (selector === 'footer') return doc.footer;
      return siteId === undefined ? null : { getAttribute: () => siteId };
    },
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

test('the banner takes its site identifier from the site meta tag and leaves it unset without one', () => {
  const tagged = fakeDocument({ siteId: 'docs' });
  mountPromotoBanner(tagged, 'en-US');
  assert.equal(connectedBanners(tagged)[0].dataset.siteId, 'docs');

  const untagged = fakeDocument();
  mountPromotoBanner(untagged, 'en-US');
  assert.equal(connectedBanners(untagged)[0].dataset.siteId, undefined);
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

test('the route hook records the visit after mounting the banner', () => {
  assert.match(DOCUSAURUS_CLIENT_SOURCE, /import \{ definePromotoBannerElement, recordSiteVisit \} from '@hagicode\/hagilight-core\/promoto-banner';/u);
  const hook = DOCUSAURUS_CLIENT_SOURCE.slice(DOCUSAURUS_CLIENT_SOURCE.indexOf('export function onRouteDidUpdate'));
  assert.ok(hook.indexOf('mountPromotoBanner(') < hook.indexOf('recordSiteVisit();'));
});

test('shared markup declares every data-promoto hook that core queries', () => {
  const queried = new Set(CORE_ELEMENT_SOURCE.match(/data-promoto-[a-z]+/gu));
  assert.ok(queried.size > 0, 'core source queries promote hooks');
  const missing = [...queried].filter((hook) => !PROMOTO_SHELL_MARKUP.includes(hook));
  assert.deepEqual(missing, []);
});

test('promote card background is opaque, not the page background that Infima sets to transparent in light mode', () => {
  assert.match(PROMOTO_CSS, /background: color-mix\(in srgb, var\(--ifm-background-surface-color, var\(--ifm-color-white\)\) 96%, var\(--ifm-color-primary\) 4%\);/u);
  assert.doesNotMatch(PROMOTO_CSS, /var\(--ifm-background-color\)/u);
});

test('promote styles use Infima tokens and no Starlight tokens or hard-coded white', () => {
  assert.doesNotMatch(PROMOTO_CSS, /--sl-/u);
  assert.doesNotMatch(PROMOTO_CSS, /#fff\b/iu);
  assert.match(PROMOTO_CSS, /--hagilight-promoto-cta-text: var\(--ifm-color-white\)/u);
  assert.match(PROMOTO_CSS, /data-state='footer-hidden'/u);
  assert.match(PROMOTO_CSS, /\[data-state='top-hidden'\] \.hagilight-promoto__shell/u);
  assert.match(PROMOTO_CSS, /prefers-reduced-motion: reduce/u);
});

const rect = (left, right) => ({ left, right, width: right - left });

function layoutDocument({ viewport, main, columns = [], sidebar }) {
  const element = (box) => ({ getBoundingClientRect: () => box });
  return {
    documentElement: { clientWidth: viewport },
    querySelector: (selector) => {
      if (selector === 'main') return main && { ...element(main), querySelectorAll: () => columns.map(element) };
      if (selector === '.theme-doc-sidebar-container') return sidebar && element(sidebar);
      return null;
    },
  };
}

function bannerStyle() {
  const properties = {};
  return { properties, style: { setProperty: (name, value) => { properties[name] = value; } } };
}

test('desktop docs pages inset the card to the content column, clear of the sidebar and the table of contents', () => {
  const doc = layoutDocument({
    viewport: 1920,
    main: rect(300, 1920),
    columns: [rect(450, 1440), rect(1440, 1770)],
    sidebar: rect(0, 300),
  });
  const banner = bannerStyle();
  syncPromotoInsets(doc, banner);
  assert.deepEqual(banner.properties, {
    '--hagilight-promoto-inset-start': '450px',
    '--hagilight-promoto-inset-end': '480px',
  });
});

test('the card never starts inside the doc sidebar', () => {
  const doc = layoutDocument({ viewport: 1280, main: rect(0, 1280), columns: [rect(0, 1000)], sidebar: rect(0, 300) });
  const banner = bannerStyle();
  syncPromotoInsets(doc, banner);
  assert.equal(banner.properties['--hagilight-promoto-inset-start'], '300px');
});

test('pages without a column layout fall back to main, and mobile widths use the whole viewport', () => {
  const home = bannerStyle();
  syncPromotoInsets(layoutDocument({ viewport: 1920, main: rect(300, 1620) }), home);
  assert.deepEqual(home.properties, {
    '--hagilight-promoto-inset-start': '300px',
    '--hagilight-promoto-inset-end': '300px',
  });

  const phone = bannerStyle();
  syncPromotoInsets(layoutDocument({ viewport: 800, main: rect(0, 800), columns: [rect(16, 784)], sidebar: rect(0, 0) }), phone);
  assert.deepEqual(phone.properties, {
    '--hagilight-promoto-inset-start': '0px',
    '--hagilight-promoto-inset-end': '0px',
  });
});

test('the card is positioned between two themable insets and sizes itself inside them', () => {
  assert.match(PROMOTO_CSS, /inset-inline-start: var\(--hagilight-promoto-inset-start, 0px\);/u);
  assert.match(PROMOTO_CSS, /inset-inline-end: var\(--hagilight-promoto-inset-end, 0px\);/u);
  assert.match(PROMOTO_CSS, /width: min\(42rem, calc\(100% - var\(--hagilight-promoto-inset-start, 0px\) - var\(--hagilight-promoto-inset-end, 0px\)/u);
});
