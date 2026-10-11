import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HtmlTagObject, LoadContext, Plugin, PluginModule } from '@docusaurus/types';
import { fiftyOneLaHeadTags, googleAnalyticsHeadTags } from './analytics.js';
import { resolveOptions, type HagilightDocusaurusOptions, type ResolvedHagilightOptions } from './options.js';
import { findConfigurationWarnings } from './warnings.js';

export type {
  AnalyticsOptions,
  FeatureToggle,
  FiftyOneLaOptions,
  GoogleAnalyticsOptions,
  HagilightDocusaurusOptions,
  ResolvedHagilightOptions,
  RssOptions,
  SeoOptions,
  SeoOrganizationOptions,
} from './options.js';

export const PLUGIN_NAME = '@hagicode/hagilight-docusaurus';

export interface HagilightGlobalData {
  version: string;
  options: ResolvedHagilightOptions;
  i18n: LoadContext['i18n'];
}

const PACKAGE_VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
).version;

function packageFile(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function analyticsHeadTags(options: ResolvedHagilightOptions): HtmlTagObject[] {
  if (process.env.NODE_ENV !== 'production') return [];
  return [
    ...(options.googleAnalyticsId === undefined ? [] : googleAnalyticsHeadTags(options.googleAnalyticsId)),
    ...(options.fiftyOneLaId === undefined ? [] : fiftyOneLaHeadTags(options.fiftyOneLaId)),
  ];
}

function clientModules(options: ResolvedHagilightOptions): string[] {
  const analyticsEnabled = options.googleAnalyticsId !== undefined || options.fiftyOneLaId !== undefined;
  return analyticsEnabled ? [packageFile('./client/analytics.js')] : [];
}

function createPlugin(context: LoadContext, options: ResolvedHagilightOptions): Plugin {
  for (const warning of findConfigurationWarnings(context, options)) {
    console.warn(`[${PLUGIN_NAME}] ${warning}`);
  }

  const globalData: HagilightGlobalData = {
    version: PACKAGE_VERSION,
    options,
    i18n: context.i18n,
  };
  const themeEnabled = options.footer;

  return {
    name: PLUGIN_NAME,
    ...(themeEnabled ? { getThemePath: () => packageFile('./theme') } : {}),
    getClientModules: () => clientModules(options),
    contentLoaded({ actions }) {
      actions.setGlobalData(globalData);
    },
    injectHtmlTags() {
      return { headTags: analyticsHeadTags(options) };
    },
  };
}

export function hagilightDocusaurus(options?: HagilightDocusaurusOptions): PluginModule {
  const resolved = resolveOptions(options);
  return (context) => createPlugin(context, resolved);
}

export default hagilightDocusaurus;
