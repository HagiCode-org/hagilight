import type { RssLocale } from '@hagicode/hagilight-core/rss';

export interface RssContentOptions {
  /** Include non-blog documentation pages. Defaults to `true`. */
  includeDocs?: boolean;
  /** Include pages under `blog/`. Defaults to `true`. */
  includeBlog?: boolean;
}

export type ResolvedRssContentOptions = Required<RssContentOptions>;

/** The subset of a Starlight docs collection entry used to build feeds. */
export interface RssDocsEntry {
  id: string;
  data: {
    title: string;
    description?: string | undefined;
    draft?: boolean | undefined;
    rss?: unknown;
    lastUpdated?: unknown;
  };
}

export interface SelectRssEntriesOptions {
  filename: string | undefined;
  locales: readonly RssLocale[];
  options: ResolvedRssContentOptions;
}

export function resolveRssOptions(options: RssContentOptions = {}): ResolvedRssContentOptions {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Hagilight rss options must be an object.');
  }
  for (const key of ['includeDocs', 'includeBlog'] as const) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw new TypeError(`Hagilight rss ${key} option must be a boolean.`);
    }
  }
  return {
    includeDocs: options.includeDocs ?? true,
    includeBlog: options.includeBlog ?? true,
  };
}

function getLocaleForEntry(id: string, locales: readonly RssLocale[]) {
  const localized = locales
    .filter(({ route }) => route !== 'root')
    .sort((a, b) => b.route.length - a.route.length)
    .find(({ route }) => id === route || id.startsWith(`${route}/`));
  if (localized) return { locale: localized, relativeId: id.slice(localized.route.length).replace(/^\/+/, '') };

  const root = locales.find(({ route }) => route === 'root');
  if (root) return { locale: root, relativeId: id };
  return undefined;
}

export function isBlogEntry(id: string): boolean {
  const segments = id.split('/').filter(Boolean);
  if (segments.at(-1) === 'index') segments.pop();
  return segments[0] === 'blog' && segments.length > 1;
}

function timestamp(value: unknown): number | undefined {
  return value instanceof Date ? value.getTime() : undefined;
}

export function selectRssEntries<Entry extends RssDocsEntry>(
  entries: readonly Entry[],
  { filename, locales, options }: SelectRssEntriesOptions,
): Entry[] {
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
      if (!entryLocale || entryLocale.locale.filename !== filename) return false;
      const isBlog = isBlogEntry(entryLocale.relativeId);
      return isBlog ? options.includeBlog : options.includeDocs;
    })
    .sort((a, b) => {
      const aDate = timestamp(a.data.lastUpdated);
      const bDate = timestamp(b.data.lastUpdated);
      if (aDate === undefined || Number.isNaN(aDate)) return bDate === undefined || Number.isNaN(bDate) ? 0 : 1;
      if (bDate === undefined || Number.isNaN(bDate)) return -1;
      return bDate - aDate;
    });
}
