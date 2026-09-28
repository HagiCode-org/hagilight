import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  buildLocaleNavigationTarget,
  DEFAULT_LANGUAGE_OPTIONS,
  getConfiguredLanguageOptions,
  getKeyboardTargetIndex,
  persistStarlightLocaleSelection,
} from '../packages/starlight/language-routing.mjs';
import { locales } from '@hagicode/hagilight-starlight/locales';

const tenLocales = Object.fromEntries(DEFAULT_LANGUAGE_OPTIONS.map(({ code, label, lang }) => [
  code,
  { label, lang },
]));

test('publishes the example locale map in route order with its labels and language tags', () => {
  assert.deepEqual(Object.entries(locales), [
    ['root', { label: 'English', lang: 'en-US' }],
    ['zh-CN', { label: '简体中文', lang: 'zh-CN' }],
    ['zh-Hant', { label: '繁體中文', lang: 'zh-Hant' }],
    ['fr-FR', { label: 'Français', lang: 'fr-FR' }],
    ['de-DE', { label: 'Deutsch', lang: 'de-DE' }],
    ['es-ES', { label: 'Español (España)', lang: 'es-ES' }],
    ['ja-JP', { label: '日本語', lang: 'ja-JP' }],
    ['ko-KR', { label: '한국어', lang: 'ko-KR' }],
    ['pt-BR', { label: 'Português (Brasil)', lang: 'pt-BR' }],
    ['ru-RU', { label: 'Русский', lang: 'ru-RU' }],
  ]);
  assert.deepEqual(DEFAULT_LANGUAGE_OPTIONS.map(({ code }) => code), Object.keys(locales));
});

test('offers the ten native labels in Docs catalog order for a fully configured site', () => {
  const options = getConfiguredLanguageOptions(tenLocales, 'root');

  assert.deepEqual(options.map(({ label }) => label), [
    'English',
    '简体中文',
    '繁體中文',
    'Français',
    'Deutsch',
    'Español (España)',
    '日本語',
    '한국어',
    'Português (Brasil)',
    'Русский',
  ]);
  assert.equal(options.filter(({ selected }) => selected).length, 1);
});

test('matches existing en-US routes without replacing site labels', () => {
  const sharedRoute = getConfiguredLanguageOptions({
    root: locales.root,
  }, 'root');
  const existingRoute = getConfiguredLanguageOptions({
    'en-US': { label: 'English (US)', lang: 'en-US' },
  }, 'en-US');

  assert.deepEqual(sharedRoute.map(({ code, label, lang, selected }) => ({
    code, label, lang, selected,
  })), [{
    code: 'root',
    label: 'English',
    lang: 'en-US',
    selected: true,
  }]);
  assert.deepEqual(existingRoute.map(({ code, label, lang, selected }) => ({
    code, label, lang, selected,
  })), [{
    code: 'en-US',
    label: 'English (US)',
    lang: 'en-US',
    selected: true,
  }]);
});

test('filters to configured routes and appends additional site locales', () => {
  const subset = getConfiguredLanguageOptions({
    root: { label: '简体中文', lang: 'zh-CN' },
    'fr-FR': { label: 'French custom', lang: 'fr-FR' },
  }, 'root');
  const single = getConfiguredLanguageOptions({
    root: { label: '简体中文', lang: 'zh-CN' },
  }, 'root');
  const withExtra = getConfiguredLanguageOptions({
    'it-IT': { label: 'Italiano', lang: 'it-IT' },
    'en-US': { label: 'English', lang: 'en-US' },
    root: { label: '简体中文', lang: 'zh-CN' },
  }, 'en-US');

  assert.deepEqual(subset.map(({ code }) => code), ['root', 'fr-FR']);
  assert.equal(subset[1].label, 'French custom');
  assert.deepEqual(single.map(({ code }) => code), ['root']);
  assert.deepEqual(withExtra.map(({ code }) => code), ['en-US', 'root', 'it-IT']);
  assert.equal(withExtra[0].label, 'English');
});

test('selects English at root and navigates to the configured Chinese route', () => {
  const rootOptions = getConfiguredLanguageOptions(locales, 'root');
  const chineseOptions = getConfiguredLanguageOptions(locales, 'zh-CN');
  const toChinese = buildLocaleNavigationTarget(
    'https://example.test/docs/guide/',
    'zh-CN',
    Object.keys(locales),
    '/docs/',
  );
  const toEnglish = buildLocaleNavigationTarget(
    'https://example.test/docs/zh-CN/guide/',
    'root',
    Object.keys(locales),
    '/docs/',
  );

  assert.equal(rootOptions.find(({ code }) => code === 'root')?.selected, true);
  assert.equal(chineseOptions.find(({ code }) => code === 'zh-CN')?.selected, true);
  assert.equal(chineseOptions.find(({ code }) => code === 'zh-CN')?.label, '简体中文');
  assert.equal(toChinese.pathname, '/docs/zh-CN/guide/');
  assert.equal(toEnglish.pathname, '/docs/guide/');
});

test('preserves mixed-case locale route keys', () => {
  const toTraditionalChinese = buildLocaleNavigationTarget(
    'https://example.test/docs/guide/',
    'zh-Hant',
    Object.keys(locales),
    '/docs/',
  );
  const backToEnglish = buildLocaleNavigationTarget(
    'https://example.test/docs/zh-Hant/guide/',
    'root',
    Object.keys(locales),
    '/docs/',
  );

  assert.equal(toTraditionalChinese.pathname, '/docs/zh-Hant/guide/');
  assert.equal(backToEnglish.pathname, '/docs/guide/');
});

test('builds equivalent locale URLs with base paths, root routes, queries and fragments', () => {
  const rootToFrench = buildLocaleNavigationTarget(
    'https://example.test/docs/guide/nested/?tab=pricing#install',
    'fr-FR',
    Object.keys(tenLocales),
    '/docs/',
  );
  const frenchToRoot = buildLocaleNavigationTarget(
    'https://example.test/docs/fr-FR/guide/nested/?tab=pricing#install',
    'root',
    Object.keys(tenLocales),
    '/docs/',
  );

  assert.equal(rootToFrench.pathname, '/docs/fr-FR/guide/nested/');
  assert.equal(rootToFrench.search, '?tab=pricing');
  assert.equal(rootToFrench.hash, '#install');
  assert.equal(frenchToRoot.pathname, '/docs/guide/nested/');
  assert.equal(frenchToRoot.search, '?tab=pricing');
  assert.equal(frenchToRoot.hash, '#install');
});

test('handles generated html routes and trailing-slash settings', () => {
  const languageRoot = buildLocaleNavigationTarget(
    'https://example.test/docs/zh-CN.html?view=full#top',
    'zh-Hant',
    Object.keys(tenLocales),
    '/docs/',
  );
  const defaultRoot = buildLocaleNavigationTarget(
    'https://example.test/docs/fr-FR.html',
    'root',
    Object.keys(tenLocales),
    '/docs/',
  );
  const noTrailingSlash = buildLocaleNavigationTarget(
    'https://example.test/docs/zh-CN/guide/',
    'fr-FR',
    Object.keys(tenLocales),
    '/docs/',
    'never',
  );

  assert.equal(languageRoot.pathname, '/docs/zh-Hant.html');
  assert.equal(defaultRoot.pathname, '/docs/index.html');
  assert.equal(noTrailingSlash.pathname, '/docs/fr-FR/guide');
});

test('supports keyboard option movement and boundary keys', () => {
  assert.equal(getKeyboardTargetIndex(0, 'ArrowLeft', 10), 9);
  assert.equal(getKeyboardTargetIndex(9, 'ArrowRight', 10), 0);
  assert.equal(getKeyboardTargetIndex(4, 'ArrowDown', 10), 5);
  assert.equal(getKeyboardTargetIndex(4, 'ArrowUp', 10), 3);
  assert.equal(getKeyboardTargetIndex(4, 'Home', 10), 0);
  assert.equal(getKeyboardTargetIndex(4, 'End', 10), 9);
  assert.equal(getKeyboardTargetIndex(4, 'Tab', 10), 4);
});

test('persists the selected locale while preserving preference fields', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map([['starlight-route', JSON.stringify({
    path: '/guide/',
    lang: 'en-US',
    version: 'latest',
  })]]);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    },
  });

  try {
    persistStarlightLocaleSelection('zh-CN');
    assert.deepEqual(JSON.parse(values.get('starlight-route')), {
      path: '/guide/',
      lang: 'zh-CN',
      version: 'latest',
    });
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
});

test('continues to allow locale navigation when storage is unavailable', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem() {
          throw new Error('blocked');
        },
        setItem() {
          throw new Error('blocked');
        },
      },
    },
  });

  try {
    assert.doesNotThrow(() => persistStarlightLocaleSelection('fr-FR'));
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  }
});

test('chooser uses native dialog semantics, keyboard focus, and dismiss behavior', async () => {
  const component = await readFile(
    new URL('../packages/starlight/LanguageChooser.astro', import.meta.url),
    'utf8',
  );

  assert.match(component, /id="hagilight-language-dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /dialog\.showModal\(\)/);
  assert.match(component, /dialog\.addEventListener\('cancel'/);
  assert.match(component, /trigger\.focus\(\)/);
  assert.match(component, /getKeyboardTargetIndex/);
  assert.match(component, /persistStarlightLocaleSelection\(locale\)/);
  assert.match(component, /target\.search = window\.location\.search/);
  assert.match(component, /target\.hash = window\.location\.hash/);
  assert.match(component, /window\.location\.assign\(target\.toString\(\)\)/);
});
