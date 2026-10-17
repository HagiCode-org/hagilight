import type { SiteLinksOptions } from '@hagicode/hagilight-core/links';
import { DEFAULT_POSTHOG_API_KEY, POSTHOG_API_KEY_PATTERN } from '@hagicode/hagilight-core/posthog';
import { isValidSeoImageReference, resolveAbsoluteHttpUrl } from '@hagicode/hagilight-core/seo';
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
}

export interface PostHogOptions extends FeatureToggle {
  apiKey?: string;
}

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

export interface HagilightDocusaurusOptions {
  footer?: FeatureToggle;
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
  links: SiteLinksOptions;
  googleAnalyticsId: string | undefined;
  fiftyOneLaId: string | undefined;
  posthogApiKey: string | undefined;
  promoto: boolean;
  languageSelector: boolean;
  seo: ResolvedSeoOptions;
  sitemap: boolean;
  robots: boolean;
  rss: ResolvedRssOptions;
  noIndex: boolean;
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

function featureEnabled(value: unknown, path: string): boolean {
  if (value === undefined) return true;
  return booleanOption(objectOption(value, path).enabled, `${path}.enabled`) ?? true;
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

export function resolveOptions(input: HagilightDocusaurusOptions | undefined): ResolvedHagilightOptions {
  const options: HagilightDocusaurusOptions = input === undefined ? {} : objectOption(input, 'options') as HagilightDocusaurusOptions;
  const analytics = options.analytics === undefined ? {} : objectOption(options.analytics, 'analytics');

  return {
    footer: featureEnabled(options.footer, 'footer'),
    links: options.links === undefined ? {} : (objectOption(options.links, 'links') as SiteLinksOptions),
    googleAnalyticsId: resolveProvider(
      analytics.googleAnalytics,
      'analytics.googleAnalytics',
      'measurementId',
      GOOGLE_ANALYTICS_ID_PATTERN,
      DEFAULT_GOOGLE_ANALYTICS_ID,
    ),
    fiftyOneLaId: resolveProvider(
      analytics.fiftyOneLa,
      'analytics.fiftyOneLa',
      'siteId',
      FIFTY_ONE_LA_ID_PATTERN,
      DEFAULT_FIFTY_ONE_LA_ID,
    ),
    posthogApiKey: resolveProvider(
      analytics.posthog,
      'analytics.posthog',
      'apiKey',
      POSTHOG_API_KEY_PATTERN,
      DEFAULT_POSTHOG_API_KEY,
    ),
    promoto: featureEnabled(options.promoto, 'promoto'),
    languageSelector: featureEnabled(options.languageSelector, 'languageSelector'),
    seo: resolveSeo(options.seo),
    sitemap: featureEnabled(options.sitemap, 'sitemap'),
    robots: featureEnabled(options.robots, 'robots'),
    rss: resolveRss(options.rss),
    noIndex: booleanOption(options.noIndex, 'noIndex') ?? false,
  };
}
