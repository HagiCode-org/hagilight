import {
  POSTHOG_PAGE_TYPES,
  capturePostHogEvent,
  classifyPagePath,
  type PostHogClient,
  type PostHogInput,
  type PostHogPageType,
} from './posthog-events.js';

/*
 * Observers for DOM-owned interactions: Pagefind search (Starlight), result clicks, code copy buttons
 * (Expressive Code and Docusaurus) and Docusaurus locale links. Delegated on the document, so lazily
 * created dialogs and client navigation need no rebinding. Observers only read the DOM. They never call
 * preventDefault or stopPropagation, never read copied code or clipboard data, and never throw.
 */

export const SEARCH_DEBOUNCE_MS = 800;
export const SEARCH_SETTLE_TIMEOUT_MS = 2000;
export const SEARCH_POLL_MS = 100;
const SEARCH_QUERY_MAX_CODE_POINTS = 64;

const SEARCH_INPUT = '.pagefind-ui__search-input';
const SEARCH_ROOT = '.pagefind-ui';
const SEARCH_MESSAGE = '.pagefind-ui__message';
const SEARCH_RESULT_LINK = 'a.pagefind-ui__result-link';
// Pagefind renders the results list only once a search has settled; while loading it shows "Searching…" instead.
const SEARCH_RESULTS = '.pagefind-ui__results';
const SEARCH_LOADING = '.pagefind-ui__loading';
const STARLIGHT_COPY_BUTTON = '.expressive-code .copy button';
const DOCUSAURUS_COPY_BUTTON = '.theme-code-block button[class*="copyButton"]';
const CODE_BLOCK = '.expressive-code, .theme-code-block';
// Docusaurus renders each locale dropdown item with `lang` (the locale code); `hreflang` is accepted too.
const DOCUSAURUS_LOCALE_LINK = '.navbar a[hreflang], .navbar a[lang]';
const PAGE_TYPE_META = 'meta[name="hagilight:page-type"]';
const LANGUAGE_PATTERN = /^[a-z0-9+#._-]{1,32}$/u;

/** Minimal element surface the observers read. Browser elements satisfy it. */
export interface InteractionElement {
  closest(selector: string): InteractionElement | null;
  querySelector(selector: string): InteractionElement | null;
  querySelectorAll(selector: string): ArrayLike<InteractionElement>;
  getAttribute(name: string): string | null;
  readonly textContent?: string | null;
  readonly value?: string;
}

/** Minimal document surface: the delegated listeners, the page language and the page-type meta element. */
export interface InteractionDocument {
  readonly documentElement: { readonly lang?: string };
  addEventListener(type: string, listener: (event: InteractionEvent) => void, options?: boolean | { capture?: boolean }): void;
  querySelector(selector: string): InteractionElement | null;
}

export interface InteractionEvent {
  readonly target: unknown;
}

/** Timers are injected so tests can drive the debounce and the settle wait deterministically. */
export interface InteractionTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface InteractionEnvironment {
  timers: InteractionTimers;
  posthog(): PostHogClient | undefined;
  /** The page's `window.__hagilightPosthogConfig`, written by the init script only for a non-default option. */
  config(): { searchQuery?: unknown } | undefined;
  pathname(): string;
}

const INSTALLED_KEY = Symbol.for('hagilight.posthog-interactions');

function defaultEnvironment(): InteractionEnvironment {
  const globalWindow = (globalThis as { window?: { posthog?: PostHogClient; __hagilightPosthogConfig?: { searchQuery?: unknown }; location?: { pathname?: string } } }).window;
  return {
    timers: globalThis as unknown as InteractionTimers,
    posthog: () => globalWindow?.posthog,
    config: () => globalWindow?.__hagilightPosthogConfig,
    pathname: () => globalWindow?.location?.pathname ?? '',
  };
}

const HEX_RUN = /[0-9a-f]{16,}/iu;
const KEY_LIKE_TOKEN = /[A-Za-z0-9+\/_=-]{24,}/u;
const TOKEN_PREFIXES = ['phc_', 'sk-', 'ghp_', 'gho_', 'xox', 'AKIA', 'eyJ'] as const;

/**
 * Returns the search text when it is safe to send, or `undefined`. The whole text is checked before it is
 * truncated, so a secret that starts after the 64th character still withholds the text.
 */
export function sanitizeSearchQuery(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  if (HEX_RUN.test(text) || /[/\\]/u.test(text) || text.startsWith('~') || text.includes('://')) return undefined;
  if (/bearer\s/iu.test(text)) return undefined;
  for (const token of text.split(/\s+/u)) {
    if (KEY_LIKE_TOKEN.test(token) || token.includes('@') || TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))) return undefined;
  }
  return [...text].slice(0, SEARCH_QUERY_MAX_CODE_POINTS).join('');
}

/**
 * The result count of a settled Pagefind list. The first number of the message is the total, after the query
 * text is removed so digits typed by the visitor are not counted, and locale grouping (`1,234`) is folded.
 * With no number, an empty list is zero results; anything else is unknown and sends nothing.
 */
export function readResultsCount(root: InteractionElement, query: string): number | undefined {
  const raw = root.querySelector(SEARCH_MESSAGE)?.textContent ?? '';
  const message = query ? raw.split(query).join(' ') : raw;
  const match = /\d+(?:[.,\s\u00a0\u202f]\d{3})*/u.exec(message);
  if (match) return Number(match[0].replace(/\D/gu, ''));
  return root.querySelectorAll(SEARCH_RESULT_LINK).length === 0 ? 0 : undefined;
}

function languageClass(element: InteractionElement | null): string | undefined {
  const classes = element?.getAttribute('class') ?? '';
  return /(?:^|\s)language-(\S+)/u.exec(classes)?.[1];
}

/** A declared language from `data-language` or a `language-*` class, lowercased; `unknown` otherwise. */
export function normalizeCodeLanguage(value: string | null | undefined): string {
  const text = value?.trim().toLowerCase() ?? '';
  return LANGUAGE_PATTERN.test(text) ? text : 'unknown';
}

function pageTypeOf(doc: InteractionDocument, pathname: string, lang: string): PostHogPageType {
  const declared = doc.querySelector(PAGE_TYPE_META)?.getAttribute('content');
  if (declared && (POSTHOG_PAGE_TYPES as readonly string[]).includes(declared)) return declared as PostHogPageType;
  return classifyPagePath(pathname, { locales: lang ? [lang] : [] });
}

function currentLocale(doc: InteractionDocument): string {
  return doc.documentElement.lang ?? '';
}

function reportSearch(doc: InteractionDocument, env: InteractionEnvironment, field: InteractionElement, root: InteractionElement): void {
  const query = (field.value ?? '').trim();
  if (!query) return;
  const count = readResultsCount(root, query);
  if (count === undefined) return;
  const properties: Record<string, unknown> = {
    query_length: [...query].length,
    results_count: count,
    locale: currentLocale(doc),
  };
  if (count === 0 && env.config()?.searchQuery === 'zero-results') {
    const safe = sanitizeSearchQuery(query);
    if (safe !== undefined) properties.query = safe;
  }
  capturePostHogEvent('search_used', properties as PostHogInput<'search_used'>, env.posthog());
}

/** Waits until Pagefind has rendered a settled list with no loading placeholder, then reports once. Sends nothing on timeout. */
function awaitSettledSearch(
  doc: InteractionDocument,
  env: InteractionEnvironment,
  field: InteractionElement,
  root: InteractionElement,
  waitedMs: number,
  track: (handle: unknown) => void,
): void {
  if (root.querySelector(SEARCH_RESULTS) && !root.querySelector(SEARCH_LOADING)) {
    reportSearch(doc, env, field, root);
    return;
  }
  if (waitedMs >= SEARCH_SETTLE_TIMEOUT_MS) return;
  track(env.timers.setTimeout(() => awaitSettledSearch(doc, env, field, root, waitedMs + SEARCH_POLL_MS, track), SEARCH_POLL_MS));
}

function handleInput(doc: InteractionDocument, env: InteractionEnvironment, state: { pending: unknown[] }, event: InteractionEvent): void {
  const field = elementOf(event.target)?.closest(SEARCH_INPUT);
  if (!field) return;
  for (const handle of state.pending.splice(0)) env.timers.clearTimeout(handle);
  const root = field.closest(SEARCH_ROOT);
  if (!root) return;
  const track = (handle: unknown) => state.pending.push(handle);
  state.pending.push(env.timers.setTimeout(() => {
    state.pending.splice(0);
    awaitSettledSearch(doc, env, field, root, 0, track);
  }, SEARCH_DEBOUNCE_MS));
}

function handleResultClick(env: InteractionEnvironment, link: InteractionElement): void {
  const root = link.closest(SEARCH_ROOT);
  if (!root) return;
  const links = Array.from(root.querySelectorAll(SEARCH_RESULT_LINK));
  const rank = links.indexOf(link) + 1;
  if (rank < 1) return;
  const query = root.querySelector(SEARCH_INPUT)?.value?.trim() ?? '';
  const count = readResultsCount(root, query);
  if (count === undefined) return;
  capturePostHogEvent('search_result_clicked', { rank, results_count: count }, env.posthog());
}

function handleCopy(doc: InteractionDocument, env: InteractionEnvironment, button: InteractionElement): void {
  const block = button.closest(CODE_BLOCK);
  const pre = block?.querySelector('pre') ?? null;
  const declared = pre?.getAttribute('data-language') ?? languageClass(pre) ?? languageClass(block);
  const pathname = env.pathname();
  capturePostHogEvent('code_copied', {
    language: normalizeCodeLanguage(declared),
    page_type: pageTypeOf(doc, pathname, currentLocale(doc)),
    is_install_page: pathname.includes('/installation/'),
  }, env.posthog());
}

function handleLocaleLink(doc: InteractionDocument, env: InteractionEnvironment, link: InteractionElement): void {
  const to = link.getAttribute('hreflang') ?? link.getAttribute('lang');
  const from = currentLocale(doc);
  if (!to || to === from) return;
  capturePostHogEvent('locale_changed', { from, to }, env.posthog());
}

function elementOf(target: unknown): InteractionElement | undefined {
  return typeof target === 'object' && target !== null && typeof (target as InteractionElement).closest === 'function'
    ? target as InteractionElement
    : undefined;
}

function handleClick(doc: InteractionDocument, env: InteractionEnvironment, event: InteractionEvent): void {
  const target = elementOf(event.target);
  if (!target) return;
  const link = target.closest(SEARCH_RESULT_LINK);
  if (link) return handleResultClick(env, link);
  const button = target.closest(STARLIGHT_COPY_BUTTON) ?? target.closest(DOCUSAURUS_COPY_BUTTON);
  if (button) return handleCopy(doc, env, button);
  const localeLink = target.closest(DOCUSAURUS_LOCALE_LINK);
  if (localeLink) handleLocaleLink(doc, env, localeLink);
}

/**
 * Installs the delegated interaction observers once per document. Returns `false` when already installed.
 * Every handler is wrapped so an observer failure never reaches the page.
 */
export function installPostHogInteractions(
  doc: InteractionDocument = document as unknown as InteractionDocument,
  overrides: Partial<InteractionEnvironment> = {},
): boolean {
  const marked = doc as unknown as Record<symbol, true | undefined>;
  if (marked[INSTALLED_KEY]) return false;
  marked[INSTALLED_KEY] = true;
  const env: InteractionEnvironment = { ...defaultEnvironment(), ...overrides };
  const state = { pending: [] as unknown[] };
  doc.addEventListener('input', (event) => {
    try {
      handleInput(doc, env, state, event);
    } catch {
      // Analytics must never interfere with search.
    }
  }, { capture: true });
  doc.addEventListener('click', (event) => {
    try {
      handleClick(doc, env, event);
    } catch {
      // Analytics must never interfere with clicks.
    }
  }, { capture: true });
  return true;
}

/*
 * End-of-article promotion impressions. The card counts as seen once at least half of it is visible for one
 * continuous second. The event fires at most once per page view; click reporting stays with `cta_click`.
 */
export const PROMOTION_IMPRESSION_THRESHOLD = 0.5;
export const PROMOTION_IMPRESSION_DWELL_MS = 1000;
const PROMOTION_CARD = '.hagilight-article-promotion';
const CENTRE_FAN_CARD = '.hagilight-fan__card[data-slot="1"]';
const VARIANT_PATTERN = /^[a-z0-9._-]{1,64}$/u;

/** The pool key of the centre fan card, from its image file name, or `default` when no fan was dealt. */
export function promotionVariantOf(card: InteractionElement): string {
  const source = card.querySelector(CENTRE_FAN_CARD)?.getAttribute('src') ?? '';
  const key = (source.split(/[?#]/u, 1)[0] ?? '').split('/').pop()?.replace(/\.avif$/u, '') ?? '';
  return VARIANT_PATTERN.test(key) ? key : 'default';
}

interface ImpressionObserver {
  observe(target: unknown): void;
  disconnect(): void;
}

export interface PromotionImpressionEnvironment {
  timers: InteractionTimers;
  posthog(): PostHogClient | undefined;
  pathname(): string;
  IntersectionObserver?: new (
    callback: (entries: readonly { isIntersecting: boolean; intersectionRatio: number }[]) => void,
    options: { threshold: number },
  ) => ImpressionObserver;
}

/**
 * Observes one promotion card and sends `article_promotion_impression` after sustained visibility. Returns
 * `false` without an IntersectionObserver, so no event is sent there. Never throws.
 */
export function observePromotionImpression(card: InteractionElement, overrides: Partial<PromotionImpressionEnvironment> = {}): boolean {
  const defaults = defaultEnvironment();
  const env: PromotionImpressionEnvironment = {
    timers: defaults.timers,
    posthog: defaults.posthog,
    pathname: defaults.pathname,
    IntersectionObserver: (globalThis as { IntersectionObserver?: PromotionImpressionEnvironment['IntersectionObserver'] }).IntersectionObserver,
    ...overrides,
  };
  if (typeof env.IntersectionObserver !== 'function') return false;
  let timer: unknown;
  let sent = false;
  let observer: ImpressionObserver | undefined;
  observer = new env.IntersectionObserver((entries) => {
    try {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= PROMOTION_IMPRESSION_THRESHOLD) {
          if (timer === undefined && !sent) {
            timer = env.timers.setTimeout(() => {
              timer = undefined;
              sent = true;
              observer?.disconnect();
              capturePostHogEvent('article_promotion_impression', {
                variant: promotionVariantOf(card),
                path: env.pathname(),
              }, env.posthog());
            }, PROMOTION_IMPRESSION_DWELL_MS);
          }
        } else if (timer !== undefined) {
          env.timers.clearTimeout(timer);
          timer = undefined;
        }
      }
    } catch {
      // Analytics must never interfere with the page.
    }
  }, { threshold: PROMOTION_IMPRESSION_THRESHOLD });
  observer.observe(card);
  return true;
}

/** Observes the page's promotion card, if the page has one. */
export function installPromotionImpression(doc: InteractionDocument = document as unknown as InteractionDocument): boolean {
  const card = doc.querySelector(PROMOTION_CARD);
  return card ? observePromotionImpression(card) : false;
}
