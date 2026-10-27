// Type fixture for @hagicode/hagilight-core. Each `@ts-expect-error` line must stay an error.
import { resolveTransitDestination, resolveTransitNavigation } from '@hagicode/hagilight-core/root-transit';

const transitPath: string = resolveTransitDestination('/en-US/', { site: 'https://example.test', base: '/manual/' });
resolveTransitNavigation(transitPath, new URL('https://example.test/manual/'), '/manual/');
// @ts-expect-error A destination is a configured string, not incoming URL state.
resolveTransitDestination(42, { site: 'https://example.test' });
// @ts-expect-error Validation needs the consuming site origin.
resolveTransitDestination('/en-US/', {});
import {
  gaEventAttributes,
  handleGaClick,
  installGaEventTracking,
  siteLinkGaAttributes,
  type GaCategory,
  type GaEventAttributes,
  type GaEventParams,
} from '@hagicode/hagilight-core/analytics-events';
import {
  rehypeContentImages,
  satteriContentImages,
  type ContentImageNode,
  type ContentImageOptions,
  type PictureStep,
  type SatteriContentImagePlugin,
} from '@hagicode/hagilight-core/content-images';
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
import {
  DEFAULT_POSTHOG_API_KEY,
  POSTHOG_API_HOST,
  POSTHOG_DEFAULTS,
  POSTHOG_PERSON_PROFILES,
  POSTHOG_UI_HOST,
  POSTHOG_API_KEY_PATTERN,
  posthogInitScript,
} from '@hagicode/hagilight-core/posthog';

const posthogScript: string = posthogInitScript();
posthogInitScript('phc_Custom123');
POSTHOG_API_KEY_PATTERN.test(DEFAULT_POSTHOG_API_KEY);
// @ts-expect-error Project keys must be strings.
posthogInitScript(42);
export { posthogScript, POSTHOG_API_HOST, POSTHOG_DEFAULTS, POSTHOG_PERSON_PROFILES, POSTHOG_UI_HOST };

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
const contentImageOptions: ContentImageOptions = { loading: 'eager', decoding: 'auto', className: 'figure-image' };
const contentImagePlugin: (tree: ContentImageNode) => void = rehypeContentImages(contentImageOptions);
const satteriPlugin: SatteriContentImagePlugin = satteriContentImages();
const picture: PictureStep = { enabled: true, publicDir: '/site/public' };
const pictureWithoutDir: PictureStep = { enabled: false };
const pictureAwareSatteri: SatteriContentImagePlugin = satteriContentImages({}, picture);
const pictureAwareUnified: (tree: ContentImageNode) => void = rehypeContentImages({}, pictureWithoutDir);

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
// @ts-expect-error Content-image loading is "lazy" or "eager".
rehypeContentImages({ loading: 'fast' });
// @ts-expect-error Content-image decoding is "async", "sync", or "auto".
rehypeContentImages({ decoding: 'defer' });
// @ts-expect-error Unknown content-image options are rejected.
satteriContentImages({ marker: 'x' });
// @ts-expect-error The public directory is a filesystem path string, not a number.
const invalidPicture: PictureStep = { enabled: true, publicDir: 3 };

export {
  claim, composed, contentImageOptions, contentImagePlugin, faviconDataUri, faviconHref, feed, frontmatter, installed,
  invalidClaim, invalidPicture, jsonLd, locales, owner, pictureAwareSatteri, pictureAwareUnified, picture, pictureWithoutDir,
  promotions, quickLinks, satteriPlugin, sentParams, siteTagged, tagged, unregister,
};
