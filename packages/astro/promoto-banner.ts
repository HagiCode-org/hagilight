import { loadActivePromotions, type PromotionCard } from './promotions.ts';

const ELEMENT_NAME = 'hagilight-promoto-banner';
const DISMISSED_SIGNATURE_KEY = 'hagilight:promoto-banner:dismissed-signature';
const ROTATION_INTERVAL_MS = 8000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export type PromotionVisibility = 'dismissed' | 'footer-hidden' | 'hidden' | 'ready';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value, 'https://hagilight.invalid/').protocol);
  } catch {
    return false;
  }
}

function isUsableCard(value: unknown): value is PromotionCard {
  if (!isRecord(value)) return false;
  const image = value.image;
  const imageIsValid = image === undefined || (
    isRecord(image) && typeof image.src === 'string' && isSafeUrl(image.src)
    && typeof image.alt === 'string'
    && (image.variant === undefined || typeof image.variant === 'string')
    && (image.width === undefined || (typeof image.width === 'number' && Number.isFinite(image.width) && image.width > 0))
    && (image.height === undefined || (typeof image.height === 'number' && Number.isFinite(image.height) && image.height > 0))
  );
  return typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.title === 'string' && value.title.trim().length > 0
    && typeof value.description === 'string' && value.description.trim().length > 0
    && typeof value.ctaLabel === 'string' && value.ctaLabel.trim().length > 0
    && typeof value.link === 'string' && value.link.trim().length > 0 && isSafeUrl(value.link)
    && imageIsValid;
}

export function selectPromotionCards(
  remote: PromotionCard[],
  fallback?: PromotionCard | null,
): PromotionCard[] {
  const eligibleRemote = remote.filter(isUsableCard);
  if (eligibleRemote.length) return eligibleRemote;
  return fallback && isUsableCard(fallback) ? [fallback] : [];
}

export function getPromotionSetSignature(cards: PromotionCard[]): string | null {
  if (!cards.length) return null;
  return JSON.stringify(cards.map(({ id, title, description, ctaLabel, link, image }) => [
    id, title, description, ctaLabel, link, image?.src ?? '', image?.alt ?? '',
    image?.variant ?? '', image?.width ?? 0, image?.height ?? 0,
  ]));
}

export function getPromotionVisibility(
  cards: PromotionCard[],
  signature: string | null,
  dismissedSignature: string | null,
  footerVisible: boolean,
): PromotionVisibility {
  if (!cards.length) return 'hidden';
  if (signature && signature === dismissedSignature) return 'dismissed';
  return footerVisible ? 'footer-hidden' : 'ready';
}

export function getNextPromotionIndex(index: number, count: number, direction: -1 | 1): number {
  return count > 0 ? (index + direction + count) % count : 0;
}

export function shouldAutoRotate(
  count: number,
  paused: boolean,
  reducedMotion: boolean,
  documentVisible: boolean,
  visibility: PromotionVisibility,
): boolean {
  return count > 1 && !paused && !reducedMotion && documentVisible && visibility === 'ready';
}

function readDismissedSignature(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_SIGNATURE_KEY);
  } catch {
    return null;
  }
}

function saveDismissedSignature(signature: string): void {
  try {
    window.localStorage.setItem(DISMISSED_SIGNATURE_KEY, signature);
  } catch (error) {
    console.warn('Unable to save the dismissed promotion preference.', error);
  }
}

export function definePromotoBannerElement(): void {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined'
    || customElements.get(ELEMENT_NAME)) return;

  class PromotoBannerElement extends HTMLElement {
    private cards: PromotionCard[] = [];
    private currentIndex = 0;
    private dismissedSignature = readDismissedSignature();
    private paused = false;
    private reducedMotion = false;
    private rotationTimer: number | undefined;
    private refreshTimer: number | undefined;
    private motionQuery: MediaQueryList | undefined;
    private resizeObserver: ResizeObserver | undefined;
    private footer: HTMLElement | null = null;

    private readonly onPrevious = () => this.move(-1);
    private readonly onNext = () => this.move(1);
    private readonly onPause = () => {
      if (this.reducedMotion) return;
      this.paused = !this.paused;
      this.updateControls();
      this.syncRotation();
    };
    private readonly onDismiss = () => {
      const signature = getPromotionSetSignature(this.cards);
      if (!signature) return;
      this.dismissedSignature = signature;
      saveDismissedSignature(signature);
      this.updateVisibility();
      this.stopRotation();
    };
    private readonly onLayoutChange = () => {
      const previousState = this.dataset.state;
      this.updateVisibility();
      if (previousState !== this.dataset.state) this.syncRotation();
    };
    private readonly onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.stopRotation();
        this.stopRefresh();
      } else {
        this.syncRotation();
        this.startRefresh();
      }
    };
    private readonly onMotionChange = () => {
      this.reducedMotion = this.motionQuery?.matches ?? false;
      this.updateControls();
      this.syncRotation();
    };

    connectedCallback(): void {
      this.footer = document.querySelector('footer');
      this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this.motionQuery?.matches ?? false;
      this.querySelector('[data-promoto-previous]')?.addEventListener('click', this.onPrevious);
      this.querySelector('[data-promoto-next]')?.addEventListener('click', this.onNext);
      this.querySelector('[data-promoto-pause]')?.addEventListener('click', this.onPause);
      this.querySelector('[data-promoto-dismiss]')?.addEventListener('click', this.onDismiss);
      window.addEventListener('scroll', this.onLayoutChange, { passive: true });
      window.addEventListener('resize', this.onLayoutChange);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.motionQuery?.addEventListener('change', this.onMotionChange);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(this.onLayoutChange);
        if (this.footer) this.resizeObserver.observe(this.footer);
        const shell = this.querySelector('[data-promoto-shell]');
        if (shell) this.resizeObserver.observe(shell);
      }
      void this.reload();
      this.startRefresh();
    }

    disconnectedCallback(): void {
      this.querySelector('[data-promoto-previous]')?.removeEventListener('click', this.onPrevious);
      this.querySelector('[data-promoto-next]')?.removeEventListener('click', this.onNext);
      this.querySelector('[data-promoto-pause]')?.removeEventListener('click', this.onPause);
      this.querySelector('[data-promoto-dismiss]')?.removeEventListener('click', this.onDismiss);
      window.removeEventListener('scroll', this.onLayoutChange);
      window.removeEventListener('resize', this.onLayoutChange);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.motionQuery?.removeEventListener('change', this.onMotionChange);
      this.resizeObserver?.disconnect();
      this.stopRotation();
      this.stopRefresh();
    }

    private async reload(): Promise<void> {
      const previousId = this.cards[this.currentIndex]?.id;
      const remote = await loadActivePromotions({ locale: this.dataset.locale });
      if (!this.isConnected) return;
      const fallback = this.readFallback();
      this.cards = selectPromotionCards(remote, fallback);
      const previousIndex = previousId ? this.cards.findIndex((card) => card.id === previousId) : -1;
      this.currentIndex = previousIndex >= 0 ? previousIndex : 0;
      this.renderCards();
      this.updateVisibility();
      this.updateControls();
      this.syncRotation();
    }

    private readFallback(): PromotionCard | null {
      const serialized = this.dataset.fallback;
      if (!serialized) return null;
      try {
        const value: unknown = JSON.parse(serialized);
        return isUsableCard(value) ? value : null;
      } catch (error) {
        console.warn('Unable to parse the site-provided promotion fallback.', error);
        return null;
      }
    }

    private renderCards(): void {
      const track = this.querySelector<HTMLElement>('[data-promoto-track]');
      if (!track) return;
      const fragment = document.createDocumentFragment();
      this.cards.forEach((card, index) => {
        const slide = document.createElement('article');
        slide.className = 'hagilight-promoto__slide';
        slide.dataset.hasImage = String(Boolean(card.image));
        slide.setAttribute('aria-hidden', index === this.currentIndex ? 'false' : 'true');
        if (index !== this.currentIndex) slide.setAttribute('inert', '');

        const copy = document.createElement('div');
        copy.className = 'hagilight-promoto__copy';
        const title = document.createElement('h2');
        title.className = 'hagilight-promoto__title';
        title.textContent = card.title;
        const description = document.createElement('p');
        description.className = 'hagilight-promoto__description';
        description.textContent = card.description;
        copy.append(title, description);

        const link = document.createElement('a');
        link.className = 'hagilight-promoto__cta';
        link.href = card.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = card.ctaLabel;
        slide.append(copy);

        if (card.image) {
          const media = document.createElement('span');
          media.className = 'hagilight-promoto__media';
          const image = document.createElement('img');
          image.className = 'hagilight-promoto__image';
          image.src = card.image.src;
          image.alt = card.image.alt || card.title;
          image.loading = index === this.currentIndex ? 'eager' : 'lazy';
          image.decoding = 'async';
          if (card.image.width) image.width = card.image.width;
          if (card.image.height) image.height = card.image.height;
          media.append(image);
          slide.append(media);
        }
        slide.append(link);
        fragment.append(slide);
      });
      track.replaceChildren(fragment);
      this.updateSlides();
    }

    private updateSlides(): void {
      const track = this.querySelector<HTMLElement>('[data-promoto-track]');
      if (!track) return;
      Array.from(track.children).forEach((slide, index) => {
        const active = index === this.currentIndex;
        slide.setAttribute('aria-hidden', String(!active));
        if (active) slide.removeAttribute('inert');
        else slide.setAttribute('inert', '');
      });
      track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
      const current = this.cards[this.currentIndex];
      const status = this.querySelector<HTMLElement>('[data-promoto-status]');
      if (status) status.textContent = current?.title ?? '';
      const count = this.querySelector<HTMLElement>('[data-promoto-count]');
      if (count) count.textContent = `${this.currentIndex + 1} / ${this.cards.length}`;
    }

    private updateControls(): void {
      const multiple = this.cards.length > 1;
      const controls = this.querySelector<HTMLElement>('[data-promoto-controls]');
      if (controls) controls.hidden = !multiple;
      const pause = this.querySelector<HTMLButtonElement>('[data-promoto-pause]');
      if (pause) {
        const paused = this.paused || this.reducedMotion;
        pause.disabled = this.reducedMotion;
        pause.setAttribute('aria-pressed', String(paused));
        pause.setAttribute('aria-label', paused ? 'Resume automatic promotion rotation' : 'Pause automatic promotion rotation');
        pause.textContent = paused ? 'Resume' : 'Pause';
      }
      this.updateSlides();
    }

    private move(direction: -1 | 1): void {
      if (this.cards.length < 2) return;
      this.currentIndex = getNextPromotionIndex(this.currentIndex, this.cards.length, direction);
      this.updateSlides();
      this.syncRotation();
    }

    private updateVisibility(): void {
      const signature = getPromotionSetSignature(this.cards);
      const state = getPromotionVisibility(
        this.cards,
        signature,
        this.dismissedSignature,
        this.isFooterVisible(),
      );
      const hidden = state === 'hidden' || state === 'dismissed';
      const shell = this.querySelector<HTMLElement>('[data-promoto-shell]');
      this.hidden = hidden;
      if (shell) {
        shell.hidden = hidden;
        shell.inert = hidden || state === 'footer-hidden';
      }
      this.dataset.state = state;
    }

    private isFooterVisible(): boolean {
      if (!this.footer) return false;
      const bounds = this.footer.getBoundingClientRect();
      return bounds.top < window.innerHeight && bounds.bottom > 0;
    }

    private syncRotation(): void {
      this.stopRotation();
      const state = this.dataset.state;
      if (state !== 'ready' && state !== 'footer-hidden' && state !== 'hidden' && state !== 'dismissed') return;
      if (!shouldAutoRotate(
        this.cards.length,
        this.paused,
        this.reducedMotion,
        document.visibilityState !== 'hidden',
        state,
      )) return;
      this.rotationTimer = window.setInterval(() => this.move(1), ROTATION_INTERVAL_MS);
    }

    private stopRotation(): void {
      if (this.rotationTimer !== undefined) window.clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }

    private startRefresh(): void {
      this.stopRefresh();
      if (document.visibilityState !== 'hidden') {
        this.refreshTimer = window.setInterval(() => void this.reload(), REFRESH_INTERVAL_MS);
      }
    }

    private stopRefresh(): void {
      if (this.refreshTimer !== undefined) window.clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  customElements.define(ELEMENT_NAME, PromotoBannerElement);
}
