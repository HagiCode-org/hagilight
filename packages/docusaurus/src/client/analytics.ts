import { installGaEventTracking } from '@hagicode/hagilight-core/analytics-events';
import {
  classifyPagePath,
  installPostHogClickTracking,
  type PostHogClient,
} from '@hagicode/hagilight-core/posthog-events';

export interface RouteLocation {
  pathname: string;
  search: string;
  hash: string;
}

export interface RouteDidUpdate {
  location: RouteLocation;
  previousLocation: RouteLocation | null;
}

export interface PageSnapshot {
  title: string;
  location: string;
  path: string;
}

export interface RouteReportDeps {
  getGtag: () => unknown;
  readPage: () => PageSnapshot;
  schedule: (task: () => void) => void;
}

export function installClickTracking(target?: Pick<EventTarget, 'addEventListener'>): boolean {
  const installed = installGaEventTracking(target);
  // The PostHog sink is installed only when the head script initialized PostHog, so a site that disables
  // PostHog gets no PostHog listener even though this module is bundled for Google Analytics.
  if ((globalThis as { __hagilightPosthogInitialized?: boolean }).__hagilightPosthogInitialized === true) {
    installPostHogClickTracking(target);
  }
  return installed;
}

export interface PostHogPageContext {
  /** The document language, sent as `locale` when non-empty. */
  lang: string;
  /** The site base path, for example `/docs/`. */
  base: string;
}

/**
 * Refreshes only `locale` and `page_type` as super properties. Route updates are the only time this
 * module calls PostHog, and it never initializes the SDK or captures an event.
 */
export function refreshPostHogPageProperties(
  update: RouteDidUpdate,
  posthog: PostHogClient | undefined,
  page: PostHogPageContext,
): boolean {
  if (typeof posthog?.register !== 'function') return false;
  const pageType = classifyPagePath(update.location.pathname, { base: page.base, locales: page.lang ? [page.lang] : [] });
  const properties: Record<string, string> = page.lang ? { locale: page.lang, page_type: pageType } : { page_type: pageType };
  posthog.register(properties);
  return true;
}

export function reportPageView(gtag: unknown, page: PageSnapshot): boolean {
  if (typeof gtag !== 'function') return false;
  gtag('event', 'page_view', { page_title: page.title, page_location: page.location, page_path: page.path });
  return true;
}

export function handleRouteDidUpdate(update: RouteDidUpdate, deps: RouteReportDeps): void {
  if (!update.previousLocation) return;
  deps.schedule(() => {
    reportPageView(deps.getGtag(), deps.readPage());
  });
}

const browserDeps: RouteReportDeps = {
  getGtag: () => (globalThis as { gtag?: unknown }).gtag,
  readPage: () => ({
    title: document.title,
    location: window.location.href,
    path: `${window.location.pathname}${window.location.search}`,
  }),
  schedule: (task) => {
    window.setTimeout(task, 0);
  },
};

function browserPageContext(): PostHogPageContext {
  return {
    lang: document.documentElement.lang,
    base: document.querySelector('meta[name="hagilight-base-path"]')?.getAttribute('content') || '/',
  };
}

export function onRouteDidUpdate(update: RouteDidUpdate): void {
  handleRouteDidUpdate(update, browserDeps);
  try {
    refreshPostHogPageProperties(update, (globalThis as { posthog?: PostHogClient }).posthog, browserPageContext());
  } catch {
    // Analytics must never break route handling.
  }
}

if (typeof document !== 'undefined') installClickTracking(document);
