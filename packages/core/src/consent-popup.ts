/**
 * Browser wiring for the consent popup. `mountConsentPopup` reveals the markup from `consent-markup.ts` only for an
 * undecided visitor whose region decision is `required` or `unknown`. It stays hidden while the decision is pending and
 * for `notRequired`. It connects Accept and Reject to `setConsent`, toggles the details, reflects the current choice when
 * `openConsentPreferences()` is called, and publishes the popup's height as `--hagilight-consent-clearance` on the root.
 * A replay opt-in request (`openConsentPreferences('replay')`) shows the replay section instead. The details slide open
 * and the panel fades out through the Web Animations API, and both snap under reduced motion. It never moves or traps focus.
 */
import {
  currentRegionConfig, CONSENT_PREFERENCES_EVENT, getConsent, onConsentChange, openConsentPreferences, regionalBehavior, setConsent,
} from './consent.js';
import { pageRegionSource, startRegionResolution, type RegionSource } from './consent-region.js';

export const CONSENT_CLEARANCE_PROPERTY = '--hagilight-consent-clearance';
/** Space between the popup and the banner or footer it lifts. */
const CLEARANCE_GAP_PX = 12;

const noop = () => {};

/** Durations in ms. The details open slower than they close, and the panel leaves faster than it arrives. */
const DETAILS_OPEN_MS = 340;
const DETAILS_CLOSE_MS = 220;
const PANEL_LEAVE_MS = 200;
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.64, 0, 0.78, 0)';

/** Motion is skipped under reduced motion, and wherever the Web Animations API is missing. */
function canAnimate(element: HTMLElement): boolean {
  try {
    if (typeof element.animate !== 'function') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function publishClearance(panel: HTMLElement): void {
  try {
    const root = document.documentElement;
    // A panel that is leaving no longer holds space: the banner and footer settle back while it fades.
    if (panel.hidden || panel.dataset.leaving === 'true') {
      root.style.setProperty(CONSENT_CLEARANCE_PROPERTY, '0px');
      return;
    }
    // offsetHeight ignores transforms, so the entrance scale does not shrink the clearance the banner lifts by.
    const height = panel.offsetHeight;
    root.style.setProperty(CONSENT_CLEARANCE_PROPERTY, `${height + CLEARANCE_GAP_PX}px`);
  } catch {
    // No layout (for example during static rendering): leave the property unchanged.
  }
}

/**
 * Reveals the footer's regional entries (`data-consent-entry`), which the footer renders hidden. The settings entry shows
 * for `required` and `unknown` decisions, or always when the site asks for it. The replay entry shows only for a
 * `notRequired` visitor with the opt-in option and no record. Pages without these markers are not touched.
 */
function revealConsentEntries(region: RegionSource): () => void {
  const apply = (): void => {
    const decision = region.current();
    const behavior = regionalBehavior();
    const undecided = getConsent().analytics === 'undecided';
    const settingsVisible = behavior.settingsEntry === 'always' || decision === 'required' || decision === 'unknown';
    const replayVisible = decision === 'notRequired' && behavior.sessionReplay === 'optIn' && undecided;
    for (const entry of Array.from(document.querySelectorAll<HTMLElement>('[data-consent-entry]'))) {
      const visible = entry.dataset.consentEntry === 'settings' ? settingsVisible
        : entry.dataset.consentEntry === 'replay' ? replayVisible
          : false;
      entry.hidden = !visible;
    }
  };
  apply();
  const unsubscribeRegion = region.subscribe(apply);
  const unsubscribeConsent = onConsentChange(apply);
  // A client-side router can replace the footer between pages, so new entries are revealed as they appear.
  let observer: MutationObserver | undefined;
  try {
    observer = typeof MutationObserver === 'function' ? new MutationObserver(apply) : undefined;
    observer?.observe(document.body, { childList: true, subtree: true });
  } catch {
    observer = undefined;
  }
  return () => {
    unsubscribeRegion();
    unsubscribeConsent();
    observer?.disconnect();
  };
}

/** Shows the current choice in the panel, using the copy carried on the choice line. */
function reflectChoice(panel: HTMLElement): void {
  const decision = getConsent().analytics;
  panel.dataset.state = decision;
  const choice = panel.querySelector<HTMLElement>('[data-consent-choice]');
  const value = panel.querySelector<HTMLElement>('[data-consent-choice-value]');
  if (!choice || !value) return;
  const text = decision === 'granted'
    ? choice.dataset.choiceGranted
    : decision === 'denied'
      ? choice.dataset.choiceDenied
      : choice.dataset.choiceUndecided;
  value.textContent = text ?? decision;
}

/**
 * Mounts the popup inside `root` (the `[data-hagilight-consent]` section). Returns a function that removes the listeners.
 * With no panel, or where the visitor already decided, the panel stays hidden. An undecided visitor sees it once the
 * region decision is `required` or `unknown`, and never for `notRequired` or while the decision is pending.
 */
export function mountConsentPopup(root: ParentNode = document, region: RegionSource = pageRegionSource()): () => void {
  const panel = root.querySelector<HTMLElement>('[data-hagilight-consent]');
  if (!panel) return noop;
  // A page can mount the same panel from both its component and an integration; the second mount does nothing.
  if (panel.dataset.consentMounted === 'true') return noop;
  panel.dataset.consentMounted = 'true';
  // The decision is resolved once per document. A page that never started it gets it started here.
  startRegionResolution(currentRegionConfig());
  const stopRevealingEntries = revealConsentEntries(region);
  const main = panel.querySelector<HTMLElement>('[data-consent-main]');
  const replay = panel.querySelector<HTMLElement>('[data-hagilight-consent-replay]');
  const replayAllow = panel.querySelector<HTMLButtonElement>('[data-consent-replay-allow]');
  const replayDecline = panel.querySelector<HTMLButtonElement>('[data-consent-replay-decline]');
  // Move the popup to the end of the body. Site layouts can isolate their content (Starlight's main pane does), which
  // would trap a z-index of 45 inside that pane, under fixed side panels. In the root stacking context it stays on top.
  const host = panel.closest<HTMLElement>('.hagilight-consent-host') ?? panel;
  if (host.parentElement !== document.body) document.body.appendChild(host);
  const accept = panel.querySelector<HTMLButtonElement>('[data-consent-accept]');
  const reject = panel.querySelector<HTMLButtonElement>('[data-consent-reject]');
  const toggle = panel.querySelector<HTMLButtonElement>('[data-consent-toggle]');
  const details = panel.querySelector<HTMLElement>('[data-consent-details]');

  let leaving: Animation | undefined;
  let sliding: Animation | undefined;

  const hide = (): void => {
    // The clearance drops at once, so the banner and footer start moving back while the panel is still leaving.
    const wasVisible = !panel.hidden;
    leaving?.cancel();
    leaving = undefined;
    if (!wasVisible || !canAnimate(panel)) {
      panel.hidden = true;
      publishClearance(panel);
      return;
    }
    panel.dataset.leaving = 'true';
    const leave = panel.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(0.75rem) scale(0.98)' }],
      { duration: PANEL_LEAVE_MS, easing: EASE_IN, fill: 'forwards' },
    );
    leaving = leave;
    publishClearance(panel);
    const finish = (): void => {
      if (leaving !== leave) return;
      leaving = undefined;
      delete panel.dataset.leaving;
      panel.hidden = true;
      leave.cancel();
      publishClearance(panel);
    };
    leave.addEventListener('finish', finish);
    leave.addEventListener('cancel', () => {
      if (leaving === leave) leaving = undefined;
    });
  };
  /** Shows the main choice, or the replay opt-in section when `mode` is `replay` and the site offers that section. */
  const show = (mode: 'main' | 'replay' = 'main'): void => {
    if (leaving) {
      leaving.cancel();
      leaving = undefined;
    }
    delete panel.dataset.leaving;
    const replayMode = mode === 'replay' && replay !== null;
    if (main) main.hidden = replayMode;
    if (replay) replay.hidden = !replayMode;
    if (replayMode) panel.dataset.mode = 'replay';
    else delete panel.dataset.mode;
    reflectChoice(panel);
    panel.hidden = false;
    publishClearance(panel);
  };
  const choose = (analytics: boolean): void => {
    setConsent({ analytics });
    hide();
  };
  /** Allow stores an explicit grant, which also turns replay on. Not now stores nothing and only closes the panel. */
  const onReplayAllow = (): void => choose(true);
  const onReplayDecline = (): void => hide();

  const onAccept = (): void => choose(true);
  const onReject = (): void => choose(false);
  const onToggle = (): void => {
    if (!toggle || !details) return;
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    slideDetails(details, expanded);
  };
  /** Opens or closes the details with a height slide; the final state is always the plain `hidden` attribute. */
  const slideDetails = (section: HTMLElement, open: boolean): void => {
    const current = sliding;
    // Start from wherever an interrupted slide stopped, so a quick second click reverses instead of jumping.
    const startHeight = current ? section.getBoundingClientRect().height : open ? 0 : section.getBoundingClientRect().height;
    current?.cancel();
    sliding = undefined;
    if (!canAnimate(section)) {
      section.hidden = !open;
      publishClearance(panel);
      return;
    }
    section.hidden = false;
    const endHeight = open ? section.scrollHeight : 0;
    section.style.overflow = 'hidden';
    const slide = section.animate(
      [
        { height: `${startHeight}px`, opacity: open ? 0 : 1 },
        { height: `${endHeight}px`, opacity: open ? 1 : 0 },
      ],
      { duration: open ? DETAILS_OPEN_MS : DETAILS_CLOSE_MS, easing: open ? EASE_OUT : EASE_IN },
    );
    sliding = slide;
    slide.addEventListener('finish', () => {
      if (sliding !== slide) return;
      sliding = undefined;
      section.style.overflow = '';
      section.hidden = !open;
      publishClearance(panel);
    });
    slide.addEventListener('cancel', () => {
      if (sliding === slide) sliding = undefined;
      section.style.overflow = '';
    });
  };
  const onPreferences = (event: Event): void => {
    const detail = (event as CustomEvent<{ mode?: string } | null>).detail;
    show(detail?.mode === 'replay' ? 'replay' : 'main');
  };
  /**
   * The footer's entries call `openConsentPreferences()`. An entry marked `data-consent-mode="replay"` asks for the
   * replay opt-in section; the popup's own listener then shows it.
   */
  const onFooterEntry = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const entry = target.closest<HTMLElement>('[data-consent-preferences]');
    if (!entry) return;
    openConsentPreferences(entry.dataset.consentMode === 'replay' ? 'replay' : undefined);
  };

  accept?.addEventListener('click', onAccept);
  reject?.addEventListener('click', onReject);
  toggle?.addEventListener('click', onToggle);
  replayAllow?.addEventListener('click', onReplayAllow);
  replayDecline?.addEventListener('click', onReplayDecline);
  document.addEventListener(CONSENT_PREFERENCES_EVENT, onPreferences);
  document.addEventListener('click', onFooterEntry);

  let observer: ResizeObserver | undefined;
  try {
    observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => publishClearance(panel)) : undefined;
    observer?.observe(panel);
  } catch {
    observer = undefined;
  }

  /**
   * An undecided visitor sees the popup once the region decision is `required` or `unknown`. A decided visitor never
   * does. The decision arrives through `region`, and a deadline timeout resolves to `required`, so the popup is shown
   * exactly once for those cases.
   */
  const applyDecision = (): void => {
    if (getConsent().analytics !== 'undecided') {
      hide();
      return;
    }
    const decision = region.current();
    if (decision === 'required' || decision === 'unknown') show();
    else hide();
  };
  const unsubscribeRegion = region.subscribe(applyDecision);

  return () => {
    leaving?.cancel();
    sliding?.cancel();
    unsubscribeRegion();
    stopRevealingEntries();
    accept?.removeEventListener('click', onAccept);
    reject?.removeEventListener('click', onReject);
    toggle?.removeEventListener('click', onToggle);
    replayAllow?.removeEventListener('click', onReplayAllow);
    replayDecline?.removeEventListener('click', onReplayDecline);
    document.removeEventListener(CONSENT_PREFERENCES_EVENT, onPreferences);
    document.removeEventListener('click', onFooterEntry);
    observer?.disconnect();
  };
}
