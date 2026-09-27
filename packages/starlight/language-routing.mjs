export const DEFAULT_LANGUAGE_OPTIONS = [
  { code: 'root', label: '简体中文', lang: 'zh-CN' },
  { code: 'en-US', label: 'English', lang: 'en-US' },
  { code: 'zh-Hant', label: '繁體中文', lang: 'zh-Hant' },
  { code: 'fr-FR', label: 'Français', lang: 'fr-FR' },
  { code: 'de-DE', label: 'Deutsch', lang: 'de-DE' },
  { code: 'es-ES', label: 'Español (España)', lang: 'es-ES' },
  { code: 'ja-JP', label: '日本語', lang: 'ja-JP' },
  { code: 'ko-KR', label: '한국어', lang: 'ko-KR' },
  { code: 'pt-BR', label: 'Português (Brasil)', lang: 'pt-BR' },
  { code: 'ru-RU', label: 'Русский', lang: 'ru-RU' },
];

const normalizeLang = (lang) => lang?.replaceAll('_', '-').toLowerCase();

export function getConfiguredLanguageOptions(locales, currentLocale) {
  const catalog = DEFAULT_LANGUAGE_OPTIONS;
  return Object.entries(locales ?? {})
    .map(([code, locale]) => {
      const lang = typeof locale === 'string' ? locale : locale?.lang ?? code;
      const catalogEntry = catalog.find((entry) =>
        entry.code === code || normalizeLang(entry.lang) === normalizeLang(lang),
      );
      return {
        code,
        label: typeof locale === 'object' && locale?.label
          ? locale.label
          : catalogEntry?.label ?? code,
        lang,
        selected: code === currentLocale,
        catalogOrder: catalogEntry ? catalog.indexOf(catalogEntry) : catalog.length,
      };
    })
    .sort((left, right) => left.catalogOrder - right.catalogOrder)
    .map(({ catalogOrder, ...option }) => option);
}

export function getKeyboardTargetIndex(index, key, count) {
  if (count < 1) return -1;
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowUp':
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return index;
  }
}

export function buildLocaleNavigationTarget(
  currentUrl,
  targetLocale,
  configuredLocales,
  basePath = '/',
  trailingSlash = 'ignore',
) {
  const targetUrl = new URL(currentUrl);
  const base = basePath.replace(/\/+$/u, '');
  const hasBase = base === ''
    ? true
    : targetUrl.pathname === base || targetUrl.pathname.startsWith(`${base}/`);
  let pathname = hasBase ? targetUrl.pathname.slice(base.length) || '/' : targetUrl.pathname;
  const [, firstSegment = '', remainder = ''] = pathname.match(/^\/([^/]*)(.*)$/u) ?? [];
  const isHtmlRoute = firstSegment.endsWith('.html');
  const currentSlug = isHtmlRoute ? firstSegment.slice(0, -5) : firstSegment;
  const currentLocale = configuredLocales.find((locale) => locale !== 'root' && locale === currentSlug);

  if (currentLocale) {
    if (targetLocale === 'root') {
      pathname = isHtmlRoute ? '/index.html' : remainder || '/';
    } else {
      pathname = `/${targetLocale}${isHtmlRoute ? '.html' : remainder}`;
    }
  } else if (targetLocale !== 'root') {
    pathname = firstSegment === 'index.html'
      ? `/${targetLocale}.html`
      : `/${targetLocale}${pathname}`;
  }

  targetUrl.pathname = `${hasBase ? base : ''}${pathname}` || '/';
  if (trailingSlash === 'never') {
    targetUrl.pathname = targetUrl.pathname.replace(/\/+$/u, '') || '/';
  }
  return targetUrl;
}

export function persistStarlightLocaleSelection(locale) {
  try {
    const storedValue = window.localStorage.getItem('starlight-route');
    let routePreference = {};
    if (storedValue) {
      try {
        const parsed = JSON.parse(storedValue);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          routePreference = parsed;
        }
      } catch {
        routePreference = {};
      }
    }
    window.localStorage.setItem(
      'starlight-route',
      JSON.stringify({ ...routePreference, lang: locale }),
    );
  } catch {
    // Language navigation must remain available when browser storage is blocked.
  }
}
