export type SiteLinkKey =
  | 'home'
  | 'blog'
  | 'support'
  | 'downloadClient'
  | 'about'
  | 'dockerCompose'
  | 'productDocs'
  | 'rss'
  | 'costCalculator'
  | 'github'
  | 'discord'
  | 'qqGroup'
  | 'steam';

export type LinkGroup = 'header' | 'quick' | 'community';
type LocalizedText = string | Readonly<Record<string, string>>;

export interface SiteLink {
  id: SiteLinkKey | string;
  label: string;
  href: string;
  target?: '_blank';
  rel?: 'noopener noreferrer';
}

export interface SiteLinkOverride {
  href?: LocalizedText;
  label?: LocalizedText;
  external?: boolean;
}

export interface ExtraSiteLink extends SiteLinkOverride {
  href: LocalizedText;
  label: LocalizedText;
}

export interface RelatedSite {
  id: string;
  name: LocalizedText;
  url: string;
  description?: LocalizedText;
}

export interface SiteLinksOptions {
  overrides?: Partial<Record<SiteLinkKey, SiteLinkOverride>>;
  extraLinks?: Partial<Record<LinkGroup, readonly ExtraSiteLink[]>>;
  relatedSites?: readonly RelatedSite[];
  siteId?: string;
  siteUrl?: string;
}

interface LinkDefinition {
  label: LocalizedText;
  href: string | ((locale: string) => string);
  external?: boolean;
}

const translations = {
  home: { 'zh-CN': '首页', 'zh-Hant': '首頁', 'en-US': 'Home' },
  blog: { 'zh-CN': '博客', 'zh-Hant': '部落格', 'en-US': 'Blog' },
  support: { 'zh-CN': '获取技术支持', 'zh-Hant': '獲取技術支援', 'en-US': 'Get Support' },
  downloadClient: { 'zh-CN': '下载客户端', 'zh-Hant': '下載客戶端', 'en-US': 'Download Client' },
  about: { 'zh-CN': '关于 HagiCode', 'zh-Hant': '關於 HagiCode', 'en-US': 'About HagiCode' },
  dockerCompose: { 'zh-CN': 'Docker Compose 安装', 'zh-Hant': 'Docker Compose 安裝', 'en-US': 'Docker Compose Installation' },
  productDocs: { 'zh-CN': '产品文档', 'zh-Hant': '產品文件', 'en-US': 'Product Docs' },
  rss: { 'zh-CN': 'RSS 订阅', 'zh-Hant': 'RSS 訂閱', 'en-US': 'RSS Feed' },
  costCalculator: { 'zh-CN': '算一算，AI 会不会淘汰我', 'zh-Hant': '算一算，AI 會不會淘汰我', 'en-US': 'Will AI Replace Me?' },
  github: { 'zh-CN': 'GitHub', 'zh-Hant': 'GitHub', 'en-US': 'GitHub' },
  discord: { 'zh-CN': 'Discord 社区', 'zh-Hant': 'Discord 社群', 'en-US': 'Discord Community' },
  qqGroup: { 'zh-CN': 'QQ 群 610394020', 'zh-Hant': 'QQ 群 610394020', 'en-US': 'QQ Group 610394020' },
  steam: { 'zh-CN': 'Steam', 'zh-Hant': 'Steam', 'en-US': 'Steam' },
} satisfies Record<SiteLinkKey, LocalizedText>;

const defaultLinks: Record<SiteLinkKey, LinkDefinition> = {
  home: { label: translations.home, href: 'https://www.hagicode.com/' },
  blog: { label: translations.blog, href: (locale) => docsPath(locale, '/blog/') },
  support: { label: translations.support, href: 'https://www.hagicode.com/about/' },
  downloadClient: { label: translations.downloadClient, href: 'https://www.hagicode.com/desktop/' },
  about: { label: translations.about, href: 'https://www.hagicode.com/about/' },
  dockerCompose: { label: translations.dockerCompose, href: (locale) => docsPath(locale, '/installation/docker-compose/') },
  productDocs: { label: translations.productDocs, href: (locale) => docsPath(locale, '/product-overview/') },
  rss: { label: translations.rss, href: (locale) => docsPath(locale, '/blog/rss.zh-CN.xml') },
  costCalculator: { label: translations.costCalculator, href: 'https://cost.hagicode.com', external: true },
  github: { label: translations.github, href: 'https://github.com/HagiCode-org/site', external: true },
  discord: { label: translations.discord, href: 'https://discord.gg/qY662sJK', external: true },
  qqGroup: { label: translations.qqGroup, href: 'https://qm.qq.com/q/Fwb0o094kw', external: true },
  steam: { label: translations.steam, href: 'https://store.steampowered.com/app/4625540/Hagicode/', external: true },
};

const groups: Record<LinkGroup, readonly SiteLinkKey[]> = {
  header: ['home', 'blog', 'support'],
  quick: ['downloadClient', 'about', 'dockerCompose', 'productDocs', 'blog', 'rss', 'costCalculator'],
  community: ['github', 'discord', 'qqGroup', 'steam'],
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
  return locale!.trim();
}

function docsPath(locale: string, pathname: string): string {
  if (pathname.startsWith('/blog/rss.')) {
    const language = locale.startsWith('zh') ? 'zh-CN' : 'en-US';
    return `https://docs.hagicode.com/blog/rss.${language}.xml`;
  }
  const supportedRouteLocales = new Set([
    'en-US', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU',
  ]);
  const routeLocale = supportedRouteLocales.has(locale) ? locale : 'en-US';
  const prefix = routeLocale === 'zh-CN' ? '' : `/${routeLocale}`;
  return `https://docs.hagicode.com${prefix}${pathname}`;
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
    ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
  };
}

export function resolveSiteLinks(localeInput?: string | null, options: SiteLinksOptions = {}) {
  const locale = normalizeLocale(localeInput);
  const resolvedGroups = Object.fromEntries(
    (Object.keys(groups) as LinkGroup[]).map((group) => {
      const catalogLinks = groups[group].map((key) =>
        resolveLink(key, locale, defaultLinks[key], options.overrides?.[key]),
      );
      const extraLinks = (options.extraLinks?.[group] ?? []).map((entry, index) => {
        const definition: LinkDefinition = {
          label: entry.label,
          href: resolveLocalized(entry.href, locale, ''),
          external: entry.external,
        };
        return resolveLink(`${group}-custom-${index + 1}`, locale, definition);
      });
      return [group, [...catalogLinks, ...extraLinks]];
    }),
  ) as Record<LinkGroup, SiteLink[]>;

  const renderedUrls = new Set(
    Object.values(resolvedGroups).flat().map((link) => normalizeUrl(link.href)),
  );
  if (options.siteUrl) renderedUrls.add(normalizeUrl(options.siteUrl));

  const relatedIds = new Set<string>();
  const relatedUrls = new Set<string>();
  const relatedSites = (options.relatedSites ?? []).flatMap((site) => {
    const normalizedUrl = normalizeUrl(site.url);
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
      href: site.url,
    }];
  });

  return {
    locale,
    labels: {
      relatedSites: resolveLocalized({ 'zh-CN': '相关站点', 'zh-Hant': '相關站點', 'en-US': 'Related sites' }, locale, 'Related sites'),
      quickLinks: resolveLocalized({ 'zh-CN': '快捷链接', 'zh-Hant': '快速連結', 'en-US': 'Quick links' }, locale, 'Quick links'),
      community: resolveLocalized({ 'zh-CN': '社区与支持', 'zh-Hant': '社群與支援', 'en-US': 'Community & support' }, locale, 'Community & support'),
    },
    header: resolvedGroups.header,
    quick: resolvedGroups.quick,
    community: resolvedGroups.community,
    relatedSites,
  };
}
