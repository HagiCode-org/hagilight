import type { I18nConfig } from '@docusaurus/types';

export const defaultLocale = 'en-US';

export const localeConfigs: NonNullable<I18nConfig['localeConfigs']> = {
  'en-US': { label: 'English', htmlLang: 'en-US', direction: 'ltr' },
  'zh-CN': { label: '简体中文', htmlLang: 'zh-CN', direction: 'ltr' },
  'zh-Hant': { label: '繁體中文', htmlLang: 'zh-Hant', direction: 'ltr' },
  'fr-FR': { label: 'Français', htmlLang: 'fr-FR', direction: 'ltr' },
  'de-DE': { label: 'Deutsch', htmlLang: 'de-DE', direction: 'ltr' },
  'es-ES': { label: 'Español (España)', htmlLang: 'es-ES', direction: 'ltr' },
  'ja-JP': { label: '日本語', htmlLang: 'ja-JP', direction: 'ltr' },
  'ko-KR': { label: '한국어', htmlLang: 'ko-KR', direction: 'ltr' },
  'pt-BR': { label: 'Português (Brasil)', htmlLang: 'pt-BR', direction: 'ltr' },
  'ru-RU': { label: 'Русский', htmlLang: 'ru-RU', direction: 'ltr' },
};

export const locales: [string, ...string[]] = [defaultLocale, ...Object.keys(localeConfigs).filter((locale) => locale !== defaultLocale)];

export const i18n: I18nConfig = {
  defaultLocale,
  locales,
  path: 'i18n',
  localeConfigs,
};
