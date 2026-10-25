import {
  SPLASH_IMAGE_DEFAULTS, loadSplashImage, pickSplashIndex, splashImageUrl, storeSplashImage, type SplashConfig,
} from './splash-images.js';
import { mountLocaleMonitor } from './root-transit-monitor.js';

export {
  DEFAULT_LOCALE, LEGACY_SITE_LOCALE_STORAGE_KEY, SITE_LOCALE_STORAGE_KEY, SITE_LOCALES, normalizeTransitLocale,
  resolveTransitLocale,
  type LocaleInputEvidence, type LocaleResolution, type LocaleResolutionOptions, type LocaleSource, type SiteLocale,
} from './root-transit-locale.js';
export {
  LOCALE_MONITOR_COOKIE, LOCALE_MONITOR_STORAGE_KEY, formatLocaleMarker, parseLocaleMarker, type LocaleMarker,
} from './root-transit-marker.js';
export { mountLocaleMonitor, resolveLocaleMonitor, type LocaleMonitorOptions } from './root-transit-monitor.js';

/** The reference route sweep: the beam lands here and the loading rail takes over. */
const ROUTE_RUN_MS = 1250;

/** The reference route sweep (1,250 ms) and finished-state hold (320 ms). */
export const ROOT_TRANSIT_DELAY_MS = ROUTE_RUN_MS + 320;

/** Idle-time limit for storing a loaded splash image, so the store never waits on the page. */
const SPLASH_STORE_IDLE_TIMEOUT_MS = 1000;

export interface TransitDestinationOptions {
  site: string | URL;
  base?: string;
}

/** Resolve a configured local route, applying the deployment base at most once. */
export function resolveTransitDestination(destination: string, { site, base = '/' }: TransitDestinationOptions): string {
  const fail = (reason: string): never => { throw new TypeError(`Hagilight RootTransit: ${reason}`); };
  if (typeof destination !== 'string' || !destination.trim()) fail('destination is required.');
  const input = destination.trim();
  if (/[\u0000-\u0020\\]/u.test(input)) fail('destination must not contain whitespace, control characters or backslashes.');
  const origin = new URL(site);
  if (!['http:', 'https:'].includes(origin.protocol)) fail('site must use HTTP(S).');
  if (!/^\/(?!\/)/u.test(base) || /[?#\\\u0000-\u0020]/u.test(base)) fail('base must be an absolute local pathname.');
  const baseUrl = new URL(`${base.replace(/\/+$/u, '')}/`, origin.origin);
  const absolute = /^[a-z][a-z\d+.-]*:|^\/\//iu.test(input);
  const alreadyBased = input === baseUrl.pathname.slice(0, -1) || input.startsWith(baseUrl.pathname);
  let target: URL;
  try {
    target = new URL(absolute || alreadyBased ? input : input.replace(/^\//u, ''), absolute || alreadyBased ? origin.origin : baseUrl);
  } catch {
    return fail('destination must be a valid local URL.');
  }
  if (!['http:', 'https:'].includes(target.protocol) || target.origin !== origin.origin || target.username || target.password) {
    fail('destination must be an HTTP(S) URL on the configured site origin.');
  }
  target.pathname = target.pathname.replace(/\/{2,}/gu, '/');
  if (/%(?:2f|5c)/iu.test(target.pathname)) fail('destination must not contain encoded path separators.');
  let decoded: string;
  try { decoded = decodeURIComponent(target.pathname); } catch { return fail('destination contains invalid path encoding.'); }
  const root = decodeURIComponent(baseUrl.pathname).replace(/\/$/u, '');
  if (decoded.replace(/\/(?:index\.html?)?\/?$/iu, '') === root) fail('destination must not resolve to the transit root.');
  if (!target.pathname.startsWith(baseUrl.pathname)) fail('destination must stay inside the deployment base.');
  return `${target.pathname}${target.search}${target.hash}`;
}

/** Browser-only search/fragment replace configured values when present. */
export function resolveTransitNavigation(destination: string, current: URL, base = '/'): string {
  const target = new URL(resolveTransitDestination(destination, { site: current, base }), current);
  if (current.search) target.search = current.search;
  if (current.hash) target.hash = current.hash;
  return `${target.pathname}${target.search}${target.hash}`;
}

const mounted = new WeakMap<HTMLElement, () => void>();

/**
 * The decorative splash: one random image, started from a macrotask after the page is mounted. Nothing awaits it.
 * A failed first image is retried once with another key; a second failure removes the figure. Every path ends in
 * `release`, which drops the handlers, revokes any object URL and detaches the image.
 */
function mountSplash(win: Window, doc: Document): () => void {
  const figure = doc.querySelector<HTMLElement>('[data-splash]');
  const img = figure?.querySelector<HTMLImageElement>('img');
  if (!figure || !img) return () => {};
  const config: SplashConfig = {
    baseUrl: figure.dataset.splashBase ?? '',
    prefix: figure.dataset.splashPrefix ?? '',
    count: Number(figure.dataset.splashCount),
    cacheName: figure.dataset.splashCache ?? '',
  };
  const storage = win.caches ?? null;
  const fetchImage = (target: string) => win.fetch(target, { mode: 'cors', credentials: 'omit' });
  let active = true;
  let index = 0;
  let retried = false;
  let networkUrl: string | undefined;
  let objectUrl: string | undefined;
  let startTimer: number | undefined;

  const forgetObjectUrl = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  };
  const release = () => {
    if (!active) return;
    active = false;
    win.clearTimeout(startTimer);
    img.removeEventListener('load', onLoad);
    img.removeEventListener('error', onError);
    forgetObjectUrl();
    img.removeAttribute('src');
  };
  const attempt = (step: () => void) => {
    try {
      step();
    } catch {
      figure.remove();
      release();
    }
  };
  const whenIdle = (task: () => void) => {
    if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(task, { timeout: SPLASH_STORE_IDLE_TIMEOUT_MS });
    else win.setTimeout(task, 0);
  };
  const onLoad = () => attempt(() => {
    if (!active) return;
    figure.dataset.state = 'shown';
    const url = networkUrl;
    if (url) whenIdle(() => { if (active) void storeSplashImage(url, { storage, fetchImage, cacheName: config.cacheName }); });
  });
  const onError = () => attempt(() => {
    if (!active) return;
    if (!retried && config.count > 1) {
      retried = true;
      const next = pickSplashIndex(Math.random, config.count - 1);
      index = next >= index ? next + 1 : next;
      forgetObjectUrl();
      networkUrl = splashImageUrl(index, config);
      img.src = networkUrl;
      return;
    }
    figure.remove();
    release();
  });
  const load = async (picked: number) => {
    index = picked;
    const url = splashImageUrl(picked, config);
    const loaded = await loadSplashImage(url, { storage, cacheName: config.cacheName, budgetMs: SPLASH_IMAGE_DEFAULTS.readBudgetMs });
    if (!active) return;
    if (loaded.source === 'cache') {
      objectUrl = URL.createObjectURL(loaded.blob);
      img.src = objectUrl;
    } else {
      networkUrl = url;
      img.src = url;
    }
  };

  img.addEventListener('load', onLoad);
  img.addEventListener('error', onError);
  startTimer = win.setTimeout(() => {
    startTimer = undefined;
    try {
      load(pickSplashIndex(Math.random, config.count)).catch(release);
    } catch {
      release();
    }
  }, 0);
  return release;
}

/**
 * The beam handing off to the loading rail: one attribute on the root, set when the route sweep lands (or when a
 * continuation click starts the navigation early). Style only; the forward clock never reads or waits for it.
 * Without an `animationend` (reduced motion, no animation support) a timer sets it at the same moment.
 */
function mountLoadingPhase(win: Window, doc: Document): { enter: () => void; release: () => void } {
  const root = doc.documentElement;
  const run = doc.querySelector<HTMLElement>('.run');
  let timer: number | undefined;
  const onEnd = (event: Event) => { if (event.target === run) enter(); };
  const release = () => {
    win.clearTimeout(timer);
    if (typeof run?.removeEventListener === 'function') run.removeEventListener('animationend', onEnd);
  };
  function enter() {
    release();
    root.dataset.transitPhase = 'loading';
  }
  if (typeof run?.addEventListener === 'function') run.addEventListener('animationend', onEnd);
  timer = win.setTimeout(enter, ROUTE_RUN_MS);
  return { enter, release };
}

/** Mount once per rendered root; decoration never controls the navigation clock. */
export function mountRootTransit(win: Window = window): () => void {
  const doc = win.document;
  const page = doc.querySelector<HTMLElement>('[data-root-transit]');
  if (!page) return () => {};
  const existing = mounted.get(page);
  if (existing) return existing;
  const anchor = page.querySelector<HTMLAnchorElement>('[data-transit-continue]');
  if (!anchor) return () => {};
  const target = resolveTransitNavigation(anchor.getAttribute('href') ?? '', new URL(win.location.href), page.dataset.base);
  anchor.href = target;
  const links = [anchor, ...page.querySelectorAll<HTMLAnchorElement>('[data-transit-alternative]')];
  for (const link of links.slice(1)) {
    link.href = resolveTransitNavigation(link.getAttribute('href') ?? '', new URL(win.location.href), page.dataset.base);
  }
  let finished = false;
  let timer: number;
  let releaseSplash = () => {};
  let loading = { enter: () => {}, release: () => {} };
  try {
    loading = mountLoadingPhase(win, doc);
  } catch {
    // The rail only decorates; a failure here never changes forwarding.
  }
  const cleanup = () => {
    finished = true;
    win.clearTimeout(timer);
    loading.release();
    releaseSplash();
    win.removeEventListener('pagehide', cleanup);
    doc.removeEventListener('astro:before-swap', cleanup);
    for (const link of links) link.removeEventListener('click', continueNow);
  };
  const forward = (destination = target) => {
    if (finished) return;
    loading.enter();
    cleanup();
    win.location.replace(destination);
  };
  const continueNow = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    forward((event.currentTarget as HTMLAnchorElement).getAttribute('href') ?? target);
  };
  timer = win.setTimeout(() => forward(), ROOT_TRANSIT_DELAY_MS);
  mounted.set(page, cleanup);
  for (const link of links) link.addEventListener('click', continueNow);
  win.addEventListener('pagehide', cleanup);
  doc.addEventListener('astro:before-swap', cleanup);
  try {
    releaseSplash = mountSplash(win, doc);
  } catch {
    releaseSplash = () => {};
  }
  try {
    mountLocaleMonitor(win, doc);
  } catch {
    // The monitor only observes; a failure here never changes forwarding.
  }
  doc.documentElement.dataset.transitReady = 'true';
  return cleanup;
}
