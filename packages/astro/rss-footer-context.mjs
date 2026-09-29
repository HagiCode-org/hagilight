function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLanguageTag(value) {
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

export function resolveRssFooterLinks(locals, locale, links = {}) {
  if (!isRecord(locals) || !Object.hasOwn(locals, 'hagilightRss')) return links;
  const rss = locals.hagilightRss;
  if (!isRecord(rss)
    || typeof rss.defaultFeedUrl !== 'string'
    || !rss.defaultFeedUrl
    || !isRecord(rss.localeFeedUrls)
    || !Array.isArray(rss.locales)
    || rss.locales.some((entry) => !isRecord(entry)
      || typeof entry.lang !== 'string'
      || typeof entry.filename !== 'string')) {
    throw new TypeError('Hagilight RSS Footer context is malformed.');
  }

  const normalizedLocale = normalizeLanguageTag(locale);
  const configuredLocale = rss.locales.find((entry) =>
    isRecord(entry)
      && entry.filename !== 'en'
      && normalizeLanguageTag(entry.lang) === normalizedLocale);
  const localeFeedUrl = configuredLocale
    ? rss.localeFeedUrls[configuredLocale.lang]
    : undefined;
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
