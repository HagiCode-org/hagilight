import { resolveSiteLinks, type SiteLinksOptions } from '@hagicode/hagilight-core/links';

export interface FooterLinksInput {
  locale: string;
  baseUrl: string;
  links: SiteLinksOptions;
  rssEnabled: boolean;
}

export type FooterLinks = ReturnType<typeof resolveSiteLinks>;

export function resolveFooterLinks({ locale, baseUrl, links, rssEnabled }: FooterLinksInput): FooterLinks {
  const sitemap = links.overrides?.sitemap;
  return resolveSiteLinks(locale, {
    ...links,
    rssFeedUrl: links.rssFeedUrl ?? (rssEnabled ? `${baseUrl}rss.xml` : undefined),
    overrides: {
      ...links.overrides,
      sitemap: { ...sitemap, href: sitemap?.href ?? `${baseUrl}sitemap.xml` },
    },
  });
}
