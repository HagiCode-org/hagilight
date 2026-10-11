import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LoadContext } from '@docusaurus/types';
import { locales as catalogLocales } from './locales.js';
import type { ResolvedHagilightOptions } from './options.js';

const THEME_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'] as const;
const GTAG_PLUGIN = '@docusaurus/plugin-google-gtag';
const CLASSIC_PRESET = '@docusaurus/preset-classic';
const CATALOG_LOCALES: ReadonlySet<string> = new Set(catalogLocales);

export function siteOwnsThemeComponent(siteDir: string, name: string): boolean {
  const themeDir = join(siteDir, 'src', 'theme');
  return THEME_EXTENSIONS.some(
    (ext) => existsSync(join(themeDir, name, `index.${ext}`)) || existsSync(join(themeDir, `${name}.${ext}`)),
  );
}

function entryName(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
  return undefined;
}

function entryOptions(entry: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(entry)) return undefined;
  const options: unknown = entry[1];
  return typeof options === 'object' && options !== null ? (options as Record<string, unknown>) : undefined;
}

function hasPluginEntry(entries: unknown, name: string): boolean {
  return Array.isArray(entries) && entries.some((entry) => entryName(entry) === name);
}

function hasLocaleDropdown(themeConfig: Record<string, unknown>): boolean {
  const navbar = themeConfig.navbar;
  if (typeof navbar !== 'object' || navbar === null) return false;
  const items: unknown = (navbar as { items?: unknown }).items;
  return Array.isArray(items) && items.some((item) => (item as { type?: unknown } | null)?.type === 'localeDropdown');
}

function officialGtagConfigured(siteConfig: LoadContext['siteConfig']): boolean {
  const raw = siteConfig as unknown as { plugins?: unknown; presets?: unknown };
  if (hasPluginEntry(raw.plugins, GTAG_PLUGIN)) return true;
  return Array.isArray(raw.presets)
    && raw.presets.some((preset) => entryName(preset) === CLASSIC_PRESET && entryOptions(preset)?.gtag !== undefined);
}

export function findConfigurationWarnings(
  context: Pick<LoadContext, 'siteDir' | 'siteConfig' | 'i18n'>,
  options: ResolvedHagilightOptions,
): string[] {
  const warnings: string[] = [];
  const themeConfig = (context.siteConfig.themeConfig ?? {}) as Record<string, unknown>;

  if (options.languageSelector && context.i18n.locales.length > 1) {
    if (!hasLocaleDropdown(themeConfig)) {
      warnings.push(
        "Several locales are configured but themeConfig.navbar.items has no localeDropdown item, so visitors cannot switch language. Add { type: 'localeDropdown' } or set languageSelector: { enabled: false }.",
      );
    }
    const nonCatalog = context.i18n.locales.filter((locale) => !CATALOG_LOCALES.has(locale));
    if (nonCatalog.length > 0) {
      warnings.push(
        `${nonCatalog.join(', ')} ${nonCatalog.length === 1 ? 'is' : 'are'} not in the Hagilight locale catalog, so its native label and lang value are not checked against the Starlight locales. Use catalog locales or set languageSelector: { enabled: false }.`,
      );
    }
  }

  if (options.footer && siteOwnsThemeComponent(context.siteDir, 'Footer')) {
    warnings.push(
      'src/theme/Footer replaces the Hagilight footer. Remove the site Footer component or set footer: { enabled: false } to keep one footer.',
    );
  }
  if (options.seo.enabled && siteOwnsThemeComponent(context.siteDir, 'SiteMetadata')) {
    warnings.push(
      'src/theme/SiteMetadata replaces the Hagilight sharing-image fallback. Remove the site component or set seo: { enabled: false }; the Organization and WebSite JSON-LD are still emitted.',
    );
  }
  if (options.seo.enabled && options.seo.image === undefined && themeConfig.image === undefined) {
    warnings.push(
      'Neither themeConfig.image nor seo.image is set, so pages without their own image get no default sharing image. Set one of them, or set seo: { enabled: false }.',
    );
  }
  if (options.footer && themeConfig.footer !== undefined) {
    warnings.push(
      'themeConfig.footer is ignored by the Hagilight footer. Move its links into the links option or set footer: { enabled: false }.',
    );
  }
  if (options.googleAnalyticsId !== undefined && (themeConfig.gtag !== undefined || officialGtagConfigured(context.siteConfig))) {
    warnings.push(
      'Google Analytics would load twice: the site already configures gtag. Remove themeConfig.gtag or the official gtag plugin, or set analytics.googleAnalytics: { enabled: false }.',
    );
  }

  return warnings;
}
