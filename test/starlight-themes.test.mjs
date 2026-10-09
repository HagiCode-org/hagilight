import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import hagilight from '@hagicode/hagilight-starlight';
import {
  DEFAULT_PALETTE_THEME_ID,
  EXTRA_THEME_IDS,
  STARLIGHT_THEME_STORAGE_KEY,
  THEME_BOOTSTRAP,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  applyThemeChoice,
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

/** Key an earlier version used to persist a randomly assigned theme; it must now be ignored and never written. */
const LEGACY_RANDOM_THEME_KEY = 'hagilight-theme-random';

const unavailableStorage = {
  getItem: () => {
    throw new Error('storage unavailable');
  },
  setItem: () => {
    throw new Error('storage unavailable');
  },
};

/** Runs `run` with fake storage and document; `Math.random` throws so any random lookup fails the test. */
function withEnvironment(stored, run, storage) {
  const store = new Map(Object.entries(stored ?? {}));
  const previous = {
    localStorage: globalThis.localStorage,
    document: globalThis.document,
    random: Math.random,
  };
  globalThis.localStorage = storage ?? {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  };
  globalThis.document = { documentElement: { dataset: {} } };
  Math.random = () => {
    throw new Error('the theme picker must not consult Math.random');
  };
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

test('the default choice renders the Forest palette', () => {
  assert.equal(DEFAULT_PALETTE_THEME_ID, 'forest');
  assert.deepEqual([...EXTRA_THEME_IDS], ['ocean', 'sakura', 'forest']);
});

test('resolveThemeId maps the default choice to Forest and others to their own theme', () => {
  withEnvironment({}, () => {
    assert.equal(resolveThemeId('default'), 'forest');
    assert.equal(resolveThemeId('default-light'), 'default');
    assert.equal(resolveThemeId('ocean-dark'), 'ocean');
    assert.equal(resolveThemeId('forest-light'), 'forest');
  });

  withEnvironment({ [LEGACY_RANDOM_THEME_KEY]: 'sakura' }, ({ store }) => {
    assert.equal(resolveThemeId('default'), 'forest', 'a legacy random assignment must be ignored');
    assert.equal(store.get(LEGACY_RANDOM_THEME_KEY), 'sakura', 'the legacy value is left untouched');
  });
});

test('applyThemeChoice persists the choice and keeps Starlight mode storage in sync', () => {
  withEnvironment({ [LEGACY_RANDOM_THEME_KEY]: 'ocean' }, ({ root, store }) => {
    applyThemeChoice('default-dark', root);
    assert.equal(root.dataset.hagilightTheme, 'default');
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(store.get(THEME_STORAGE_KEY), 'default-dark');
    assert.equal(store.get(STARLIGHT_THEME_STORAGE_KEY), 'dark');
  });

  withEnvironment({}, ({ root, store }) => {
    applyThemeChoice('default', root);
    assert.equal(root.dataset.hagilightTheme, 'forest', 'default choice renders Forest');
    assert.equal(root.dataset.theme, undefined, 'default choice leaves mode to system preference');
    assert.equal(store.get(THEME_STORAGE_KEY), 'default');
    assert.equal(store.get(STARLIGHT_THEME_STORAGE_KEY), '');
    assert.ok(!store.has(LEGACY_RANDOM_THEME_KEY), 'default choice must not write a random assignment');
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

test('the pre-paint bootstrap script renders Forest by default and applies stored choices without touching mode', () => {
  withEnvironment({}, ({ root, store }) => {
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'forest', 'first visit renders Forest');
    assert.equal(root.dataset.theme, undefined, 'bootstrap must not pin a light/dark mode');
    assert.equal(store.size, 0, 'bootstrap must not write to storage');
  });

  withEnvironment({ [THEME_STORAGE_KEY]: 'forest-light' }, ({ root }) => {
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'forest');
  });

  withEnvironment({ [THEME_STORAGE_KEY]: 'sakura-dark' }, ({ root }) => {
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'sakura', 'an explicit choice keeps its theme');
  });

  withEnvironment({ [THEME_STORAGE_KEY]: 'neon-dark' }, ({ root }) => {
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'forest', 'invalid choices fall back to Forest');
  });

  withEnvironment({ [LEGACY_RANDOM_THEME_KEY]: 'sakura' }, ({ root }) => {
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'forest', 'a legacy random assignment is ignored');
  });

  withEnvironment({ [LEGACY_RANDOM_THEME_KEY]: 'sakura', [THEME_STORAGE_KEY]: 'ocean-light' }, ({ root }) => {
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'ocean', 'an explicit choice wins over a legacy assignment');
  });
});

test('the pre-paint bootstrap script and runtime agree on the first-visit theme', () => {
  const bootstrapped = withEnvironment({}, ({ root }) => {
    new Function(THEME_BOOTSTRAP)();
    return root.dataset.hagilightTheme;
  });
  const applied = withEnvironment({}, ({ root }) => {
    applyThemeChoice(readStoredThemeChoice(), root);
    return root.dataset.hagilightTheme;
  });
  assert.equal(bootstrapped, applied);
  assert.equal(bootstrapped, DEFAULT_PALETTE_THEME_ID);
});

test('Forest stays the default when browser storage is unavailable', () => {
  withEnvironment({}, ({ root }) => {
    new Function(THEME_BOOTSTRAP)();
    assert.equal(root.dataset.hagilightTheme, 'forest');
    assert.equal(resolveThemeId('default'), 'forest');
    assert.equal(readStoredThemeChoice(), 'default');
    assert.doesNotThrow(() => applyThemeChoice('default', root));
    assert.equal(root.dataset.hagilightTheme, 'forest');
  }, unavailableStorage);
});

test('the bootstrap script source never consults Math.random or the legacy key', () => {
  assert.ok(!THEME_BOOTSTRAP.includes('Math.random'));
  assert.ok(!THEME_BOOTSTRAP.includes(LEGACY_RANDOM_THEME_KEY));
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
  for (const theme of EXTRA_THEME_IDS) {
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
