import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  getNextPromotionIndex,
  getPromotionImageSources,
  getPromotionSetSignature,
  getPromotionVisibility,
  getVisitCountKey,
  isPageTopRuleActive,
  isScrolledToTop,
  parseVisitCount,
  selectPromotionCards,
  shouldAutoRotate,
} from '../packages/core/dist/promoto-banner.js';

const fallback = {
  id: 'site-fallback',
  title: 'Local campaign',
  description: 'Localized for this site',
  ctaLabel: 'Read more',
  link: '/campaign',
};

test('uses a site fallback only when no eligible remote campaign exists', () => {
  assert.deepEqual(selectPromotionCards([], fallback), [fallback]);
  assert.deepEqual(selectPromotionCards([{ ...fallback, id: 'remote' }], fallback), [{ ...fallback, id: 'remote' }]);
  assert.deepEqual(selectPromotionCards([], { ...fallback, link: 'javascript:alert(1)' }), []);
});

test('dismissal signatures change with campaign content and drive banner visibility', () => {
  const signature = getPromotionSetSignature([fallback]);
  assert.ok(signature);
  assert.equal(getPromotionSetSignature([{ ...fallback, title: 'Changed campaign' }]) === signature, false);
  assert.equal(getPromotionVisibility([fallback], signature, signature, false), 'dismissed');
  assert.equal(getPromotionVisibility([fallback], signature, null, true), 'footer-hidden');
  assert.equal(getPromotionVisibility([fallback], signature, null, false), 'ready');
  assert.equal(getPromotionVisibility([], null, null, false), 'hidden');
});

test('supports manual wraparound controls and respects reduced-motion rotation', () => {
  assert.equal(getNextPromotionIndex(0, 3, -1), 2);
  assert.equal(getNextPromotionIndex(2, 3, 1), 0);
  assert.equal(getNextPromotionIndex(0, 0, 1), 0);
  assert.equal(shouldAutoRotate(2, false, false, true, 'ready'), true);
  assert.equal(shouldAutoRotate(2, false, true, true, 'ready'), false);
  assert.equal(shouldAutoRotate(2, false, false, true, 'footer-hidden'), false);
  assert.equal(shouldAutoRotate(1, false, false, true, 'ready'), false);
});


test('every rendered promotion CTA, including rotated slides, is tagged with its campaign id', async () => {
  const source = await readFile(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');
  const render = source.slice(source.indexOf('private renderCards'), source.indexOf('private updateSlides'));

  // renderCards() builds one anchor per card, and is re-run on reload and rotation.
  assert.match(render, /this\.cards\.forEach\(\(card, index\) => \{/);
  assert.match(render, /category: 'promotion',\s*label: card\.id,\s*location: 'promoto_banner',/);
  assert.match(render, /gaEventAttributes\(/);
  assert.match(render, /link\.setAttribute\(name, value\)/);
});

test('pager and dismiss stay a compact icon toolbar that follows the content in DOM order', async () => {
  const component = await readFile(new URL('../packages/core/PromotoBanner.astro', import.meta.url), 'utf8');
  const script = await readFile(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');

  // Content first, then pager, then dismiss, so focus order matches the visual order.
  const order = ['hagilight-promoto__viewport', 'data-promoto-controls', 'data-promoto-dismiss']
    .map((marker) => component.indexOf(marker));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);

  // Controls are icon buttons that keep an accessible name; the script must not overwrite
  // their children with text, or the pause/play icons would disappear.
  assert.match(component, /data-promoto-pause[\s\S]*?aria-label="Pause automatic promotion rotation"/u);
  assert.match(component, /hagilight-promoto__icon--pause/u);
  assert.match(component, /hagilight-promoto__icon--play/u);
  assert.doesNotMatch(script, /pause\.textContent\s*=/u);
  assert.match(script, /toggleAttribute\('data-multiple'/u);

  // Visible marks stay small; touch devices get a larger, still compact, target.
  assert.match(component, /--promoto-control-size:\s*1\.75rem/u);
  assert.match(component, /@media \(pointer: coarse\)[\s\S]*?--promoto-control-size:\s*2rem/u);
});

test('narrow and short viewports keep the card compact without a separate controls row', async () => {
  const component = await readFile(new URL('../packages/core/PromotoBanner.astro', import.meta.url), 'utf8');

  // The pager is bottom-anchored on the call-to-action row at every size, never a column of its own.
  assert.match(component, /@media \(max-width: 36rem\) and \(min-height: 30rem\)/u);
  assert.match(component, /\.hagilight-promoto__controls\s*\{[^}]*position:\s*absolute/u);
  assert.match(component, /\[data-multiple\] \.hagilight-promoto__cta\s*\{[^}]*max-width:/u);
  // Short landscape viewports collapse to a thin strip instead of overflowing.
  assert.match(component, /@media \(max-height: 30rem\)[\s\S]*?\.hagilight-promoto__media\s*\{[^}]*display:\s*none/u);
});

test('lists the published image tiers in order and leaves out the original', () => {
  const image = {
    src: 'https://index.hagicode.com/_astro/card.png',
    alt: 'Card',
    sources: [
      { type: 'image/avif', src: 'https://index.hagicode.com/_astro/card.avif' },
      { type: 'image/webp', src: 'https://index.hagicode.com/_astro/card.webp' },
      { type: 'image/png', src: 'https://index.hagicode.com/_astro/card.png' },
    ],
  };
  assert.deepEqual(getPromotionImageSources(image).map((source) => source.type), ['image/avif', 'image/webp']);
});

test('drops tiers with an unsafe URL or a non-image type and lists nothing without a chain', () => {
  const image = {
    src: 'https://index.hagicode.com/_astro/card.png',
    alt: 'Card',
    sources: [
      { type: 'text/html', src: 'https://index.hagicode.com/_astro/card.html' },
      { type: 'image/avif', src: 'javascript:alert(1)' },
      { type: 'image/webp', src: 'https://index.hagicode.com/_astro/card.webp' },
    ],
  };
  assert.deepEqual(getPromotionImageSources(image), [
    { type: 'image/webp', src: 'https://index.hagicode.com/_astro/card.webp' },
  ]);
  assert.deepEqual(getPromotionImageSources({ src: '/card.png', alt: 'Card' }), []);
  assert.deepEqual(getPromotionImageSources({ src: '/card.png', alt: 'Card', sources: 'not-a-list' }), []);
  assert.deepEqual(getPromotionImageSources(undefined), []);
});

test('dismissal signature ignores the published image chain', () => {
  const card = {
    ...fallback,
    image: { src: 'https://index.hagicode.com/_astro/card.png', alt: 'Card', width: 1232, height: 706 },
  };
  const withChain = {
    ...card,
    image: { ...card.image, sources: [{ type: 'image/webp', src: 'https://index.hagicode.com/_astro/card.webp' }] },
  };
  assert.ok(getPromotionSetSignature([card]));
  assert.equal(getPromotionSetSignature([withChain]), getPromotionSetSignature([card]));
});

test('renders the tiers as a picture before the original and advances past a failed tier', async () => {
  const script = await readFile(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');
  const render = script.slice(script.indexOf('private renderCards'), script.indexOf('private updateSlides'));

  assert.match(render, /getPromotionImageSources\(card\.image\)/u);
  assert.match(render, /document\.createElement\('picture'\)/u);
  assert.match(render, /element\.srcset = source\.src;/u);
  assert.match(render, /picture\.append\(image\);/u);
  assert.match(render, /else \{\s*media\.append\(image\);/u);
  assert.match(render, /image\.addEventListener\('error', \(\) => advancePromotionImageSource\(image\)\)/u);
  assert.match(render, /image\.src = card\.image\.src;/u);

  assert.match(script, /function advancePromotionImageSource[\s\S]*?failed\.remove\(\)/u);
  assert.match(script, /sourceUrl\(source\) === image\.currentSrc/u);
});

test('the picture wrapper is laid out transparently inside the media frame', async () => {
  const component = await readFile(new URL('../packages/core/PromotoBanner.astro', import.meta.url), 'utf8');
  assert.match(component, /\.hagilight-promoto__media picture\s*\{[^}]*display:\s*contents/u);
});

test('the page-top state applies only through the fifth argument and keeps the four-argument states', () => {
  const signature = getPromotionSetSignature([fallback]);
  assert.equal(getPromotionVisibility([fallback], signature, null, false, true), 'top-hidden');
  assert.equal(getPromotionVisibility([fallback], signature, null, false, false), 'ready');
  assert.equal(getPromotionVisibility([fallback], signature, null, false), 'ready');
  assert.equal(getPromotionVisibility([fallback], signature, null, true, false), 'footer-hidden');
  assert.equal(getPromotionVisibility([fallback], signature, signature, false, false), 'dismissed');
  assert.equal(getPromotionVisibility([], null, null, false, false), 'hidden');
});

test('dismissal, an empty set and the footer each take precedence over the page top', () => {
  const signature = getPromotionSetSignature([fallback]);
  assert.equal(getPromotionVisibility([fallback], signature, signature, false, true), 'dismissed');
  assert.equal(getPromotionVisibility([], null, null, false, true), 'hidden');
  assert.equal(getPromotionVisibility([fallback], signature, null, true, true), 'footer-hidden');
});

test('a card hidden at the top does not rotate', () => {
  assert.equal(shouldAutoRotate(2, false, false, true, 'top-hidden'), false);
});

test('the top-of-page boundary includes scroll offsets of 1 px or less', () => {
  assert.equal(isScrolledToTop(0), true);
  assert.equal(isScrolledToTop(1), true);
  assert.equal(isScrolledToTop(1.5), false);
  assert.equal(isScrolledToTop(240), false);
});

test('the page-top rule applies to visits 1 through 30 only', () => {
  assert.equal(isPageTopRuleActive(0), true);
  assert.equal(isPageTopRuleActive(1), true);
  assert.equal(isPageTopRuleActive(30), true);
  assert.equal(isPageTopRuleActive(31), false);
  assert.equal(isPageTopRuleActive(1000), false);
});

test('parseVisitCount accepts only plain non-negative integers and reads anything else as 0', () => {
  for (const raw of [null, '', 'abc', '-1', '3.5', '1e3', ' 12', '9007199254740993']) {
    assert.equal(parseVisitCount(raw), 0, `raw ${JSON.stringify(raw)}`);
  }
  assert.equal(parseVisitCount('0'), 0);
  assert.equal(parseVisitCount('12'), 12);
  assert.equal(parseVisitCount('31'), 31);
});

test('the visit counter key is scoped to the hostname', () => {
  assert.notEqual(getVisitCountKey('docs.example.com'), getVisitCountKey('www.example.com'));
  assert.equal(getVisitCountKey('docs.example.com'), getVisitCountKey('docs.example.com'));
  assert.equal(getVisitCountKey('localhost'), 'hagilight:promoto-banner:visit-count:localhost');
});

const VISIT_EVENT = 'hagilight:promoto-visit';
const modulePath = new URL('../packages/core/dist/promoto-banner.js', import.meta.url).href;
let freshModuleCount = 0;

// Each import is a new module instance, so its per-document page memory starts empty.
async function loadFreshModule() {
  freshModuleCount += 1;
  return import(`${modulePath}?fresh=${freshModuleCount}`);
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

function withBrowser({ hostname = 'docs.example.com', pathname = '/', storage = createStorage() } = {}, run) {
  const events = [];
  const location = { hostname, pathname, search: '', hash: '' };
  globalThis.window = { location, localStorage: storage };
  globalThis.document = { dispatchEvent: (event) => { events.push(event.type); return true; } };
  try {
    return run({ location, events, storage });
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
}

test('recordSiteVisit counts each page once per document and dispatches the visit event', async () => {
  const firstDocument = await loadFreshModule();
  const reloadedDocument = await loadFreshModule();
  const key = getVisitCountKey('docs.example.com');
  const storage = createStorage();
  withBrowser({ storage }, ({ location, events }) => {
    assert.equal(firstDocument.recordSiteVisit(), 1);
    assert.equal(storage.values.get(key), '1');
    assert.equal(firstDocument.recordSiteVisit(), 1, 'the same page in the same document is not counted again');
    location.hash = '#pricing';
    assert.equal(firstDocument.recordSiteVisit(), 1, 'a hash change is not a visit');
    assert.deepEqual(events, [VISIT_EVENT]);
    location.pathname = '/guide';
    assert.equal(firstDocument.recordSiteVisit(), 2, 'a navigation to another page is a visit');
    assert.equal(reloadedDocument.recordSiteVisit(), 3, 'a reload of that page is one more visit');
    assert.equal(storage.values.get(key), '3');
  });
});

test('the stored count stops at 31 and later visits leave it unchanged', async () => {
  const key = getVisitCountKey('docs.example.com');
  const storage = createStorage({ [key]: '30' });
  const thirtyFirst = await loadFreshModule();
  const later = await loadFreshModule();
  withBrowser({ storage }, ({ location }) => {
    assert.equal(thirtyFirst.recordSiteVisit(), 31);
    location.pathname = '/later';
    assert.equal(thirtyFirst.recordSiteVisit(), 31);
    assert.equal(later.recordSiteVisit(), 31);
    assert.equal(storage.values.get(key), '31');
  });
});

test('each hostname keeps its own counter', async () => {
  const storage = createStorage();
  const localhost = await loadFreshModule();
  const loopback = await loadFreshModule();
  const localhostAgain = await loadFreshModule();
  withBrowser({ storage, hostname: 'localhost' }, () => assert.equal(localhost.recordSiteVisit(), 1));
  withBrowser({ storage, hostname: '127.0.0.1' }, () => assert.equal(loopback.recordSiteVisit(), 1));
  withBrowser({ storage, hostname: 'localhost', pathname: '/next' }, () => assert.equal(localhostAgain.recordSiteVisit(), 2));
  assert.equal(storage.values.get(getVisitCountKey('localhost')), '2');
  assert.equal(storage.values.get(getVisitCountKey('127.0.0.1')), '1');
});

test('a blocked or failing localStorage never throws, and a failed write keeps the stored count', async () => {
  const throwing = () => { throw new Error('storage blocked'); };
  const readBlocked = await loadFreshModule();
  withBrowser({ storage: { getItem: throwing, setItem: throwing } }, () => {
    assert.equal(readBlocked.recordSiteVisit(), 0);
    assert.equal(isPageTopRuleActive(0), true);
  });

  const writeBlocked = await loadFreshModule();
  withBrowser({ storage: { getItem: () => '5', setItem: throwing } }, () => {
    assert.equal(writeBlocked.recordSiteVisit(), 5);
  });
});

test('recordSiteVisit does nothing when reading the localStorage property itself throws', async () => {
  const { recordSiteVisit } = await loadFreshModule();
  globalThis.window = {
    location: { hostname: 'docs.example.com', pathname: '/', search: '', hash: '' },
    get localStorage() { throw new Error('access denied'); },
  };
  try {
    assert.equal(recordSiteVisit(), 0);
  } finally {
    delete globalThis.window;
  }
});

test('recordSiteVisit is a no-op without a window', async () => {
  const { recordSiteVisit } = await loadFreshModule();
  delete globalThis.window;
  assert.equal(recordSiteVisit(), 0);
});

test('updateVisibility feeds the page-top rule and inerts every state except ready', async () => {
  const source = await readFile(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');
  const update = source.slice(source.indexOf('private updateVisibility'), source.indexOf('private isFooterVisible'));
  assert.match(update, /isScrolledToTop\(window\.scrollY \?\? document\.documentElement\.scrollTop\)\s*&&\s*isPageTopRuleActive\(siteVisitCount\)/u);
  assert.match(update, /shell\.inert = state !== 'ready';/u);
});

test('visits are recorded on connect and on each Astro page load', async () => {
  const source = await readFile(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');
  const connected = source.slice(source.indexOf('connectedCallback(): void {'), source.indexOf('disconnectedCallback(): void {'));
  assert.ok(connected.indexOf('recordSiteVisit();') < connected.indexOf('void this.reload();'));
  assert.match(source, /private readonly onPageLoad = \(\) => \{\s*recordSiteVisit\(\);/u);
});

test('the Astro component styles hide the shell in the top-hidden state', async () => {
  const component = await readFile(new URL('../packages/core/PromotoBanner.astro', import.meta.url), 'utf8');
  assert.match(component, /\.hagilight-promoto\[data-state='top-hidden'\] \.hagilight-promoto__shell\s*\{[^}]*visibility:\s*hidden/u);
});
