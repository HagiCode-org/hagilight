import rss from '@astrojs/rss';

function resolveSite(value) {
  try {
    const site = new URL(value);
    if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password) {
      throw new Error();
    }
    return site;
  } catch {
    throw new TypeError('Hagilight RSS requires an absolute Astro site URL; configure `site` in astro.config.mjs.');
  }
}

function resolveLanguage(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Hagilight RSS language must be a valid language tag.');
  }
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    throw new TypeError(`Hagilight RSS language "${value}" must be a valid language tag.`);
  }
}

function resolveBaseUrl(site, baseUrl = '/') {
  let base;
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

function resolveItemUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Hagilight RSS items require a non-empty link.');
  }
  let url;
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

function resolvePublicationDate(item, index) {
  const value = item.pubDate ?? item.date;
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Hagilight RSS item ${index + 1} has an invalid publication date.`);
  }
  return date;
}

export function generateRssFeed({
  site: siteInput,
  baseUrl = '/',
  language = 'en',
  title,
  description,
  items,
} = {}) {
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
  const feedItems = items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError(`Hagilight RSS item ${index + 1} must be an object.`);
    }
    if (typeof item.title !== 'string' || !item.title.trim()) {
      throw new TypeError(`Hagilight RSS item ${index + 1} requires a non-empty title.`);
    }
    if (item.description !== undefined && typeof item.description !== 'string') {
      throw new TypeError(`Hagilight RSS item ${index + 1} description must be a string.`);
    }
    const pubDate = resolvePublicationDate(item, index);
    return {
      title: item.title,
      ...(item.description === undefined ? {} : { description: item.description }),
      link: resolveItemUrl(item.link, base),
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
