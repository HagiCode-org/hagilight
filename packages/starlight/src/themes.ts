/**
 * Hagilight theme picker: four themes (the Starlight default plus Ocean, Sakura, and Forest),
 * each with a light and a dark appearance, plus a "default" choice that applies the site
 * default experience. The palette in use is exposed to CSS through the
 * `data-hagilight-theme` attribute on `<html>`; light/dark mode keeps using Starlight's
 * `data-theme` attribute and `starlight-theme` storage so Starlight's pre-paint script
 * continues to apply the correct mode.
 */

export type ThemeId = 'default' | 'ocean' | 'sakura' | 'forest';

export type ThemeMode = 'light' | 'dark';

export type ThemeChoice =
  | 'default'
  | 'default-light'
  | 'default-dark'
  | 'ocean-light'
  | 'ocean-dark'
  | 'sakura-light'
  | 'sakura-dark'
  | 'forest-light'
  | 'forest-dark';

/** Themes a first-visit user is randomly assigned while the "default" choice is selected. */
export const RANDOM_THEME_IDS = ['ocean', 'sakura', 'forest'] as const;

export const DEFAULT_THEME_CHOICE: ThemeChoice = 'default';

export const THEME_CHOICES = [
  'default',
  'default-light',
  'default-dark',
  'ocean-light',
  'ocean-dark',
  'sakura-light',
  'sakura-dark',
  'forest-light',
  'forest-dark',
] as const satisfies readonly ThemeChoice[];

export const THEME_STORAGE_KEY = 'hagilight-theme';
export const RANDOM_THEME_STORAGE_KEY = 'hagilight-theme-random';
/** Starlight's own storage key; kept in sync with the picker so its pre-paint script applies the right mode. */
export const STARLIGHT_THEME_STORAGE_KEY = 'starlight-theme';

const RANDOM_THEME_ID_SET: ReadonlySet<string> = new Set(RANDOM_THEME_IDS);
const THEME_CHOICE_SET: ReadonlySet<unknown> = new Set(THEME_CHOICES);

export function parseThemeChoice(value: unknown): ThemeChoice {
  return THEME_CHOICE_SET.has(value) ? value as ThemeChoice : DEFAULT_THEME_CHOICE;
}

export function splitThemeChoice(choice: ThemeChoice): { themeId: ThemeId; mode?: ThemeMode } {
  if (choice === DEFAULT_THEME_CHOICE) return { themeId: 'default' };
  const separator = choice.lastIndexOf('-');
  return {
    themeId: choice.slice(0, separator) as ThemeId,
    mode: choice.slice(separator + 1) as ThemeMode,
  };
}

function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    return;
  }
}

/** The theme randomly assigned to this user, picking and persisting one on the first visit. */
export function assignedRandomThemeId(): ThemeId {
  let stored = readStorage(RANDOM_THEME_STORAGE_KEY);
  if (stored === null || !RANDOM_THEME_ID_SET.has(stored)) {
    stored = RANDOM_THEME_IDS[Math.floor(Math.random() * RANDOM_THEME_IDS.length)];
    writeStorage(RANDOM_THEME_STORAGE_KEY, stored);
  }
  return stored as ThemeId;
}

/** The theme id a choice renders as: the theme itself, or the user's random assignment for "default". */
export function resolveThemeId(choice: ThemeChoice): ThemeId {
  const { themeId, mode } = splitThemeChoice(choice);
  return mode === undefined ? assignedRandomThemeId() : themeId;
}

export function readStoredThemeChoice(): ThemeChoice {
  return parseThemeChoice(readStorage(THEME_STORAGE_KEY));
}

/** Apply a choice to the document, persist it, and keep Starlight's mode storage in sync. */
export function applyThemeChoice(
  choice: ThemeChoice,
  root: HTMLElement = document.documentElement,
): void {
  const { mode } = splitThemeChoice(choice);
  root.dataset.hagilightTheme = resolveThemeId(choice);
  if (mode !== undefined) root.dataset.theme = mode;
  writeStorage(THEME_STORAGE_KEY, choice);
  writeStorage(STARLIGHT_THEME_STORAGE_KEY, mode ?? '');
}

/**
 * Inline pre-paint bootstrap run from `<head>`: it must stay dependency-free because it
 * executes before any module script. Keep the behavior identical to `applyThemeChoice`.
 */
export const THEME_BOOTSTRAP = `(function () {
  var choices = ${JSON.stringify(THEME_CHOICES)};
  var randomThemes = ${JSON.stringify(RANDOM_THEME_IDS)};
  var choiceKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  var randomKey = ${JSON.stringify(RANDOM_THEME_STORAGE_KEY)};
  var choice = 'default';
  try {
    var stored = localStorage.getItem(choiceKey);
    if (choices.includes(stored)) choice = stored;
  } catch (error) {}
  var themeId;
  if (choice === 'default') {
    try {
      themeId = localStorage.getItem(randomKey);
      if (!randomThemes.includes(themeId)) themeId = null;
    } catch (error) {
      themeId = null;
    }
    if (!themeId) {
      themeId = randomThemes[Math.floor(Math.random() * randomThemes.length)];
      try {
        localStorage.setItem(randomKey, themeId);
      } catch (error) {}
    }
  } else {
    themeId = choice.slice(0, choice.lastIndexOf('-'));
  }
  document.documentElement.dataset.hagilightTheme = themeId;
})();`;

export interface ThemePickerLabels {
  /** Label of the "default" choice: site default experience with an automatically assigned theme. */
  defaultOption: string;
  /** Label of the option group holding the built-in theme's light and dark appearances. */
  defaultThemeGroup: string;
  themes: Record<Exclude<ThemeId, 'default'>, string>;
}

const labels: Record<string, ThemePickerLabels> = {
  'de-de': {
    defaultOption: 'Standard',
    defaultThemeGroup: 'Standard-Design',
    themes: { ocean: 'Ozean', sakura: 'Sakura', forest: 'Wald' },
  },
  'en-us': {
    defaultOption: 'Default',
    defaultThemeGroup: 'Default theme',
    themes: { ocean: 'Ocean', sakura: 'Sakura', forest: 'Forest' },
  },
  'es-es': {
    defaultOption: 'Predeterminado',
    defaultThemeGroup: 'Tema predeterminado',
    themes: { ocean: 'Océano', sakura: 'Sakura', forest: 'Bosque' },
  },
  'fr-fr': {
    defaultOption: 'Par défaut',
    defaultThemeGroup: 'Thème par défaut',
    themes: { ocean: 'Océan', sakura: 'Sakura', forest: 'Forêt' },
  },
  'ja-jp': {
    defaultOption: 'デフォルト',
    defaultThemeGroup: 'デフォルトテーマ',
    themes: { ocean: '海', sakura: '桜', forest: '森' },
  },
  'ko-kr': {
    defaultOption: '기본값',
    defaultThemeGroup: '기본 테마',
    themes: { ocean: '바다', sakura: '벚꽃', forest: '숲' },
  },
  'pt-br': {
    defaultOption: 'Padrão',
    defaultThemeGroup: 'Tema padrão',
    themes: { ocean: 'Oceano', sakura: 'Sakura', forest: 'Floresta' },
  },
  'ru-ru': {
    defaultOption: 'По умолчанию',
    defaultThemeGroup: 'Стандартная тема',
    themes: { ocean: 'Океан', sakura: 'Сакура', forest: 'Лес' },
  },
  'zh-cn': {
    defaultOption: '默认',
    defaultThemeGroup: '默认主题',
    themes: { ocean: '海洋', sakura: '樱花', forest: '森林' },
  },
  'zh-hant': {
    defaultOption: '預設',
    defaultThemeGroup: '預設主題',
    themes: { ocean: '海洋', sakura: '櫻花', forest: '森林' },
  },
};

const enLabels = labels['en-us']!;

export function getThemePickerLabels(lang: string | undefined): ThemePickerLabels {
  if (lang !== undefined) {
    const key = lang.toLowerCase();
    const exact = labels[key];
    if (exact) return exact;
    const prefix = key.split('-')[0];
    const prefixed = Object.entries(labels).find(([id]) => id.split('-')[0] === prefix);
    if (prefixed) return prefixed[1];
  }
  return enLabels;
}
