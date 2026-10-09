import type { SiteLink, SiteLinkKey } from './links.js';

export const GA_CATEGORIES = ['download', 'navigation', 'community', 'promotion'] as const;
export type GaCategory = (typeof GA_CATEGORIES)[number];
export type GaAction = 'download_click' | 'link_click';

// GA4 has no native category/action/label: the action is the event name.
export const GA_CATEGORY_ACTIONS: Readonly<Record<GaCategory, GaAction>> = Object.freeze({
  download: 'download_click',
  navigation: 'link_click',
  community: 'link_click',
  promotion: 'link_click',
});

export const GA_LOCATIONS = ['header', 'footer', 'article_promotion', 'promoto_banner'] as const;
export type GaLocation = (typeof GA_LOCATIONS)[number];

/** Shared links that report click events, keyed by `SiteLink.id`. Renaming a key changes its GA label. */
export const TRACKED_SITE_LINKS: Readonly<Partial<Record<SiteLinkKey, GaCategory>>> = Object.freeze({
  home: 'navigation',
  blog: 'navigation',
  support: 'navigation',
  downloadClient: 'download',
  microsoftStore: 'download',
  dockerCompose: 'navigation',
  productDocs: 'navigation',
  blogPosts: 'navigation',
  github: 'community',
  discord: 'community',
  issueFeedback: 'community',
});

export interface GaEventTag {
  category: GaCategory;
  /** Stable identifier, never localized text. */
  label: string;
  /** Where the link sits, for example one of `GA_LOCATIONS`. */
  location: string;
  /** Destination to report when the tagged element has no `href` of its own. */
  url?: string;
}

export interface GaEventAttributes {
  'data-ga-category': GaCategory;
  'data-ga-label': string;
  'data-ga-location': string;
  'data-ga-url'?: string;
}

export interface GaEventParams {
  event_category: GaCategory;
  event_label: string;
  link_location: string;
  link_url?: string;
  transport_type: 'beacon';
}

export type GaSend = (action: GaAction, params: GaEventParams) => void;

function isCategory(value: unknown): value is GaCategory {
  return typeof value === 'string' && (GA_CATEGORIES as readonly string[]).includes(value);
}

function requireText(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Analytics event ${name} must be a non-empty string.`);
  }
  return value;
}

/** Builds the `data-ga-*` attributes that make a link report a click event. */
export function gaEventAttributes(tag: GaEventTag): GaEventAttributes {
  if (!isCategory(tag.category)) {
    throw new TypeError(`Analytics event category must be one of: ${GA_CATEGORIES.join(', ')}.`);
  }
  return {
    'data-ga-category': tag.category,
    'data-ga-label': requireText('label', tag.label),
    'data-ga-location': requireText('location', tag.location),
    ...(tag.url === undefined ? {} : { 'data-ga-url': requireText('url', tag.url) }),
  };
}

/** Returns tag attributes for catalog links in `TRACKED_SITE_LINKS` and `{}` for every other link. */
export function siteLinkGaAttributes(
  link: Pick<SiteLink, 'id'>,
  location: string,
): Partial<GaEventAttributes> {
  if (!Object.hasOwn(TRACKED_SITE_LINKS, link.id)) return {};
  return gaEventAttributes({
    category: TRACKED_SITE_LINKS[link.id as SiteLinkKey] as GaCategory,
    label: link.id,
    location,
  });
}

interface TaggedElement {
  getAttribute(name: string): string | null;
  href?: unknown;
}

function isTaggedElement(value: unknown): value is TaggedElement {
  return typeof value === 'object' && value !== null
    && typeof (value as TaggedElement).getAttribute === 'function'
    && ((value as TaggedElement).getAttribute('data-ga-category') !== null
      || (value as TaggedElement).getAttribute('data-ga-label') !== null);
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Reports the first tagged element in the click's composed path. Never throws and never
 * touches the event, so navigation is unaffected.
 */
export function handleGaClick(event: { composedPath(): readonly unknown[] }, send: GaSend): void {
  try {
    const element = event.composedPath().find(isTaggedElement);
    if (!element) return;
    const category = element.getAttribute('data-ga-category');
    const label = nonEmpty(element.getAttribute('data-ga-label'));
    const location = nonEmpty(element.getAttribute('data-ga-location'));
    if (!isCategory(category) || !label || !location) return;
    const linkUrl = nonEmpty(element.getAttribute('data-ga-url'))
      ?? nonEmpty(element.href)
      ?? nonEmpty(element.getAttribute('href'));
    send(GA_CATEGORY_ACTIONS[category], {
      event_category: category,
      event_label: label,
      link_location: location,
      ...(linkUrl === undefined ? {} : { link_url: linkUrl }),
      transport_type: 'beacon',
    });
  } catch {
    // Analytics must never interfere with the click.
  }
}

const INSTALLED = Symbol.for('hagilight.ga-event-tracking');

/**
 * Installs one capture-phase click listener per document. Events are sent only while
 * `gtag` exists, so development builds, disabled sites, and the 404 page stay silent.
 * Returns `false` when the document was already instrumented.
 */
export function installGaEventTracking(
  target: Pick<EventTarget, 'addEventListener'> = document,
  getGtag: () => unknown = () => (globalThis as { gtag?: unknown }).gtag,
): boolean {
  const marked = target as { [INSTALLED]?: true };
  if (marked[INSTALLED]) return false;
  marked[INSTALLED] = true;
  target.addEventListener('click', (event) => {
    handleGaClick(event, (action, params) => {
      const gtag = getGtag();
      if (typeof gtag === 'function') gtag('event', action, params);
    });
  }, true);
  return true;
}
