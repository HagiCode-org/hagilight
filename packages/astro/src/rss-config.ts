import type { RssFeedItem, RssLocale } from '@hagicode/hagilight-core/rss';

export interface RssFeedRequest {
  /** Locale route key from the configured `locales` map (`root` for the default locale). */
  route: string;
  /** Canonical language tag of the requested feed. */
  lang: string;
}

export interface RssFeedContent {
  title: string;
  description: string;
  items: readonly RssFeedItem[];
}

/** Default export of the module referenced by `hagilight({ rss: { getFeed } })`. */
export type RssFeedCallback = (request: RssFeedRequest) => RssFeedContent | Promise<RssFeedContent>;

/** Request-local feed URLs that the plain-Astro Footer reads from `Astro.locals.hagilightRss`. */
export interface RssFooterContext {
  defaultFeedUrl: string;
  localeFeedUrls: Readonly<Record<string, string>>;
  locales: readonly RssLocale[];
}

/** Serialized configuration exposed to generated routes through `virtual:hagilight/rss-config`. */
export interface RssRuntimeConfig {
  site: string;
  baseUrl: string;
  locales: readonly RssLocale[];
  getFeed: RssFeedCallback | undefined;
  footer: RssFooterContext;
}