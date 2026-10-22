/**
 * Locale monitor resolver. The input order and the normalization rules are copied from the official site:
 * `traceSiteEntryLocale()` in repos/site/src/lib/site-entry-locale.ts and `normalizeSiteLocale()` in
 * repos/site/src/i18n/locale-metadata.ts. The parity cases in test/root-transit-locale.test.mjs pin the two together.
 * Nothing here selects a route: the result only reports which input the monitor would pick.
 */

export const SITE_LOCALES = [
  { code: 'en-US', aliases: ['en', 'en-us'] },
  { code: 'zh-CN', aliases: ['zh', 'zh-cn', 'zh-hans', 'zh-sg'] },
  { code: 'zh-Hant', aliases: ['zh-hant', 'zh-tw', 'zh-hk', 'zh-mo'] },
  { code: 'ja-JP', aliases: ['ja', 'ja-jp'] },
  { code: 'ko-KR', aliases: ['ko', 'ko-kr'] },
  { code: 'de-DE', aliases: ['de', 'de-de'] },
  { code: 'fr-FR', aliases: ['fr', 'fr-fr'] },
  { code: 'es-ES', aliases: ['es', 'es-es'] },
  { code: 'pt-BR', aliases: ['pt', 'pt-br'] },
  { code: 'ru-RU', aliases: ['ru', 'ru-ru'] },
] as const;

export type SiteLocale = (typeof SITE_LOCALES)[number]['code'];

export const SITE_LOCALE_CODES: readonly SiteLocale[] = SITE_LOCALES.map((locale) => locale.code);
export const DEFAULT_LOCALE: SiteLocale = 'en-US';
export const SITE_LOCALE_STORAGE_KEY = 'hagicode:site-locale';
export const LEGACY_SITE_LOCALE_STORAGE_KEY = 'lang';

/** Which input decided the locale, in the order the official page consults them. */
export type LocaleSource = 'query' | 'stored' | 'browser' | 'default';

export interface LocaleInputEvidence {
  /** The value that decided this input, or the first value read when none was supported; null when nothing was read. */
  raw: string | null;
  /** The supported locale that `raw` resolves to, or null. */
  locale: SiteLocale | null;
}

export interface LocaleResolutionOptions {
  requestedLang?: string | null;
  storedLocale?: string | null;
  legacyStoredLocale?: string | null;
  clientLanguages?: readonly (string | null | undefined)[] | null;
}

export interface LocaleResolution {
  locale: SiteLocale;
  source: LocaleSource;
  evidence: {
    query: LocaleInputEvidence;
    stored: LocaleInputEvidence;
    browser: LocaleInputEvidence;
  };
}

const LOCALE_BY_INPUT = new Map<string, SiteLocale>();
const LOCALE_BY_LANGUAGE = new Map<string, SiteLocale>();
for (const { code, aliases } of SITE_LOCALES) {
  LOCALE_BY_INPUT.set(code.toLowerCase(), code);
  for (const alias of aliases) LOCALE_BY_INPUT.set(canonicalLocale(alias).toLowerCase(), code);
  // Later entries overwrite earlier ones, as in the official map: a bare language resolves to its last locale.
  LOCALE_BY_LANGUAGE.set(code.split('-')[0].toLowerCase(), code);
}

function canonicalLocale(locale: string): string {
  const candidate = locale.trim().replace(/_/gu, '-');
  if (!candidate) return '';
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? candidate;
  } catch {
    return candidate;
  }
}

/** Maps a raw language tag to a supported locale: exact or alias first, then by language family. */
export function normalizeTransitLocale(value: string | null | undefined): SiteLocale | null {
  if (!value) return null;
  const normalized = canonicalLocale(value).toLowerCase();
  if (!normalized) return null;
  const direct = LOCALE_BY_INPUT.get(normalized);
  if (direct) return direct;
  const [language] = normalized.split('-');
  return LOCALE_BY_LANGUAGE.get(language) ?? null;
}

function evidenceFor(value: string | null | undefined): LocaleInputEvidence {
  const raw = value || null;
  return { raw, locale: normalizeTransitLocale(raw) };
}

function storedEvidence(storedLocale: string | null | undefined, legacyStoredLocale: string | null | undefined): LocaleInputEvidence {
  const current = evidenceFor(storedLocale);
  if (current.locale) return current;
  const legacy = evidenceFor(legacyStoredLocale);
  if (legacy.locale) return legacy;
  return { raw: current.raw ?? legacy.raw, locale: null };
}

function browserEvidence(clientLanguages: readonly (string | null | undefined)[]): LocaleInputEvidence {
  let first: string | null = null;
  for (const language of clientLanguages) {
    if (!language) continue;
    first ??= language;
    const locale = normalizeTransitLocale(language);
    if (locale) return { raw: language, locale };
  }
  return { raw: first, locale: null };
}

/**
 * Resolves the locale the official rules would pick and reports the evidence from each input. A supported `?lang=`
 * wins, then the stored value (current key, then the legacy `lang` key), then the first supported browser language,
 * then the default. Unsupported values are skipped. The function never reads or writes storage itself.
 */
export function resolveTransitLocale(options: LocaleResolutionOptions = {}): LocaleResolution {
  const { requestedLang, storedLocale, legacyStoredLocale, clientLanguages } = options;
  const evidence = {
    query: evidenceFor(requestedLang),
    stored: storedEvidence(storedLocale, legacyStoredLocale),
    browser: browserEvidence(clientLanguages ?? []),
  };
  if (evidence.query.locale) return { locale: evidence.query.locale, source: 'query', evidence };
  if (evidence.stored.locale) return { locale: evidence.stored.locale, source: 'stored', evidence };
  if (evidence.browser.locale) return { locale: evidence.browser.locale, source: 'browser', evidence };
  return { locale: DEFAULT_LOCALE, source: 'default', evidence };
}
