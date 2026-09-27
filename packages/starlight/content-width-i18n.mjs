const labels = {
  'de-DE': { group: 'Inhaltsbreite', wide: 'Breit', narrow: 'Schmal' },
  'en-US': { group: 'Content width', wide: 'Wide', narrow: 'Narrow' },
  'es-ES': { group: 'Ancho del contenido', wide: 'Ancho', narrow: 'Estrecho' },
  'fr-FR': { group: 'Largeur du contenu', wide: 'Large', narrow: 'Étroit' },
  'ja-JP': { group: 'コンテンツ幅', wide: '広い', narrow: '狭い' },
  'ko-KR': { group: '콘텐츠 너비', wide: '넓게', narrow: '좁게' },
  'pt-BR': { group: 'Largura do conteúdo', wide: 'Ampla', narrow: 'Estreita' },
  'ru-RU': { group: 'Ширина содержимого', wide: 'Широкая', narrow: 'Узкая' },
  'zh-CN': { group: '内容宽度', wide: '宽', narrow: '窄' },
  'zh-Hant': { group: '內容寬度', wide: '寬', narrow: '窄' },
};

export function getContentWidthLabels(lang) {
  return labels[lang] ?? labels['en-US'];
}
