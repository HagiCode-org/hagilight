const COPY = {
  'de-DE': {
    author: 'Dieser Inhalt wurde mit KI-Unterstützung erstellt. Bitte prüfen Sie wichtige Angaben.',
    translation: 'Dieser Beitrag wurde mit KI übersetzt.',
    source: 'Original ansehen',
  },
  'en-US': {
    author: 'This content was created with AI assistance. Please verify important details.',
    translation: 'This post was translated with AI.',
    source: 'View source',
  },
  'es-ES': {
    author: 'Este contenido se creó con ayuda de IA. Verifica los detalles importantes.',
    translation: 'Esta publicación se tradujo con IA.',
    source: 'Ver original',
  },
  'fr-FR': {
    author: 'Ce contenu a été créé avec l’aide de l’IA. Vérifiez les informations importantes.',
    translation: 'Cet article a été traduit avec l’IA.',
    source: 'Voir la source',
  },
  'ja-JP': {
    author: 'この記事は AI の支援を受けて作成されました。重要な情報はご確認ください。',
    translation: 'この記事は AI によって翻訳されました。',
    source: '原文を見る',
  },
  'ko-KR': {
    author: '이 콘텐츠는 AI의 도움을 받아 작성되었습니다. 중요한 세부 정보는 확인해 주세요.',
    translation: '이 게시물은 AI로 번역되었습니다.',
    source: '원문 보기',
  },
  'pt-BR': {
    author: 'Este conteúdo foi criado com auxílio de IA. Confira os detalhes importantes.',
    translation: 'Esta publicação foi traduzida com IA.',
    source: 'Ver original',
  },
  'ru-RU': {
    author: 'Этот материал создан с помощью ИИ. Проверьте важные сведения.',
    translation: 'Эта публикация переведена с помощью ИИ.',
    source: 'Открыть оригинал',
  },
  'zh-CN': {
    author: '本文内容由 AI 辅助创作。请核实重要信息。',
    translation: '本文由 AI 翻译。',
    source: '查看原文',
  },
  'zh-Hant': {
    author: '本文內容由 AI 輔助創作。請核實重要資訊。',
    translation: '本文由 AI 翻譯。',
    source: '查看原文',
  },
};

export function resolveAIDisclosureFlags(frontmatter, defaults) {
  for (const key of ['isAITranslation', 'isAIAuthor']) {
    if (frontmatter[key] !== undefined && typeof frontmatter[key] !== 'boolean') {
      throw new TypeError(`Hagilight frontmatter ${key} must be a boolean.`);
    }
    if (typeof defaults[key] !== 'boolean') {
      throw new TypeError(`Hagilight aiDisclosures ${key} default must be a boolean.`);
    }
  }
  return {
    isAITranslation: frontmatter.isAITranslation ?? defaults.isAITranslation,
    isAIAuthor: frontmatter.isAIAuthor ?? defaults.isAIAuthor,
  };
}

export function getAIDisclosureCopy(lang) {
  if (COPY[lang]) return COPY[lang];
  const language = lang?.split('-')[0];
  return COPY[language] ?? COPY['en-US'];
}

export function getSourceEntryId(routeId, currentLocale, sourceLocale) {
  const prefix = currentLocale && currentLocale !== 'root' ? `${currentLocale}/` : '';
  const routeSlug = prefix && routeId.startsWith(prefix) ? routeId.slice(prefix.length) : routeId;
  if (sourceLocale === 'root') return routeSlug === 'index' ? '' : routeSlug;
  return `${sourceLocale}/${routeSlug || 'index'}`;
}

export function normalizeDocsEntryId(id) {
  return id === 'index' ? '' : id;
}

export function getSourcePath({ docs, routeId, currentLocale, sourceLocale, pathname, baseUrl }) {
  const sourceId = getSourceEntryId(routeId, currentLocale, sourceLocale);
  if (!docs.some((entry) => normalizeDocsEntryId(entry.id) === sourceId)) return undefined;
  return buildSourcePathname(pathname, baseUrl, currentLocale, sourceLocale);
}

export function isTranslationLocale(locale, sourceLocale) {
  return (locale ?? 'root') !== sourceLocale;
}

export function buildSourcePathname(pathname, baseUrl, currentLocale, sourceLocale) {
  const basePath = new URL(baseUrl, 'https://hagilight.invalid').pathname;
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const relativePath = pathname.startsWith(normalizedBase)
    ? pathname.slice(normalizedBase.length)
    : pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const segments = relativePath.split('/');
  if (currentLocale && currentLocale !== 'root' && segments[0] === currentLocale) segments.shift();
  if (sourceLocale !== 'root') segments.unshift(sourceLocale);
  return `${normalizedBase}${segments.join('/')}`;
}

export { COPY };
