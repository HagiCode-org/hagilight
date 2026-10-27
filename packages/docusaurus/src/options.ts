import type { SiteLinksOptions } from '@hagicode/hagilight-core/links';
import { resolveFooterAvatarOptions, type ResolvedFooterAvatarOptions } from '@hagicode/hagilight-core/footer-avatar';
import { DEFAULT_POSTHOG_API_KEY, POSTHOG_API_KEY_PATTERN } from '@hagicode/hagilight-core/posthog';
import {
  validatePolicyVersion,
  validatePrivacyUrl,
  type ConsentPopupOptions,
} from '@hagicode/hagilight-core/consent-markup';
import { isValidSeoImageReference, resolveAbsoluteHttpUrl } from '@hagicode/hagilight-core/seo';
import { resolveSiteMetadataOption, type SiteMetadataOption } from '@hagicode/hagilight-core/site-metadata';
import {
  DEFAULT_FIFTY_ONE_LA_ID,
  DEFAULT_GOOGLE_ANALYTICS_ID,
  FIFTY_ONE_LA_ID_PATTERN,
  GOOGLE_ANALYTICS_ID_PATTERN,
} from './analytics.js';

export interface FeatureToggle {
  enabled?: boolean;
}

export interface GoogleAnalyticsOptions extends FeatureToggle {
  measurementId?: string;
}

export interface FiftyOneLaOptions extends FeatureToggle {
  siteId?: string;
}

export interface AnalyticsOptions {
  googleAnalytics?: GoogleAnalyticsOptions;
  fiftyOneLa?: FiftyOneLaOptions;
  posthog?: PostHogOptions;
  consent?: ConsentOptions;
}

export interface ConsentOptions {
  /** Defaults to on when any analytics provider is enabled. `false` restores immediate loading. */
  enabled?: boolean;
  /** An absolute HTTP(S) URL or a site-relative path. Omitted means the details have no privacy link. */
  privacyUrl?: string;
  /** Defaults to `1`. Changing it asks every visitor again. */
  policyVersion?: string;
}

export interface ResolvedConsentOptions {
  enabled: boolean;
  privacyUrl: string | undefined;
  policyVersion: string;
  providers: ConsentPopupOptions['providers'];
}

export interface PostHogOptions extends FeatureToggle {
  apiKey?: string;
  /** `zero-results` sends search text only for searches with no results. Defaults to `off`; never changes enablement. */
  searchQuery?: PostHogSearchQueryOption;
}

export type PostHogSearchQueryOption = 'off' | 'zero-results';

export interface SeoOrganizationOptions {
  name?: string;
  url?: string;
  logo?: string;
}

export interface SeoOptions extends FeatureToggle {
  image?: string;
  organization?: SeoOrganizationOptions;
}

export interface RssOptions extends FeatureToggle {
  includeDocs?: boolean;
  includeBlog?: boolean;
}

export interface MetadataOptions extends FeatureToggle {
  /** Site name. Defaults to `siteConfig.title`. */
  name?: string;
  /** Site description. Defaults to `siteConfig.tagline`. */
  description?: string;
}

export interface FooterOptions extends FeatureToggle {
  /** The decorative avatar in the brand block. Defaults to `true`; `false` removes it. */
  avatar?: boolean;
  /** Swap the avatar for one random pool entry per page view. Defaults to `true`. */
  randomAvatar?: boolean;
}

export interface HagilightDocusaurusOptions {
  /**
   * Write `.well-known/hagilight.metadata.json` at the end of the build. Defaults to `true`;
   * `false` opts out, and an object may set `name` and `description`. A site-owned file in
   * `static/.well-known/` is kept. Only the default locale build writes the file.
   */
  metadata?: boolean | MetadataOptions;
  footer?: FooterOptions;
  links?: SiteLinksOptions;
  analytics?: AnalyticsOptions;
  promoto?: FeatureToggle;
  languageSelector?: FeatureToggle;
  seo?: SeoOptions;
  sitemap?: FeatureToggle;
  robots?: FeatureToggle;
  rss?: RssOptions;
  noIndex?: boolean;
}

export interface ResolvedSeoOptions {
  enabled: boolean;
  image: string | undefined;
  organization: SeoOrganizationOptions;
}

export interface ResolvedRssOptions {
  enabled: boolean;
  includeDocs: boolean;
  includeBlog: boolean;
}

export interface ResolvedHagilightOptions {
  footer: boolean;
  footerAvatar: ResolvedFooterAvatarOptions;
  links: SiteLinksOptions;
  googleAnalyticsId: string | undefined;
  fiftyOneLaId: string | undefined;
  posthogApiKey: string | undefined;
  consent: ResolvedConsentOptions;
  posthogSearchQuery: PostHogSearchQueryOption;
  promoto: boolean;
  languageSelector: boolean;
  seo: ResolvedSeoOptions;
  sitemap: boolean;
  robots: boolean;
  rss: ResolvedRssOptions;
  noIndex: boolean;
  metadata: SiteMetadataOption;
}

function invalid(path: string, reason: string): TypeError {
  return new TypeError(`@hagicode/hagilight-docusaurus option "${path}" ${reason}.`);
}

function objectOption(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function booleanOption(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw invalid(path, 'must be a boolean');
  return value;
}

function nonEmptyStringOption(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw invalid(path, 'must be a non-empty string');
  return value;
}

function resolveFooterAvatar(value: unknown): ResolvedFooterAvatarOptions {
  if (value === undefined) return resolveFooterAvatarOptions();
  const group = objectOption(value, 'footer');
  return resolveFooterAvatarOptions({
    avatar: booleanOption(group.avatar, 'footer.avatar'),
    randomAvatar: booleanOption(group.randomAvatar, 'footer.randomAvatar'),
  });
}

function featureEnabled(value: unknown, path: string): boolean {
  if (value === undefined) return true;
  return booleanOption(objectOption(value, path).enabled, `${path}.enabled`) ?? true;
}

function resolvePostHogSearchQuery(value: unknown): PostHogSearchQueryOption {
  if (value === undefined) return 'off';
  const mode = objectOption(value, 'analytics.posthog').searchQuery;
  if (mode === undefined || mode === 'off') return 'off';
  if (mode === 'zero-results') return mode;
  throw invalid('analytics.posthog.searchQuery', 'must be one of: off, zero-results');
}

/**
 * Removes `searchQuery` before provider resolution, because it never changes whether PostHog is enabled.
 * An object that held only `searchQuery` therefore counts as omitted, so the default key stays on.
 */
function providerOptionsWithoutSearchQuery(value: unknown): unknown {
  if (value === undefined || typeof value !== 'object' || value === null || !Object.hasOwn(value, 'searchQuery')) return value;
  const { searchQuery: _searchQuery, ...rest } = value as Record<string, unknown>;
  return Object.keys(rest).length === 0 ? undefined : rest;
}

function resolveProvider(
  value: unknown,
  path: string,
  idKey: 'measurementId' | 'siteId' | 'apiKey',
  pattern: RegExp,
  defaultId: string,
): string | undefined {
  if (value === undefined) return defaultId;
  const group = objectOption(value, path);
  const enabled = booleanOption(group.enabled, `${path}.enabled`) ?? Boolean(group[idKey]);
  if (!enabled) return undefined;

  const id = group[idKey];
  const idPath = `${path}.${idKey}`;
  if (typeof id !== 'string' || !id.trim()) {
    throw invalid(idPath, 'is required while the provider is enabled');
  }
  if (!pattern.test(id)) {
    throw invalid(idPath, 'has an invalid format');
  }
  return id;
}

function absoluteHttpUrlOption(value: unknown, path: string): string {
  try {
    return resolveAbsoluteHttpUrl(value, path).href;
  } catch {
    throw invalid(path, 'must be an absolute HTTP(S) URL');
  }
}

function resolveSeo(value: unknown): ResolvedSeoOptions {
  const group = value === undefined ? {} : objectOption(value, 'seo');
  const enabled = booleanOption(group.enabled, 'seo.enabled') ?? true;

  const image = nonEmptyStringOption(group.image, 'seo.image');
  if (image !== undefined && !isValidSeoImageReference(image)) {
    throw invalid('seo.image', 'must be an absolute HTTP(S) URL or a site-root path');
  }

  const organization: SeoOrganizationOptions = {};
  if (group.organization !== undefined) {
    const org = objectOption(group.organization, 'seo.organization');
    const name = nonEmptyStringOption(org.name, 'seo.organization.name');
    if (name !== undefined) organization.name = name;
    if (org.url !== undefined) organization.url = absoluteHttpUrlOption(org.url, 'seo.organization.url');
    const logo = nonEmptyStringOption(org.logo, 'seo.organization.logo');
    if (logo !== undefined) organization.logo = absoluteHttpUrlOption(logo, 'seo.organization.logo');
  }

  return { enabled, image, organization };
}

function resolveRss(value: unknown): ResolvedRssOptions {
  const group = value === undefined ? {} : objectOption(value, 'rss');
  return {
    enabled: booleanOption(group.enabled, 'rss.enabled') ?? true,
    includeDocs: booleanOption(group.includeDocs, 'rss.includeDocs') ?? true,
    includeBlog: booleanOption(group.includeBlog, 'rss.includeBlog') ?? true,
  };
}

/**
 * Consent is on by default whenever a provider is enabled; `enabled: false` restores immediate loading. Invalid values
 * throw from the core validators, which name the option.
 */
function resolveConsent(config: unknown, providers: ConsentPopupOptions['providers']): ResolvedConsentOptions {
  const record = config === undefined ? {} : (objectOption(config, 'analytics.consent') as ConsentOptions);
  const requested = booleanOption(record.enabled, 'analytics.consent.enabled');
  return {
    enabled: providers.length > 0 && (requested ?? true),
    privacyUrl: validatePrivacyUrl(record.privacyUrl),
    policyVersion: validatePolicyVersion(record.policyVersion),
    providers,
  };
}

export function resolveOptions(input: HagilightDocusaurusOptions | undefined): ResolvedHagilightOptions {
  const options: HagilightDocusaurusOptions = input === undefined ? {} : objectOption(input, 'options') as HagilightDocusaurusOptions;
  const analytics = options.analytics === undefined ? {} : objectOption(options.analytics, 'analytics');

  const googleAnalyticsId = resolveProvider(
    analytics.googleAnalytics,
    'analytics.googleAnalytics',
    'measurementId',
    GOOGLE_ANALYTICS_ID_PATTERN,
    DEFAULT_GOOGLE_ANALYTICS_ID,
  );
  const fiftyOneLaId = resolveProvider(
    analytics.fiftyOneLa,
    'analytics.fiftyOneLa',
    'siteId',
    FIFTY_ONE_LA_ID_PATTERN,
    DEFAULT_FIFTY_ONE_LA_ID,
  );
  const posthogSearchQuery = resolvePostHogSearchQuery(analytics.posthog);
  const posthogApiKey = resolveProvider(
    providerOptionsWithoutSearchQuery(analytics.posthog),
    'analytics.posthog',
    'apiKey',
    POSTHOG_API_KEY_PATTERN,
    DEFAULT_POSTHOG_API_KEY,
  );

  return {
    footer: featureEnabled(options.footer, 'footer'),
    footerAvatar: resolveFooterAvatar(options.footer),
    links: options.links === undefined ? {} : (objectOption(options.links, 'links') as SiteLinksOptions),
    googleAnalyticsId,
    fiftyOneLaId,
    posthogApiKey,
    posthogSearchQuery,
    consent: resolveConsent(analytics.consent, [
      ...(googleAnalyticsId === undefined ? [] : ['googleAnalytics' as const]),
      ...(fiftyOneLaId === undefined ? [] : ['fiftyOneLa' as const]),
      ...(posthogApiKey === undefined ? [] : ['posthog' as const]),
    ]),
    promoto: featureEnabled(options.promoto, 'promoto'),
    languageSelector: featureEnabled(options.languageSelector, 'languageSelector'),
    seo: resolveSeo(options.seo),
    sitemap: featureEnabled(options.sitemap, 'sitemap'),
    robots: featureEnabled(options.robots, 'robots'),
    rss: resolveRss(options.rss),
    noIndex: booleanOption(options.noIndex, 'noIndex') ?? false,
    metadata: resolveSiteMetadataOption(options.metadata),
  };
}
