/**
 * Contract for the `.well-known/hagilight.metadata.json` file. Browser-safe and
 * pure: no Node modules. The Node-only writer lives in `site-metadata-writer.ts`.
 *
 * Values are copied field by field from typed inputs, so new input fields can
 * never leak into the output. Analytics appears only as on/off booleans.
 */
import { normalizeBuildInfo, UNKNOWN, type BuildInfo } from './build-info.js';

export const SITE_METADATA_SCHEMA_VERSION = 1;

/** Site-relative output path. This is the only place the path is spelled. */
export const SITE_METADATA_PATH = '.well-known/hagilight.metadata.json';

/**
 * Substrings that a provider's loader leaves in built HTML. Each provider needs
 * every marker in one page. A core test pins these to the shipped loaders, so a
 * loader change fails loudly here.
 */
export const ANALYTICS_LOADER_MARKERS = {
  googleAnalytics: ['https://www.googletagmanager.com/gtag/js'],
  fiftyOneLa: ['id="LA_COLLECT"', 'https://sdk.51.la/js-sdk-pro.min.js'],
  posthog: ['__hagilightPosthogInitialized'],
} as const satisfies Record<keyof SiteMetadataAnalytics, readonly string[]>;

export interface SiteMetadataGenerator {
  readonly name: string;
  readonly version: string;
}

export interface SiteMetadataSite {
  readonly name: string;
  /** Absolute HTTP(S) site URL, as configured. */
  readonly url: string;
  /** Base path with a leading and trailing slash. */
  readonly base: string;
  readonly description?: string;
}

export interface SiteMetadataLocale {
  /** The integration's locale key; the default locale uses its language tag. */
  readonly code: string;
  /** BCP 47 language tag. */
  readonly lang: string;
  /** Locale URL path, relative to `site.base`. */
  readonly path: string;
}

export interface SiteMetadataLanguages {
  readonly default: string;
  readonly locales: readonly SiteMetadataLocale[];
}

/** Site-relative paths, relative to `site.base`. A key is present only when the build produced the file. */
export interface SiteMetadataDiscovery {
  readonly sitemap?: string;
  readonly robots?: string;
  readonly rss?: string;
  readonly llms?: string;
}

/** Whether each provider's loader is emitted in this build. */
export interface SiteMetadataAnalytics {
  readonly googleAnalytics: boolean;
  readonly fiftyOneLa: boolean;
  readonly posthog: boolean;
}

export interface SiteMetadataFeatures {
  readonly seo?: boolean;
  readonly promoto?: boolean;
}

export interface SiteMetadata {
  readonly schemaVersion: typeof SITE_METADATA_SCHEMA_VERSION;
  readonly generator: SiteMetadataGenerator;
  readonly site: SiteMetadataSite;
  readonly languages: SiteMetadataLanguages;
  readonly build: BuildInfo;
  readonly discovery: SiteMetadataDiscovery;
  readonly analytics: SiteMetadataAnalytics;
  readonly features: SiteMetadataFeatures;
}

export interface BuildSiteMetadataInput {
  generator: SiteMetadataGenerator;
  site: {
    /** Explicit name, the site's own title, or the home page name. Falls back to the URL hostname. */
    name?: string | undefined;
    url: string | URL;
    base?: string | undefined;
    description?: string | undefined;
  };
  /** Locales with paths relative to the base. An empty list yields one locale that is also the default. */
  locales?: readonly SiteMetadataLocale[] | undefined;
  defaultLocale?: string | undefined;
  /** Language tag used for the single-locale fallback. Defaults to `en`. */
  fallbackLang?: string | undefined;
  build: unknown;
  discovery?: SiteMetadataDiscovery | undefined;
  analytics?: Partial<SiteMetadataAnalytics> | undefined;
  features?: SiteMetadataFeatures | undefined;
}

export interface SiteMetadataOption {
  readonly enabled: boolean;
  readonly name?: string;
  readonly description?: string;
}

const DISCOVERY_KEYS = ['sitemap', 'robots', 'rss', 'llms'] as const;
const ANALYTICS_KEYS = ['googleAnalytics', 'fiftyOneLa', 'posthog'] as const;
const FEATURE_KEYS = ['seo', 'promoto'] as const;
const TOP_LEVEL_KEYS = ['schemaVersion', 'generator', 'site', 'languages', 'build', 'discovery', 'analytics', 'features'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function trimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text || undefined;
}

/** Leading and trailing slash, `/` for the root. */
function normalizeBase(value: unknown): string {
  const inner = (trimmed(value) ?? '').replace(/^\/+|\/+$/gu, '');
  return inner ? `/${inner}/` : '/';
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return UNKNOWN;
  }
}

function canonicalLang(value: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    return undefined;
  }
}

function pickBooleans<const K extends string>(input: unknown, keys: readonly K[]): Record<K, boolean> {
  const record = isRecord(input) ? input : {};
  return Object.fromEntries(keys.map((key) => [key, record[key] === true])) as Record<K, boolean>;
}

/** Build a schema-valid object from typed inputs. Pure and deterministic. */
export function buildSiteMetadata(input: BuildSiteMetadataInput): SiteMetadata {
  const url = new URL(input.site.url).href;
  const base = normalizeBase(input.site.base);
  const description = trimmed(input.site.description);

  const fallbackLang = canonicalLang(input.fallbackLang ?? 'en') ?? 'en';
  const rawLocales = (input.locales ?? []).map((locale) => ({
    code: trimmed(locale.code) ?? fallbackLang,
    lang: canonicalLang(locale.lang) ?? fallbackLang,
    path: normalizeBase(locale.path),
  }));
  const locales = rawLocales.length > 0
    ? rawLocales
    : [{ code: fallbackLang, lang: fallbackLang, path: '/' }];
  const defaultLocale = trimmed(input.defaultLocale);
  const defaultCode = defaultLocale !== undefined && locales.some((locale) => locale.code === defaultLocale)
    ? defaultLocale
    : locales[0]!.code;

  const discovery: Record<string, string> = {};
  for (const key of DISCOVERY_KEYS) {
    const value = input.discovery?.[key];
    if (typeof value === 'string' && value.startsWith('/')) discovery[key] = value;
  }

  const features: SiteMetadataFeatures = {
    ...(typeof input.features?.seo === 'boolean' ? { seo: input.features.seo } : {}),
    ...(typeof input.features?.promoto === 'boolean' ? { promoto: input.features.promoto } : {}),
  };

  return {
    schemaVersion: SITE_METADATA_SCHEMA_VERSION,
    generator: {
      name: trimmed(input.generator.name) ?? UNKNOWN,
      version: trimmed(input.generator.version) ?? UNKNOWN,
    },
    site: {
      name: trimmed(input.site.name) ?? hostnameOf(url),
      url,
      base,
      ...(description === undefined ? {} : { description }),
    },
    languages: {
      default: defaultCode,
      locales,
    },
    build: normalizeBuildInfo(input.build),
    discovery,
    analytics: pickBooleans(input.analytics, ANALYTICS_KEYS),
    features,
  };
}

/** Problems found in an untrusted value. An empty list means the value follows schema version 1. */
export function validateSiteMetadata(value: unknown): readonly string[] {
  const problems: string[] = [];
  if (!isRecord(value)) return ['metadata must be an object'];
  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.includes(key)) problems.push(`unexpected top-level field "${key}"`);
  }
  if (value.schemaVersion !== SITE_METADATA_SCHEMA_VERSION) problems.push('schemaVersion must be 1');

  const generator = isRecord(value.generator) ? value.generator : {};
  for (const key of ['name', 'version'] as const) {
    if (!trimmed(generator[key])) problems.push(`generator.${key} must be a non-empty string`);
  }

  const site = isRecord(value.site) ? value.site : {};
  if (!trimmed(site.name)) problems.push('site.name must be a non-empty string');
  if (typeof site.url !== 'string' || !/^https?:\/\//u.test(site.url)) problems.push('site.url must be an absolute HTTP(S) URL');
  if (typeof site.base !== 'string' || !/^\/(?:.*\/)?$/u.test(site.base)) problems.push('site.base must start and end with "/"');
  if (site.description !== undefined && !trimmed(site.description)) problems.push('site.description must be a non-empty string when present');

  const languages = isRecord(value.languages) ? value.languages : {};
  const locales = Array.isArray(languages.locales) ? languages.locales : [];
  if (locales.length === 0) problems.push('languages.locales must be a non-empty array');
  const codes = new Set<string>();
  for (const locale of locales) {
    const entry = isRecord(locale) ? locale : {};
    if (!trimmed(entry.code)) problems.push('languages.locales[].code must be a non-empty string');
    else codes.add(entry.code as string);
    if (typeof entry.lang !== 'string' || canonicalLang(entry.lang) === undefined) problems.push('languages.locales[].lang must be a BCP 47 tag');
    if (typeof entry.path !== 'string' || !/^\/(?:.*\/)?$/u.test(entry.path)) problems.push('languages.locales[].path must start and end with "/"');
  }
  if (typeof languages.default !== 'string' || (locales.length > 0 && !codes.has(languages.default))) {
    problems.push('languages.default must match one of languages.locales[].code');
  }

  const build = isRecord(value.build) ? value.build : {};
  for (const key of ['branch', 'commit', 'builtAt'] as const) {
    if (!trimmed(build[key])) problems.push(`build.${key} must be a non-empty string`);
  }

  const discovery = isRecord(value.discovery) ? value.discovery : {};
  for (const key of Object.keys(discovery)) {
    if (!(DISCOVERY_KEYS as readonly string[]).includes(key)) problems.push(`unexpected discovery field "${key}"`);
    else if (typeof discovery[key] !== 'string' || !(discovery[key] as string).startsWith('/')) problems.push(`discovery.${key} must be a site-relative path`);
  }

  const analytics = isRecord(value.analytics) ? value.analytics : {};
  for (const key of ANALYTICS_KEYS) {
    if (typeof analytics[key] !== 'boolean') problems.push(`analytics.${key} must be a boolean`);
  }

  const features = isRecord(value.features) ? value.features : {};
  for (const key of FEATURE_KEYS) {
    if (features[key] !== undefined && typeof features[key] !== 'boolean') problems.push(`features.${key} must be a boolean`);
  }
  return problems;
}

/** Canonical minified JSON: fixed key order, no indentation, trailing newline. Identical input gives identical bytes. */
export function serializeSiteMetadata(metadata: SiteMetadata): string {
  const canonical = {
    schemaVersion: metadata.schemaVersion,
    generator: { name: metadata.generator.name, version: metadata.generator.version },
    site: {
      name: metadata.site.name,
      url: metadata.site.url,
      base: metadata.site.base,
      ...(metadata.site.description === undefined ? {} : { description: metadata.site.description }),
    },
    languages: {
      default: metadata.languages.default,
      locales: metadata.languages.locales.map(({ code, lang, path }) => ({ code, lang, path })),
    },
    build: { branch: metadata.build.branch, commit: metadata.build.commit, builtAt: metadata.build.builtAt },
    discovery: Object.fromEntries(DISCOVERY_KEYS
      .filter((key) => metadata.discovery[key] !== undefined)
      .map((key) => [key, metadata.discovery[key]])),
    analytics: {
      googleAnalytics: metadata.analytics.googleAnalytics,
      fiftyOneLa: metadata.analytics.fiftyOneLa,
      posthog: metadata.analytics.posthog,
    },
    features: Object.fromEntries(FEATURE_KEYS
      .filter((key) => metadata.features[key] !== undefined)
      .map((key) => [key, metadata.features[key]])),
  };
  return `${JSON.stringify(canonical)}\n`;
}

/**
 * Detect which analytics loaders the built pages contain. A provider is enabled
 * when any page carries all of its markers. Only booleans leave this function.
 */
export function detectAnalyticsLoaders(pages: Iterable<string>): SiteMetadataAnalytics {
  const found: Record<keyof SiteMetadataAnalytics, boolean> = { googleAnalytics: false, fiftyOneLa: false, posthog: false };
  for (const html of pages) {
    for (const provider of ANALYTICS_KEYS) {
      if (!found[provider] && ANALYTICS_LOADER_MARKERS[provider].every((marker) => html.includes(marker))) {
        found[provider] = true;
      }
    }
  }
  return found;
}

/**
 * Resolve the `metadata` option shared by the three packages. `undefined` and
 * `true` enable the default output, `false` opts out, and an object may override
 * `name` and `description`. Errors name the option.
 */
export function resolveSiteMetadataOption(value: unknown): SiteMetadataOption {
  if (value === undefined || value === true) return { enabled: true };
  if (value === false) return { enabled: false };
  if (!isRecord(value)) {
    throw new TypeError('Hagilight metadata option must be a boolean or an options object.');
  }
  for (const key of Object.keys(value)) {
    if (!['enabled', 'name', 'description'].includes(key)) {
      throw new TypeError(`Hagilight metadata option has an unknown key "${key}".`);
    }
  }
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    throw new TypeError('Hagilight metadata enabled option must be a boolean.');
  }
  for (const key of ['name', 'description'] as const) {
    if (value[key] !== undefined && !trimmed(value[key])) {
      throw new TypeError(`Hagilight metadata ${key} must be a non-empty string.`);
    }
  }
  const name = trimmed(value.name);
  const description = trimmed(value.description);
  return {
    enabled: value.enabled !== false,
    ...(name === undefined ? {} : { name }),
    ...(description === undefined ? {} : { description }),
  };
}
