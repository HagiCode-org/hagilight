import { readTaggedClick } from './analytics-events.js';

/*
 * The PostHog event vocabulary: the only place Hagilight event names, per-event property allowlists,
 * super-property keys, page types and framework names are spelled. Browser-safe: no Node or Astro imports.
 * Adding an event needs only a new `POSTHOG_EVENTS` entry and a snapshot update in the same change.
 */

export const POSTHOG_EVENTS = Object.freeze({
  cta_click: ['category', 'label', 'location', 'destination_host', 'is_external'],
  // Promotion banner events. `promo_id` equals the CTA's `data-ga-label`; positions are 1-based.
  promoto_impression: ['promo_id', 'position', 'rotating'],
  promoto_dismissed: ['promo_id', 'visible_ms', 'seen_count'],
  promoto_paged: ['from', 'to', 'method'],
  // Interaction events. Search text, code contents and full URLs never appear in any property.
  not_found_viewed: ['path', 'referrer_domain'],
  search_used: ['query_length', 'results_count', 'locale', 'query'],
  search_result_clicked: ['rank', 'results_count'],
  code_copied: ['language', 'page_type', 'is_install_page'],
  article_promotion_impression: ['variant', 'path'],
  locale_changed: ['from', 'to'],
  locale_redirected: ['from', 'to', 'reason'],
  theme_changed: ['theme'],
  content_width_changed: ['choice'],
} as const);
export type PostHogEventName = keyof typeof POSTHOG_EVENTS;
export type PostHogEventProperty<E extends PostHogEventName> = (typeof POSTHOG_EVENTS)[E][number];

/**
 * Properties an event cannot be sent without. When one is missing or invalid after sanitizing, the whole
 * event is dropped. Events absent from this map need no required property.
 */
export const POSTHOG_REQUIRED_PROPERTIES: Readonly<Partial<Record<PostHogEventName, readonly string[]>>> = Object.freeze({
  not_found_viewed: ['path'],
  search_used: ['query_length', 'results_count', 'locale'],
  search_result_clicked: ['rank', 'results_count'],
  code_copied: ['language', 'page_type', 'is_install_page'],
  article_promotion_impression: ['variant', 'path'],
  locale_changed: ['from', 'to'],
  locale_redirected: ['from', 'to', 'reason'],
  theme_changed: ['theme'],
  content_width_changed: ['choice'],
});

/** Closed value lists for enumerated properties. */
export const POSTHOG_REDIRECT_REASONS = ['query', 'stored', 'browser', 'default'] as const;
export const POSTHOG_CONTENT_WIDTHS = ['narrow', 'wide'] as const;

export const POSTHOG_SUPER_PROPERTIES = ['site_id', 'site_framework', 'hagilight_version', 'locale', 'page_type'] as const;
export type PostHogSuperProperty = (typeof POSTHOG_SUPER_PROPERTIES)[number];

export const POSTHOG_PAGE_TYPES = ['home', 'docs', 'blog', 'compare', '404', 'other'] as const;
export type PostHogPageType = (typeof POSTHOG_PAGE_TYPES)[number];

export const POSTHOG_FRAMEWORKS = ['astro', 'starlight', 'docusaurus'] as const;
export type PostHogFramework = (typeof POSTHOG_FRAMEWORKS)[number];

export type PostHogPropertyValue = string | number | boolean;
/** Caller input for an event. Values are untrusted until `sanitizePostHogProperties` checks them. */
export type PostHogInput<E extends PostHogEventName> = Partial<Record<PostHogEventProperty<E>, unknown>>;
/** The sanitized properties of an event: only allowlisted keys, with values that the SDK can send. */
export type PostHogProperties<E extends PostHogEventName> = Partial<Record<PostHogEventProperty<E>, PostHogPropertyValue>>;

/** The part of the PostHog SDK that Hagilight reads and writes. */
export interface PostHogClient {
  capture?: (event: string, properties: Record<string, PostHogPropertyValue>, options?: { transport: 'sendBeacon' }) => unknown;
  register?: (properties: Record<string, string>) => unknown;
  has_opted_out_capturing?: () => boolean;
  __loaded?: boolean;
}

/** The destination of a link: its lowercase host, and whether it differs from the current page's host. */
export interface PostHogDestination {
  /** Omitted for non-HTTP(S) or unparseable destinations. */
  host?: string;
  isExternal: boolean;
}

export interface PagePathOptions {
  /** The site's base path, for example `/docs/`. Defaults to `/`. */
  base?: string;
  /** Locale path segments to skip before classifying. */
  locales?: readonly string[];
}

export type PagePathType = Exclude<PostHogPageType, '404' | 'other'>;

const HTTP_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/u;
const ABSOLUTE_URL_PATTERN = /^https?:\/\//iu;

/**
 * Resolves a destination against the current page. Returns only a host and a flag, so a path, query
 * or hash cannot reach an event by construction. Never throws.
 */
export function destinationOf(url: unknown, baseHref?: string): PostHogDestination {
  try {
    if (typeof url !== 'string' || !url.trim()) return { isExternal: false };
    const target = new URL(url, baseHref || undefined);
    if (!HTTP_PROTOCOLS.has(target.protocol)) return { isExternal: false };
    const host = target.hostname.toLowerCase();
    let currentHost: string | undefined;
    try {
      currentHost = new URL(baseHref ?? '').hostname.toLowerCase();
    } catch {
      // Without a readable page URL, every resolvable host counts as external.
    }
    return { host, isExternal: host !== currentHost };
  } catch {
    return { isExternal: false };
  }
}

const MAX_QUERY_CODE_POINTS = 64;
const LANGUAGE_PATTERN = /^[a-z0-9+#._-]{1,32}$/u;
const VARIANT_PATTERN = /^[a-z0-9._-]{1,64}$/u;
const LOCALE_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/u;
const THEME_PATTERN = /^[a-z0-9-]{1,40}$/u;
const COUNT_PROPERTIES: ReadonlySet<string> = new Set(['query_length', 'results_count']);

/** Returns the path with its query and fragment removed, or `undefined` unless it starts with `/`. */
export function sanitizePath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let path = value.trim();
  if (ABSOLUTE_URL_PATTERN.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return undefined;
    }
  }
  path = path.split(/[?#]/u, 1)[0] ?? '';
  return path.startsWith('/') ? path : undefined;
}

/** The lowercase host name of a referrer, or `undefined` when it is empty, relative, or unparseable. */
export function referrerDomain(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const host = destinationOf(value).host;
  return host !== undefined && HOST_PATTERN.test(host) ? host : undefined;
}

function sanitizeValue(property: string, value: unknown): PostHogPropertyValue | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    if (COUNT_PROPERTIES.has(property)) return Number.isInteger(value) && value >= 0 ? value : undefined;
    if (property === 'rank') return Number.isInteger(value) && value >= 1 ? value : undefined;
    return value;
  }
  if (typeof value !== 'string') return undefined;
  // Numeric and boolean properties never accept text, whatever it contains.
  if (COUNT_PROPERTIES.has(property) || property === 'rank' || property === 'is_install_page') return undefined;
  if (property === 'path') return sanitizePath(value);
  if (property === 'referrer_domain') return referrerDomain(value) ?? (HOST_PATTERN.test(value.toLowerCase()) ? value.toLowerCase() : undefined);
  // A URL-valued input keeps only its host: never a path, query, hash or embedded credentials.
  if (ABSOLUTE_URL_PATTERN.test(value)) return destinationOf(value, undefined).host;
  if (property === 'destination_host') {
    const host = value.toLowerCase();
    return HOST_PATTERN.test(host) ? host : undefined;
  }
  switch (property) {
    case 'query': {
      const text = value.trim();
      if (!text || /[/\\]/u.test(text)) return undefined;
      return [...text].slice(0, MAX_QUERY_CODE_POINTS).join('');
    }
    case 'language':
      return LANGUAGE_PATTERN.test(value) || value === 'unknown' ? value : undefined;
    case 'page_type':
      return (POSTHOG_PAGE_TYPES as readonly string[]).includes(value) ? value : undefined;
    case 'variant':
      return VARIANT_PATTERN.test(value) || value === 'default' ? value : undefined;
    case 'locale':
    case 'from':
    case 'to':
      return LOCALE_PATTERN.test(value) ? value : undefined;
    case 'reason':
      return (POSTHOG_REDIRECT_REASONS as readonly string[]).includes(value) ? value : undefined;
    case 'theme':
      return THEME_PATTERN.test(value) ? value : undefined;
    case 'choice':
      return (POSTHOG_CONTENT_WIDTHS as readonly string[]).includes(value) ? value : undefined;
    default:
      return value;
  }
}

/**
 * Keeps only the event's allowlisted properties whose values are strings, finite numbers or booleans.
 * Returns an empty object for an unknown event. Never throws.
 */
export function sanitizePostHogProperties<E extends PostHogEventName>(event: E, input: unknown): PostHogProperties<E> {
  const sanitized: Record<string, PostHogPropertyValue> = {};
  try {
    if (!Object.hasOwn(POSTHOG_EVENTS, event) || typeof input !== 'object' || input === null) return sanitized as PostHogProperties<E>;
    for (const property of POSTHOG_EVENTS[event] as readonly string[]) {
      const value = sanitizeValue(property, (input as Record<string, unknown>)[property]);
      if (value !== undefined) sanitized[property] = value;
    }
  } catch {
    // Analytics must never throw into the page.
  }
  return sanitized as PostHogProperties<E>;
}

/** Returns the page type when it is in the vocabulary, and `other` for anything else. */
export function resolvePageType(value: unknown): PostHogPageType {
  return (POSTHOG_PAGE_TYPES as readonly unknown[]).includes(value) ? (value as PostHogPageType) : 'other';
}

/**
 * Classifies a pathname for integrations without a per-page source. Never returns `404`: a page that
 * is not recognized is a `docs` page, because most Hagilight sites serve their documentation at the root.
 */
export function classifyPagePath(pathname: string, { base = '/', locales = [] }: PagePathOptions = {}): PagePathType {
  const baseSegments = base.split('/').filter(Boolean);
  let segments = (typeof pathname === 'string' ? pathname : '').split('/').filter(Boolean);
  if (baseSegments.every((segment, index) => segments[index] === segment)) {
    segments = segments.slice(baseSegments.length);
  }
  if (segments.length > 0 && locales.includes(segments[0])) segments = segments.slice(1);
  if (segments.length === 0) return 'home';
  if (segments[0] === 'blog') return 'blog';
  if (segments[0] === 'compare') return 'compare';
  return 'docs';
}

function windowPostHog(): PostHogClient | undefined {
  return (globalThis as { window?: { posthog?: PostHogClient } }).window?.posthog;
}

/**
 * The only Hagilight code path that calls `posthog.capture`. It sends nothing and throws nothing when
 * `window.posthog` is absent, when the SDK is loaded and opted out, or when no property survives sanitizing.
 * While the SDK is still a stub, the opt-out check is skipped and the capture queues; the SDK applies
 * opt-out when it replays the queue.
 */
export function capturePostHogEvent<E extends PostHogEventName>(
  event: E,
  input: PostHogInput<E>,
  posthog: PostHogClient | undefined = windowPostHog(),
): void {
  try {
    if (!Object.hasOwn(POSTHOG_EVENTS, event)) return;
    const properties = sanitizePostHogProperties(event, input) as Record<string, PostHogPropertyValue>;
    if (Object.keys(properties).length === 0) return;
    const required: readonly string[] = POSTHOG_REQUIRED_PROPERTIES[event] ?? [];
    if (required.some((name) => properties[name] === undefined)) return;
    if (!posthog || typeof posthog.capture !== 'function') return;
    if (posthog.__loaded === true && typeof posthog.has_opted_out_capturing === 'function' && posthog.has_opted_out_capturing()) return;
    posthog.capture(event, properties, { transport: 'sendBeacon' });
  } catch {
    // Analytics must never interfere with the page.
  }
}

/** Builds the `cta_click` input for a tagged click. Never throws. */
export function handlePostHogClick(
  event: { composedPath(): readonly unknown[] },
  capture: (name: 'cta_click', input: PostHogInput<'cta_click'>) => void,
  baseHref: string = (globalThis as { location?: { href?: string } }).location?.href ?? '',
): void {
  try {
    const tagged = readTaggedClick(event);
    if (!tagged) return;
    const destination = destinationOf(tagged.url, baseHref);
    capture('cta_click', {
      category: tagged.category,
      label: tagged.label,
      location: tagged.location,
      destination_host: destination.host,
      is_external: destination.isExternal,
    });
  } catch {
    // Analytics must never interfere with the click.
  }
}

const CLICK_TRACKING = Symbol.for('hagilight.posthog-click-tracking');

/**
 * Installs one passive capture-phase click listener per document, independent of Google Analytics.
 * It never cancels, stops or mutates the click. Returns `false` when the document is already instrumented.
 */
export function installPostHogClickTracking(
  target: Pick<EventTarget, 'addEventListener'> = document,
  getPosthog: () => PostHogClient | undefined = windowPostHog,
): boolean {
  const marked = target as { [CLICK_TRACKING]?: true };
  if (marked[CLICK_TRACKING]) return false;
  marked[CLICK_TRACKING] = true;
  target.addEventListener('click', (event) => {
    handlePostHogClick(event, (name, input) => capturePostHogEvent(name, input, getPosthog()));
  }, { capture: true, passive: true });
  return true;
}
