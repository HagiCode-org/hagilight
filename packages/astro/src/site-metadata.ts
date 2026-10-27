/**
 * Facts for `.well-known/hagilight.metadata.json` from a plain-Astro build. Site
 * name and description come from the built home page, locales from Astro `i18n`,
 * and analytics flags from the loaders present in the built pages.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BuildInfo } from '@hagicode/hagilight-core/build-info';
import { CONSENT_DESCRIPTOR_ID } from '@hagicode/hagilight-core/consent-markup';
import {
  buildSiteMetadata,
  detectAnalyticsLoaders,
  SITE_METADATA_PATH,
  type SiteMetadataLocale,
} from '@hagicode/hagilight-core/site-metadata';
import { findDiscoveryOutputs, writeSiteMetadata, type SiteMetadataLogger } from '@hagicode/hagilight-core/site-metadata-writer';
import { parseHeadMeta } from './llms.js';

const ASTRO_PACKAGE_VERSION = (JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }).version;

export interface WriteAstroSiteMetadataInput {
  config: {
    site?: unknown;
    base?: string;
    publicDir: URL;
    i18n?: unknown;
  };
  outDir: string;
  pages: readonly { pathname: string }[];
  build: BuildInfo;
  options: { name?: string; description?: string };
  logger: SiteMetadataLogger;
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

/** Read the built HTML of each page that the build emitted, using the same lookup as `llms.txt`. */
function builtPageHtml(outDir: string, pages: readonly { pathname: string }[]): string[] {
  const html: string[] = [];
  for (const { pathname } of pages) {
    const relative = pathname.replace(/^\/+/u, '');
    const candidates = relative === '' || relative.endsWith('/')
      ? [join(outDir, relative, 'index.html')]
      : [join(outDir, relative, 'index.html'), join(outDir, `${relative}.html`)];
    const file = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    if (file) html.push(readFileSync(file, 'utf8'));
  }
  return html;
}

function localeEntryKey(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry.trim() || undefined;
  if (isRecord(entry) && typeof entry.path === 'string' && entry.path.trim()) return entry.path.trim();
  return undefined;
}

/** Map Astro `i18n` to locales relative to the base. Mirrors the RSS locale derivation. */
export function deriveAstroMetadataLocales(i18n: unknown): { locales: SiteMetadataLocale[]; defaultLocale?: string } {
  if (!isRecord(i18n) || !Array.isArray(i18n.locales) || i18n.locales.length === 0) return { locales: [] };
  const defaultLocale = typeof i18n.defaultLocale === 'string'
    ? i18n.defaultLocale
    : localeEntryKey(i18n.locales[0]);
  const prefixDefaultLocale = isRecord(i18n.routing) && i18n.routing.prefixDefaultLocale === true;
  const locales: SiteMetadataLocale[] = [];
  for (const entry of i18n.locales) {
    const code = localeEntryKey(entry);
    if (!code) continue;
    const codes = isRecord(entry) && Array.isArray(entry.codes) ? entry.codes : [];
    const lang = typeof codes[0] === 'string' && codes[0].trim() ? codes[0].trim() : code;
    const isDefault = code === defaultLocale;
    locales.push({ code, lang, path: isDefault && !prefixDefaultLocale ? '/' : `/${code}/` });
  }
  return { locales, ...(defaultLocale === undefined ? {} : { defaultLocale }) };
}

/**
 * Build and write the metadata file for a plain-Astro build. Skips with a warning
 * when no absolute site URL is configured, because the file has to name the site.
 */
export function writeAstroSiteMetadata({ config, outDir, pages, build, options, logger }: WriteAstroSiteMetadataInput): void {
  const siteUrl = absoluteSite(config.site);
  if (!siteUrl) {
    logger.warn(`${SITE_METADATA_PATH} requires an absolute Astro site URL, so it was not generated.`);
    return;
  }
  const base = `${config.base || '/'}`.replace(/\/?$/u, '/');
  const siteBase = new URL(base, siteUrl);
  const homeFile = join(outDir, 'index.html');
  const homeHtml = existsSync(homeFile) ? readFileSync(homeFile, 'utf8') : undefined;
  // Site-level facts are read even when the home page is noindex, such as a root redirect page.
  const homeMeta = homeHtml === undefined ? undefined : parseHeadMeta(homeHtml);
  const pageHtml = builtPageHtml(outDir, pages);
  if (homeHtml !== undefined && !pageHtml.includes(homeHtml)) pageHtml.push(homeHtml);
  const locales = deriveAstroMetadataLocales(config.i18n);

  const metadata = buildSiteMetadata({
    generator: { name: '@hagicode/hagilight', version: ASTRO_PACKAGE_VERSION },
    site: {
      name: options.name ?? homeMeta?.siteName ?? homeMeta?.title,
      url: siteUrl,
      base,
      description: options.description ?? homeMeta?.description,
    },
    locales: locales.locales,
    defaultLocale: locales.defaultLocale,
    fallbackLang: homeMeta?.lang,
    build,
    discovery: findDiscoveryOutputs(outDir),
    analytics: detectAnalyticsLoaders(pageHtml),
    // The popup is mounted exactly when a built page carries its config descriptor.
    features: { consent: pageHtml.some((html) => html.includes(CONSENT_DESCRIPTOR_ID)) },
  });
  writeSiteMetadata({
    outDir,
    metadata,
    siteOwnedFiles: [join(fileURLToPath(config.publicDir), SITE_METADATA_PATH)],
    logger,
  });
}
