const COPY = {
  'de-DE': {
    title: 'Über HagiCode',
    description: 'HagiCode entwickelt Werkzeuge und eine Community für Menschen, die gemeinsam Software bauen.',
    link: 'HagiCode besuchen',
  },
  'en-US': {
    title: 'About HagiCode',
    description: 'HagiCode builds tools and a community for people creating software together.',
    link: 'Visit HagiCode',
  },
  'es-ES': {
    title: 'Acerca de HagiCode',
    description: 'HagiCode crea herramientas y una comunidad para quienes desarrollan software en equipo.',
    link: 'Visitar HagiCode',
  },
  'fr-FR': {
    title: 'À propos de HagiCode',
    description: 'HagiCode crée des outils et une communauté pour les personnes qui développent des logiciels ensemble.',
    link: 'Découvrir HagiCode',
  },
  'ja-JP': {
    title: 'HagiCodeについて',
    description: 'HagiCodeは、ソフトウェアを共につくる人々のためのツールとコミュニティを提供します。',
    link: 'HagiCodeを見る',
  },
  'ko-KR': {
    title: 'HagiCode 소개',
    description: 'HagiCode는 함께 소프트웨어를 만드는 사람들을 위한 도구와 커뮤니티를 만듭니다.',
    link: 'HagiCode 방문하기',
  },
  'pt-BR': {
    title: 'Sobre a HagiCode',
    description: 'A HagiCode cria ferramentas e uma comunidade para pessoas que desenvolvem software em conjunto.',
    link: 'Visite a HagiCode',
  },
  'ru-RU': {
    title: 'О HagiCode',
    description: 'HagiCode создаёт инструменты и сообщество для тех, кто вместе разрабатывает программное обеспечение.',
    link: 'Посетить HagiCode',
  },
  'zh-CN': {
    title: '关于 HagiCode',
    description: 'HagiCode 为协作构建软件的人们提供工具与社区。',
    link: '访问 HagiCode',
  },
  'zh-Hant': {
    title: '關於 HagiCode',
    description: 'HagiCode 為協作打造軟體的人們提供工具與社群。',
    link: '造訪 HagiCode',
  },
};

function resolveArticlePromotion(frontmatterValue, siteDefault = true) {
  if (typeof siteDefault !== 'boolean') {
    throw new TypeError('Hagilight hagicodePromotion enabled default must be a boolean.');
  }
  if (frontmatterValue !== undefined && typeof frontmatterValue !== 'boolean') {
    throw new TypeError('Hagilight frontmatter hagicodePromotion must be a boolean.');
  }
  return frontmatterValue ?? siteDefault;
}

function getArticlePromotionCopy(lang) {
  const language = lang?.split('-')[0];
  return COPY[lang] ?? COPY[language] ?? COPY['en-US'];
}

export { COPY, getArticlePromotionCopy, resolveArticlePromotion };
