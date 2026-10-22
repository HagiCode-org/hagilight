/**
 * Browser-safe picker for decorative R2 images (`r2-image-random-display`).
 *
 * A slot keeps its vendored default in the markup and carries a `data-random-pool` JSON list of R2 object paths.
 * After load, one entry is picked uniformly, preloaded with a plain `Image()` (never `fetch`, so the R2 CORS rule
 * does not apply), and swapped in only when it loads within the timeout. Every failure keeps the default. No node:
 * import, no library. The environment is injectable so tests can use a fake image and a seeded random source.
 */

export const R2_IMAGE_ORIGIN = 'https://img-gen.hagicode.com';
export const RANDOM_POOL_ATTRIBUTE = 'data-random-pool';
export const RANDOM_POOL_MIN_ENTRIES = 12;
export const RANDOM_POOL_MAX_ENTRIES = 200;
export const RANDOM_IMAGE_TIMEOUT_MS = 3000;

const OBJECT_PATH_PATTERN = /^([a-z0-9][a-z0-9_-]*)\/[a-z0-9][a-z0-9_-]*\.avif$/u;

export interface PreloadImage {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

export interface RandomImageEnvironment {
  /** Returns a value in [0, 1). Defaults to `Math.random`. */
  readonly random?: () => number;
  /** Defaults to `new Image()`. */
  readonly createImage?: () => PreloadImage;
  /** Defaults to the global `setTimeout` and `clearTimeout`. */
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  /** Defaults to the browser's data-saver preference. */
  readonly saveData?: () => boolean;
}

/**
 * Checks a pool: 12 to 200 unique `<album>/<key>.avif` object paths, all from one album. Throws a `TypeError`, so a
 * bad pool fails the build instead of the page.
 */
export function validateRandomPool(entries: unknown): readonly string[] {
  if (!Array.isArray(entries) || entries.length < RANDOM_POOL_MIN_ENTRIES || entries.length > RANDOM_POOL_MAX_ENTRIES) {
    throw new TypeError(`Hagilight random pool must list ${RANDOM_POOL_MIN_ENTRIES} to ${RANDOM_POOL_MAX_ENTRIES} R2 objects.`);
  }
  let album: string | undefined;
  for (const entry of entries) {
    const match = typeof entry === 'string' ? OBJECT_PATH_PATTERN.exec(entry) : null;
    if (!match) throw new TypeError(`Hagilight random pool entry "${String(entry)}" must be an <album>/<key>.avif object path.`);
    album ??= match[1];
    if (match[1] !== album) throw new TypeError('Hagilight random pool entries must all come from one album.');
  }
  if (new Set(entries).size !== entries.length) throw new TypeError('Hagilight random pool entries must be unique.');
  return Object.freeze([...entries]);
}

/** Picks one entry uniformly. Out-of-range or non-finite random values clamp to the first or last entry. */
export function pickRandomEntry<T>(entries: readonly T[], random: () => number = Math.random): T {
  const value = random();
  const fraction = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1 - Number.EPSILON) : 0;
  return entries[Math.floor(fraction * entries.length)] as T;
}

/** The full image URL of an R2 object path. */
export function poolImageUrl(objectPath: string): string {
  return `${R2_IMAGE_ORIGIN}/${objectPath}`;
}

/**
 * Loads `url` in an image element. Resolves `true` only when it loads within the timeout; an error, a timeout or a
 * missing `Image` resolves `false`. Never rejects and never retries.
 */
export function preloadImage(url: string, env: RandomImageEnvironment = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const setTimer = env.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    const clearTimer = env.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    let timer: unknown;
    const finish = (loaded: boolean) => {
      clearTimer(timer);
      resolve(loaded);
    };
    try {
      const image = env.createImage ? env.createImage() : new Image();
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      timer = setTimer(() => finish(false), RANDOM_IMAGE_TIMEOUT_MS);
      image.src = url;
    } catch {
      finish(false);
    }
  });
}

/**
 * Swaps a loaded URL into a `<picture>` or `<img>` slot. The `<source>` elements are removed so the browser uses the
 * swapped `src`; the `<img>` keeps its width, height and alt text, so the box does not change.
 */
export function showPoolImage(slot: Element, url: string): void {
  slot.querySelectorAll('source').forEach((source) => source.remove());
  const img = slot.querySelector('img');
  if (!img) return;
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
  img.src = url;
}

function dataSaverEnabled(): boolean {
  const connection = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * Runs the picker for every `[data-random-pool]` slot under `root` that has not been handled yet. Each slot is marked
 * with `data-random-state` so it is picked once per page view. Returns the number of slots that swapped.
 * Never rejects: an invalid pool, a data saver, or a failed load leaves the default in place.
 */
export async function mountRandomImages(root: ParentNode, env: RandomImageEnvironment = {}): Promise<number> {
  const random = env.random ?? Math.random;
  const saveData = env.saveData ?? dataSaverEnabled;
  const slots = Array.from(root.querySelectorAll(`[${RANDOM_POOL_ATTRIBUTE}]:not([data-random-state])`));
  const outcomes = await Promise.all(slots.map(async (slot) => {
    slot.setAttribute('data-random-state', 'default');
    if (saveData()) return false;
    try {
      const pool = validateRandomPool(JSON.parse(slot.getAttribute(RANDOM_POOL_ATTRIBUTE) ?? 'null'));
      const url = poolImageUrl(pickRandomEntry(pool, random));
      if (!(await preloadImage(url, env))) return false;
      showPoolImage(slot, url);
      slot.setAttribute('data-random-state', 'swapped');
      return true;
    } catch {
      return false;
    }
  }));
  return outcomes.filter(Boolean).length;
}

export interface RandomPoolManifest {
  readonly album: string;
  readonly maxBytes: number;
  readonly entries: readonly { readonly key: string; readonly bytes: number }[];
}

/**
 * Build-time: turns a manifest pool into validated object paths. An entry over `maxBytes` fails the build, so an
 * oversized object never reaches a page.
 */
export function randomPoolFromManifest(pool: RandomPoolManifest): readonly string[] {
  for (const entry of pool.entries) {
    if (entry.bytes > pool.maxBytes) {
      throw new TypeError(`Hagilight random pool entry ${entry.key} is ${entry.bytes} bytes, over the ${pool.maxBytes} byte cap.`);
    }
  }
  return validateRandomPool(pool.entries.map(({ key }) => `${pool.album}/${key}.avif`));
}

/** Build-time: the `data-random-pool` attribute value for a validated pool. */
export function randomPoolAttribute(entries: readonly string[]): string {
  return JSON.stringify(validateRandomPool(entries));
}
