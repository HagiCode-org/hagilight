import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import hagilight from '@hagicode/hagilight-starlight';
import {
  RANDOM_THEME_IDS,
  RANDOM_THEME_STORAGE_KEY,
  STARLIGHT_THEME_STORAGE_KEY,
  THEME_BOOTSTRAP,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  applyThemeChoice,
  assignedRandomThemeId,
  getThemePickerLabels,
  parseThemeChoice,
  readStoredThemeChoice,
  resolveThemeId,
  splitThemeChoice,
} from '../packages/starlight/dist/themes.js';

const themesCss = readFileSync(
  fileURLToPath(new URL('../packages/starlight/themes.css', import.meta.url)),
  'utf8',
);

function withEnvironment(stored, run) {
  const store = new Map(Object.entries(stored ?? {}));
  const previous = {
    localStorage: globalThis.localStorage,
    document: globalThis.document,
    random: Math.random,
  };
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  };
  globalThis.document = { documentElement: { dataset: {} } };
  try {
    return run({ store, root: globalThis.document.documentElement });
  } finally {
    if (previous.localStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous.localStorage;
    if (previous.document === undefined) delete globalThis.document;
    else globalThis.document = previous.document;
    Math.random = previous.random;
  }
}

function stubRandom(sequence) {
  let index = 0;
  Math.random = () => sequence[index % sequence.length] ?? 0;
}

function configure(options = {}, components = {}) {
  const updated = {};
  hagilight(options).hooks['config:setup']({
    astroConfig: { site: 'https://example.com/', base: '/' },
    config: { components, head: [] },
    updateConfig: (value) => Object.assign(updated, value),
    addIntegration: () => {},
  });
  return updated;
}

test('offers exactly nine choices: default plus four themes in light and dark', () => {
  assert.deepEqual([...THEME_CHOICES], [
    'default',
    'default-light',
    'default-dark',
    'ocean-light',
    'ocean-dark',
    'sakura-light',
    'sakura-dark',
    'forest-light',
    'forest-dark',
  ]);
});

test('parseThemeChoice falls back to default for unknown values', () => {
  assert.equal(parseThemeChoice('ocean-dark'), 'ocean-dark');
  for (const invalid of [undefined, null, '', 'night', 'default-neon', 42]) {
    assert.equal(parseThemeChoice(invalid), 'default');
  }
});

test('splitThemeChoice exposes the theme and the forced mode', () => {
  assert.deepEqual(splitThemeChoice('default'), { themeId: 'default' });
  assert.deepEqual(splitThemeChoice('default-light'), { themeId: 'default', mode: 'light' });
  assert.deepEqual(splitThemeChoice('forest-dark'), { themeId: 'forest', mode: 'dark' });
});

test('assignedRandomThemeId picks one of the extra themes and keeps it stable per user', () => {
  withEnvironment({}, () => {
    stubRandom([0.999]);
    const first = assignedRandomThemeId();
    assert.equal(first, 'forest');
    stubRandom([0]);
    assert.equal(assignedRandomThemeId(), 'forest', 'must reuse the persisted assignment');
  });

  withEnvironment({ [RANDOM_THEME_STORAGE_KEY]: 'moon' }, () => {
    stubRandom([0.5]);
    assert.equal(assignedRandomThemeId(), 'sakura', 'must replace an invalid assignment');
  });
});

test('resolveThemeId maps default choices to the random assignment and others to their theme', () => {
  withEnvironment({ [RANDOM_THEME_STORAGE_KEY]: 'sakura' }, () => {
    assert.equal(resolveThemeId('default'), 'sakura');
    assert.equal(resolveThemeId('default-light'), 'default');
    assert.equal(resolveThemeId('ocean-dark'), 'ocean');
  });
});

test('applyThemeChoice persists the choice and keeps Starlight mode storage in sync', () => {
  withEnvironment({ [RANDOM_THEME_STORAGE_KEY]: 'ocean' }, ({ root, store }) => {
    applyThemeChoice('default-dark', root);
    assert.equal(root.dataset.hagilightTheme, 'default');
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(store.get(THEME_STORAGE_KEY), 'default-dark');
    assert.equal(store.get(STARLIGHT_THEME_STORAGE_KEY), 'dark');
  });

  withEnvironment({}, ({ root, store }) => {
    stubRandom([0.25]);
    applyThemeChoice('default', root);
    assert.equal(root.dataset.hagilightTheme, 'ocean', 'default choice renders the assigned random theme');
    assert.equal(root.dataset.theme, undefined, 'default choice leaves mode to system preference');
    assert.equal(store.get(THEME_STORAGE_KEY), 'default');
    assert.equal(store.get(STARLIGHT_THEME_STORAGE_KEY), '');
  });
});

test('readStoredThemeChoice falls back to default when storage is missing or invalid', () => {
  withEnvironment({}, ({ root }) => {
    assert.equal(readStoredThemeChoice(), 'default');
    applyThemeChoice('sakura-light', root);
    assert.equal(readStoredThemeChoice(), 'sakura-light');
  });
  withEnvironment({ [THEME_STORAGE_KEY]: 'sunset-light' }, () => {
    assert.equal(readStoredThemeChoice(), 'default');
  });
});

test('the pre-paint bootstrap script applies stored choices without touching mode', () => {
  withEnvironment({ [THEME_STORAGE_KEY]: 'forest-light' }, ({ root }) => {
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'forest');
  });

  withEnvironment({}, ({ root, store }) => {
    stubRandom([0.75]);
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'forest');
    assert.equal(store.get(RANDOM_THEME_STORAGE_KEY), 'forest');
    assert.equal(root.dataset.theme, undefined, 'bootstrap must not pin a light/dark mode');
  });

  withEnvironment({ [THEME_STORAGE_KEY]: 'neon-dark' }, ({ root }) => {
    stubRandom([0]);
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'ocean', 'invalid choices fall back to the default experience');
  });

  withEnvironment({ [RANDOM_THEME_STORAGE_KEY]: 'sakura' }, ({ root }) => {
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'sakura', 'repeat visits keep the assigned theme');
  });
});

test('picker labels exist for every HagiCode locale and fall back to English', () => {
  const localeKeys = ['en-US', 'zh-CN', 'zh-Hant', 'fr-FR', 'de-DE', 'es-ES', 'ja-JP', 'ko-KR', 'pt-BR', 'ru-RU'];
  for (const key of localeKeys) {
    const labels = getThemePickerLabels(key);
    for (const field of ['defaultOption', 'defaultThemeGroup']) {
      assert.equal(typeof labels[field], 'string');
      assert.notEqual(labels[field], '');
    }
    for (const theme of ['ocean', 'sakura', 'forest']) {
      assert.equal(typeof labels.themes[theme], 'string');
      assert.notEqual(labels.themes[theme], '');
    }
  }
  assert.equal(getThemePickerLabels('zh-CN').themes.sakura, '樱花');
  assert.equal(getThemePickerLabels('zh-Hant').themes.sakura, '櫻花');
  assert.equal(getThemePickerLabels('zh-TW').themes.ocean, '海洋', 'prefix match falls back to a Chinese locale');
  assert.equal(getThemePickerLabels('en').defaultOption, 'Default');
  assert.equal(getThemePickerLabels(undefined).defaultOption, 'Default');
  assert.equal(getThemePickerLabels('xx-YY').defaultThemeGroup, 'Default theme');
});

test('themes.css defines dark and light palettes for every extra theme', () => {
  for (const theme of RANDOM_THEME_IDS) {
    for (const dark of [true, false]) {
      const scope = dark
        ? `:root[data-hagilight-theme='${theme}']:not([data-theme='light'])`
        : `:root[data-hagilight-theme='${theme}'][data-theme='light']`;
      const blockStart = themesCss.indexOf(scope);
      assert.notEqual(blockStart, -1, `missing ${dark ? 'dark' : 'light'} palette for ${theme}`);
      const blockEnd = themesCss.indexOf('}', blockStart);
      const block = themesCss.slice(blockStart, blockEnd);
      for (const variable of ['--sl-color-accent:', '--sl-color-gray-6:', '--sl-hue-blue:']) {
        assert.ok(block.includes(variable), `${scope} must define ${variable}`);
      }
    }
  }
  assert.ok(!themesCss.includes("data-hagilight-theme='default'"), 'the default theme must stay Starlight');
});

test('registers the theme picker, palette styles, and bootstrap script by default', () => {
  const updated = configure({ analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } } });
  assert.match(updated.components.ThemeSelect, /[\\/]ThemeSelect\.astro$/);
  assert.ok(updated.customCss.includes(fileURLToPath(new URL('../packages/starlight/themes.css', import.meta.url))));
  const bootstrap = updated.head.find((entry) => entry.tag === 'script' && entry.content?.includes(THEME_STORAGE_KEY));
  assert.ok(bootstrap, 'the head must include the theme bootstrap script');
  assert.match(bootstrap.content, /document\.documentElement\.dataset\.hagilightTheme/);
});

test('keeps a consumer ThemeSelect when the picker is disabled', () => {
  const updated = configure(
    {
      analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } },
      themes: { enabled: false },
    },
    { ThemeSelect: './CustomThemeSelect.astro' },
  );
  assert.equal(updated.components.ThemeSelect, './CustomThemeSelect.astro');
  assert.ok(!updated.customCss.some((path) => String(path).endsWith('themes.css')));
  assert.ok(!updated.head.some((entry) => entry.tag === 'script' && entry.content?.includes(THEME_STORAGE_KEY)));
});

test('rejects a consumer ThemeSelect override unless the picker is disabled', () => {
  assert.throws(
    () => configure({ analytics: { googleAnalytics: { enabled: false }, fiftyOneLa: { enabled: false } } }, { ThemeSelect: './CustomThemeSelect.astro' }),
    /existing Starlight ThemeSelect override.*themes: \{ enabled: false \}/,
  );
});
