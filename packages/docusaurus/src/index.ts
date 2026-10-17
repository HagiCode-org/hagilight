import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveBuildInfo } from '@hagicode/hagilight-core/build-info-resolver';
import type { RssFeedItem } from '@hagicode/hagilight-core/rss';
import type { HtmlTagObject, LoadContext, Plugin, PluginModule } from '@docusaurus/types';
import { fiftyOneLaHeadTags, googleAnalyticsHeadTags, posthogHeadTags } from './analytics.js';
import { collectFeedItems, feedHeadTags, writeDiscoveryOutputs, type DiscoverySite } from './discovery.js';
import { PLUGIN_NAME, type HagilightGlobalData } from './global-data.js';
import { resolveOptions, type HagilightDocusaurusOptions, type ResolvedHagilightOptions } from './options.js';
import { seoHeadTags } from './seo.js';
import { findConfigurationWarnings } from './warnings.js';

export { PLUGIN_NAME };
export type { HagilightGlobalData };
export type {
  AnalyticsOptions,
  FeatureToggle,
  FiftyOneLaOptions,
  GoogleAnalyticsOptions,
  PostHogOptions,
  HagilightDocusaurusOptions,
  ResolvedHagilightOptions,
  RssOptions,
  SeoOptions,
  SeoOrganizationOptions,
} from './options.js';

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
    ...(options.posthogApiKey === undefined ? [] : posthogHeadTags(options.posthogApiKey)),
  ];
}

/** Exposes the footer site identifier to the client banner, which tags its call to action with it. */
function promotoSiteIdHeadTags(options: ResolvedHagilightOptions): HtmlTagObject[] {
  const siteId = options.links.siteId?.trim();
  if (!options.promoto || !siteId) return [];
  return [{ tagName: 'meta', attributes: { name: 'hagilight-site-id', content: siteId } }];
}

function clientModules(options: ResolvedHagilightOptions): string[] {
  const analyticsEnabled = options.googleAnalyticsId !== undefined || options.fiftyOneLaId !== undefined;
  return [
    ...(analyticsEnabled ? [packageFile('./client/analytics.js')] : []),
    ...(options.promoto ? [packageFile('./client/promoto.js'), packageFile('../promoto.css')] : []),
    ...(options.footer ? [packageFile('../styles.css')] : []),
  ];
}

function createPlugin(context: LoadContext, options: ResolvedHagilightOptions): Plugin {
  for (const warning of findConfigurationWarnings(context, options)) {
    console.warn(`[${PLUGIN_NAME}] ${warning}`);
  }

  const globalData: HagilightGlobalData = {
    version: PACKAGE_VERSION,
    options,
    i18n: context.i18n,
    buildInfo: resolveBuildInfo({ root: context.siteDir }),
  };
  const themeEnabled = options.footer || options.seo.enabled;
  const site: DiscoverySite = {
    title: context.siteConfig.title,
    tagline: context.siteConfig.tagline,
    url: context.siteConfig.url,
    baseUrl: context.siteConfig.baseUrl,
    siteDir: context.siteDir,
    i18n: context.i18n,
  };
  const report = {
    warn: (message: string) => console.warn(`[${PLUGIN_NAME}] ${message}`),
    info: (message: string) => console.info(`[${PLUGIN_NAME}] ${message}`),
  };
  let feedItems: RssFeedItem[] = [];

  return {
    name: PLUGIN_NAME,
    ...(themeEnabled ? { getThemePath: () => packageFile('./theme') } : {}),
    getClientModules: () => clientModules(options),
    contentLoaded({ actions }) {
      actions.setGlobalData(globalData);
    },
    allContentLoaded({ allContent }) {
      feedItems = collectFeedItems(allContent, site, options.rss, report);
    },
    async postBuild(props) {
      await writeDiscoveryOutputs({
        options,
        site,
        outDir: props.outDir,
        production: process.env.NODE_ENV === 'production',
        plugins: props.plugins,
        routesPaths: props.routesPaths,
        routesBuildMetadata: props.routesBuildMetadata,
        feedItems,
        report,
      });
    },
    injectHtmlTags() {
      return {
        headTags: [
          ...analyticsHeadTags(options),
          ...seoHeadTags(options.seo, site),
          ...feedHeadTags(site, options.rss, feedItems.length),
          ...promotoSiteIdHeadTags(options),
        ],
      };
    },
  };
}

export function hagilightDocusaurus(options?: HagilightDocusaurusOptions): PluginModule {
  const resolved = resolveOptions(options);
  return (context) => createPlugin(context, resolved);
}

export default hagilightDocusaurus;
