import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { HtmlTagObject, LoadContext } from '@docusaurus/types';
import { generateRssFeed, resolveRssLocales, type RssFeedItem } from '@hagicode/hagilight-core/rss';
import type { ResolvedHagilightOptions, ResolvedRssOptions } from './options.js';

type Warn = (message: string) => void;

export interface DiscoveryReporter {
  warn: Warn;
  info: Warn;
}

export interface DiscoverySite {
  title: string;
  tagline: string;
  url: string;
  baseUrl: string;
  siteDir: string;
  i18n: LoadContext['i18n'];
}

export interface DiscoveryOutputs {
  options: ResolvedHagilightOptions;
  site: DiscoverySite;
  outDir: string;
  production: boolean;
  plugins: readonly { name: string }[];
  routesPaths: readonly string[];
  routesBuildMetadata: Readonly<Record<string, { noIndex: boolean } | undefined>>;
  feedItems: readonly RssFeedItem[];
  report: DiscoveryReporter;
}

const SITEMAP_PLUGIN = 'docusaurus-plugin-sitemap';
const DOCS_PLUGIN = 'docusaurus-plugin-content-docs';
const BLOG_PLUGIN = 'docusaurus-plugin-content-blog';
function notFoundRoute(baseUrl: string): RegExp {
  const escapedBase = baseUrl.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^${escapedBase}404(?:\\.html)?\\/?$`, 'u');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function siteOwns(site: DiscoverySite, fileName: string): boolean {
  return existsSync(join(site.siteDir, 'static', fileName));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

export function sitemapUrls(
  routesPaths: readonly string[],
  routesBuildMetadata: DiscoveryOutputs['routesBuildMetadata'],
  siteUrl: string,
  localeBaseUrl: string,
): string[] {
  const notFound = notFoundRoute(localeBaseUrl);
  const urls = routesPaths
    .filter((route) => !notFound.test(route) && routesBuildMetadata[route]?.noIndex !== true)
    .map((route) => new URL(route, siteUrl).href);
  return [...new Set(urls)];
}

export function sitemapXml(urls: readonly string[]): string {
  const entries = urls.map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function robotsTxt(sitemapUrlList: readonly string[]): string {
  return ['User-agent: *', 'Allow: /', '', ...sitemapUrlList.map((url) => `Sitemap: ${url}`), ''].join('\n');
}

function localeSitemapUrls(site: DiscoverySite): string[] {
  return site.i18n.locales.map(
    (locale) => new URL(`${site.i18n.localeConfigs[locale].baseUrl}sitemap.xml`, site.url).href,
  );
}

function defaultLocaleOutDir(outDir: string, i18n: LoadContext['i18n']): string {
  const defaultBase = i18n.localeConfigs[i18n.defaultLocale].baseUrl;
  const currentBase = i18n.localeConfigs[i18n.currentLocale].baseUrl;
  const localeSegments = currentBase.slice(defaultBase.length).split('/').filter(Boolean);
  return resolve(outDir, ...localeSegments.map(() => '..'));
}

function instanceContents(allContent: unknown, pluginName: string, report: DiscoveryReporter): unknown[] {
  if (!isRecord(allContent) || allContent[pluginName] === undefined) return [];
  const instances = allContent[pluginName];
  if (!isRecord(instances)) {
    report.warn(`${pluginName} content has an unexpected shape, so its feed items are skipped.`);
    return [];
  }
  return Object.values(instances);
}

function publicationDate(value: unknown): Date | number | string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && !Number.isNaN(new Date(value).getTime())) return value;
  return undefined;
}

function toFeedItem(meta: Record<string, unknown>, date: unknown, siteUrl: string): RssFeedItem | undefined {
  if (typeof meta.title !== 'string' || typeof meta.permalink !== 'string') return undefined;
  const description = typeof meta.description === 'string' && meta.description.trim() ? meta.description : undefined;
  const published = publicationDate(date);
  return {
    title: meta.title,
    link: new URL(meta.permalink, siteUrl).href,
    ...(description === undefined ? {} : { description }),
    ...(published === undefined ? {} : { date: published }),
  };
}

function isListed(meta: Record<string, unknown>): boolean {
  return meta.draft !== true && meta.unlisted !== true;
}

function docFeedItems(allContent: unknown, site: DiscoverySite, report: DiscoveryReporter): RssFeedItem[] {
  const items: RssFeedItem[] = [];
  let malformed = 0;
  for (const content of instanceContents(allContent, DOCS_PLUGIN, report)) {
    const current = isRecord(content) && Array.isArray(content.loadedVersions)
      ? content.loadedVersions.find((version) => isRecord(version) && version.isLast === true)
      : undefined;
    if (!isRecord(current) || !Array.isArray(current.docs)) {
      malformed += 1;
      continue;
    }
    for (const doc of current.docs) {
      if (!isRecord(doc)) {
        malformed += 1;
        continue;
      }
      if (!isListed(doc)) continue;
      const item = toFeedItem(doc, doc.lastUpdatedAt, site.url);
      if (item === undefined) malformed += 1;
      else items.push(item);
    }
  }
  if (malformed > 0) report.warn(`${malformed} docs entries have an unexpected shape and are left out of the RSS feed.`);
  return items;
}

function blogFeedItems(allContent: unknown, site: DiscoverySite, report: DiscoveryReporter): RssFeedItem[] {
  const items: RssFeedItem[] = [];
  let malformed = 0;
  for (const content of instanceContents(allContent, BLOG_PLUGIN, report)) {
    const posts = isRecord(content) && Array.isArray(content.blogPosts) ? content.blogPosts : undefined;
    if (posts === undefined) {
      malformed += 1;
      continue;
    }
    for (const post of posts) {
      const meta = isRecord(post) && isRecord(post.metadata) ? post.metadata : undefined;
      if (meta === undefined) {
        malformed += 1;
        continue;
      }
      if (!isListed(meta)) continue;
      const item = toFeedItem(meta, meta.date, site.url);
      if (item === undefined) malformed += 1;
      else items.push(item);
    }
  }
  if (malformed > 0) report.warn(`${malformed} blog entries have an unexpected shape and are left out of the RSS feed.`);
  return items;
}

export function collectFeedItems(
  allContent: unknown,
  site: DiscoverySite,
  rss: ResolvedRssOptions,
  report: DiscoveryReporter,
): RssFeedItem[] {
  if (!rss.enabled) return [];
  return [
    ...(rss.includeBlog ? blogFeedItems(allContent, site, report) : []),
    ...(rss.includeDocs ? docFeedItems(allContent, site, report) : []),
  ];
}

export function feedHeadTags(site: DiscoverySite, rss: ResolvedRssOptions, feedItemCount: number): HtmlTagObject[] {
  if (!rss.enabled || (feedItemCount === 0 && !siteOwns(site, 'rss.xml'))) return [];
  return [
    {
      tagName: 'link',
      attributes: {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: site.title,
        href: new URL(`${site.baseUrl}rss.xml`, site.url).href,
      },
    },
  ];
}

async function renderFeed(site: DiscoverySite, items: readonly RssFeedItem[]): Promise<string> {
  const locale = site.i18n.currentLocale;
  const htmlLang = site.i18n.localeConfigs[locale].htmlLang;
  const [{ lang }] = resolveRssLocales({ [locale]: { lang: htmlLang } });
  const response = await generateRssFeed({
    site: site.url,
    baseUrl: site.baseUrl,
    language: lang,
    title: site.title,
    description: site.tagline.trim() ? site.tagline : site.title,
    items: [...items],
  });
  return response.text();
}

export async function writeDiscoveryOutputs(outputs: DiscoveryOutputs): Promise<void> {
  const { options, site, outDir, report } = outputs;
  const noIndex = options.noIndex;

  if (options.sitemap && outputs.production && !noIndex && !outputs.plugins.some((plugin) => plugin.name === SITEMAP_PLUGIN)) {
    const urls = sitemapUrls(
      outputs.routesPaths,
      outputs.routesBuildMetadata,
      site.url,
      site.i18n.localeConfigs[site.i18n.currentLocale].baseUrl,
    );
    await writeFile(join(outDir, 'sitemap.xml'), sitemapXml(urls));
  }

  if (options.robots && !noIndex && !siteOwns(site, 'robots.txt')) {
    if (site.i18n.currentLocale === site.i18n.defaultLocale) {
      await writeFile(join(outDir, 'robots.txt'), robotsTxt(localeSitemapUrls(site)));
    } else if (!existsSync(join(defaultLocaleOutDir(outDir, site.i18n), 'robots.txt'))) {
      report.warn(
        `robots.txt is written only by the default locale build (${site.i18n.defaultLocale}); build that locale to include it.`,
      );
    }
  }

  if (options.rss.enabled && !siteOwns(site, 'rss.xml')) {
    if (outputs.feedItems.length === 0) {
      report.info('No content is available for the RSS feed, so rss.xml is not written.');
    } else {
      await writeFile(join(outDir, 'rss.xml'), await renderFeed(site, outputs.feedItems));
    }
  }
}
