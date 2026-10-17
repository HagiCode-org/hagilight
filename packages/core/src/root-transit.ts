/** The reference route sweep (1,250 ms) and finished-state hold (320 ms). */
export const ROOT_TRANSIT_DELAY_MS = 1570;

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
  const cleanup = () => {
    finished = true;
    win.clearTimeout(timer);
    win.removeEventListener('pagehide', cleanup);
    doc.removeEventListener('astro:before-swap', cleanup);
    for (const link of links) link.removeEventListener('click', continueNow);
  };
  const forward = (destination = target) => {
    if (finished) return;
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
  doc.documentElement.dataset.transitReady = 'true';
  return cleanup;
}
