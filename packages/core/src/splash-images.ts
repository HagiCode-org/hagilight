/**
 * Public image contract for the img-gen `startup-splash` collection.
 *
 * Browser-safe: no `node:` import and no file system access. The cache storage, fetch and random source are
 * parameters so tests can replace them. The loaders never reject: any failure reads as a miss.
 */

export interface SplashConfig {
  readonly baseUrl: string;
  readonly prefix: string;
  readonly count: number;
  readonly cacheName: string;
}

/** The overridable keys. `readBudgetMs` and `maxEntries` are fixed defaults, not consumer options. */
export interface SplashOverrides {
  readonly baseUrl?: string;
  readonly prefix?: string;
  readonly count?: number;
  readonly cacheName?: string;
}

export const SPLASH_IMAGE_DEFAULTS = Object.freeze({
  baseUrl: 'https://img-gen.hagicode.com',
  prefix: 'startup-splash',
  count: 600,
  cacheName: 'hagilight.rootTransit.splash',
  readBudgetMs: 100,
  maxEntries: 30,
});

const KEY_PREFIX = 'hagicode-splash-';
const KEY_PATTERN = /^hagicode-splash-(\d{3,4})$/u;
const PREFIX_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;
const MAX_COUNT = 9999;

const fail = (reason: string): never => {
  throw new TypeError(`Hagilight RootTransit: ${reason}`);
};

const DEFAULT_CONFIG: SplashConfig = Object.freeze({
  baseUrl: SPLASH_IMAGE_DEFAULTS.baseUrl,
  prefix: SPLASH_IMAGE_DEFAULTS.prefix,
  count: SPLASH_IMAGE_DEFAULTS.count,
  cacheName: SPLASH_IMAGE_DEFAULTS.cacheName,
});

/**
 * Resolves the `splash` option. `false` disables the splash (returns null); `undefined` gives the defaults; an
 * object overrides the listed keys. Throws a `TypeError` for any invalid value, so bad config fails the build.
 */
export function resolveSplashConfig(input?: false | SplashOverrides): SplashConfig | null {
  if (input === false) return null;
  if (input === undefined) return DEFAULT_CONFIG;
  if (typeof input !== 'object' || input === null) fail('splash must be false or an options object.');
  const allowed = new Set(['baseUrl', 'prefix', 'count', 'cacheName']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) fail(`splash has an unknown option "${key}".`);
  }

  const baseUrl = input.baseUrl ?? DEFAULT_CONFIG.baseUrl;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return fail('splash baseUrl must be an absolute URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    fail('splash baseUrl must be HTTPS without credentials, query or fragment.');
  }

  const prefix = input.prefix ?? DEFAULT_CONFIG.prefix;
  if (!PREFIX_PATTERN.test(prefix) || prefix.split('/').some((segment) => segment === '.' || segment === '..')) {
    fail('splash prefix must be letters, digits, dots, underscores and hyphens joined by slashes.');
  }

  const count = input.count ?? DEFAULT_CONFIG.count;
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    fail(`splash count must be an integer from 1 to ${MAX_COUNT}.`);
  }

  const cacheName = input.cacheName ?? DEFAULT_CONFIG.cacheName;
  if (typeof cacheName !== 'string' || !cacheName.trim()) fail('splash cacheName must be a non-empty string.');

  return Object.freeze({
    baseUrl: `${url.origin}${url.pathname.replace(/\/+$/u, '')}`,
    prefix,
    count,
    cacheName,
  });
}

/** Maps an index from 1 to `count` to its key, for example 7 to `hagicode-splash-007`. */
export function splashKey(index: number, count: number = SPLASH_IMAGE_DEFAULTS.count): string {
  if (!Number.isInteger(index) || index < 1 || index > count) {
    fail(`splash index must be an integer from 1 to ${count}.`);
  }
  return `${KEY_PREFIX}${String(index).padStart(3, '0')}`;
}

/**
 * The path below the base URL, `<prefix>/<key>.avif`, for a key or an index. A string must be a key of the
 * collection: `hagicode-splash-` followed by its number, padded to three digits, within the count.
 */
export function splashImagePath(keyOrIndex: number | string, config: SplashConfig = DEFAULT_CONFIG): string {
  const key = typeof keyOrIndex === 'number' ? splashKey(keyOrIndex, config.count) : canonicalKey(keyOrIndex, config.count);
  return `${config.prefix}/${key}.avif`;
}

/** The full image URL: the base URL joined with `splashImagePath`. */
export function splashImageUrl(keyOrIndex: number | string, config: SplashConfig = DEFAULT_CONFIG): string {
  return `${config.baseUrl}/${splashImagePath(keyOrIndex, config)}`;
}

function canonicalKey(key: string, count: number): string {
  const match = KEY_PATTERN.exec(key);
  if (!match || splashKey(Number(match[1]), count) !== key) {
    fail(`splash key must be ${KEY_PREFIX}NNN within 1 to ${count}.`);
  }
  return key;
}

/**
 * A 1-based index from `random`, which returns a value in [0, 1). Out-of-range or non-finite results are clamped,
 * so the result is always within 1 to `count`.
 */
export function pickSplashIndex(random: () => number = Math.random, count: number = SPLASH_IMAGE_DEFAULTS.count): number {
  const value = random();
  const fraction = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1 - Number.EPSILON) : 0;
  return 1 + Math.floor(fraction * count);
}

export interface SplashStorageOptions {
  /** `undefined` uses the global `caches`; `null` means no cache (every read is a miss). */
  readonly storage?: CacheStorage | null;
  readonly cacheName?: string;
  readonly budgetMs?: number;
  readonly maxEntries?: number;
}

export type SplashLoad = { readonly source: 'cache'; readonly blob: Blob } | { readonly source: 'miss' };

const MISS: SplashLoad = Object.freeze({ source: 'miss' });

function resolveStorage(storage: CacheStorage | null | undefined): CacheStorage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof caches === 'undefined' ? null : caches;
  } catch {
    return null;
  }
}

/**
 * Reads `url` from the Cache API within the read budget. A hit gives the cached blob; anything else (no cache, no
 * entry, a read error or a read that is not done within the budget) gives `miss`, and the caller loads the URL
 * from the network. Keyed by the full URL, so a changed host or prefix never reads an old entry. Never rejects.
 */
export async function loadSplashImage(url: string, options: SplashStorageOptions = {}): Promise<SplashLoad> {
  const storage = resolveStorage(options.storage);
  if (!storage) return MISS;

  const cacheName = options.cacheName ?? SPLASH_IMAGE_DEFAULTS.cacheName;
  const lookup = (async (): Promise<SplashLoad> => {
    try {
      const cache = await storage.open(cacheName);
      const response = await cache.match(url);
      if (!response?.ok) return MISS;
      const blob = await response.blob();
      return blob.size > 0 ? { source: 'cache', blob } : MISS;
    } catch {
      return MISS;
    }
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<SplashLoad>((resolve) => {
    timer = setTimeout(() => resolve(MISS), options.budgetMs ?? SPLASH_IMAGE_DEFAULTS.readBudgetMs);
  });
  try {
    return await Promise.race([lookup, budget]);
  } finally {
    clearTimeout(timer);
  }
}

export interface SplashStoreOptions extends SplashStorageOptions {
  /** Defaults to a CORS `fetch` with no credentials. */
  readonly fetchImage?: (url: string) => Promise<Response>;
}

/**
 * Downloads `url` and stores the image under that URL, then trims the cache to `maxEntries`, oldest first. A
 * response that is not OK, or has an empty body, stores nothing. Returns whether an entry was written. Never
 * rejects, so a missing CORS header or an unavailable cache is a `false`, not an error.
 */
export async function storeSplashImage(url: string, options: SplashStoreOptions = {}): Promise<boolean> {
  const storage = resolveStorage(options.storage);
  if (!storage) return false;

  try {
    const fetchImage = options.fetchImage ?? ((target: string) => fetch(target, { mode: 'cors', credentials: 'omit' }));
    const response = await fetchImage(url);
    if (!response.ok) return false;
    const blob = await response.blob();
    if (blob.size === 0) return false;

    const cache = await storage.open(options.cacheName ?? SPLASH_IMAGE_DEFAULTS.cacheName);
    // Delete first so a re-stored entry moves to the end of the insertion order that trimming relies on.
    await cache.delete(url);
    await cache.put(url, new Response(blob));
    await trimCache(cache, options.maxEntries ?? SPLASH_IMAGE_DEFAULTS.maxEntries);
    return true;
  } catch {
    return false;
  }
}

async function trimCache(cache: Cache, maxEntries: number): Promise<void> {
  const keys = await cache.keys();
  for (const oldest of keys.slice(0, Math.max(0, keys.length - maxEntries))) {
    await cache.delete(oldest);
  }
}
