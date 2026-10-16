import { definePromotoBannerElement, recordSiteVisit } from '@hagicode/hagilight-core/promoto-banner';
import { PROMOTO_SHELL_MARKUP } from './promoto-markup.js';

const ELEMENT_NAME = 'hagilight-promoto-banner';
const DEFAULT_LOCALE = 'en-US';

interface PromotoMount {
  banner: HTMLElement;
  footer: Element | null;
  locale: string;
}

const mounts = new WeakMap<Document, PromotoMount>();

/** Infima switches to the single-column mobile layout below this width. */
const DESKTOP_MIN_WIDTH = 997;
const INSET_START = '--hagilight-promoto-inset-start';
const INSET_END = '--hagilight-promoto-inset-end';

let stopWatchingLayout: (() => void) | undefined;

function widest(elements: Element[]): DOMRect | undefined {
  return elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0)
    .sort((a, b) => b.width - a.width)[0];
}

/**
 * Centers the fixed card in the main content column instead of the viewport: it
 * starts after the doc sidebar and ends before the desktop table of contents.
 * Infima's layout cannot be expressed in CSS alone (collapsible sidebar, container
 * max-width, TOC column), so the two insets are measured and handed to promoto.css.
 */
export function syncPromotoInsets(doc: Document, banner: HTMLElement): void {
  const viewport = doc.documentElement.clientWidth;
  let start = 0;
  let end = 0;
  if (viewport >= DESKTOP_MIN_WIDTH) {
    const main = doc.querySelector('main');
    const columns = main ? Array.from(main.querySelectorAll(':scope > * > .row > .col, :scope > .row > .col')) : [];
    const content = widest(columns) ?? main?.getBoundingClientRect();
    if (content && content.width > 0) {
      const sidebar = doc.querySelector('.theme-doc-sidebar-container')?.getBoundingClientRect();
      start = Math.max(content.left, sidebar && sidebar.width > 0 ? sidebar.right : 0);
      end = Math.max(0, viewport - content.right);
    }
  }
  banner.style.setProperty(INSET_START, `${Math.max(0, Math.round(start))}px`);
  banner.style.setProperty(INSET_END, `${Math.max(0, Math.round(end))}px`);
}

function watchPromotoLayout(doc: Document, banner: HTMLElement): void {
  stopWatchingLayout?.();
  stopWatchingLayout = undefined;
  const win = doc.defaultView;
  if (!win || !banner.style || typeof win.ResizeObserver !== 'function') return;

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      syncPromotoInsets(doc, banner);
    });
  };
  const observer = new win.ResizeObserver(schedule);
  const main = doc.querySelector('main');
  if (main) observer.observe(main);
  observer.observe(doc.documentElement);
  syncPromotoInsets(doc, banner);
  stopWatchingLayout = () => {
    observer.disconnect();
    if (frame) win.cancelAnimationFrame(frame);
  };
}

function readSiteId(doc: Document): string | undefined {
  const content = doc.querySelector('meta[name="hagilight-site-id"]')?.getAttribute('content')?.trim();
  return content || undefined;
}

export function mountPromotoBanner(doc: Document, locale: string): void {
  const footer = doc.querySelector('footer');
  const previous = mounts.get(doc);
  if (previous?.banner.isConnected && previous.footer === footer && previous.locale === locale) {
    // The page layout may have been swapped under the same footer (docs to blog), so re-measure it.
    watchPromotoLayout(doc, previous.banner);
    return;
  }

  doc.querySelectorAll(ELEMENT_NAME).forEach((existing) => existing.remove());
  const banner = doc.createElement(ELEMENT_NAME);
  banner.className = 'hagilight-promoto';
  banner.dataset.locale = locale;
  const siteId = readSiteId(doc);
  if (siteId) banner.dataset.siteId = siteId;
  banner.hidden = true;
  banner.innerHTML = PROMOTO_SHELL_MARKUP;
  doc.body.append(banner);
  mounts.set(doc, { banner, footer, locale });
  watchPromotoLayout(doc, banner);
}

export function onRouteDidUpdate(): void {
  definePromotoBannerElement();
  mountPromotoBanner(document, document.documentElement.lang || DEFAULT_LOCALE);
  recordSiteVisit();
}
