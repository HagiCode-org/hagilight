import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { HookParameters, StarlightPlugin } from '@astrojs/starlight/types';
import { resolveFaviconHeadEntry } from '@hagicode/hagilight-core/favicon';
import type { BuildInfo } from '@hagicode/hagilight-core/build-info';
import { resolveBuildInfo } from '@hagicode/hagilight-core/build-info-resolver';
import { resolveFooterAvatarOptions, type ResolvedFooterAvatarOptions } from '@hagicode/hagilight-core/footer-avatar';
import { checkContentImageRegistration, registerContentImages } from '@hagicode/hagilight-core/content-images';
import type { SiteLinksOptions } from '@hagicode/hagilight-core/links';
import { DEFAULT_POSTHOG_API_KEY, POSTHOG_API_KEY_PATTERN } from '@hagicode/hagilight-core/posthog';
import {
  validatePolicyVersion,
  validatePrivacyUrl,
  type ConsentPopupOptions,
} from '@hagicode/hagilight-core/consent-markup';
import { resolveRssLocales, type RssLocale } from '@hagicode/hagilight-core/rss';
import {
  RSS_OWNER,
  registerStarlightRssOwner,
  type RssOwnerClaim,
} from '@hagicode/hagilight-core/rss-ownership';
import { isValidSeoImageReference, resolveSeoImageUrl } from '@hagicode/hagilight-core/seo';
import { resolveSiteMetadataOption } from '@hagicode/hagilight-core/site-metadata';
import { registerStarlightSiteMetadataOwner } from '@hagicode/hagilight-core/site-metadata-ownership';
import type { AIDisclosureDefaults } from './ai-disclosures.js';
import type { StarlightRssRuntimeConfig } from './rss-renderer.js';
import { resolveRssOptions, type RssContentOptions } from './rss-utils.js';
import { resolveSeoLocales, type SeoLocale, type SeoOrganization } from './seo-utils.js';
import { createStarlightMetadataFinalizer, type StarlightSiteMetadataSetup } from './site-metadata.js';
import { THEME_BOOTSTRAP } from './themes.js';

export interface HagilightToggleOptions {
  enabled?: boolean;
}

export interface HagilightPromotionOptions extends HagilightToggleOptions {
  /** Swap the showcase illustration for one random pool entry per page view. Defaults to `true`. */
  randomAvatar?: boolean;
}

export interface HagilightFooterOptions {
  /** Show the decorative avatar in the footer brand block. Defaults to `true`. */
  avatar?: boolean;
  /** Swap the footer avatar for one random pool entry per page view. Defaults to `true`. */
  randomAvatar?: boolean;
}

export interface HagilightGoogleAnalyticsOptions {
  /** Defaults to `true` when the provider options are omitted, otherwise to whether `measurementId` is set. */
  enabled?: boolean;
  /** Google Analytics 4 measurement ID such as `G-ABC123`. */
  measurementId?: `G-${string}`;
}

export interface HagilightFiftyOneLaOptions {
  /** Defaults to `true` when the provider options are omitted, otherwise to whether `siteId` is set. */
  enabled?: boolean;
  siteId?: string;
}

export interface HagilightAnalyticsOptions {
  googleAnalytics?: HagilightGoogleAnalyticsOptions;
  fiftyOneLa?: HagilightFiftyOneLaOptions;
  posthog?: HagilightPostHogOptions;
  consent?: HagilightConsentOptions;
}

export interface HagilightConsentOptions {
  /** Defaults to on when any analytics provider is enabled. `false` restores immediate loading. */
  enabled?: boolean;
  /** An absolute HTTP(S) URL or a site-relative path. Omitted means the details have no privacy link. */
  privacyUrl?: string;
  /** Defaults to `1`. Changing it asks every visitor again. 1 to 32 letters, digits, dots, underscores or hyphens. */
  policyVersion?: string;
}

export interface HagilightPostHogOptions {
  /** Defaults to true when the provider options are omitted, otherwise to whether apiKey is set. */
  enabled?: boolean;
  apiKey?: string;
}

export interface HagilightSeoOptions {
  /** Replace Starlight's Head with Hagilight SEO metadata. Defaults to `true`; requires Astro `site`. */
  enabled?: boolean;
  title?: string;
  description?: string;
  /** Absolute HTTP(S) URL or site-root path of the default sharing image. */
  image?: string;
  organization?: SeoOrganization;
}

export interface HagilightRssOptions extends RssContentOptions {
  /** Generate `/rss.xml` and localized feeds. Defaults to `true`; requires Astro `site`. */
  enabled?: boolean;
}

export interface HagilightThemesOptions {
  /**
   * Replace Starlight's light/dark picker with the Hagilight theme picker: four themes
   * (the default plus Ocean, Sakura, and Forest) in light and dark, plus a "default"
   * choice that follows the system color scheme and renders the Forest theme, so
   * first-visit users see Forest until they pick another theme.
   * Defaults to `true`.
   */
  enabled?: boolean;
}

export interface HagilightContentComponentsOptions {
  pageTitle?: boolean;
  markdownContent?: boolean;
}

export type HagilightAIDisclosureOptions = Partial<AIDisclosureDefaults>;

export interface HagilightMetadataOptions {
  /** Defaults to `true`. */
  enabled?: boolean;
  /** Site name. Defaults to the Starlight `title` for the default locale, then the site hostname. */
  name?: string;
  /** Site description. Defaults to the Starlight `description` when the site sets one. */
  description?: string;
}

export interface HagilightStarlightOptions {
  /**
   * Generate `/.well-known/hagilight.metadata.json` after the build. Defaults to `true`; `false`
   * opts out, and an options object may set `name` and `description`. A site-provided file is
   * never overwritten. When a plain-Astro `hagilight()` is also registered, this plugin writes
   * the file and the plain-Astro integration defers to it.
   */
  metadata?: boolean | HagilightMetadataOptions;
  header?: HagilightToggleOptions;
  notFoundPage?: HagilightToggleOptions;
  rss?: HagilightRssOptions;
  analytics?: HagilightAnalyticsOptions;
  seo?: HagilightSeoOptions;
  contentComponents?: HagilightContentComponentsOptions;
  aiDisclosures?: HagilightAIDisclosureOptions;
  /** Theme picker with three extra light/dark themes and a Forest first-visit default. */
  themes?: HagilightThemesOptions;
  /** Footer brand block options: the decorative avatar and its random pool. */
  footer?: HagilightFooterOptions;
  /** End-of-article HagiCode introduction. */
  hagicodePromotion?: HagilightPromotionOptions;
  /** Floating promotion banner rendered after the footer. */
  promoto?: HagilightToggleOptions;
  /** Body-image baseline (`loading`, `decoding`, marker class) for Markdown and MDX. Defaults to enabled. */
  contentImages?: HagilightToggleOptions;
  /** Header and footer link customization passed to `resolveSiteLinks`. */
  links?: SiteLinksOptions;
}

type ConfigSetup = HookParameters<'config:setup'>;
type StarlightUserConfig = ConfigSetup['config'];
type HeadEntries = NonNullable<StarlightUserConfig['head']>;

interface ResolvedSeoOptions {
  enabled: boolean;
  title: string | undefined;
  description: string | undefined;
  image?: string;
  organization?: SeoOrganization;
}

interface SerializedOptions {
  promotoEnabled: boolean;
  hagicodePromotionEnabled: boolean;
  hagicodePromotionRandomAvatar: boolean;
  footerAvatar: ResolvedFooterAvatarOptions;
  links: SiteLinksOptions;
  googleAnalyticsMeasurementId: string | undefined;
  fiftyOneLaId: string | undefined;
  posthogApiKey: string | undefined;
  consentEnabled: boolean;
  consentProviders: ConsentPopupOptions['providers'];
  consentPrivacyUrl: string | undefined;
  consentPolicyVersion: string;
  aiDisclosures: AIDisclosureDefaults;
  seoEnabled: boolean;
  seo: ResolvedSeoOptions;
  seoSite?: string | undefined;
  seoBasePath?: string;
  seoLocales?: SeoLocale[];
  seoDefaultLocale?: string;
  seoFormat?: string;
  seoTrailingSlash?: string;
  consumerHead?: HeadEntries;
}

interface ComponentIds {
  header: string | undefined;
  hero: string | undefined;
  footer: string;
  pageTitle: string | undefined;
  markdownContent: string | undefined;
  head: string | undefined;
  themeSelect: string | undefined;
}

interface ProviderSpec {
  name: string;
  idKey: string;
  pattern: RegExp;
  defaultId: string;
}

const packageRoot = new URL('../', import.meta.url);
const PACKAGE_VERSION = (
  JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8')) as { version: string }
).version;
const packageFile = (name: string): string => fileURLToPath(new URL(name, packageRoot));
const coreExport = (name: string): string => fileURLToPath(import.meta.resolve(`@hagicode/hagilight-core/${name}`));

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalRecord(value: unknown, label: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError(`Hagilight ${label} options must be an object.`);
  return value;
}

function optionalBoolean(
  record: Record<string, unknown> | undefined,
  key: string,
  label: string,
): boolean | undefined {
  const value = record?.[key];
  if (value !== undefined && typeof value !== 'boolean') {
    throw new TypeError(`Hagilight ${label} option must be a boolean.`);
  }
  return value;
}

const NOOP_IMAGE_SERVICE = 'astro/assets/services/noop';
const NOOP_IMAGE_SERVICE_WARNING = '@hagicode/hagilight-starlight: the Astro image service is the passthrough no-op, so the showcase AVIF and JPEG tiers will serve the original bytes. Use the default sharp service or another transforming image service.';
const GOOGLE_ID_PATTERN = /^G-[A-Z0-9]+$/u;
const FIFTY_ONE_LA_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
const DEFAULT_GOOGLE_ANALYTICS_ID = 'G-EN03FMT2Q4';
const DEFAULT_51LA_ID = 'L6b88a5yK4h2Xnci';
const defaultLogo = coreExport('logo.png');
const contentWidthCssPath = packageFile('content-width.css');
const themesCssPath = packageFile('themes.css');
const contentWidthHeadScript = `(() => {
  let mode = 'wide';
  try {
    const stored = localStorage.getItem('hagilight-content-width');
    if (stored === 'wide' || stored === 'narrow') mode = stored;
  } catch {
    mode = 'wide';
  }
  document.documentElement.dataset.hagilightContentWidth = mode;
})();`;

interface ResolvedConsentOptions {
  enabled: boolean;
  privacyUrl: string | undefined;
  policyVersion: string;
  providers: ConsentPopupOptions['providers'];
}

/**
 * Consent is on by default whenever a provider is enabled, and `enabled: false` restores immediate loading. Invalid
 * values throw from the core validators, which name the option.
 */
function resolveConsentOptions(config: unknown, providers: ConsentPopupOptions['providers']): ResolvedConsentOptions {
  const record = optionalRecord(config, 'analytics consent');
  const requested = optionalBoolean(record, 'enabled', 'analytics consent enabled');
  return {
    enabled: providers.length > 0 && (requested ?? true),
    privacyUrl: validatePrivacyUrl(record?.privacyUrl),
    policyVersion: validatePolicyVersion(record?.policyVersion),
    providers,
  };
}

function resolveProvider(config: unknown, { name, idKey, pattern, defaultId }: ProviderSpec): string | undefined {
  if (config !== undefined && !isRecord(config)) {
    throw new TypeError(`Hagilight ${name} analytics options must be an object.`);
  }

  const enabled = config === undefined ? true : config.enabled ?? Boolean(config[idKey]);
  if (!enabled) return undefined;

  const id = config === undefined ? defaultId : config[idKey];
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error(`Hagilight ${name} analytics is enabled but its ${idKey} is missing.`);
  }
  if (!pattern.test(id)) {
    throw new Error(`Hagilight ${name} analytics ${idKey} has an invalid format.`);
  }
  return id;
}

function resolveAIDisclosures(config: unknown): AIDisclosureDefaults {
  if (config === undefined) {
    return {
      isAITranslation: false,
      isAIAuthor: false,
      sourceLocale: 'root',
    };
  }
  if (!isRecord(config)) {
    throw new TypeError('Hagilight aiDisclosures options must be an object.');
  }
  for (const key of ['isAITranslation', 'isAIAuthor'] as const) {
    if (config[key] !== undefined && typeof config[key] !== 'boolean') {
      throw new TypeError(`Hagilight aiDisclosures ${key} option must be a boolean.`);
    }
  }
  const sourceLocale = config.sourceLocale === undefined ? 'root' : config.sourceLocale;
  if (typeof sourceLocale !== 'string' || !sourceLocale.trim() || /[/\\]/u.test(sourceLocale)) {
    throw new TypeError('Hagilight aiDisclosures sourceLocale option must be a non-empty string.');
  }
  return {
    isAITranslation: (config.isAITranslation as boolean | undefined) ?? false,
    isAIAuthor: (config.isAIAuthor as boolean | undefined) ?? false,
    sourceLocale: sourceLocale.trim(),
  };
}

function resolveHagicodePromotion(config: unknown): boolean {
  if (config === undefined) return true;
  if (!isRecord(config)) {
    throw new TypeError('Hagilight hagicodePromotion options must be an object.');
  }
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    throw new TypeError('Hagilight hagicodePromotion enabled option must be a boolean.');
  }
  return (config.enabled as boolean | undefined) ?? true;
}

function resolveHagicodePromotionRandomAvatar(config: unknown): boolean {
  if (config === undefined || !isRecord(config)) return true;
  if (config.randomAvatar !== undefined && typeof config.randomAvatar !== 'boolean') {
    throw new TypeError('Hagilight hagicodePromotion randomAvatar option must be a boolean.');
  }
  return (config.randomAvatar as boolean | undefined) ?? true;
}

function getRssFeedUrl(config: StarlightUserConfig): string | undefined {
  if (!Array.isArray(config.head)) return undefined;
  const rssLink = config.head.find((entry) => {
    const attrs = entry?.attrs;
    return entry?.tag === 'link'
      && attrs?.rel === 'alternate'
      && typeof attrs.type === 'string'
      && attrs.type.toLowerCase() === 'application/rss+xml'
      && typeof attrs.href === 'string';
  });
  return rssLink?.attrs?.href as string | undefined;
}

function optionalSeoText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Hagilight SEO ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function resolveSeoOptions(config: unknown): ResolvedSeoOptions {
  if (config !== undefined && !isRecord(config)) {
    throw new TypeError('Hagilight seo options must be an object.');
  }
  if (config?.enabled !== undefined && typeof config.enabled !== 'boolean') {
    throw new TypeError('Hagilight seo enabled option must be a boolean.');
  }

  const image = config?.image;
  if (image !== undefined && !isValidSeoImageReference(image)) {
    throw new TypeError('Hagilight SEO image must be an absolute HTTP(S) URL or a site-root path.');
  }

  let organization: SeoOrganization | undefined;
  if (config?.organization !== undefined) {
    const identity = config.organization;
    if (!isRecord(identity)) {
      throw new TypeError('Hagilight SEO organization option must be an object.');
    }
    const name = optionalSeoText(identity.name, 'organization name');
    const url = optionalSeoText(identity.url, 'organization URL');
    if (!name) throw new TypeError('Hagilight SEO organization name is required.');
    if (!url) throw new TypeError('Hagilight SEO organization URL is required.');
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new TypeError('Hagilight SEO organization URL must be an absolute HTTP(S) URL.');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      throw new TypeError('Hagilight SEO organization URL must be an absolute HTTP(S) URL.');
    }
    if (identity.logo !== undefined && !isValidSeoImageReference(identity.logo)) {
      throw new TypeError('Hagilight SEO organization logo must be an absolute HTTP(S) URL or a site-root path.');
    }
    organization = {
      name,
      url: parsedUrl.href,
      ...(identity.logo === undefined ? {} : { logo: identity.logo }),
    };
  }

  return {
    enabled: (config?.enabled as boolean | undefined) ?? true,
    title: optionalSeoText(config?.title, 'title'),
    description: optionalSeoText(config?.description, 'description'),
    ...(image === undefined ? {} : { image }),
    ...(organization === undefined ? {} : { organization }),
  };
}

function resolveAstroSite(site: unknown): string {
  if (site === undefined || site === null || site === '') {
    throw new Error('Hagilight SEO requires an absolute Astro site URL. Set site or disable generated SEO with seo: { enabled: false }.');
  }
  let parsed: URL;
  try {
    parsed = new URL(site as string | URL);
  } catch {
    throw new Error('Hagilight SEO requires Astro site to be an absolute HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Hagilight SEO requires Astro site to be an absolute HTTP(S) URL.');
  }
  return parsed.href;
}

function resolveDefaultSeoLocale(defaultLocale: unknown, locales: readonly SeoLocale[]): string {
  const configured = isRecord(defaultLocale)
    ? defaultLocale.locale ?? defaultLocale.lang
    : defaultLocale;
  if (configured === undefined) {
    return locales.find(({ route }) => route === 'root')?.route ?? locales[0]!.route;
  }
  const found = locales.find(({ route, lang }) =>
    route === configured || lang.toLowerCase() === String(configured).toLowerCase(),
  );
  if (!found) {
    throw new Error(`Hagilight SEO default locale "${configured}" is not present in Starlight locales.`);
  }
  return found.route;
}

function createConfiguredIntegration(
  instanceId: string,
  serializedOptions: SerializedOptions,
  rssConfig: StarlightRssRuntimeConfig,
  rssLocaleFeedUrls: Record<string, string>,
  componentIds: ComponentIds,
  getConfiguredRssFeed: () => string | undefined,
  generateRss: boolean,
  unregisterRssOwner: () => void,
  contentImagesEnabled: boolean,
  siteMetadata: StarlightSiteMetadataSetup,
  unregisterSiteMetadataOwner: () => void,
): AstroIntegration & { readonly [RSS_OWNER]: RssOwnerClaim } {
  const optionsId = `virtual:hagilight-starlight/${instanceId}/options`;
  const rssConfigId = 'virtual:hagilight-starlight/rss-config';
  const headerPath = componentIds.header ? packageFile('Header.astro') : undefined;
  const footerPath = packageFile('Footer.astro');
  const pageTitlePath = packageFile('PageTitle.astro');
  const markdownContentPath = packageFile('MarkdownContent.astro');
  const seoHeadPath = packageFile('SEOHead.astro');
  const headerSource = headerPath
    ? `---
import Header from ${JSON.stringify(headerPath)};
import options from '${optionsId}';
---

<Header links={options.links} />
`
    : undefined;
  const promotionImport = serializedOptions.promotoEnabled
    ? `import PromotoBanner from ${JSON.stringify(coreExport('PromotoBanner'))};`
    : '';
  const promotionRender = serializedOptions.promotoEnabled
    ? '<PromotoBanner siteId={options.links?.siteId} />'
    : '';
  const analyticsImport = serializedOptions.fiftyOneLaId
    ? `import Analytics51LA from ${JSON.stringify(coreExport('Analytics51LA'))};`
    : '';
  // Consent-off sites keep their generated markup unchanged; the attribute appears only when the popup is mounted.
  const consentAttribute = serializedOptions.consentEnabled ? ' consent={true}' : '';
  const analyticsRender = serializedOptions.fiftyOneLaId
    ? `<Analytics51LA siteId={options.fiftyOneLaId}${consentAttribute} />`
    : '';
  const consentImport = serializedOptions.consentEnabled
    ? `import CookieConsent from ${JSON.stringify(coreExport('CookieConsent'))};`
    : '';
  const consentRender = serializedOptions.consentEnabled
    ? '<CookieConsent providers={options.consentProviders} privacyUrl={options.consentPrivacyUrl} policyVersion={options.consentPolicyVersion} locale={Astro.locals?.starlightRoute?.locale} />'
    : '';
  const footerSource = `---
import Footer from ${JSON.stringify(footerPath)};
${promotionImport}
${analyticsImport}
${consentImport}
import options from '${optionsId}';
---

<Footer
  locale={Astro.locals?.starlightRoute?.locale}
  links={options.links}
  rssFeedUrl={options.rssFeedUrl}
  rssLocaleFeedUrls={options.rssLocaleFeedUrls}
  buildInfo={options.buildInfo}
  avatar={options.footerAvatar.avatar}
  randomAvatar={options.footerAvatar.randomAvatar}
${consentAttribute ? `  consent={true}
` : ''}/>
${promotionRender}
${analyticsRender}
${consentRender}
`;
  const pageTitleSource = `---
import PageTitle from ${JSON.stringify(pageTitlePath)};
---

<PageTitle />
`;
  const markdownContentSource = `---
import MarkdownContent from ${JSON.stringify(markdownContentPath)};
import options from '${optionsId}';
---

<MarkdownContent
  aiDisclosures={options.aiDisclosures}
  hagicodePromotionEnabled={options.hagicodePromotionEnabled}
  hagicodePromotionRandomAvatar={options.hagicodePromotionRandomAvatar}
  siteId={options.links?.siteId}
><slot /></MarkdownContent>
`;
  const headSource = `---
import DefaultHead from '@astrojs/starlight/components/Head.astro';
import SEOHead from ${JSON.stringify(seoHeadPath)};
import GoogleAnalytics from ${JSON.stringify(coreExport('GoogleAnalytics'))};
${serializedOptions.posthogApiKey ? `import PostHog from ${JSON.stringify(coreExport('PostHog'))};` : ''}
import { classifyPagePath } from ${JSON.stringify(coreExport('posthog-events'))};
import options from '${optionsId}';
const isNotFound = /(?:^|\\/)404(?:\\.html)?\\/?$/u.test(Astro.url.pathname);
const route = Astro.locals.starlightRoute;
const pageType = isNotFound
  ? '404'
  : route?.entry?.data?.template === 'splash'
    ? 'home'
    : classifyPagePath(Astro.url.pathname, { base: import.meta.env.BASE_URL, locales: route?.locale ? [route.locale] : [] });
---

{options.seoEnabled ? <SEOHead options={options} /> : <DefaultHead />}
${serializedOptions.posthogApiKey ? `<PostHog apiKey={options.posthogApiKey} framework="starlight" version={${JSON.stringify(PACKAGE_VERSION)}} siteId={options.links?.siteId} pageType={pageType}${serializedOptions.consentEnabled ? ' consent={true}' : ''} />` : ''}
{!isNotFound && options.googleAnalyticsMeasurementId && (
  <GoogleAnalytics measurementId={options.googleAnalyticsMeasurementId}${serializedOptions.consentEnabled ? ' consent={true}' : ''} />
)}
`;
  const modules = new Map<string, string>([
    ...(componentIds.header && headerSource ? [[componentIds.header, headerSource] as const] : []),
    [componentIds.footer, footerSource],
    ...(componentIds.pageTitle ? [[componentIds.pageTitle, pageTitleSource] as const] : []),
    ...(componentIds.markdownContent ? [[componentIds.markdownContent, markdownContentSource] as const] : []),
    ...(componentIds.head ? [[componentIds.head, headSource] as const] : []),
  ]);
  let buildInfo: BuildInfo | undefined;
  const vitePlugin = {
    name: `@hagicode/hagilight-starlight:${instanceId}`,
    resolveId(id: string): string | null {
      return modules.has(id) || id === optionsId || id === rssConfigId ? `\0${id}` : null;
    },
    load(id: string): string | null {
      if (!id.startsWith('\0')) return null;
      const moduleId = id.slice(1);
      if (moduleId === optionsId) {
        return `export default ${JSON.stringify({
          ...serializedOptions,
          rssFeedUrl: getConfiguredRssFeed(),
          rssLocaleFeedUrls,
          buildInfo,
        })};`;
      }
      if (moduleId === rssConfigId) return `export default ${JSON.stringify(rssConfig)};`;
      return modules.get(moduleId) ?? null;
    },
  };

  return {
    name: `@hagicode/hagilight-starlight:${instanceId}`,
    [RSS_OWNER]: { package: 'starlight', enabled: generateRss },
    hooks: {
      'astro:config:setup'({ config, injectRoute, updateConfig, logger }) {
        registerContentImages({ config, logger, enabled: contentImagesEnabled });
        buildInfo = resolveBuildInfo({ root: fileURLToPath(config.root) });
        if (generateRss) {
          injectRoute({
            pattern: '/rss.xml',
            entrypoint: packageFile('rss.xml.ts'),
            prerender: true,
          });
          injectRoute({
            pattern: '/rss.[language].xml',
            entrypoint: packageFile('rss.[language].xml.ts'),
            prerender: true,
          });
        }
        // Starlight splices its own sitemap into the integration list before this setup runs, so
        // the finalizer appended in the same update runs after the sitemap has written its index.
        updateConfig({
          vite: { plugins: [vitePlugin] },
          ...(siteMetadata.enabled
            ? { integrations: [createStarlightMetadataFinalizer(siteMetadata, () => buildInfo)] }
            : {}),
        });
      },
      'astro:config:done'({ config, logger }) {
        unregisterRssOwner();
        unregisterSiteMetadataOwner();
        checkContentImageRegistration({ config, logger, enabled: contentImagesEnabled });
        if (config.image?.service?.entrypoint === NOOP_IMAGE_SERVICE) {
          logger.warn(NOOP_IMAGE_SERVICE_WARNING);
        }
      },
    },
  };
}

/** Starlight plugin that applies HagiCode header, footer, content, SEO, RSS, and analytics customizations. */
export default function hagilight(options: HagilightStarlightOptions = {}): StarlightPlugin {
  if (!isRecord(options)) {
    throw new TypeError('Hagilight Starlight options must be an object.');
  }
  const input: Record<string, unknown> = options;
  const header = optionalRecord(input.header, 'header');
  const headerEnabled = optionalBoolean(header, 'enabled', 'header enabled') !== false;
  const notFoundPage = optionalRecord(input.notFoundPage, 'notFoundPage');
  const notFoundPageEnabled = optionalBoolean(notFoundPage, 'enabled', 'notFoundPage enabled') !== false;
  const rss = optionalRecord(input.rss, 'rss');
  const rssEnabled = optionalBoolean(rss, 'enabled', 'rss enabled') !== false;
  const rssOptions = resolveRssOptions(rss);
  const analytics = optionalRecord(input.analytics, 'analytics') ?? {};
  const seo = resolveSeoOptions(input.seo);
  const contentComponents = optionalRecord(input.contentComponents, 'contentComponents');
  const themes = optionalRecord(input.themes, 'themes');
  const themesEnabled = optionalBoolean(themes, 'enabled', 'themes enabled') !== false;
  const pageTitleEnabled = optionalBoolean(contentComponents, 'pageTitle', 'contentComponents pageTitle') !== false;
  const markdownContentEnabled = optionalBoolean(
    contentComponents,
    'markdownContent',
    'contentComponents markdownContent',
  ) !== false;
  const aiDisclosures = resolveAIDisclosures(input.aiDisclosures);
  const hagicodePromotionEnabled = resolveHagicodePromotion(input.hagicodePromotion);
  const hagicodePromotionRandomAvatar = resolveHagicodePromotionRandomAvatar(input.hagicodePromotion);
  const footerOptions = optionalRecord(input.footer, 'footer');
  const footerAvatar = resolveFooterAvatarOptions({
    avatar: optionalBoolean(footerOptions, 'avatar', 'footer avatar'),
    randomAvatar: optionalBoolean(footerOptions, 'randomAvatar', 'footer randomAvatar'),
  });
  const googleAnalyticsMeasurementId = resolveProvider(analytics.googleAnalytics, {
    name: 'Google Analytics',
    idKey: 'measurementId',
    pattern: GOOGLE_ID_PATTERN,
    defaultId: DEFAULT_GOOGLE_ANALYTICS_ID,
  });
  const fiftyOneLaId = resolveProvider(analytics.fiftyOneLa, {
    name: '51LA',
    idKey: 'siteId',
    pattern: FIFTY_ONE_LA_ID_PATTERN,
    defaultId: DEFAULT_51LA_ID,
  });
  const posthog = optionalRecord(analytics.posthog, 'PostHog analytics');
  optionalBoolean(posthog, 'enabled', 'PostHog analytics enabled');
  const posthogApiKey = resolveProvider(analytics.posthog, {
    name: 'PostHog',
    idKey: 'apiKey',
    pattern: POSTHOG_API_KEY_PATTERN,
    defaultId: DEFAULT_POSTHOG_API_KEY,
  });
  const consentProviders: ConsentPopupOptions['providers'] = [
    ...(googleAnalyticsMeasurementId ? ['googleAnalytics' as const] : []),
    ...(fiftyOneLaId ? ['fiftyOneLa' as const] : []),
    ...(posthogApiKey ? ['posthog' as const] : []),
  ];
  const consent = resolveConsentOptions(analytics.consent, consentProviders);
  const promoto = optionalRecord(input.promoto, 'promoto');
  const promotoEnabled = optionalBoolean(promoto, 'enabled', 'promoto enabled') !== false;
  const contentImages = optionalRecord(input.contentImages, 'contentImages');
  const contentImagesEnabled = optionalBoolean(contentImages, 'enabled', 'contentImages enabled') !== false;
  const instanceId = randomUUID();
  const componentIds: ComponentIds = {
    header: headerEnabled
      ? `virtual:hagilight-starlight/${instanceId}/Header.astro`
      : undefined,
    hero: notFoundPageEnabled
      ? packageFile('NotFoundHero.astro')
      : undefined,
    footer: `virtual:hagilight-starlight/${instanceId}/Footer.astro`,
    pageTitle: pageTitleEnabled ? `virtual:hagilight-starlight/${instanceId}/PageTitle.astro` : undefined,
    markdownContent: markdownContentEnabled
      ? `virtual:hagilight-starlight/${instanceId}/MarkdownContent.astro`
      : undefined,
    head: seo.enabled || googleAnalyticsMeasurementId || posthogApiKey
      ? `virtual:hagilight-starlight/${instanceId}/Head.astro`
      : undefined,
    themeSelect: themesEnabled ? packageFile('ThemeSelect.astro') : undefined,
  };
  const serializedOptions: SerializedOptions = {
    promotoEnabled,
    hagicodePromotionEnabled,
    hagicodePromotionRandomAvatar,
    footerAvatar,
    links: options.links ?? {},
    googleAnalyticsMeasurementId,
    fiftyOneLaId,
    posthogApiKey,
    consentEnabled: consent.enabled,
    consentProviders: consent.providers,
    consentPrivacyUrl: consent.privacyUrl,
    consentPolicyVersion: consent.policyVersion,
    aiDisclosures,
    seoEnabled: seo.enabled,
    seo,
  };
  const unregisterRssOwner = registerStarlightRssOwner(rssEnabled);
  const metadata = resolveSiteMetadataOption(input.metadata);
  const unregisterSiteMetadataOwner = registerStarlightSiteMetadataOwner(metadata.enabled);

  return {
    name: '@hagicode/hagilight-starlight',
    hooks: {
      'config:setup'({ astroConfig, config, updateConfig, addIntegration }) {
        if (headerEnabled && config.components?.Header) {
          throw new Error('Hagilight cannot replace an existing Starlight Header override. Set header: { enabled: false } to keep it, or compose @hagicode/hagilight-starlight/Header directly.');
        }
        if (notFoundPageEnabled && config.components?.Hero) {
          throw new Error('Hagilight cannot replace an existing Starlight Hero override. Set notFoundPage: { enabled: false } to keep it, or compose @hagicode/hagilight-starlight/NotFoundHero directly.');
        }
        if (config.components?.Footer) {
          throw new Error('Hagilight cannot replace an existing Starlight Footer override.');
        }
        if (pageTitleEnabled && config.components?.PageTitle) {
          throw new Error('Hagilight cannot replace an existing Starlight PageTitle override. Set contentComponents: { pageTitle: false } and compose @hagicode/hagilight-starlight/ContentLayoutToggle into your PageTitle component.');
        }
        if (markdownContentEnabled && config.components?.MarkdownContent) {
          throw new Error('Hagilight cannot replace an existing Starlight MarkdownContent override. Set contentComponents: { markdownContent: false } and compose @hagicode/hagilight-starlight/MarkdownContent into your MarkdownContent component.');
        }
        if (themesEnabled && config.components?.ThemeSelect) {
          throw new Error('Hagilight cannot replace an existing Starlight ThemeSelect override. Set themes: { enabled: false } to keep it, or compose @hagicode/hagilight-starlight/ThemeSelect into your component.');
        }
        if (componentIds.head && config.components?.Head) {
          if (seo.enabled) {
            throw new Error('Hagilight SEO cannot replace an existing Starlight Head override. Set seo: { enabled: false }, analytics.googleAnalytics: { enabled: false }, and analytics.posthog: { enabled: false } to keep your Head, or compose SEO, @hagicode/hagilight-core/GoogleAnalytics and @hagicode/hagilight-core/PostHog explicitly.');
          }
          throw new Error('Hagilight Google Analytics or PostHog cannot replace an existing Starlight Head override. Set analytics.googleAnalytics: { enabled: false } and analytics.posthog: { enabled: false } to keep it, or compose @hagicode/hagilight-core/GoogleAnalytics and @hagicode/hagilight-core/PostHog in your Head.');
        }

        let seoSite: string | undefined;
        let seoLocales: SeoLocale[] = [];
        let defaultSeoLocale = 'root';
        if (seo.enabled) {
          seoSite = resolveAstroSite(astroConfig.site);
          seoLocales = resolveSeoLocales(config.locales);
          defaultSeoLocale = resolveDefaultSeoLocale(config.defaultLocale, seoLocales);
        }
        const basePath = astroConfig.base ?? '/';
        serializedOptions.seoSite = seoSite;
        serializedOptions.seoBasePath = basePath;
        serializedOptions.seoLocales = seoLocales;
        serializedOptions.seoDefaultLocale = defaultSeoLocale;
        serializedOptions.seoFormat = astroConfig.build?.format ?? 'directory';
        serializedOptions.seoTrailingSlash = astroConfig.trailingSlash ?? 'ignore';
        serializedOptions.seo = seo.enabled
          ? {
            ...seo,
            ...(seo.image === undefined
              ? {}
              : { image: resolveSeoImageUrl(seo.image, { site: seoSite, basePath }) }),
            ...(seo.organization === undefined
              ? {}
              : {
                organization: {
                  ...seo.organization,
                  ...(seo.organization.logo === undefined
                    ? {}
                    : { logo: resolveSeoImageUrl(seo.organization.logo, { site: seoSite, basePath }) }),
                },
              }),
          }
          : seo;
        serializedOptions.consumerHead = config.head ?? [];

        const generateRss = rssEnabled && !getRssFeedUrl(config);
        if (generateRss && !astroConfig.site) {
          throw new Error('Hagilight RSS requires the Astro site option. Set site or disable RSS with rss: { enabled: false }.');
        }
        const rssLocales: RssLocale[] = generateRss ? resolveRssLocales(config.locales) : [];
        const baseUrl = generateRss
          ? new URL((astroConfig.base ?? '/').replace(/\/?$/u, '/'), astroConfig.site)
          : undefined;
        const rssFeedUrl = baseUrl ? new URL('rss.xml', baseUrl).toString() : undefined;
        const rssLocaleFeedUrls = baseUrl
          ? Object.fromEntries(rssLocales
            .filter(({ filename }) => filename !== 'en')
            .map(({ lang, filename }) => [
              lang,
              new URL(`rss.${filename}.xml`, baseUrl).toString(),
            ]))
          : {};
        addIntegration(createConfiguredIntegration(
          instanceId,
          serializedOptions,
          { options: rssOptions, locales: rssLocales },
          rssLocaleFeedUrls,
          componentIds,
          () => getRssFeedUrl(config) ?? rssFeedUrl,
          generateRss,
          unregisterRssOwner,
          contentImagesEnabled,
          {
            enabled: metadata.enabled,
            name: metadata.name,
            description: metadata.description,
            title: config.title,
            siteDescription: (config as { description?: unknown }).description,
            locales: config.locales,
            defaultLocale: config.defaultLocale,
            site: astroConfig.site,
            base: astroConfig.base,
            publicDir: astroConfig.publicDir,
            analytics: {
              googleAnalytics: serializedOptions.googleAnalyticsMeasurementId !== undefined,
              fiftyOneLa: serializedOptions.fiftyOneLaId !== undefined,
              posthog: serializedOptions.posthogApiKey !== undefined,
            },
            features: { seo: seo.enabled, promoto: promotoEnabled, consent: consent.enabled },
          },
          unregisterSiteMetadataOwner,
        ));
        updateConfig({
          ...(config.logo === undefined ? { logo: { src: defaultLogo, alt: 'HagiCode' } } : {}),
          customCss: [
            ...(config.customCss ?? []),
            contentWidthCssPath,
            ...(themesEnabled ? [themesCssPath] : []),
          ],
          head: [
            ...(config.head ?? []),
            ...(rssFeedUrl ? [{
              tag: 'link' as const,
              attrs: { rel: 'alternate', type: 'application/rss+xml', href: rssFeedUrl },
            }] : []),
            { tag: 'script' as const, content: contentWidthHeadScript },
            ...(themesEnabled ? [{ tag: 'script' as const, content: THEME_BOOTSTRAP }] : []),
            ...(() => {
              const entry = resolveFaviconHeadEntry(
                config.head,
                config.favicon === undefined ? {} : { href: config.favicon },
              );
              return entry ? [entry] : [];
            })(),
          ],
          components: {
            ...config.components,
            ...(componentIds.header ? { Header: componentIds.header } : {}),
            ...(componentIds.hero ? { Hero: componentIds.hero } : {}),
            Footer: componentIds.footer,
            ...(componentIds.pageTitle ? { PageTitle: componentIds.pageTitle } : {}),
            ...(componentIds.markdownContent ? { MarkdownContent: componentIds.markdownContent } : {}),
            ...(componentIds.head ? { Head: componentIds.head } : {}),
            ...(componentIds.themeSelect ? { ThemeSelect: componentIds.themeSelect } : {}),
          },
        });
      },
    },
  };
}
