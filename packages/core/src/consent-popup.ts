/**
 * Browser wiring for the consent popup. `mountConsentPopup` reveals the markup from `consent-markup.ts` only for an
 * undecided visitor, connects Accept and Reject to `setConsent`, toggles the details, reflects the current choice when
 * `openConsentPreferences()` is called, and publishes the popup's height as `--hagilight-consent-clearance` on the root.
 * It never moves or traps focus.
 */
import { CONSENT_PREFERENCES_EVENT, getConsent, isConsentRequired, openConsentPreferences, setConsent } from './consent.js';

export const CONSENT_CLEARANCE_PROPERTY = '--hagilight-consent-clearance';
/** Space between the popup and the banner or footer it lifts. */
const CLEARANCE_GAP_PX = 12;

const noop = () => {};

function publishClearance(panel: HTMLElement): void {
  try {
    const root = document.documentElement;
    if (panel.hidden) {
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

  const hide = (): void => {
    panel.hidden = true;
    publishClearance(panel);
  };
  const show = (): void => {
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
    details.hidden = !expanded;
    publishClearance(panel);
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
    accept?.removeEventListener('click', onAccept);
    reject?.removeEventListener('click', onReject);
    toggle?.removeEventListener('click', onToggle);
    document.removeEventListener(CONSENT_PREFERENCES_EVENT, onPreferences);
    document.removeEventListener('click', onFooterEntry);
    observer?.disconnect();
  };
}
