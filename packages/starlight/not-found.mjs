const homeLabels = {
  de: 'Zur Startseite',
  en: 'Back to home',
  es: 'Volver al inicio',
  fr: 'Retour à l’accueil',
  ja: 'ホームに戻る',
  ko: '홈으로 돌아가기',
  pt: 'Voltar ao início',
  ru: 'На главную',
  'zh-cn': '返回首页',
  'zh-hant': '返回首頁',
};

export function isNotFoundEntry(entryId) {
  return entryId === '404' || entryId.endsWith('/404');
}

export function getNotFoundHomeHref({ basePath = '/', locale, trailingSlash = 'ignore' }) {
  const base = basePath.replace(/\/+$/u, '');
  const localePath = locale && locale !== 'root' ? `/${locale}` : '';
  const path = `${base}${localePath}` || '/';

  if (trailingSlash === 'never') {
    return path.replace(/\/+$/u, '') || '/';
  }

  return `${path.replace(/\/+$/u, '')}/`;
}

export function getNotFoundHomeLabel(lang) {
  const language = lang?.replaceAll('_', '-').toLowerCase() ?? 'en';
  return homeLabels[language] ?? homeLabels[language.split('-')[0]] ?? homeLabels.en;
}
