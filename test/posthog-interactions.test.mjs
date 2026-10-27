import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PROMOTION_IMPRESSION_DWELL_MS,
  PROMOTION_IMPRESSION_THRESHOLD,
  installPostHogInteractions,
  installPromotionImpression,
  normalizeCodeLanguage,
  observePromotionImpression,
  promotionVariantOf,
  readResultsCount,
  sanitizeSearchQuery,
} from '@hagicode/hagilight-core/posthog-interactions';

/*
 * Fake DOM and timers. Selectors match by exact string, so a test fails if the code uses a different
 * selector than the one the element was built with. Real selectors are checked by the browser step (task 3.1, 6.2).
 */

/** A selector list ("a, b") matches when any member matches, as in the browser. */
function matchesSelector(selectors, selector) {
  return selector.split(',').some((part) => selectors.includes(part.trim()));
}

class FakeElement {
  constructor({ selectors = [], attributes = {}, text = '', value, children = [] } = {}) {
    this.selectors = selectors;
    this.attributes = attributes;
    this.textContent = text;
    this.value = value;
    this.parent = null;
    this.children = [];
    for (const child of children) this.append(child);
  }

  append(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  closest(selector) {
    for (let node = this; node; node = node.parent) {
      if (matchesSelector(node.selectors, selector)) return node;
    }
    return null;
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child.selectors, selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class FakeDocument {
  constructor({ lang = 'en-US', pageType } = {}) {
    this.documentElement = { lang };
    this.listeners = {};
    this.root = new FakeElement({ selectors: ['html'] });
    this.pageType = pageType;
  }

  addEventListener(type, listener, options) {
    (this.listeners[type] ??= []).push({ listener, options });
  }

  querySelector(selector) {
    if (selector === 'meta[name="hagilight:page-type"]' && this.pageType) {
      return new FakeElement({ attributes: { content: this.pageType } });
    }
    return this.root.querySelector(selector);
  }

  dispatch(type, target) {
    const event = {
      type,
      target,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
    };
    for (const { listener } of this.listeners[type] ?? []) listener(event);
    return event;
  }
}

/** Timers that fire only when the test advances the clock. */
function fakeTimers() {
  let now = 0;
  let seq = 0;
  const queue = [];
  return {
    setTimeout(callback, ms) {
      const timer = { at: now + ms, callback, id: ++seq, cancelled: false, done: false };
      queue.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.cancelled = true;
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = queue
          .filter((timer) => !timer.cancelled && !timer.done && timer.at <= end)
          .sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!next) break;
        next.done = true;
        now = next.at;
        next.callback();
      }
      now = end;
    },
  };
}

function fakeSdk({ optedOut = false, loaded = true, throws = false } = {}) {
  const calls = [];
  return {
    calls,
    __loaded: loaded,
    capture(name, properties, options) {
      if (throws) throw new Error('boom');
      calls.push({ name, properties, options });
    },
    has_opted_out_capturing() { return optedOut; },
  };
}

/**
 * A Pagefind search dialog, shaped like the default UI: while loading the message reads "Searching" and the
 * results list is absent; once settled the message holds the total and the list holds the rendered links.
 */
function searchDialog({ value, message = '', links = 0, loading = false }) {
  const field = new FakeElement({ selectors: ['.pagefind-ui__search-input'], value });
  const root = new FakeElement({ selectors: ['.pagefind-ui'], children: [field] });
  if (loading) {
    root.append(new FakeElement({ selectors: ['.pagefind-ui__message'], text: 'Searching' }));
  } else {
    settle(root, message, links);
  }
  return { root, field, links: root.querySelectorAll('a.pagefind-ui__result-link') };
}

/** Replaces the loading state with a settled message and list, as Pagefind does when a search finishes. */
function settle(root, message, links) {
  root.children = root.children.filter((node) => node.selectors.includes('.pagefind-ui__search-input'));
  root.append(new FakeElement({ selectors: ['.pagefind-ui__message'], text: message }));
  root.append(new FakeElement({
    selectors: ['.pagefind-ui__results'],
    children: Array.from({ length: links }, (_, index) => new FakeElement({
      selectors: ['a.pagefind-ui__result-link'],
      attributes: { href: `/docs/result-${index + 1}/` },
    })),
  }));
}

/** `posthog: null` means no PostHog global on the page; omitting it gives a healthy fake SDK. */
function setup({ lang = 'en-US', pathname = '/docs/', config, posthog, pageType } = {}) {
  const doc = new FakeDocument({ lang, pageType });
  const timers = fakeTimers();
  const sdk = posthog === undefined ? fakeSdk() : posthog;
  installPostHogInteractions(doc, {
    timers,
    posthog: () => sdk ?? undefined,
    config: () => config,
    pathname: () => pathname,
  });
  return { doc, timers, sdk };
}

function typeInto(doc, timers, field, value) {
  field.value = value;
  doc.dispatch('input', field);
  return timers;
}

test('one search_used fires 800 ms after the last keystroke, with the final query length and count', () => {
  const { doc, timers, sdk } = setup();
  const dialog = searchDialog({ value: '', message: '12 results', links: 12 });
  typeInto(doc, timers, dialog.field, 'docs');
  timers.advance(799);
  assert.equal(sdk.calls.length, 0);
  timers.advance(1);
  assert.equal(sdk.calls.length, 1);
  assert.equal(sdk.calls[0].name, 'search_used');
  assert.deepEqual(sdk.calls[0].properties, { query_length: 4, results_count: 12, locale: 'en-US' });
  assert.deepEqual(sdk.calls[0].options, { transport: 'sendBeacon' });
});

test('typing again inside the window cancels the earlier wait, so only the last query is reported', () => {
  const { doc, timers, sdk } = setup();
  const dialog = searchDialog({ value: '', message: '3 results', links: 3 });
  typeInto(doc, timers, dialog.field, 'do');
  timers.advance(500);
  typeInto(doc, timers, dialog.field, 'docs');
  timers.advance(799);
  assert.equal(sdk.calls.length, 0);
  timers.advance(1);
  assert.equal(sdk.calls.length, 1);
  assert.equal(sdk.calls[0].properties.query_length, 4);
});

test('an empty or whitespace-only query sends nothing', () => {
  const { doc, timers, sdk } = setup();
  const dialog = searchDialog({ value: '', message: '', links: 0 });
  typeInto(doc, timers, dialog.field, '   ');
  timers.advance(5000);
  assert.deepEqual(sdk.calls, []);
});

test('a search with no results sends results_count 0 and, by default, no search text', () => {
  const { doc, timers, sdk } = setup();
  const dialog = searchDialog({ value: '', message: 'No results for "secretword"' });
  typeInto(doc, timers, dialog.field, 'secretword');
  timers.advance(800);
  assert.deepEqual(sdk.calls[0].properties, { query_length: 10, results_count: 0, locale: 'en-US' });
  assert.doesNotMatch(JSON.stringify(sdk.calls), /secretword/u);
});

test('zero-results adds the query only when the count is 0', () => {
  const zero = setup({ config: { searchQuery: 'zero-results' } });
  const zeroDialog = searchDialog({ value: '', message: 'No results' });
  typeInto(zero.doc, zero.timers, zeroDialog.field, 'install guide');
  zero.timers.advance(800);
  assert.equal(zero.sdk.calls[0].properties.query, 'install guide');

  const found = setup({ config: { searchQuery: 'zero-results' } });
  const foundDialog = searchDialog({ value: '', message: '2 results', links: 2 });
  typeInto(found.doc, found.timers, foundDialog.field, 'install guide');
  found.timers.advance(800);
  assert.equal('query' in found.sdk.calls[0].properties, false);
});

test('off sends no query even when the count is 0', () => {
  const { doc, timers, sdk } = setup({ config: { searchQuery: 'off' } });
  const dialog = searchDialog({ value: '', message: 'No results' });
  typeInto(doc, timers, dialog.field, 'install guide');
  timers.advance(800);
  assert.equal('query' in sdk.calls[0].properties, false);
});

test('a suspicious zero-result query is withheld while the rest of the event is still sent', () => {
  const { doc, timers, sdk } = setup({ config: { searchQuery: 'zero-results' } });
  const dialog = searchDialog({ value: '', message: 'No results' });
  typeInto(doc, timers, dialog.field, 'C:/Users/me/key');
  timers.advance(800);
  assert.deepEqual(sdk.calls[0].properties, { query_length: 15, results_count: 0, locale: 'en-US' });
});

test('the wait for settled results polls, reports once Pagefind renders the list, and sends nothing on timeout', () => {
  const waiting = setup();
  const dialog = searchDialog({ value: '', loading: true });
  typeInto(waiting.doc, waiting.timers, dialog.field, 'api');
  waiting.timers.advance(800);
  assert.equal(waiting.sdk.calls.length, 0, 'still searching at 800 ms');
  settle(dialog.root, '4 results', 4);
  waiting.timers.advance(100);
  assert.equal(waiting.sdk.calls.length, 1);
  assert.equal(waiting.sdk.calls[0].properties.results_count, 4);

  const stuck = setup();
  const never = searchDialog({ value: '', loading: true });
  typeInto(stuck.doc, stuck.timers, never.field, 'api');
  stuck.timers.advance(800 + 2000 + 500);
  assert.deepEqual(stuck.sdk.calls, []);
});

test('a loading message with no number is never read as zero results', () => {
  const { doc, timers, sdk } = setup();
  const dialog = searchDialog({ value: '', loading: true });
  typeInto(doc, timers, dialog.field, 'api');
  timers.advance(2800);
  assert.deepEqual(sdk.calls, []);
});

test('grouped totals (1,234) are read whole', () => {
  const dialog = searchDialog({ value: '', message: '1,234 results for "api"', links: 5 });
  assert.equal(readResultsCount(dialog.root, 'api'), 1234);
});

test('an unreadable count (links rendered but no number in the message) sends nothing', () => {
  const { doc, timers, sdk } = setup();
  const dialog = searchDialog({ value: '', message: 'Searching', links: 2 });
  typeInto(doc, timers, dialog.field, 'api');
  timers.advance(800);
  assert.deepEqual(sdk.calls, []);
});

test('digits the visitor typed are not counted as results', () => {
  const { doc, timers, sdk } = setup();
  const dialog = searchDialog({ value: '', message: '2026: 3 results', links: 3 });
  typeInto(doc, timers, dialog.field, '2026');
  timers.advance(800);
  assert.equal(sdk.calls[0].properties.results_count, 3);
});

test('a result click reports its 1-based rank and the displayed total, without preventing navigation', () => {
  const { doc, timers, sdk } = setup();
  const dialog = searchDialog({ value: 'api', message: '12 results', links: 12 });
  const third = dialog.links[2];
  const event = doc.dispatch('click', third);
  assert.deepEqual(sdk.calls, [{
    name: 'search_result_clicked',
    properties: { rank: 3, results_count: 12 },
    options: { transport: 'sendBeacon' },
  }]);
  assert.equal(event.defaultPrevented, false);
  assert.equal(event.propagationStopped, false);
});

test('clicks elsewhere in the search dialog send no result event', () => {
  const { doc, sdk } = setup();
  const dialog = searchDialog({ value: 'api', message: '12 results', links: 12 });
  doc.dispatch('click', dialog.root.children[1]);
  assert.deepEqual(sdk.calls, []);
});

function codeBlock({ kind, canary }) {
  if (kind === 'starlight') {
    const pre = new FakeElement({ selectors: ['pre'], attributes: { 'data-language': 'bash' } });
    const button = new FakeElement({ selectors: ['.expressive-code .copy button'], attributes: { 'data-code': canary } });
    const frame = new FakeElement({ selectors: ['.expressive-code'], children: [pre, new FakeElement({ selectors: ['.copy'], children: [button] })] });
    return { button, block: frame };
  }
  const pre = new FakeElement({ selectors: ['pre'], attributes: { class: 'prism-code language-js' }, text: canary });
  const button = new FakeElement({ selectors: ['.theme-code-block button[class*="copyButton"]'], attributes: { class: 'clean-btn copyButton_x' } });
  const block = new FakeElement({ selectors: ['.theme-code-block'], attributes: { class: 'language-js theme-code-block' }, children: [pre, button] });
  return { button, block };
}

test('a Starlight install-page copy reports its language, page type and install flag, never the code', () => {
  const canary = 'CANARY_CODE_9f8e7d6c5b4a';
  const { doc, sdk } = setup({ pathname: '/installation/docker/', lang: 'en-US' });
  const { button, block } = codeBlock({ kind: 'starlight', canary });
  doc.root.append(block);
  doc.dispatch('click', button);
  assert.deepEqual(sdk.calls, [{
    name: 'code_copied',
    properties: { language: 'bash', page_type: 'docs', is_install_page: true },
    options: { transport: 'sendBeacon' },
  }]);
  assert.doesNotMatch(JSON.stringify(sdk.calls), new RegExp(canary, 'u'));
});

test('a Docusaurus copy takes the language from the language-* class and the page type from the meta element', () => {
  const canary = 'CANARY_DOCUSAURUS_1a2b3c4d5e';
  const { doc, sdk } = setup({ pathname: '/blog/post/', lang: 'en', pageType: 'blog' });
  const { button, block } = codeBlock({ kind: 'docusaurus', canary });
  doc.root.append(block);
  doc.dispatch('click', button);
  assert.deepEqual(sdk.calls[0].properties, { language: 'js', page_type: 'blog', is_install_page: false });
  assert.doesNotMatch(JSON.stringify(sdk.calls), new RegExp(canary, 'u'));
});

test('a block without a declared language, or a hostile one, reports unknown', () => {
  assert.equal(normalizeCodeLanguage(undefined), 'unknown');
  assert.equal(normalizeCodeLanguage(''), 'unknown');
  assert.equal(normalizeCodeLanguage('<script>'), 'unknown');
  assert.equal(normalizeCodeLanguage('Bash'), 'bash');
  const { doc, sdk } = setup();
  const pre = new FakeElement({ selectors: ['pre'] });
  const button = new FakeElement({ selectors: ['.expressive-code .copy button'] });
  doc.root.append(new FakeElement({ selectors: ['.expressive-code'], children: [pre, button] }));
  doc.dispatch('click', button);
  assert.equal(sdk.calls[0].properties.language, 'unknown');
});

test('a Docusaurus locale link reports the change, and the current language reports nothing', () => {
  const { doc, sdk } = setup({ lang: 'en-US' });
  const navbar = new FakeElement({ selectors: ['.navbar'] });
  const zh = new FakeElement({ selectors: ['.navbar a[hreflang]'], attributes: { hreflang: 'zh-CN', href: '/zh-CN/' } });
  const en = new FakeElement({ selectors: ['.navbar a[hreflang]'], attributes: { hreflang: 'en-US', href: '/' } });
  navbar.append(zh);
  navbar.append(en);
  doc.root.append(navbar);
  const zhEvent = doc.dispatch('click', zh);
  doc.dispatch('click', en);
  assert.deepEqual(sdk.calls, [{
    name: 'locale_changed',
    properties: { from: 'en-US', to: 'zh-CN' },
    options: { transport: 'sendBeacon' },
  }]);
  assert.equal(zhEvent.defaultPrevented, false);
});

test('a Docusaurus locale dropdown item, rendered with lang rather than hreflang, reports the same change', () => {
  const { doc, sdk } = setup({ lang: 'en-US' });
  const navbar = new FakeElement({ selectors: ['.navbar'] });
  const zh = new FakeElement({ selectors: ['.navbar a[hreflang]', '.navbar a[lang]'], attributes: { lang: 'zh-CN', href: '/zh-CN/' } });
  navbar.append(zh);
  doc.root.append(navbar);
  doc.dispatch('click', zh);
  assert.deepEqual(sdk.calls.map((call) => call.properties), [{ from: 'en-US', to: 'zh-CN' }]);
});

test('the observers install once per document', () => {
  const doc = new FakeDocument();
  assert.equal(installPostHogInteractions(doc, { timers: fakeTimers(), posthog: () => undefined }), true);
  assert.equal(installPostHogInteractions(doc, { timers: fakeTimers(), posthog: () => undefined }), false);
  assert.equal(doc.listeners.input.length, 1);
  assert.equal(doc.listeners.click.length, 1);
});

test('no event is sent without PostHog, when opted out, or when PostHog throws, and nothing is thrown into the page', () => {
  const absent = setup({ posthog: null });
  const dialog = searchDialog({ value: '', message: '1 result', links: 1 });
  typeInto(absent.doc, absent.timers, dialog.field, 'api');
  assert.doesNotThrow(() => absent.timers.advance(800));

  const opted = setup({ posthog: fakeSdk({ optedOut: true, loaded: true }) });
  typeInto(opted.doc, opted.timers, dialog.field, 'api');
  opted.timers.advance(800);
  assert.deepEqual(opted.sdk.calls, []);

  const throwing = setup({ posthog: fakeSdk({ throws: true }) });
  typeInto(throwing.doc, throwing.timers, dialog.field, 'api');
  assert.doesNotThrow(() => throwing.timers.advance(800));
  assert.doesNotThrow(() => throwing.doc.dispatch('click', dialog.links[0]));
});

test('readResultsCount and sanitizeSearchQuery handle the edge cases the spec names', () => {
  const dialog = searchDialog({ value: 'x', message: '', links: 0 });
  assert.equal(readResultsCount(dialog.root, 'x'), 0);

  assert.equal(sanitizeSearchQuery('install guide'), 'install guide');
  assert.equal(sanitizeSearchQuery('0123456789abcdef'), undefined, 'hex run of 16');
  assert.equal(sanitizeSearchQuery('see /etc/passwd'), undefined, 'path separator');
  assert.equal(sanitizeSearchQuery('https://example.org'), undefined, 'URL scheme');
  assert.equal(sanitizeSearchQuery('~/notes'), undefined, 'leading tilde');
  assert.equal(sanitizeSearchQuery('phc_abcdef'), undefined, 'known prefix');
  assert.equal(sanitizeSearchQuery('bearer token'), undefined, 'bearer prefix');
  assert.equal(sanitizeSearchQuery('abcdefghijklmnopqrstuvwxyz'), undefined, 'key-like token of 26');
  assert.equal(sanitizeSearchQuery('me@example.org'), undefined, 'email-like token');
  assert.equal(sanitizeSearchQuery('   '), undefined);

  assert.equal(sanitizeSearchQuery(`${'word '.repeat(20)}sk-secret`), undefined, 'secret after code point 64');
  assert.equal(sanitizeSearchQuery('word '.repeat(20)), 'word '.repeat(20).slice(0, 64), 'long safe text is truncated');

  const multiByte = '搜'.repeat(70);
  assert.equal(sanitizeSearchQuery(multiByte), '搜'.repeat(64), 'truncates on a code point');
});

/** An IntersectionObserver double: the test decides what the page sees and when. */
class FakeIntersectionObserver {
  static instances = [];
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.targets = [];
    this.disconnected = false;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target) { this.targets.push(target); }
  disconnect() { this.disconnected = true; }
  see(isIntersecting, intersectionRatio) {
    this.callback([{ isIntersecting, intersectionRatio }]);
  }
}

function promotionCard(src) {
  const fan = src === undefined ? [] : [new FakeElement({
    selectors: ['.hagilight-fan__card[data-slot="1"]'],
    attributes: { src },
  })];
  return new FakeElement({ selectors: ['.hagilight-article-promotion'], children: fan });
}

function promotionEnv(timers, sdk, pathname = '/blog/launch/') {
  return {
    timers,
    posthog: () => sdk,
    pathname: () => pathname,
    IntersectionObserver: FakeIntersectionObserver,
  };
}

test('the promotion card reports once after one continuous second with at least half visible', () => {
  FakeIntersectionObserver.instances = [];
  const timers = fakeTimers();
  const sdk = fakeSdk();
  const card = promotionCard('https://cdn.example/cat-heads/pool-7.avif?v=2');
  assert.equal(observePromotionImpression(card, promotionEnv(timers, sdk)), true);
  const [observer] = FakeIntersectionObserver.instances;
  assert.equal(observer.options.threshold, PROMOTION_IMPRESSION_THRESHOLD);
  assert.equal(PROMOTION_IMPRESSION_THRESHOLD, 0.5);
  observer.see(true, 0.6);
  timers.advance(PROMOTION_IMPRESSION_DWELL_MS - 1);
  assert.deepEqual(sdk.calls, []);
  timers.advance(1);
  assert.deepEqual(sdk.calls, [{
    name: 'article_promotion_impression',
    properties: { variant: 'pool-7', path: '/blog/launch/' },
    options: { transport: 'sendBeacon' },
  }]);
  assert.equal(observer.disconnected, true);
});

test('a card scrolled past within a second, or never half visible, sends nothing', () => {
  FakeIntersectionObserver.instances = [];
  const timers = fakeTimers();
  const sdk = fakeSdk();
  observePromotionImpression(promotionCard('/x/pool-1.avif'), promotionEnv(timers, sdk));
  const [observer] = FakeIntersectionObserver.instances;
  observer.see(true, 0.9);
  timers.advance(500);
  observer.see(false, 0);
  timers.advance(5000);
  assert.deepEqual(sdk.calls, []);
  observer.see(true, 0.3);
  timers.advance(5000);
  assert.deepEqual(sdk.calls, [], 'below half visible never starts the timer');
});

test('a card that re-enters after the event sends no second event for the page view', () => {
  FakeIntersectionObserver.instances = [];
  const timers = fakeTimers();
  const sdk = fakeSdk();
  observePromotionImpression(promotionCard('/x/pool-2.avif'), promotionEnv(timers, sdk));
  const [observer] = FakeIntersectionObserver.instances;
  observer.see(true, 1);
  timers.advance(PROMOTION_IMPRESSION_DWELL_MS);
  observer.see(false, 0);
  observer.see(true, 1);
  timers.advance(10000);
  assert.equal(sdk.calls.length, 1);
});

test('a card without a dealt fan reports the default variant, and no observer means no event', () => {
  assert.equal(promotionVariantOf(promotionCard(undefined)), 'default');
  assert.equal(promotionVariantOf(promotionCard('/x/Not Valid.avif')), 'default');
  FakeIntersectionObserver.instances = [];
  const timers = fakeTimers();
  const sdk = fakeSdk();
  observePromotionImpression(promotionCard(undefined), promotionEnv(timers, sdk));
  FakeIntersectionObserver.instances[0].see(true, 1);
  timers.advance(2000);
  assert.equal(sdk.calls[0].properties.variant, 'default');

  const none = fakeTimers();
  assert.equal(observePromotionImpression(promotionCard(undefined), { ...promotionEnv(none, sdk), IntersectionObserver: undefined }), false);
});

test('installPromotionImpression observes the page card once it exists', () => {
  FakeIntersectionObserver.instances = [];
  const doc = new FakeDocument();
  doc.root.append(promotionCard('/x/pool-3.avif'));
  const original = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = FakeIntersectionObserver;
  try {
    assert.equal(installPromotionImpression(doc), true);
  } finally {
    globalThis.IntersectionObserver = original;
  }
  assert.equal(FakeIntersectionObserver.instances.length, 1);
  assert.equal(installPromotionImpression(new FakeDocument()), false);
});
