import type { SiteLinksOptions } from './links.js';

interface RssFooterContext {
  defaultFeedUrl: string;
  localeFeedUrls: Readonly<Record<string, string>>;
  locales: readonly { lang: string; filename: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLanguageTag(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const input = value.trim().replaceAll('_', '-');
  const alias = input.toLowerCase();
  if (['zh', 'zh-cn', 'zh-hans', 'root'].includes(alias)) return 'zh-CN';
  if (['zh-hant', 'zh-tw', 'zh-hk'].includes(alias)) return 'zh-Hant';
  try {
    return Intl.getCanonicalLocales(input)[0];
  } catch {
    return undefined;
  }
}

function isFooterContext(value: unknown): value is RssFooterContext {
  return isRecord(value)
    && typeof value.defaultFeedUrl === 'string'
    && value.defaultFeedUrl !== ''
    && isRecord(value.localeFeedUrls)
    && Array.isArray(value.locales)
    && value.locales.every((entry: unknown) => isRecord(entry)
      && typeof entry.lang === 'string'
      && typeof entry.filename === 'string');
}

/**
 * Merge generated `hagilightRss()` feed URLs from request locals into Footer
 * link options. Explicit `rssFeedUrl`/`rssLocaleFeedUrl` values win.
 */
export function resolveRssFooterLinks(
  locals: unknown,
  locale: string | undefined,
  links: SiteLinksOptions = {},
): SiteLinksOptions {
  if (!isRecord(locals) || !Object.hasOwn(locals, 'hagilightRss')) return links;
  const rss = locals.hagilightRss;
  if (!isFooterContext(rss)) {
    throw new TypeError('Hagilight RSS Footer context is malformed.');
  }

  const normalizedLocale = normalizeLanguageTag(locale);
  const configuredLocale = rss.locales.find((entry) =>
    entry.filename !== 'en' && normalizeLanguageTag(entry.lang) === normalizedLocale);
  const localeFeedUrl = configuredLocale ? rss.localeFeedUrls[configuredLocale.lang] : undefined;
  if (configuredLocale && (typeof localeFeedUrl !== 'string' || !localeFeedUrl)) {
    throw new TypeError(`Hagilight RSS Footer context has no URL for "${configuredLocale.lang}".`);
  }

  return {
    ...links,
    rssFeedUrl: links.rssFeedUrl ?? rss.defaultFeedUrl,
    ...(typeof localeFeedUrl === 'string' && localeFeedUrl
      ? { rssLocaleFeedUrl: links.rssLocaleFeedUrl ?? localeFeedUrl }
      : {}),
  };
}
