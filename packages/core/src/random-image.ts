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
export const RANDOM_FAN_ATTRIBUTE = 'data-random-fan';
/** Cards shown at once, and cards picked per page view; the rest wait off stage and take turns. */
export const FAN_VISIBLE_CARDS = 3;
export const FAN_DECK_CARDS = 6;
export const FAN_TURN_MS = 3600;

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

export interface RandomFanEnvironment extends RandomImageEnvironment {
  /** Defaults to the `prefers-reduced-motion` media query. The fan then stays still at its first three cards. */
  readonly reducedMotion?: () => boolean;
  /** Reports when a slot is on screen: `onChange(true)` as it nears the viewport and again on every change. Defaults to an IntersectionObserver. */
  readonly watch?: (slot: Element, onChange: (visible: boolean) => void) => void;
  /** Defaults to `document.hidden`. */
  readonly tabHidden?: () => boolean;
  /** Starts a repeating timer and returns its stop function. Defaults to `setInterval`. */
  readonly every?: (callback: () => void, ms: number) => () => void;
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

/** Clamps a random value into [0, 1); a non-finite value counts as 0. */
function unitFraction(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1 - Number.EPSILON) : 0;
}

/** Picks one entry uniformly. Out-of-range or non-finite random values clamp to the first or last entry. */
export function pickRandomEntry<T>(entries: readonly T[], random: () => number = Math.random): T {
  return entries[Math.floor(unitFraction(random) * entries.length)] as T;
}

/** Picks up to `count` distinct entries uniformly, in random order (a partial Fisher-Yates shuffle of a copy). */
export function pickRandomEntries<T>(entries: readonly T[], count: number, random: () => number = Math.random): T[] {
  const copy = [...entries];
  const take = Math.min(Math.max(Math.floor(count), 0), copy.length);
  for (let index = 0; index < take; index += 1) {
    const other = index + Math.floor(unitFraction(random) * (copy.length - index));
    [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
  }
  return copy.slice(0, take);
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

/** The fan slot of deck card `card` after `turn` turns: 0 left, 1 centre, 2 right, then the off-stage places in line. */
export function fanSlot(card: number, turn: number, count: number = FAN_DECK_CARDS): number {
  return (((card - turn) % count) + count) % count;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function watchViewport(slot: Element, onChange: (visible: boolean) => void): void {
  if (typeof IntersectionObserver !== 'function') {
    onChange(true);
    return;
  }
  new IntersectionObserver((entries) => onChange(entries[entries.length - 1]?.isIntersecting === true), { rootMargin: '0px 0px 160px 0px' }).observe(slot);
}

function deal(slot: Element, defaultImage: Element | null, urls: readonly string[], cards: number): HTMLElement[] {
  const stage = (slot.ownerDocument as Document).createElement('span');
  stage.className = 'hagilight-fan';
  const deck = urls.slice(0, cards).map((url) => {
    const card = (defaultImage ? defaultImage.cloneNode(false) : (slot.ownerDocument as Document).createElement('img')) as HTMLElement;
    card.removeAttribute('srcset');
    card.removeAttribute('sizes');
    card.removeAttribute('loading');
    card.setAttribute('class', 'hagilight-fan__card');
    card.setAttribute('src', url);
    stage.append(card);
    return card;
  });
  slot.append(stage);
  // Commit the cards' resting pose, so the first slots below animate into a fan instead of appearing in it.
  void (slot as HTMLElement).offsetWidth;
  defaultImage?.setAttribute('data-fan-out', '');
  deck.forEach((card, index) => card.setAttribute('data-slot', String(index)));
  return deck;
}

async function mountFan(slot: Element, env: RandomFanEnvironment): Promise<boolean> {
  slot.setAttribute('data-random-state', 'default');
  if ((env.saveData ?? dataSaverEnabled)()) return false;
  let pool: readonly string[];
  try {
    pool = validateRandomPool(JSON.parse(slot.getAttribute(RANDOM_FAN_ATTRIBUTE) ?? 'null'));
  } catch {
    return false;
  }
  // Nothing is fetched until the footer nears the viewport, so the cards deal out where they can be seen.
  let visible = false;
  let near!: () => void;
  const arrived = new Promise<void>((resolve) => { near = resolve; });
  (env.watch ?? watchViewport)(slot, (isVisible) => {
    visible = isVisible;
    if (isVisible) near();
  });
  await arrived;
  const random = env.random ?? Math.random;
  // A full deck turns; a short one, or reduced motion, keeps the first three cards still, so only those are fetched.
  const wantsTurns = !(env.reducedMotion ?? prefersReducedMotion)();
  const urls = pickRandomEntries(pool, wantsTurns ? FAN_DECK_CARDS : FAN_VISIBLE_CARDS, random).map(poolImageUrl);
  const loaded = (await Promise.all(urls.map(async (url) => ((await preloadImage(url, env)) ? url : '')))).filter(Boolean);
  if (loaded.length < FAN_VISIBLE_CARDS) return false;
  const turning = wantsTurns && loaded.length === FAN_DECK_CARDS;
  const deck = deal(slot, slot.querySelector('img'), loaded, turning ? FAN_DECK_CARDS : FAN_VISIBLE_CARDS);
  slot.setAttribute('data-random-state', 'fan');
  if (turning) {
    let turn = 0;
    let stop = () => {};
    stop = (env.every ?? ((callback, ms) => {
      const handle = setInterval(callback, ms);
      return () => clearInterval(handle);
    }))(() => {
      if ((slot as { isConnected?: boolean }).isConnected === false) stop();
      else if (visible && !(env.tabHidden ?? (() => typeof document !== 'undefined' && document.hidden))()) {
        turn += 1;
        deck.forEach((card, index) => card.setAttribute('data-slot', String(fanSlot(index, turn, deck.length))));
      }
    }, FAN_TURN_MS);
  }
  return true;
}

/**
 * Runs the footer fan for every `[data-random-fan]` slot under `root` that has not been handled yet. The slot keeps
 * its vendored default until the footer nears the viewport; then six random pool entries are preloaded and, when
 * all six load, dealt out as a fan of three that turns through the six while the slot is on screen. Fewer than six
 * loaded cards make a still fan of three, fewer than three keep the default. One promise per slot, each resolving
 * `true` when the fan was dealt; none rejects.
 */
export function mountRandomFans(root: ParentNode, env: RandomFanEnvironment = {}): Promise<boolean>[] {
  return Array.from(root.querySelectorAll(`[${RANDOM_FAN_ATTRIBUTE}]:not([data-random-state])`))
    .map((slot) => mountFan(slot, env).catch(() => false));
}
