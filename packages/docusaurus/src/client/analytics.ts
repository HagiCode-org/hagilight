import { installGaEventTracking } from '@hagicode/hagilight-core/analytics-events';

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
  return installGaEventTracking(target);
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

export function onRouteDidUpdate(update: RouteDidUpdate): void {
  handleRouteDidUpdate(update, browserDeps);
}

if (typeof document !== 'undefined') installClickTracking(document);
