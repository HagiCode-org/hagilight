const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

export function resolveRssLocales(locales, { requireNonEmpty = false } = {}) {
  if (locales !== undefined && (!locales || typeof locales !== 'object' || Array.isArray(locales))) {
    throw new TypeError('Hagilight RSS locales must be an object.');
  }
  if (requireNonEmpty && (locales === undefined || Object.keys(locales).length === 0)) {
    throw new TypeError('Hagilight RSS locales must contain at least one locale.');
  }

  const configuredLocales = locales === undefined
    ? [['root', { lang: 'en' }]]
    : Object.entries(locales);
  if (configuredLocales.length === 0) {
    if (requireNonEmpty) throw new TypeError('Hagilight RSS locales must contain at least one locale.');
    configuredLocales.push(['root', { lang: 'en' }]);
  }

  const usedFilenames = new Set();
  return configuredLocales.map(([route, config]) => {
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
}
