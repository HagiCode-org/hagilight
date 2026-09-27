import docsRelatedSites from './related-sites.json' with { type: 'json' };

export type SiteLinkKey =
  | 'home'
  | 'blog'
  | 'support'
  | 'downloadClient'
  | 'about'
  | 'dockerCompose'
  | 'productDocs'
  | 'blogPosts'
  | 'rss'
  | 'costCalculator'
  | 'github'
  | 'discord'
  | 'issueFeedback'
  | 'contactEmail'
  | 'qqGroup'
  | 'microsoftStore'
  | 'icpFiling'
  | 'publicSecurityFiling';

export type LinkGroup = 'header' | 'quick' | 'community' | 'filings';
export type FooterLinkSection = 'relatedSites' | 'quick' | 'community';
type LocalizedText = string | Readonly<Record<string, string>>;

export interface SiteLink {
  id: SiteLinkKey | string;
  label: string;
  href: string;
  ariaLabel?: string;
  target?: '_blank';
  rel?: 'noopener noreferrer';
}

export interface SiteLinkOverride {
  href?: LocalizedText;
  label?: LocalizedText;
  external?: boolean;
}

export interface ExtraSiteLink extends SiteLinkOverride {
  id?: string;
  href: LocalizedText;
  label: LocalizedText;
}

export interface RelatedSite {
  id: string;
  name: LocalizedText;
  url: string;
  description?: LocalizedText;
  supportsLocalePath?: boolean;
}

export interface SiteLinksOptions {
  overrides?: Partial<Record<SiteLinkKey, SiteLinkOverride>>;
  extraLinks?: Partial<Record<LinkGroup, readonly ExtraSiteLink[]>> & {
    relatedSites?: readonly RelatedSite[];
  };
  removeLinks?: Partial<Record<FooterLinkSection, readonly string[]>>;
  relatedSites?: readonly RelatedSite[];
  rssFeedUrl?: string;
  siteId?: string;
  siteUrl?: string;
}

interface LinkDefinition {
  label: LocalizedText;
  href: string | ((locale: string) => string);
  external?: boolean;
  ariaLabel?: LocalizedText;
}

const translations = {
  home: {
    'zh-CN': '首页', 'zh-Hant': '首頁', 'en-US': 'Home', 'ja-JP': 'ホーム',
    'ko-KR': '홈', 'de-DE': 'Startseite', 'fr-FR': 'Accueil', 'es-ES': 'Inicio',
    'pt-BR': 'Início', 'ru-RU': 'Главная',
  },
  blog: {
    'zh-CN': '博客', 'zh-Hant': '部落格', 'en-US': 'Blog', 'ja-JP': 'ブログ',
    'ko-KR': '블로그', 'de-DE': 'Blog', 'fr-FR': 'Blog', 'es-ES': 'Blog',
    'pt-BR': 'Blog', 'ru-RU': 'Блог',
  },
  support: {
    'zh-CN': '获取技术支持', 'zh-Hant': '獲取技術支援', 'en-US': 'Get Support',
    'ja-JP': 'サポート', 'ko-KR': '기술 지원', 'de-DE': 'Support',
    'fr-FR': 'Assistance', 'es-ES': 'Soporte', 'pt-BR': 'Suporte', 'ru-RU': 'Поддержка',
  },
  downloadClient: {
    'zh-CN': '下载 Hagicode', 'zh-Hant': '下載 Hagicode', 'en-US': 'Download Hagicode',
    'ja-JP': 'Hagicode をダウンロード', 'ko-KR': 'Hagicode 다운로드',
    'de-DE': 'Hagicode herunterladen', 'fr-FR': 'Télécharger Hagicode',
    'es-ES': 'Descargar Hagicode', 'pt-BR': 'Baixar Hagicode', 'ru-RU': 'Скачать Hagicode',
  },
  about: {
    'zh-CN': '关于 HagiCode', 'zh-Hant': '關於 HagiCode', 'en-US': 'About HagiCode',
    'ja-JP': 'HagiCode について', 'ko-KR': 'HagiCode 소개', 'de-DE': 'Über HagiCode',
    'fr-FR': 'À propos de HagiCode', 'es-ES': 'Acerca de HagiCode',
    'pt-BR': 'Sobre a HagiCode', 'ru-RU': 'О HagiCode',
  },
  dockerCompose: {
    'zh-CN': 'Docker Compose 安装', 'zh-Hant': 'Docker Compose 安裝',
    'en-US': 'Docker Compose Installation', 'ja-JP': 'Docker Compose インストール',
    'ko-KR': 'Docker Compose 설치', 'de-DE': 'Docker-Compose-Installation',
    'fr-FR': 'Installation de Docker Compose', 'es-ES': 'Instalación de Docker Compose',
    'pt-BR': 'Instalação do Docker Compose', 'ru-RU': 'Установка Docker Compose',
  },
  productDocs: {
    'zh-CN': '产品文档', 'zh-Hant': '產品文件', 'en-US': 'Product Docs',
    'ja-JP': '製品ドキュメント', 'ko-KR': '제품 문서', 'de-DE': 'Produktdokumentation',
    'fr-FR': 'Documentation produit', 'es-ES': 'Documentación del producto',
    'pt-BR': 'Documentação do produto', 'ru-RU': 'Документация продукта',
  },
  blogPosts: {
    'zh-CN': '博客文章', 'zh-Hant': '部落格文章', 'en-US': 'Blog Posts',
    'ja-JP': 'ブログ記事', 'ko-KR': '블로그 글', 'de-DE': 'Blogbeiträge',
    'fr-FR': 'Articles du blog', 'es-ES': 'Artículos del blog',
    'pt-BR': 'Posts do blog', 'ru-RU': 'Статьи блога',
  },
  rss: {
    'zh-CN': 'RSS 订阅', 'zh-Hant': 'RSS 訂閱', 'en-US': 'RSS Feed',
    'ja-JP': 'RSS 配信', 'ko-KR': 'RSS 구독', 'de-DE': 'RSS-Feed',
    'fr-FR': 'Flux RSS', 'es-ES': 'RSS', 'pt-BR': 'Feed RSS', 'ru-RU': 'RSS-лента',
  },
  costCalculator: {
    'zh-CN': '算一算，AI会不会淘汰我', 'zh-Hant': '算一算，AI 會不會淘汰我',
    'en-US': 'Will AI Replace Me?', 'ja-JP': 'AI に置き換えられるか診断',
    'ko-KR': 'AI가 나를 대체할까?', 'de-DE': 'Wird KI mich ersetzen?',
    'fr-FR': "L'IA va-t-elle me remplacer ?", 'es-ES': 'Me reemplazará la IA?',
    'pt-BR': 'A IA vai me substituir?', 'ru-RU': 'Заменит ли меня ИИ?',
  },
  github: {
    'zh-CN': 'GitHub', 'zh-Hant': 'GitHub', 'en-US': 'GitHub', 'ja-JP': 'GitHub',
    'ko-KR': 'GitHub', 'de-DE': 'GitHub', 'fr-FR': 'GitHub', 'es-ES': 'GitHub',
    'pt-BR': 'GitHub', 'ru-RU': 'GitHub',
  },
  discord: {
    'zh-CN': 'Discord', 'zh-Hant': 'Discord', 'en-US': 'Discord', 'ja-JP': 'Discord',
    'ko-KR': 'Discord', 'de-DE': 'Discord', 'fr-FR': 'Discord', 'es-ES': 'Discord',
    'pt-BR': 'Discord', 'ru-RU': 'Discord',
  },
  issueFeedback: {
    'zh-CN': '问题反馈', 'zh-Hant': '問題回饋', 'en-US': 'Issue Feedback',
    'ja-JP': '問題の報告', 'ko-KR': '문제 신고', 'de-DE': 'Probleme melden',
    'fr-FR': 'Signaler un problème', 'es-ES': 'Reportar un problema',
    'pt-BR': 'Relatar problema', 'ru-RU': 'Сообщить о проблеме',
  },
  contactEmail: {
    'zh-CN': '联系邮箱', 'zh-Hant': '聯絡信箱', 'en-US': 'Contact Email',
    'ja-JP': '連絡先メール', 'ko-KR': '문의 이메일', 'de-DE': 'Kontakt-E-Mail',
    'fr-FR': 'E-mail de contact', 'es-ES': 'Correo de contacto',
    'pt-BR': 'E-mail de contato', 'ru-RU': 'Контактный email',
  },
  qqGroup: {
    'zh-CN': 'QQ 群 610394020', 'zh-Hant': 'QQ 群 610394020',
    'en-US': 'QQ Group 610394020', 'ja-JP': 'QQ グループ 610394020',
    'ko-KR': 'QQ 그룹 610394020', 'de-DE': 'QQ-Gruppe 610394020',
    'fr-FR': 'Groupe QQ 610394020', 'es-ES': 'Grupo QQ 610394020',
    'pt-BR': 'Grupo QQ 610394020', 'ru-RU': 'Группа QQ 610394020',
  },
  microsoftStore: {
    'zh-CN': '下载 Hagicode Windows 版本', 'zh-Hant': '下載 Hagicode Windows 版本',
    'en-US': 'Download Hagicode for Windows', 'ja-JP': 'Hagicode for Windows をダウンロード',
    'ko-KR': 'Windows용 Hagicode 다운로드', 'de-DE': 'Hagicode für Windows herunterladen',
    'fr-FR': 'Télécharger Hagicode pour Windows', 'es-ES': 'Descargar Hagicode para Windows',
    'pt-BR': 'Baixar Hagicode para Windows', 'ru-RU': 'Скачать Hagicode для Windows',
  },
  icpFiling: '闽ICP备2026004153号-1',
  publicSecurityFiling: '闽公网安备35011102351148号',
} satisfies Record<SiteLinkKey, LocalizedText>;

const defaultLinks: Record<SiteLinkKey, LinkDefinition> = {
  home: { label: translations.home, href: (locale) => marketingPath(locale, '/') },
  blog: { label: translations.blog, href: (locale) => docsPath(locale, '/blog/') },
  support: { label: translations.support, href: (locale) => marketingPath(locale, '/about/') },
  downloadClient: { label: translations.downloadClient, href: (locale) => marketingPath(locale, '/desktop/') },
  about: { label: translations.about, href: (locale) => marketingPath(locale, '/about/') },
  dockerCompose: { label: translations.dockerCompose, href: (locale) => docsPath(locale, '/installation/docker-compose/') },
  productDocs: { label: translations.productDocs, href: (locale) => docsPath(locale, '/product-overview/') },
  blogPosts: { label: translations.blogPosts, href: (locale) => docsPath(locale, '/blog/') },
  rss: { label: translations.rss, href: '' },
  costCalculator: { label: translations.costCalculator, href: 'https://cost.hagicode.com', external: true },
  github: { label: translations.github, href: 'https://github.com/HagiCode-org/site', external: true },
  discord: { label: translations.discord, href: 'https://discord.gg/qY662sJK', external: true },
  issueFeedback: { label: translations.issueFeedback, href: 'https://github.com/HagiCode-org/site/issues', external: true },
  contactEmail: { label: translations.contactEmail, href: 'mailto:support@hagicode.com' },
  qqGroup: { label: translations.qqGroup, href: 'https://qm.qq.com/q/Fwb0o094kw', external: true },
  microsoftStore: {
    label: translations.microsoftStore,
    href: 'https://apps.microsoft.com/detail/9N3PM0N3SVDW',
    external: true,
  },
  icpFiling: {
    label: translations.icpFiling,
    href: 'https://beian.miit.gov.cn/',
    external: true,
    ariaLabel: {
      'zh-CN': '查看 ICP 备案信息', 'zh-Hant': '查看 ICP 備案資訊',
      'en-US': 'View ICP filing information', 'ja-JP': 'ICP 登録情報を表示',
      'ko-KR': 'ICP 등록 정보 보기', 'de-DE': 'ICP-Registrierungsinformationen anzeigen',
      'fr-FR': 'Voir les informations de dépôt ICP', 'es-ES': 'Ver la información de registro ICP',
      'pt-BR': 'Ver informações de registro ICP', 'ru-RU': 'Показать информацию о регистрации ICP',
    },
  },
  publicSecurityFiling: {
    label: translations.publicSecurityFiling,
    href: 'http://www.beian.gov.cn/portal/registerSystemInfo',
    external: true,
    ariaLabel: {
      'zh-CN': '查看公安备案信息', 'zh-Hant': '查看公安備案資訊',
      'en-US': 'View public security filing information', 'ja-JP': '公安登録情報を表示',
      'ko-KR': '공안 등록 정보 보기', 'de-DE': 'Informationen zur Sicherheitsregistrierung anzeigen',
      'fr-FR': 'Voir les informations de dépôt de sécurité publique',
      'es-ES': 'Ver la información de registro de seguridad pública',
      'pt-BR': 'Ver informações de registro de segurança pública',
      'ru-RU': 'Показать информацию о регистрации в органах общественной безопасности',
    },
  },
};

const groups: Record<LinkGroup, readonly SiteLinkKey[]> = {
  header: ['home', 'blog', 'support'],
  quick: ['downloadClient', 'microsoftStore', 'dockerCompose', 'productDocs', 'blogPosts', 'rss', 'about'],
  community: ['github', 'discord', 'issueFeedback', 'contactEmail', 'qqGroup'],
  filings: ['icpFiling', 'publicSecurityFiling'],
};

function normalizeLocale(locale?: string | null): string {
  const normalized = locale?.trim().replaceAll('_', '-').toLowerCase();
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-hans' || normalized === 'root') {
    return 'zh-CN';
  }
  if (normalized === 'zh-hant' || normalized === 'zh-tw' || normalized === 'zh-hk') {
    return 'zh-Hant';
  }
  if (normalized === 'en' || normalized === 'en-us' || !normalized) {
    return 'en-US';
  }
  const canonical = ['ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU']
    .find((candidate) => candidate.toLowerCase() === normalized);
  if (canonical) return canonical;
  return 'en-US';
}

function docsPath(locale: string, pathname: string): string {
  const routePrefix = locale === 'zh-CN' ? '' : `/${locale}`;
  return `https://docs.hagicode.com${routePrefix}${pathname}`;
}

function marketingPath(locale: string, pathname: string): string {
  return `https://www.hagicode.com/${locale}${pathname}`;
}

function resolveLocalized(value: LocalizedText, locale: string, fallback: string): string {
  if (typeof value === 'string') return value;
  for (const candidate of [locale, ...(locale === 'zh-Hant' ? ['zh-CN', 'en-US'] : ['en-US'])]) {
    const text = value[candidate];
    if (typeof text === 'string' && text.trim()) return text;
  }
  const firstValue = Object.values(value).find((text) => typeof text === 'string' && text.trim());
  return firstValue ?? fallback;
}

function normalizeUrl(value: string): string {
  const input = value.trim();
  if (!input) throw new TypeError('Link destinations must not be empty.');
  const url = new URL(input, 'https://hagilight.invalid');
  if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
    throw new TypeError(`Unsupported link protocol: ${url.protocol}`);
  }
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
  return url.origin === 'https://hagilight.invalid' ? url.pathname : url.toString();
}

function resolveLink(
  key: SiteLinkKey | string,
  locale: string,
  definition: LinkDefinition,
  override?: SiteLinkOverride,
): SiteLink {
  const defaultHref = typeof definition.href === 'function' ? definition.href(locale) : definition.href;
  const href = override?.href === undefined ? defaultHref : resolveLocalized(override.href, locale, defaultHref);
  const label = override?.label === undefined
    ? resolveLocalized(definition.label, locale, key)
    : resolveLocalized(override.label, locale, resolveLocalized(definition.label, locale, key));
  normalizeUrl(href);
  const external = override?.external ?? definition.external ?? false;
  return {
    id: key,
    label,
    href,
    ...(definition.ariaLabel
      ? { ariaLabel: resolveLocalized(definition.ariaLabel, locale, label) }
      : {}),
    ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
  };
}

export function resolveSiteLinks(localeInput?: string | null, options: SiteLinksOptions = {}) {
  const locale = normalizeLocale(localeInput);
  if (options.rssFeedUrl !== undefined && typeof options.rssFeedUrl !== 'string') {
    throw new TypeError('RSS feed URL must be a string.');
  }
  const resolvedGroups = Object.fromEntries(
    (Object.keys(groups) as LinkGroup[]).map((group) => {
      const catalogLinks = groups[group].map((key) => {
        if (key === 'rss' && options.rssFeedUrl === undefined
          && options.overrides?.rss?.href === undefined) {
          return undefined;
        }
        if ((group === 'quick' || group === 'community')
          && options.removeLinks?.[group]?.includes(key)) {
          return undefined;
        }
        const override = options.overrides?.[key]
          ?? (key === 'blogPosts' ? options.overrides?.blog : undefined);
        const definition = key === 'rss'
          ? { ...defaultLinks[key], href: options.rssFeedUrl ?? '' }
          : defaultLinks[key];
        return resolveLink(key, locale, definition, override);
      });
      const extraLinks = (options.extraLinks?.[group] ?? []).map((entry, index) => {
        const definition: LinkDefinition = {
          label: entry.label,
          href: resolveLocalized(entry.href, locale, ''),
          external: entry.external,
        };
        const id = entry.id ?? `${group}-custom-${index + 1}`;
        if (typeof id !== 'string' || !id.trim()) {
          throw new TypeError('Extra link IDs must be non-empty strings.');
        }
        return resolveLink(id, locale, definition);
      });
      const links = [...catalogLinks, ...extraLinks].filter((link): link is SiteLink => link !== undefined);
      if (group !== 'quick' && group !== 'community') return [group, links];

      const ids = new Set<string>();
      const urls = new Set<string>();
      const uniqueLinks = links.filter((link) => {
        const url = normalizeUrl(link.href);
        if (ids.has(link.id) || urls.has(url)) return false;
        ids.add(link.id);
        urls.add(url);
        return true;
      });
      return [group, uniqueLinks];
    }),
  ) as Record<LinkGroup, SiteLink[]>;

  const renderedUrls = new Set([...resolvedGroups.quick, ...resolvedGroups.community, ...resolvedGroups.filings]
    .map((link) => normalizeUrl(link.href)));
  if (options.siteUrl) renderedUrls.add(normalizeUrl(options.siteUrl));

  const relatedIds = new Set<string>();
  const relatedUrls = new Set<string>();
  const bundledOrReplacementSites = (options.relatedSites ?? docsRelatedSites)
    .filter((site) => !options.removeLinks?.relatedSites?.includes(site.id));
  const relatedSites = [...bundledOrReplacementSites, ...(options.extraLinks?.relatedSites ?? [])]
    .flatMap((site) => {
      if (typeof site.id !== 'string' || !site.id.trim()) {
        throw new TypeError('Related site IDs must be non-empty strings.');
      }
      const href = site.supportsLocalePath
        ? new URL(`${locale}/`, site.url.endsWith('/') ? site.url : `${site.url}/`).toString()
        : site.url;
      const normalizedUrl = normalizeUrl(href);
      if (site.id === options.siteId || renderedUrls.has(normalizedUrl)
        || relatedIds.has(site.id) || relatedUrls.has(normalizedUrl)) {
        return [];
      }
      relatedIds.add(site.id);
      relatedUrls.add(normalizedUrl);
      return [{
        id: site.id,
        name: resolveLocalized(site.name, locale, site.id),
        description: site.description
          ? resolveLocalized(site.description, locale, '')
          : undefined,
        href,
        target: '_blank' as const,
        rel: 'noopener noreferrer' as const,
      }];
    });

  return {
    locale,
    labels: {
      relatedSites: resolveLocalized({
        'zh-CN': '生态站点', 'zh-Hant': '生態站點', 'en-US': 'Ecosystem Sites',
        'ja-JP': 'エコシステムサイト', 'ko-KR': '에코시스템 사이트',
        'de-DE': 'Ökosystem-Seiten', 'fr-FR': "Sites de l'écosystème",
        'es-ES': 'Sitios del ecosistema', 'pt-BR': 'Sites do ecossistema',
        'ru-RU': 'Сайты экосистемы',
      }, locale, 'Ecosystem Sites'),
      quickLinks: resolveLocalized({
        'zh-CN': '快速链接', 'zh-Hant': '快速連結', 'en-US': 'Quick Links',
        'ja-JP': 'クイックリンク', 'ko-KR': '빠른 링크', 'de-DE': 'Schnellzugriffe',
        'fr-FR': 'Liens rapides', 'es-ES': 'Enlaces rápidos',
        'pt-BR': 'Links rápidos', 'ru-RU': 'Быстрые ссылки',
      }, locale, 'Quick Links'),
      community: resolveLocalized({
        'zh-CN': '社区', 'zh-Hant': '社群', 'en-US': 'Community',
        'ja-JP': 'コミュニティ', 'ko-KR': '커뮤니티', 'de-DE': 'Community',
        'fr-FR': 'Communauté', 'es-ES': 'Comunidad',
        'pt-BR': 'Comunidade', 'ru-RU': 'Сообщество',
      }, locale, 'Community'),
      navigation: {
        relatedSites: resolveLocalized({
          'zh-CN': '生态站点链接', 'zh-Hant': '生態站點連結', 'en-US': 'Ecosystem site links',
          'ja-JP': 'エコシステムサイトへのリンク', 'ko-KR': '에코시스템 사이트 링크',
          'de-DE': 'Links zu Ökosystem-Seiten', 'fr-FR': "Liens vers les sites de l'écosystème",
          'es-ES': 'Enlaces de sitios del ecosistema', 'pt-BR': 'Links dos sites do ecossistema',
          'ru-RU': 'Ссылки на сайты экосистемы',
        }, locale, 'Ecosystem site links'),
        quickLinks: resolveLocalized({
          'zh-CN': '快速链接', 'zh-Hant': '快速連結', 'en-US': 'Quick links',
          'ja-JP': 'クイックリンク', 'ko-KR': '빠른 링크', 'de-DE': 'Schnellzugriffe',
          'fr-FR': 'Liens rapides', 'es-ES': 'Enlaces rápidos',
          'pt-BR': 'Links rápidos', 'ru-RU': 'Быстрые ссылки',
        }, locale, 'Quick links'),
        community: resolveLocalized({
          'zh-CN': '社区链接', 'zh-Hant': '社群連結', 'en-US': 'Community links',
          'ja-JP': 'コミュニティリンク', 'ko-KR': '커뮤니티 링크',
          'de-DE': 'Community-Links', 'fr-FR': 'Liens communautaires',
          'es-ES': 'Enlaces de la comunidad', 'pt-BR': 'Links da comunidade',
          'ru-RU': 'Ссылки сообщества',
        }, locale, 'Community links'),
        filings: resolveLocalized({
          'zh-CN': '查看备案信息', 'zh-Hant': '查看備案資訊',
          'en-US': 'View filing information', 'ja-JP': '登録情報を表示',
          'ko-KR': '등록 정보 보기', 'de-DE': 'Registrierungsinformationen anzeigen',
          'fr-FR': 'Voir les informations de dépôt', 'es-ES': 'Ver información de registro',
          'pt-BR': 'Ver informações de registro', 'ru-RU': 'Показать информацию о регистрации',
        }, locale, 'View filing information'),
      },
    },
    header: resolvedGroups.header,
    quick: resolvedGroups.quick,
    community: resolvedGroups.community,
    filings: resolvedGroups.filings,
    relatedSites,
  };
}
