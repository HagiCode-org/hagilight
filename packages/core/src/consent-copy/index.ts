import { DEFAULT_LOCALE, SITE_LOCALE_CODES, type SiteLocale } from '../root-transit-locale.js';
import { copy as enUS } from './en-US.js';
import { copy as zhCN } from './zh-CN.js';
import { copy as zhHant } from './zh-Hant.js';
import { copy as jaJP } from './ja-JP.js';
import { copy as koKR } from './ko-KR.js';
import { copy as deDE } from './de-DE.js';
import { copy as frFR } from './fr-FR.js';
import { copy as esES } from './es-ES.js';
import { copy as ptBR } from './pt-BR.js';
import { copy as ruRU } from './ru-RU.js';
import type { ConsentCopy } from './types.js';

export type { ConsentCopy } from './types.js';

/** One catalog entry per `SITE_LOCALES` code. */
export const CONSENT_COPY: Readonly<Record<SiteLocale, ConsentCopy>> = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'zh-Hant': zhHant,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'de-DE': deDE,
  'fr-FR': frFR,
  'es-ES': esES,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
};

/** The popup copy for a page locale. A locale outside `SITE_LOCALES` renders `en-US`. */
export function resolveConsentCopy(locale: unknown): ConsentCopy {
  if (typeof locale === 'string' && (SITE_LOCALE_CODES as readonly string[]).includes(locale)) {
    return CONSENT_COPY[locale as SiteLocale];
  }
  return CONSENT_COPY[DEFAULT_LOCALE];
}
