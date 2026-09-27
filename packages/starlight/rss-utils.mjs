const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

export function resolveRssOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Hagilight rss options must be an object.');
  }
  for (const key of ['includeDocs', 'includeBlog']) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw new TypeError(`Hagilight rss ${key} option must be a boolean.`);
    }
  }
  return {
    includeDocs: options.includeDocs ?? true,
    includeBlog: options.includeBlog ?? true,
  };
}

export function resolveRssLocales(locales) {
  const configuredLocales = locales === undefined
    ? [['root', { lang: 'en' }]]
    : Object.entries(locales);
  if (configuredLocales.length === 0) configuredLocales.push(['root', { lang: 'en' }]);

  const usedFilenames = new Set();
  const resolved = configuredLocales.map(([route, config]) => {
    const lang = typeof config === 'string' ? config : config?.lang ?? (route === 'root' ? undefined : route);
    if (typeof lang !== 'string' || !LANGUAGE_TAG_PATTERN.test(lang)) {
      throw new TypeError(`Hagilight RSS locale "${route}" must have a valid language tag.`);
    }
    let normalizedLang;
    try {
      [normalizedLang] = Intl.getCanonicalLocales(lang);
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
  return resolved;
}

function getLocaleForEntry(id, locales) {
  const localized = locales
    .filter(({ route }) => route !== 'root')
    .sort((a, b) => b.route.length - a.route.length)
    .find(({ route }) => id === route || id.startsWith(`${route}/`));
  if (localized) return { locale: localized, relativeId: id.slice(localized.route.length).replace(/^\/+/, '') };

  const root = locales.find(({ route }) => route === 'root');
  if (root) return { locale: root, relativeId: id };
  return undefined;
}

export function isBlogEntry(id) {
  const segments = id.split('/').filter(Boolean);
  if (segments.at(-1) === 'index') segments.pop();
  return segments[0] === 'blog' && segments.length > 1;
}

export function selectRssEntries(entries, { filename, locales, options }) {
  const locale = locales.find((item) => item.filename === filename);
  if (!locale) {
    if (filename === 'en') return [];
    throw new Error(`Hagilight RSS has no configured locale for "${filename}".`);
  }

  return entries
    .filter(({ id, data }) => {
      if (data.rss !== undefined && typeof data.rss !== 'boolean') {
        throw new TypeError(`Hagilight RSS frontmatter field "rss" for "${id}" must be a boolean.`);
      }
      if (data.draft || data.rss === false) return false;

      const entryLocale = getLocaleForEntry(id, locales);
      if (entryLocale?.locale.filename !== filename) return false;
      const isBlog = isBlogEntry(entryLocale.relativeId);
      return isBlog ? options.includeBlog : options.includeDocs;
    })
    .sort((a, b) => {
      const aDate = a.data.lastUpdated instanceof Date ? a.data.lastUpdated.getTime() : undefined;
      const bDate = b.data.lastUpdated instanceof Date ? b.data.lastUpdated.getTime() : undefined;
      if (aDate === undefined || Number.isNaN(aDate)) return bDate === undefined || Number.isNaN(bDate) ? 0 : 1;
      if (bDate === undefined || Number.isNaN(bDate)) return -1;
      return bDate - aDate;
    });
}
