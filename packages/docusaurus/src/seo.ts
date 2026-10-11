import type { HtmlTagObject } from '@docusaurus/types';
import { buildOrganizationStructuredData, resolveSeoImageUrl, serializeJsonLd } from '@hagicode/hagilight-core/seo';
import type { ResolvedSeoOptions } from './options.js';

export interface SeoSite {
  title: string;
  url: string;
  baseUrl: string;
}

export function resolveSharingImage(image: string | undefined, site: Pick<SeoSite, 'url' | 'baseUrl'>): string | undefined {
  return image === undefined ? undefined : resolveSeoImageUrl(image, { site: site.url, basePath: site.baseUrl });
}

export interface SharingMetadataValues {
  siteName: string;
  image: string | undefined;
}

export function sharingMetadataFor(
  seo: ResolvedSeoOptions,
  site: Pick<SeoSite, 'title' | 'url' | 'baseUrl'>,
  themeImage: string | undefined,
): SharingMetadataValues | undefined {
  if (!seo.enabled) return undefined;
  return {
    siteName: site.title,
    image: themeImage === undefined ? resolveSharingImage(seo.image, site) : undefined,
  };
}

export function seoHeadTags(seo: ResolvedSeoOptions, site: SeoSite): HtmlTagObject[] {
  if (!seo.enabled) return [];
  const organization = buildOrganizationStructuredData({
    name: seo.organization.name ?? site.title,
    url: seo.organization.url ?? site.url,
    ...(seo.organization.logo === undefined ? {} : { logo: seo.organization.logo }),
  });
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.title,
    url: new URL(site.baseUrl, site.url).href,
  };
  return [organization, website].map((data) => ({
    tagName: 'script',
    attributes: { type: 'application/ld+json' },
    innerHTML: serializeJsonLd(data),
  }));
}
