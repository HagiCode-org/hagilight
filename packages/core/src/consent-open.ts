/**
 * Whether the consent panel is on screen. The popup sets `data-hagilight-consent-open` on the root while its panel is shown
 * (including while it fades out) and dispatches `hagilight:consent-open-change` when that flips. The promotion banner reads
 * this to yield: one floating card at a time, and the consent decision outranks a promotion. A tiny module of its own so
 * the banner does not import the popup.
 */
export const CONSENT_OPEN_ATTRIBUTE = 'data-hagilight-consent-open';
export const CONSENT_OPEN_EVENT = 'hagilight:consent-open-change';

export function isConsentPanelOpen(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute(CONSENT_OPEN_ATTRIBUTE);
}

/** Sets the root attribute and announces a change. Calling it again with the same value does nothing. */
export function setConsentPanelOpen(open: boolean): void {
  if (typeof document === 'undefined' || isConsentPanelOpen() === open) return;
  document.documentElement.toggleAttribute(CONSENT_OPEN_ATTRIBUTE, open);
  document.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
