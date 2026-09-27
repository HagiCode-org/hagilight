const INDEX_ORIGIN = 'https://index.hagicode.com';
const CATALOG_URL = `${INDEX_ORIGIN}/index-catalog.json`;
const FLAGS_URL = `${INDEX_ORIGIN}/promote.json`;
const CONTENT_URL = `${INDEX_ORIGIN}/promote_content.json`;

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

export interface PromotionImage {
  src: string;
  alt: string;
  variant?: string;
  width?: number;
  height?: number;
}

export interface PromotionCard {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  link: string;
  image?: PromotionImage;
}

interface PromotionFlag {
  id: string;
  on: boolean;
  startTime?: string;
  endTime?: string;
}

interface PromotionContent {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  cta?: Record<string, string>;
  link: string;
  image?: PromotionImage;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseLocalizedMap(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => nonEmptyString(entry[0]) && nonEmptyString(entry[1]),
  );
  return entries.length ? Object.fromEntries(entries.map(([key, text]) => [key.trim(), text.trim()])) : null;
}

function parseImage(value: unknown, record: JsonRecord): PromotionImage | undefined {
  const image = isRecord(value) ? value : {};
  const src = nonEmptyString(value)
    ? value.trim()
    : nonEmptyString(image.src)
      ? image.src.trim()
      : nonEmptyString(image.url)
        ? image.url.trim()
        : nonEmptyString(record.imageUrl)
          ? record.imageUrl.trim()
          : nonEmptyString(record.imageURL)
            ? record.imageURL.trim()
            : '';
  if (!src) return undefined;

  const width = typeof image.width === 'number' && Number.isFinite(image.width) && image.width > 0
    ? Math.round(image.width)
    : undefined;
  const height = typeof image.height === 'number' && Number.isFinite(image.height) && image.height > 0
    ? Math.round(image.height)
    : undefined;

  let normalizedSrc: string;
  try {
    const url = new URL(src, INDEX_ORIGIN);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    normalizedSrc = url.toString();
  } catch {
    return undefined;
  }

  return {
    src: normalizedSrc,
    alt: nonEmptyString(image.alt)
      ? image.alt.trim()
      : nonEmptyString(record.imageAlt)
        ? record.imageAlt.trim()
        : '',
    variant: nonEmptyString(image.variant) ? image.variant.trim() : undefined,
    width,
    height,
  };
}

function isSafeLink(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value, INDEX_ORIGIN).protocol);
  } catch {
    return false;
  }
}

export function parsePromotionFlags(payload: unknown): PromotionFlag[] {
  if (!isRecord(payload) || !Array.isArray(payload.promotes)) return [];
  return payload.promotes.flatMap((item): PromotionFlag[] => {
    if (!isRecord(item) || !nonEmptyString(item.id) || typeof item.on !== 'boolean') return [];
    return [{
      id: item.id.trim(),
      on: item.on,
      startTime: nonEmptyString(item.startTime) ? item.startTime.trim() : undefined,
      endTime: nonEmptyString(item.endTime) ? item.endTime.trim() : undefined,
    }];
  });
}

export function parsePromotionContent(payload: unknown): PromotionContent[] {
  if (!isRecord(payload) || !Array.isArray(payload.contents)) return [];
  return payload.contents.flatMap((item): PromotionContent[] => {
    if (!isRecord(item) || !nonEmptyString(item.id) || !nonEmptyString(item.link) || !isSafeLink(item.link)) {
      return [];
    }
    const title = parseLocalizedMap(item.title);
    const description = parseLocalizedMap(item.description);
    if (!title || !description) return [];
    const cta = parseLocalizedMap(item.cta);
    const image = parseImage(item.image, item);
    return [{
      id: item.id.trim(),
      title,
      description,
      cta: cta ?? undefined,
      link: item.link.trim(),
      image,
    }];
  });
}

function localeCandidates(locale: string | null | undefined): string[] {
  let canonical = 'en-US';
  if (locale?.trim()) {
    try {
      canonical = Intl.getCanonicalLocales(locale.trim().replace(/_/g, '-'))[0] ?? 'en-US';
    } catch {
      canonical = 'en-US';
    }
  }
  const normalized = canonical.toLowerCase();
  const candidates = [normalized, normalized.split('-')[0] ?? normalized];
  if (normalized.startsWith('zh-hant') || ['zh-tw', 'zh-hk', 'zh-mo'].includes(normalized)) {
    candidates.push('zh-hant', 'zh');
  } else if (normalized.startsWith('zh')) {
    candidates.push('zh-cn', 'zh');
  }
  candidates.push('en-us', 'en');
  return [...new Set(candidates)];
}

function localized(value: Record<string, string>, locale: string | null | undefined): string | null {
  const values = new Map(Object.entries(value).map(([key, text]) => [key.toLowerCase(), text]));
  for (const candidate of localeCandidates(locale)) {
    const result = values.get(candidate);
    if (result) return result;
  }
  return Object.values(value)[0] ?? null;
}

function isActive(flag: PromotionFlag, now: number): boolean {
  if (!flag.on) return false;
  const start = flag.startTime ? Date.parse(flag.startTime) : null;
  const end = flag.endTime ? Date.parse(flag.endTime) : null;
  if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end))) return false;
  if (start !== null && end !== null && start >= end) return false;
  return (start === null || now >= start) && (end === null || now < end);
}

export function normalizeActivePromotions(
  flags: PromotionFlag[],
  content: PromotionContent[],
  locale?: string | null,
  now = Date.now(),
): PromotionCard[] {
  const contentById = new Map(content.map((item) => [item.id, item]));
  return flags.flatMap((flag): PromotionCard[] => {
    const item = contentById.get(flag.id);
    if (!isActive(flag, now) || !item) return [];
    const title = localized(item.title, locale);
    const description = localized(item.description, locale);
    if (!title || !description) return [];
    return [{
      id: item.id,
      title,
      description,
      ctaLabel: (item.cta && localized(item.cta, locale)) || 'Learn more',
      link: item.link,
      image: item.image ? { ...item.image, alt: item.image.alt || title } : undefined,
    }];
  });
}

async function readJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load promotion data (${response.status})`);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('json')) throw new Error(`Expected JSON promotion data, received ${contentType || 'no content type'}`);
  return response.json();
}

export async function resolvePromotionDocumentUrls(fetchImpl: FetchLike = fetch): Promise<{
  flagsUrl: string;
  contentUrl: string;
  source: 'catalog' | 'fallback';
}> {
  try {
    const catalog = await readJson(fetchImpl, CATALOG_URL);
    if (isRecord(catalog) && Array.isArray(catalog.entries)) {
      const entries = catalog.entries.filter(isRecord);
      const flags = entries.find((entry) => entry.id === 'promotion-flags' && nonEmptyString(entry.path));
      const content = entries.find((entry) => entry.id === 'promotion-content' && nonEmptyString(entry.path));
      const flagsPath = flags?.path;
      const contentPath = content?.path;
      if (nonEmptyString(flagsPath) && nonEmptyString(contentPath)) {
        const flagsUrl = new URL(flagsPath, INDEX_ORIGIN);
        const contentUrl = new URL(contentPath, INDEX_ORIGIN);
        if (flagsUrl.origin !== INDEX_ORIGIN || contentUrl.origin !== INDEX_ORIGIN) {
          return { flagsUrl: FLAGS_URL, contentUrl: CONTENT_URL, source: 'fallback' };
        }
        return {
          flagsUrl: flagsUrl.toString(),
          contentUrl: contentUrl.toString(),
          source: 'catalog',
        };
      }
    }
  } catch {
    // The stable canonical endpoints remain available when catalog discovery fails.
  }
  return { flagsUrl: FLAGS_URL, contentUrl: CONTENT_URL, source: 'fallback' };
}

export async function loadActivePromotions(options: {
  locale?: string | null;
  fetchImpl?: FetchLike;
  now?: number;
} = {}): Promise<PromotionCard[]> {
  const { locale, fetchImpl = fetch, now = Date.now() } = options;
  try {
    const urls = await resolvePromotionDocumentUrls(fetchImpl);
    const [flags, content] = await Promise.all([
      readJson(fetchImpl, urls.flagsUrl),
      readJson(fetchImpl, urls.contentUrl),
    ]);
    return normalizeActivePromotions(parsePromotionFlags(flags), parsePromotionContent(content), locale, now);
  } catch {
    return [];
  }
}
