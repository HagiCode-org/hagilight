/**
 * A minimal stand-in for the page parts the locale monitor touches: the `[data-locale-monitor]` panel with its five
 * rows, `document.cookie`, `localStorage`, `navigator.languages` and `location`. Writes are recorded, not applied.
 */
const ROW_KEYS = ['query', 'stored', 'browser', 'default', 'shared'];

function createRow(key) {
  const value = { textContent: '' };
  const verdict = { textContent: '' };
  return {
    key,
    dataset: { state: 'idle' },
    value,
    verdict,
    querySelector(selector) {
      if (selector === '[data-locale-value]') return value;
      if (selector === '[data-locale-verdict]') return verdict;
      return null;
    },
  };
}

export function localeMonitorFake({
  href = 'https://docs.hagicode.com/',
  languages = ['de-AT'],
  storage = {},
  failStorage = false,
  cookie = '',
  cookieMode = 'write',
  sharedDomain = 'hagicode.com',
} = {}) {
  const url = new URL(href);
  const rows = Object.fromEntries(ROW_KEYS.map((key) => [key, createRow(key)]));
  const storageWrites = [];
  const cookieWrites = [];
  const panel = {
    dataset: { sharedDomain: sharedDomain ?? '' },
    querySelector(selector) {
      const match = /^\[data-locale-trace="(\w+)"\]$/u.exec(selector);
      return match ? rows[match[1]] ?? null : null;
    },
  };
  const localStorage = {
    getItem(key) {
      if (failStorage) throw new DOMException('Storage is blocked', 'SecurityError');
      return Object.hasOwn(storage, key) ? storage[key] : null;
    },
    setItem(key, value) {
      if (failStorage) throw new DOMException('Storage is blocked', 'SecurityError');
      storageWrites.push([key, value]);
      storage[key] = value;
    },
  };
  const doc = {
    querySelector: (selector) => (selector === '[data-locale-monitor]' ? panel : null),
    get cookie() {
      return cookie;
    },
    set cookie(value) {
      if (cookieMode === 'block') return;
      if (cookieMode === 'throw') throw new DOMException('Cookies are blocked', 'SecurityError');
      cookieWrites.push(value);
    },
  };
  return {
    win: {
      location: { href: url.href, search: url.search, hostname: url.hostname },
      localStorage,
      navigator: { languages },
    },
    doc,
    panel,
    rows,
    storage,
    storageWrites,
    cookieWrites,
  };
}

/** The visible text of each monitor row, keyed by row. */
export function rowTexts(rows) {
  return Object.fromEntries(Object.entries(rows).map(([key, row]) => [key, row.value.textContent]));
}

/** The keys of rows carrying the detected mark. */
export function detectedRows(rows) {
  return Object.values(rows).filter((row) => row.verdict.textContent === 'detected').map((row) => row.key);
}
