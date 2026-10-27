import { capturePostHogEvent, type PostHogClient, type PostHogEventName, type PostHogInput } from './posthog-events.js';

/*
 * PostHog reporting for the promotion banner. DOM-free so the tracker can be driven by fake timers.
 * Events go through the shared vocabulary (`POSTHOG_EVENTS`) and its property sanitizer.
 */

export type PromotoEventName = Extract<PostHogEventName, 'promoto_impression' | 'promoto_dismissed' | 'promoto_paged'>;
export type PromotoPagingMethod = 'auto' | 'click';

/** A promotion is an impression only after it stays visible this long. */
export const PROMOTO_IMPRESSION_DELAY_MS = 1000;

export interface PromotoTimers {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface PromotoPresentation {
  /** The CTA's `data-ga-label`. */
  promoId: string;
  /** The 1-based place in the carousel. */
  position: number;
}

export interface PromotoAnalyticsOptions {
  timers?: PromotoTimers;
  /** Read when the impression fires, so `rotating` reflects the state at that moment. */
  rotating?: () => boolean;
  /** Where impressions go. Defaults to the guarded `window.posthog` capture. */
  report?: (event: 'promoto_impression', input: PostHogInput<'promoto_impression'>) => void;
}

export interface PromotoAnalytics {
  /** Call with the promotion on screen, or `undefined` when none is visible. Keeps a running timer running. */
  show(presentation: PromotoPresentation | undefined): void;
  /** Forgets the per-page memory. Call when the page key changes. */
  resetPage(): void;
  /** Cancels any pending impression and returns the dismissal properties for `promoId`. */
  dismissed(promoId: string): { visible_ms: number; seen_count: number };
}

function windowPostHog(): PostHogClient | undefined {
  return (globalThis as { window?: { posthog?: PostHogClient } }).window?.posthog;
}

/**
 * Sends a promotion event only when `window.posthog` has loaded and the visitor has not opted out.
 * Nothing is queued and nothing throws: while the SDK is still a stub the event is dropped.
 */
export function capturePromoto<E extends PromotoEventName>(
  event: E,
  input: PostHogInput<E>,
  posthog: PostHogClient | undefined = windowPostHog(),
): void {
  try {
    if (!posthog || posthog.__loaded !== true) return;
    if (typeof posthog.has_opted_out_capturing === 'function' && posthog.has_opted_out_capturing()) return;
    capturePostHogEvent(event, input, posthog);
  } catch {
    // Analytics must never interfere with the banner.
  }
}

const defaultTimers: PromotoTimers = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

/**
 * Impression state for one banner: a promotion reports once per page, after it has been visible for
 * `PROMOTO_IMPRESSION_DELAY_MS` without interruption. Hiding it, rotating away or dismissing it cancels
 * the pending report, and showing it again starts the wait from zero.
 */
export function createPromotoAnalytics(options: PromotoAnalyticsOptions = {}): PromotoAnalytics {
  const timers = options.timers ?? defaultTimers;
  const rotating = options.rotating ?? (() => false);
  const report = options.report ?? ((event, input) => capturePromoto(event, input));
  const reported = new Set<string>();
  const firstVisibleAt = new Map<string, number>();
  let current: PromotoPresentation | undefined;
  let pending: unknown;
  let pendingFor: string | undefined;

  const cancel = (): void => {
    if (pendingFor === undefined) return;
    timers.clearTimeout(pending);
    pending = undefined;
    pendingFor = undefined;
  };

  return {
    show(presentation) {
      if (!presentation) {
        current = undefined;
        cancel();
        return;
      }
      const { promoId } = presentation;
      if (!firstVisibleAt.has(promoId)) firstVisibleAt.set(promoId, timers.now());
      current = presentation;
      if (reported.has(promoId)) {
        cancel();
        return;
      }
      if (pendingFor === promoId) return;
      cancel();
      pendingFor = promoId;
      pending = timers.setTimeout(() => {
        pending = undefined;
        pendingFor = undefined;
        if (!current || current.promoId !== promoId || reported.has(promoId)) return;
        reported.add(promoId);
        report('promoto_impression', { promo_id: promoId, position: current.position, rotating: rotating() });
      }, PROMOTO_IMPRESSION_DELAY_MS);
    },
    resetPage() {
      cancel();
      current = undefined;
      reported.clear();
      firstVisibleAt.clear();
    },
    dismissed(promoId) {
      cancel();
      const since = firstVisibleAt.get(promoId);
      return {
        visible_ms: since === undefined ? 0 : Math.max(0, Math.round(timers.now() - since)),
        seen_count: firstVisibleAt.size,
      };
    },
  };
}
