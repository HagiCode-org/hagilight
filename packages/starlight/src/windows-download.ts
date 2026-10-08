export const DEFAULT_WINDOWS_STORE_PRODUCT_ID = '9N3PM0N3SVDW';

/** Microsoft Store badge language for each showcase locale; `repos/docs` only maps zh and en. */
const BADGE_LANGUAGES: Readonly<Record<string, string>> = {
  'en-US': 'en-us',
  'zh-CN': 'zh-cn',
  'zh-Hant': 'zh-tw',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
  'de-DE': 'de',
  'fr-FR': 'fr',
  'es-ES': 'es',
  'pt-BR': 'pt-br',
  'ru-RU': 'ru',
};

/** Same rule as the Docs site: the product id is the path segment after `detail/` in the Store URL. */
export function resolveMicrosoftStoreProductId(href?: string): string {
  const match = href?.match(/(?:detail|store\/detail)\/([a-z0-9]+)/i);
  return match?.[1]?.toUpperCase() ?? DEFAULT_WINDOWS_STORE_PRODUCT_ID;
}

export function resolveMicrosoftStoreBadgeLanguage(locale?: string): string {
  return (locale === undefined ? undefined : BADGE_LANGUAGES[locale]) ?? 'en-us';
}
