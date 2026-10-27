import { CONSENT_DESCRIPTOR_ID, renderConsentMarkup, type ConsentPopupOptions } from '@hagicode/hagilight-core/consent-markup';
import { mountConsentGate, onPostHogStarted } from '@hagicode/hagilight-core/consent-gate';
import { mountConsentPopup } from '@hagicode/hagilight-core/consent-popup';
import { installPostHogClickTracking } from '@hagicode/hagilight-core/posthog-events';

/** Reads the head's config descriptor. A missing or malformed descriptor means consent is not mounted. */
export function readConsentConfig(doc: Document): ConsentPopupOptions | undefined {
  try {
    const text = doc.getElementById(CONSENT_DESCRIPTOR_ID)?.textContent;
    if (!text) return undefined;
    const parsed = JSON.parse(text) as { providers?: unknown; privacyUrl?: unknown; policyVersion?: unknown };
    if (!Array.isArray(parsed.providers)) return undefined;
    return {
      providers: parsed.providers as ConsentPopupOptions['providers'],
      privacyUrl: typeof parsed.privacyUrl === 'string' ? parsed.privacyUrl : undefined,
      policyVersion: typeof parsed.policyVersion === 'string' ? parsed.policyVersion : undefined,
      locale: doc.documentElement.lang,
    };
  } catch {
    return undefined;
  }
}

/**
 * Mounts the popup and the gate. The PostHog click sink installs from the grant, never at load. Nothing here throws
 * into the page: a site whose config cannot be read simply has no popup, and its providers stay off.
 */
export function mountDocusaurusConsent(doc: Document = document, win: Window = window): void {
  try {
    const config = readConsentConfig(doc);
    if (!config) return;
    if (!doc.querySelector('[data-hagilight-consent]')) {
      doc.body.insertAdjacentHTML('beforeend', renderConsentMarkup(config));
    }
    onPostHogStarted(() => installPostHogClickTracking(doc));
    mountConsentGate(win, doc);
    mountConsentPopup(doc);
  } catch {
    // Consent setup must never break the page; with no popup, no provider loads.
  }
}

if (typeof document !== 'undefined') mountDocusaurusConsent();
