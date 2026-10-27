/**
 * Browser wiring for the consent popup. `mountConsentPopup` reveals the markup from `consent-markup.ts` only for an
 * undecided visitor, connects Accept and Reject to `setConsent`, toggles the details, reflects the current choice when
 * `openConsentPreferences()` is called, and publishes the popup's height as `--hagilight-consent-clearance` on the root.
 * The details slide open and the panel fades out through the Web Animations API, and both snap under reduced motion.
 * It never moves or traps focus.
 */
import { CONSENT_PREFERENCES_EVENT, getConsent, isConsentRequired, openConsentPreferences, setConsent } from './consent.js';

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
    const height = Math.ceil(panel.getBoundingClientRect().height);
    root.style.setProperty(CONSENT_CLEARANCE_PROPERTY, `${height + CLEARANCE_GAP_PX}px`);
  } catch {
    // No layout (for example during static rendering): leave the property unchanged.
  }
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
 * With no panel, or where the visitor already decided or consent is not required, the panel stays hidden.
 */
export function mountConsentPopup(root: ParentNode = document): () => void {
  const panel = root.querySelector<HTMLElement>('[data-hagilight-consent]');
  if (!panel) return noop;
  // A page can mount the same panel from both its component and an integration; the second mount does nothing.
  if (panel.dataset.consentMounted === 'true') return noop;
  panel.dataset.consentMounted = 'true';
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
  const show = (): void => {
    if (leaving) {
      leaving.cancel();
      leaving = undefined;
    }
    delete panel.dataset.leaving;
    reflectChoice(panel);
    panel.hidden = false;
    publishClearance(panel);
  };
  const choose = (analytics: boolean): void => {
    setConsent({ analytics });
    hide();
  };

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
  const onPreferences = (): void => show();
  /** The footer's "Cookie settings" entries call `openConsentPreferences()`; the popup's own listener then shows the panel. */
  const onFooterEntry = (event: Event): void => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-consent-preferences]')) openConsentPreferences();
  };

  accept?.addEventListener('click', onAccept);
  reject?.addEventListener('click', onReject);
  toggle?.addEventListener('click', onToggle);
  document.addEventListener(CONSENT_PREFERENCES_EVENT, onPreferences);
  document.addEventListener('click', onFooterEntry);

  let observer: ResizeObserver | undefined;
  try {
    observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => publishClearance(panel)) : undefined;
    observer?.observe(panel);
  } catch {
    observer = undefined;
  }

  if (getConsent().analytics === 'undecided' && isConsentRequired()) show();
  else hide();

  return () => {
    leaving?.cancel();
    sliding?.cancel();
    accept?.removeEventListener('click', onAccept);
    reject?.removeEventListener('click', onReject);
    toggle?.removeEventListener('click', onToggle);
    document.removeEventListener(CONSENT_PREFERENCES_EVENT, onPreferences);
    document.removeEventListener('click', onFooterEntry);
    observer?.disconnect();
  };
}
