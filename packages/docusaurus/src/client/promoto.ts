import { definePromotoBannerElement } from '@hagicode/hagilight-core/promoto-banner';
import { PROMOTO_SHELL_MARKUP } from './promoto-markup.js';

const ELEMENT_NAME = 'hagilight-promoto-banner';
const DEFAULT_LOCALE = 'en-US';

interface PromotoMount {
  banner: HTMLElement;
  footer: Element | null;
  locale: string;
}

const mounts = new WeakMap<Document, PromotoMount>();

export function mountPromotoBanner(doc: Document, locale: string): void {
  const footer = doc.querySelector('footer');
  const previous = mounts.get(doc);
  if (previous?.banner.isConnected && previous.footer === footer && previous.locale === locale) return;

  doc.querySelectorAll(ELEMENT_NAME).forEach((existing) => existing.remove());
  const banner = doc.createElement(ELEMENT_NAME);
  banner.className = 'hagilight-promoto';
  banner.dataset.locale = locale;
  banner.hidden = true;
  banner.innerHTML = PROMOTO_SHELL_MARKUP;
  doc.body.append(banner);
  mounts.set(doc, { banner, footer, locale });
}

export function onRouteDidUpdate(): void {
  definePromotoBannerElement();
  mountPromotoBanner(document, document.documentElement.lang || DEFAULT_LOCALE);
}
