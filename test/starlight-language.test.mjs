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

const tenLocales = Object.fromEntries(DEFAULT_LANGUAGE_OPTIONS.map(({ code, label, lang }) => [
  code,
  { label, lang },
]));

test('offers the ten native labels in Docs catalog order for a fully configured site', () => {
  const options = getConfiguredLanguageOptions(tenLocales, 'en-US');

  assert.deepEqual(options.map(({ label }) => label), [
    '简体中文',
    'English',
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

test('filters to configured routes and appends additional site locales', () => {
  const subset = getConfiguredLanguageOptions({
    root: { label: '简体中文', lang: 'zh-CN' },
    'fr-FR': { label: 'Français', lang: 'fr-FR' },
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
  assert.deepEqual(single.map(({ code }) => code), ['root']);
  assert.deepEqual(withExtra.map(({ code }) => code), ['root', 'en-US', 'it-IT']);
  assert.equal(withExtra[0].label, '简体中文');
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
    'https://example.test/docs/en-US.html?view=full#top',
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
    'https://example.test/docs/en-US/guide/',
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
    persistStarlightLocaleSelection('fr-FR');
    assert.deepEqual(JSON.parse(values.get('starlight-route')), {
      path: '/guide/',
      lang: 'fr-FR',
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
