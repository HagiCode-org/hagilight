import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  getAIDisclosureCopy,
  getSourcePath,
  isTranslationLocale,
  resolveAIDisclosureFlags,
} from '../packages/starlight/ai-disclosures.mjs';
import {
  restoreContentWidth,
  setContentWidth,
  synchronizeContentWidthFromStorage,
  STORAGE_KEY,
} from '../packages/starlight/content-width.mjs';

function createRoot() {
  const buttons = ['wide', 'narrow'].map((mode) => ({
    dataset: { hagilightContentWidthChoice: mode },
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  }));
  return {
    dataset: {},
    buttons,
    querySelectorAll: () => buttons,
  };
}

function withStorage(storage, callback) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    callback();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
}

test('AI flags inherit independently and explicit false overrides each site default', () => {
  assert.deepEqual(resolveAIDisclosureFlags({}, {
    isAITranslation: true,
    isAIAuthor: true,
  }), {
    isAITranslation: true,
    isAIAuthor: true,
  });
  assert.deepEqual(resolveAIDisclosureFlags({
    isAITranslation: false,
  }, {
    isAITranslation: true,
    isAIAuthor: true,
  }), {
    isAITranslation: false,
    isAIAuthor: true,
  });
  assert.throws(
    () => resolveAIDisclosureFlags({ isAIAuthor: 'yes' }, { isAITranslation: false, isAIAuthor: false }),
    /frontmatter isAIAuthor must be a boolean/,
  );
});

test('translation disclosures omit the source locale and link only to an existing base-aware source page', () => {
  assert.equal(isTranslationLocale(undefined, 'root'), false);
  assert.equal(isTranslationLocale('en-US', 'root'), true);

  const existingDocs = [{ id: 'guide' }];
  assert.equal(getSourcePath({
    docs: existingDocs,
    routeId: 'fr/guide',
    currentLocale: 'fr',
    sourceLocale: 'root',
    pathname: '/docs/fr/guide/',
    baseUrl: '/docs/',
  }), '/docs/guide/');
  assert.equal(getSourcePath({
    docs: [{ id: 'index' }],
    routeId: 'zh-cn/index',
    currentLocale: 'zh-cn',
    sourceLocale: 'root',
    pathname: '/zh-cn/',
    baseUrl: '/',
  }), '/');
  assert.equal(isTranslationLocale('zh-CN', 'root'), true);
  assert.equal(getSourcePath({
    docs: [{ id: 'en-US/guide' }],
    routeId: 'guide',
    currentLocale: undefined,
    sourceLocale: 'en-US',
    pathname: '/docs/guide/',
    baseUrl: '/docs/',
  }), '/docs/en-US/guide/');
  assert.equal(getSourcePath({
    docs: [{ id: 'guide' }],
    routeId: 'fr/guide',
    currentLocale: 'fr',
    sourceLocale: 'root',
    pathname: '/fr/guide/',
    baseUrl: '/docs/',
  }), '/docs/guide/');
  assert.equal(getSourcePath({
    docs: [],
    routeId: 'fr/missing',
    currentLocale: 'fr',
    sourceLocale: 'root',
    pathname: '/docs/fr/missing/',
    baseUrl: '/docs/',
  }), undefined);
});

test('AI notice copy uses available locales and falls back to English', () => {
  assert.equal(getAIDisclosureCopy('zh-CN').translation, '本文由 AI 翻译。');
  assert.equal(getAIDisclosureCopy('fr-FR').source, 'Voir la source');
  assert.equal(getAIDisclosureCopy('it-IT').source, 'View source');
});

test('content-width restoration defaults wide and restores only valid saved values', () => {
  const root = createRoot();
  withStorage({ getItem: () => null }, () => {
    assert.equal(restoreContentWidth(root), 'wide');
  });
  assert.equal(root.dataset.hagilightContentWidth, 'wide');
  assert.equal(root.buttons[0].attributes['aria-pressed'], 'true');
  assert.equal(root.buttons[1].attributes['aria-pressed'], 'false');

  withStorage({ getItem: () => 'narrow' }, () => {
    assert.equal(restoreContentWidth(root), 'narrow');
  });
  assert.equal(root.buttons[0].attributes['aria-pressed'], 'false');
  assert.equal(root.buttons[1].attributes['aria-pressed'], 'true');

  withStorage({ getItem: () => 'unexpected' }, () => {
    assert.equal(restoreContentWidth(root), 'wide');
  });
  withStorage({
    getItem() {
      throw new Error('storage blocked');
    },
  }, () => {
    assert.equal(restoreContentWidth(root), 'wide');
  });
});

test('content-width changes update pressed states immediately and tolerate unavailable storage', () => {
  const root = createRoot();
  withStorage({
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      assert.equal(value, 'narrow');
      throw new Error('storage blocked');
    },
  }, () => {
    assert.doesNotThrow(() => setContentWidth('narrow', root));
  });
  assert.equal(root.dataset.hagilightContentWidth, 'narrow');
  assert.equal(root.buttons[0].attributes['aria-pressed'], 'false');
  assert.equal(root.buttons[1].attributes['aria-pressed'], 'true');
  assert.throws(() => setContentWidth('invalid', root), /must be "wide" or "narrow"/);
});

test('storage changes synchronize other tabs and ignore unrelated keys', () => {
  const root = createRoot();
  synchronizeContentWidthFromStorage({ key: STORAGE_KEY, newValue: 'narrow' }, root);
  assert.equal(root.dataset.hagilightContentWidth, 'narrow');
  synchronizeContentWidthFromStorage({ key: 'other-key', newValue: 'wide' }, root);
  assert.equal(root.dataset.hagilightContentWidth, 'narrow');
  synchronizeContentWidthFromStorage({ key: STORAGE_KEY, newValue: 'invalid' }, root);
  assert.equal(root.dataset.hagilightContentWidth, 'wide');
});

test('width control uses labelled pressed-state buttons and is desktop-only', async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL('../packages/starlight/ContentLayoutToggle.astro', import.meta.url), 'utf8'),
    readFile(new URL('../packages/starlight/content-width.css', import.meta.url), 'utf8'),
  ]);
  assert.match(component, /role="group"/);
  assert.match(component, /aria-label=\{labels\.group\}/);
  assert.equal((component.match(/aria-pressed=/gu) ?? []).length, 2);
  assert.match(styles, /@media \(min-width: 50em\)/);
  assert.match(styles, /@media \(max-width: 49\.999em\)/);
  assert.match(styles, /:root\[data-hagilight-content-width='wide'\]/);
});
