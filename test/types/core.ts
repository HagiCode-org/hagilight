// Type fixture for @hagicode/hagilight-core. Each `@ts-expect-error` line must stay an error.
import {
  gaEventAttributes,
  handleGaClick,
  installGaEventTracking,
  siteLinkGaAttributes,
  type GaCategory,
  type GaEventAttributes,
  type GaEventParams,
} from '@hagicode/hagilight-core/analytics-events';
import { resolveFaviconHeadEntry, getHagilightFaviconDataUri } from '@hagicode/hagilight-core/favicon';
import { resolveSiteLinks, type SiteLink, type SiteLinksOptions } from '@hagicode/hagilight-core/links';
import { loadActivePromotions, type PromotionCard } from '@hagicode/hagilight-core/promotions';
import { generateRssFeed, resolveRssLocales, type RssFeedItem, type RssLocale } from '@hagicode/hagilight-core/rss';
import {
  RSS_OWNER,
  registerStarlightRssOwner,
  resolvePlainAstroRssOwner,
  type RssOwnerClaim,
  type RssOwnerPackage,
} from '@hagicode/hagilight-core/rss-ownership';
import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
  composeCanonicalSeoHead,
  resolveSeoMetadata,
  serializeJsonLd,
  type HeadEntry,
  type SeoMetadata,
} from '@hagicode/hagilight-core/seo';
import { seoSchema, type SeoFrontmatter } from '@hagicode/hagilight-core/seo-schema';

const linkOptions: SiteLinksOptions = {
  rssFeedUrl: '/rss.xml',
  overrides: { sitemap: { href: '/manual/sitemap-index.xml' } },
  removeLinks: { quick: ['about'] },
};
const quickLinks: SiteLink[] = resolveSiteLinks('zh-CN', linkOptions).quick;
const faviconHref: string | undefined = resolveFaviconHeadEntry([], { href: '/icon.ico' })?.attrs.href;
const faviconDataUri: string = getHagilightFaviconDataUri();

const items: RssFeedItem[] = [{ title: 'Post', link: '/post/', date: new Date() }];
const feed: Promise<Response> = generateRssFeed({
  site: new URL('https://example.test'),
  baseUrl: '/manual/',
  language: 'en-US',
  title: 'Feed',
  description: 'Updates',
  items,
});
const locales: RssLocale[] = resolveRssLocales({ root: { lang: 'en-US' }, 'zh-CN': 'zh-CN' });
const owner: RssOwnerPackage = resolvePlainAstroRssOwner([{ [RSS_OWNER]: { package: 'starlight', enabled: true } }]);
const claim: RssOwnerClaim = { package: 'astro', enabled: true };
const unregister: () => void = registerStarlightRssOwner(false);

const head: HeadEntry[] = [{ tag: 'meta', attrs: { property: 'og:title', content: 'Title' } }];
const metadata: SeoMetadata = resolveSeoMetadata({ pageSeo: { title: 'Title' }, site: 'https://example.test' });
const composed: HeadEntry[] = composeCanonicalSeoHead(head, { ...metadata, site: 'https://example.test' }, {
  canonicalUrl: 'https://example.test/page/',
});
const jsonLd: string = serializeJsonLd([
  buildArticleStructuredData({ url: 'https://example.test/a/', title: 'A' }),
  buildBreadcrumbStructuredData([{ name: 'Home', url: 'https://example.test/' }]),
]);
const frontmatter: SeoFrontmatter = seoSchema.parse({ seo: { title: 'Title' } });
const promotions: Promise<PromotionCard[]> = loadActivePromotions({ locale: 'en-US' });
const category: GaCategory = 'download';
const tagged: GaEventAttributes = gaEventAttributes({ category, label: 'customDownload', location: 'footer' });
const siteTagged: Partial<GaEventAttributes> = siteLinkGaAttributes(quickLinks[0]!, 'footer');
const sentParams: GaEventParams[] = [];
handleGaClick(new Event('click'), (_action, params) => sentParams.push(params));
const installed: boolean = installGaEventTracking();

// @ts-expect-error Link overrides accept only catalog link keys.
resolveSiteLinks('en-US', { overrides: { unknownLink: { href: '/' } } });
// @ts-expect-error Event categories are limited to the documented vocabulary.
gaEventAttributes({ category: 'purchase', label: 'x', location: 'footer' });
// @ts-expect-error RSS items require a link.
generateRssFeed({ site: 'https://example.test', title: 'Feed', description: 'Updates', items: [{ title: 'Post' }] });
// @ts-expect-error RSS feeds require a description.
generateRssFeed({ site: 'https://example.test', title: 'Feed', items });
// @ts-expect-error Ownership flags are booleans.
registerStarlightRssOwner('yes');
// @ts-expect-error Only the plain-Astro and Starlight packages can own RSS routes.
const invalidClaim: RssOwnerClaim = { package: 'core', enabled: true };
// @ts-expect-error Favicon overrides are URLs, not booleans.
resolveFaviconHeadEntry([], { href: true });

export {
  claim, composed, faviconDataUri, faviconHref, feed, frontmatter, installed, invalidClaim, jsonLd, locales, owner,
  promotions, quickLinks, sentParams, siteTagged, tagged, unregister,
};
