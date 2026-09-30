import { locales } from './locales.js';
import type { TrailingSlash } from './not-found.js';

export interface LanguageOption {
  code: string;
  label: string;
  lang: string;
}

export interface ConfiguredLanguageOption extends LanguageOption {
  selected: boolean;
}

export type ConfiguredLocales = Readonly<Record<string, string | { label?: string; lang?: string } | undefined>>;

export const DEFAULT_LANGUAGE_OPTIONS: readonly LanguageOption[] = Object.entries(locales).map(([code, locale]) => ({
  code,
  label: locale.label,
  lang: locale.lang,
}));

const normalizeLang = (lang: string | undefined): string | undefined => lang?.replaceAll('_', '-').toLowerCase();

export function getConfiguredLanguageOptions(
  configuredLocales: ConfiguredLocales | undefined,
  currentLocale: string | undefined,
): ConfiguredLanguageOption[] {
  const catalog = DEFAULT_LANGUAGE_OPTIONS;
  return Object.entries(configuredLocales ?? {})
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
    .map(({ catalogOrder: _catalogOrder, ...option }) => option);
}

export function getKeyboardTargetIndex(index: number, key: string, count: number): number {
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
  currentUrl: string | URL,
  targetLocale: string,
  configuredLocales: readonly string[],
  basePath: string = '/',
  trailingSlash: TrailingSlash = 'ignore',
): URL {
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

export function persistStarlightLocaleSelection(locale: string): void {
  try {
    const storedValue = window.localStorage.getItem('starlight-route');
    let routePreference: Record<string, unknown> = {};
    if (storedValue) {
      try {
        const parsed: unknown = JSON.parse(storedValue);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          routePreference = parsed as Record<string, unknown>;
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
