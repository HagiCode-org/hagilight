import rss from '@astrojs/rss';

export type RssPublicationDate = Date | string | number | null;

export interface RssFeedItem {
  title: string;
  link: string;
  description?: string;
  date?: RssPublicationDate;
  pubDate?: RssPublicationDate;
}

export interface RssFeedOptions {
  site: string | URL;
  baseUrl?: string | URL;
  language?: string;
  title: string;
  description: string;
  items: readonly RssFeedItem[];
}

export type RssLocaleConfig = string | { lang?: string; label?: string };
export type RssLocalesInput = Readonly<Record<string, RssLocaleConfig | undefined>>;

export interface RssLocale {
  /** Starlight-style locale route key, `root` for the default locale. */
  route: string;
  /** Canonical BCP 47 language tag. */
  lang: string;
  /** Feed filename segment: `en` for English, otherwise the canonical language tag. */
  filename: string;
}

export interface ResolveRssLocalesOptions {
  requireNonEmpty?: boolean;
}

const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function resolveRssLocales(
  locales?: RssLocalesInput,
  { requireNonEmpty = false }: ResolveRssLocalesOptions = {},
): RssLocale[] {
  if (locales !== undefined && !isRecord(locales)) {
    throw new TypeError('Hagilight RSS locales must be an object.');
  }
  if (requireNonEmpty && (locales === undefined || Object.keys(locales).length === 0)) {
    throw new TypeError('Hagilight RSS locales must contain at least one locale.');
  }

  const configuredLocales: [string, RssLocaleConfig | undefined][] = locales === undefined
    ? [['root', { lang: 'en' }]]
    : Object.entries(locales);
  if (configuredLocales.length === 0) configuredLocales.push(['root', { lang: 'en' }]);

  const usedFilenames = new Set<string>();
  return configuredLocales.map(([route, config]) => {
    const lang = typeof config === 'string' ? config : config?.lang ?? (route === 'root' ? undefined : route);
    if (typeof lang !== 'string' || !LANGUAGE_TAG_PATTERN.test(lang)) {
      throw new TypeError(`Hagilight RSS locale "${route}" must have a valid language tag.`);
    }
    let normalizedLang: string;
    try {
      [normalizedLang] = Intl.getCanonicalLocales(lang) as [string];
    } catch {
      throw new TypeError(`Hagilight RSS locale "${route}" has an invalid language tag "${lang}".`);
    }

    const filename = /^en(?:-us)?$/iu.test(normalizedLang) ? 'en' : normalizedLang;
    const collisionKey = filename.toLowerCase();
    if (usedFilenames.has(collisionKey)) {
      throw new Error(`Hagilight RSS locales collide on the "${filename}" feed filename.`);
    }
    usedFilenames.add(collisionKey);
    return { route, lang: normalizedLang, filename };
  });
}

function resolveSite(value: unknown): URL {
  try {
    const site = new URL(value as string | URL);
    if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password) {
      throw new Error();
    }
    return site;
  } catch {
    throw new TypeError('Hagilight RSS requires an absolute Astro site URL; configure `site` in astro.config.mjs.');
  }
}

function resolveLanguage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Hagilight RSS language must be a valid language tag.');
  }
  try {
    return Intl.getCanonicalLocales(value)[0] as string;
  } catch {
    throw new TypeError(`Hagilight RSS language "${value}" must be a valid language tag.`);
  }
}

function resolveBaseUrl(site: URL, baseUrl: string | URL = '/'): URL {
  let base: URL;
  try {
    base = new URL(baseUrl, site);
  } catch {
    throw new TypeError('Hagilight RSS base URL must be a valid path or absolute URL on the configured site.');
  }
  if (base.origin !== site.origin) {
    throw new TypeError('Hagilight RSS base URL must use the configured Astro site origin.');
  }
  base.pathname = `${base.pathname.replace(/\/+$/u, '')}/`;
  base.search = '';
  base.hash = '';
  return base;
}

function resolveItemUrl(value: unknown, base: URL): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Hagilight RSS items require a non-empty link.');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    url = new URL(value.replace(/^\/+/u, ''), base);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError(`Hagilight RSS item link "${value}" must resolve to an absolute HTTP(S) URL.`);
  }
  return url.href;
}

function resolvePublicationDate(item: RssFeedItem, index: number): Date | undefined {
  const value = item.pubDate ?? item.date;
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Hagilight RSS item ${index + 1} has an invalid publication date.`);
  }
  return date;
}

export function generateRssFeed(options: RssFeedOptions): Promise<Response> {
  const {
    site: siteInput,
    baseUrl = '/',
    language = 'en',
    title,
    description,
    items,
  } = (options ?? {}) as Partial<RssFeedOptions>;
  const site = resolveSite(siteInput);
  const base = resolveBaseUrl(site, baseUrl);
  const lang = resolveLanguage(language);
  if (typeof title !== 'string' || !title.trim()) {
    throw new TypeError('Hagilight RSS requires a non-empty feed title.');
  }
  if (typeof description !== 'string' || !description.trim()) {
    throw new TypeError('Hagilight RSS requires a non-empty feed description.');
  }
  if (!Array.isArray(items)) {
    throw new TypeError('Hagilight RSS items must be an array supplied by the consumer.');
  }
  const feedItems = (items as readonly unknown[]).map((item, index) => {
    if (!isRecord(item)) {
      throw new TypeError(`Hagilight RSS item ${index + 1} must be an object.`);
    }
    const entry = item as unknown as RssFeedItem;
    if (typeof entry.title !== 'string' || !entry.title.trim()) {
      throw new TypeError(`Hagilight RSS item ${index + 1} requires a non-empty title.`);
    }
    if (entry.description !== undefined && typeof entry.description !== 'string') {
      throw new TypeError(`Hagilight RSS item ${index + 1} description must be a string.`);
    }
    const pubDate = resolvePublicationDate(entry, index);
    return {
      title: entry.title,
      ...(entry.description === undefined ? {} : { description: entry.description }),
      link: resolveItemUrl(entry.link, base),
      ...(pubDate === undefined ? {} : { pubDate }),
    };
  });

  return rss({
    title,
    description,
    site: base,
    customData: `<language>${lang}</language>`,
    items: feedItems,
  });
}
