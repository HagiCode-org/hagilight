/**
 * Facts for `.well-known/hagilight.metadata.json` from a Starlight build. The
 * Starlight plugin owns the file when it is enabled, so this module collects the
 * title, locales and resolved feature flags from its own configuration.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { BuildInfo } from '@hagicode/hagilight-core/build-info';
import {
  buildSiteMetadata,
  SITE_METADATA_PATH,
  type SiteMetadataAnalytics,
  type SiteMetadataFeatures,
  type SiteMetadataLocale,
} from '@hagicode/hagilight-core/site-metadata';
import { findDiscoveryOutputs, writeSiteMetadata, type SiteMetadataLogger } from '@hagicode/hagilight-core/site-metadata-writer';
import { completeSiteMetadataOwnerBuild } from '@hagicode/hagilight-core/site-metadata-ownership';
import { resolveSeoLocales, type SeoLocale } from './seo-utils.js';

const STARLIGHT_PACKAGE_VERSION = (JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }).version;

export interface StarlightSiteMetadataSetup {
  enabled: boolean;
  /** Explicit `metadata.name`, when set. */
  name?: string | undefined;
  /** Explicit `metadata.description`, when set. */
  description?: string | undefined;
  /** Starlight `title`: a string or a localized record. */
  title: unknown;
  /** Starlight `description`, when the site configures one. */
  siteDescription?: unknown;
  /** Starlight `locales` map, for example `{ root: { lang: 'en' } }`. */
  locales: unknown;
  /** Starlight `defaultLocale`. */
  defaultLocale: unknown;
  site: unknown;
  base: string | undefined;
  publicDir: URL;
  analytics: SiteMetadataAnalytics;
  features: SiteMetadataFeatures;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function absoluteSite(site: unknown): string | undefined {
  try {
    const parsed = new URL(site as string | URL);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function trimmedText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Starlight locale routes become metadata locales. The root route uses its language tag as the code. */
function toMetadataLocales(locales: readonly SeoLocale[]): { locales: SiteMetadataLocale[]; routes: Map<string, string> } {
  const routes = new Map<string, string>();
  const entries = locales.map(({ route, lang }) => {
    const code = route === 'root' ? lang : route;
    routes.set(route, code);
    return { code, lang, path: route === 'root' ? '/' : `/${route}/` };
  });
  return { locales: entries, routes };
}

/** Starlight's default locale is the route named in `defaultLocale`, or `root`. */
function defaultRoute(defaultLocale: unknown, locales: readonly SeoLocale[]): string {
  const configured = isRecord(defaultLocale) ? defaultLocale.locale ?? defaultLocale.lang : defaultLocale;
  if (typeof configured !== 'string' || !configured.trim()) return locales.find(({ route }) => route === 'root')?.route ?? locales[0]?.route ?? 'root';
  const match = locales.find(({ route, lang }) => route === configured || lang === configured);
  return match?.route ?? configured;
}

/** Starlight's title, read for the default locale. A localized record uses `root` or its first entry. */
function siteTitle(title: unknown, route: string): string | undefined {
  if (typeof title === 'string') return trimmedText(title);
  if (!isRecord(title)) return undefined;
  return trimmedText(title[route] ?? title.root ?? Object.values(title)[0]);
}

export interface WriteStarlightSiteMetadataInput {
  outDir: string;
  setup: StarlightSiteMetadataSetup;
  build: BuildInfo;
  logger: SiteMetadataLogger;
}

/** Build and write the metadata file for a Starlight build. Skips with a warning when no absolute site URL exists. */
export function writeStarlightSiteMetadata({ outDir, setup, build, logger }: WriteStarlightSiteMetadataInput): void {
  const siteUrl = absoluteSite(setup.site);
  if (!siteUrl) {
    logger.warn(`${SITE_METADATA_PATH} requires an absolute Astro site URL, so it was not generated.`);
    return;
  }
  const seoLocales = resolveSeoLocales(setup.locales as Parameters<typeof resolveSeoLocales>[0]);
  const { locales, routes } = toMetadataLocales(seoLocales);
  const defaultCode = routes.get(defaultRoute(setup.defaultLocale, seoLocales));
  const route = defaultRoute(setup.defaultLocale, seoLocales);
  const base = `${setup.base || '/'}`.replace(/\/?$/u, '/');

  const metadata = buildSiteMetadata({
    generator: { name: '@hagicode/hagilight-starlight', version: STARLIGHT_PACKAGE_VERSION },
    site: {
      name: setup.name ?? siteTitle(setup.title, route),
      url: siteUrl,
      base,
      description: setup.description ?? trimmedText(setup.siteDescription),
    },
    locales,
    defaultLocale: defaultCode,
    fallbackLang: seoLocales.find((entry) => entry.route === route)?.lang,
    build,
    discovery: findDiscoveryOutputs(outDir),
    analytics: setup.analytics,
    features: setup.features,
  });
  writeSiteMetadata({
    outDir,
    metadata,
    siteOwnedFiles: [join(fileURLToPath(setup.publicDir), SITE_METADATA_PATH)],
    logger,
  });
}

/**
 * Integration appended after this plugin's sitemap, so the write runs after
 * `@astrojs/sitemap` has written its index. The owner's write also waits for any
 * deferring plain-Astro peer that reported before it.
 */
export function createStarlightMetadataFinalizer(setup: StarlightSiteMetadataSetup, buildInfo: () => BuildInfo | undefined): AstroIntegration {
  return {
    name: '@hagicode/hagilight-starlight:metadata',
    hooks: {
      'astro:build:done'({ dir, logger }) {
        completeSiteMetadataOwnerBuild(() => {
          const build = buildInfo();
          if (!build) return;
          writeStarlightSiteMetadata({ outDir: fileURLToPath(dir), setup, build, logger });
        });
      },
    },
  };
}
