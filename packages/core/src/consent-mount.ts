/**
 * Page-level consent wiring shared by the Docusaurus client and the plain-Astro integration. It reads the popup's
 * config descriptor, places the popup markup, installs PostHog's click sink only after a grant, and mounts the gate.
 */
import { consentDescriptor, CONSENT_DESCRIPTOR_ID, renderConsentMarkup, type ConsentPopupOptions } from './consent-markup.js';
import { mountConsentGate, onPostHogStarted } from './consent-gate.js';
import { mountConsentPopup } from './consent-popup.js';
import { installPostHogClickTracking } from './posthog-events.js';
import { installPostHogInteractions } from './posthog-interactions.js';

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
 * Mounts the popup and the gate for a page whose head carries the consent descriptors. The PostHog click sink
 * installs from the grant, never at load. Nothing here throws into the page: with no readable config there is no
 * popup, and every provider stays off.
 */
export function mountConsent(doc: Document = document, win: Window = window): void {
  try {
    const config = readConsentConfig(doc);
    if (!config) return;
    if (!doc.querySelector('[data-hagilight-consent]')) {
      doc.body.insertAdjacentHTML('beforeend', renderConsentMarkup(config));
    }
    onPostHogStarted(() => {
      installPostHogClickTracking(doc);
      // The interaction observers wait for the grant too; they read the page only after PostHog may start.
      installPostHogInteractions(doc as unknown as Parameters<typeof installPostHogInteractions>[0]);
    });
    mountConsentGate(win, doc);
    mountConsentPopup(doc);
  } catch {
    // Consent setup must never break the page; with no popup, no provider loads.
  }
}

export interface ConsentHeadInput {
  /** The PostHog loader, carried as inert JSON data. Omit when PostHog is not enabled. */
  posthog?: { apiKey: string; loader: string };
  config: ConsentPopupOptions;
}

/**
 * An inline head script that inserts the inert descriptors as markup. It runs no provider code: the descriptors are
 * `application/json` elements, and the gate reads them after a grant. Used by integrations that inject PostHog.
 */
export function consentHeadScript(input: ConsentHeadInput): string {
  const escape = (text: string): string => text.replace(/</gu, '\\u003c');
  const parts: string[] = [];
  if (input.posthog) {
    const payload = escape(JSON.stringify({ apiKey: input.posthog.apiKey, loader: input.posthog.loader }));
    parts.push(`<script type="application/json" data-hagilight-analytics="posthog">${payload}</script>`);
  }
  parts.push(`<script type="application/json" id="${CONSENT_DESCRIPTOR_ID}">${consentDescriptor(input.config)}</script>`);
  return `(function(){document.head.insertAdjacentHTML('beforeend', ${singleQuoted(parts.join(''))});})();`;
}

/**
 * A single-quoted JavaScript string literal. Double quotes stay as written, so the descriptor's
 * `data-hagilight-analytics="posthog"` marker is still visible in the built HTML that detection reads.
 */
function singleQuoted(text: string): string {
  const body = text
    .replace(/\\/gu, '\\\\')
    .replace(/'/gu, "\\'")
    .replace(/\r/gu, '\\r')
    .replace(/\n/gu, '\\n')
    .replace(/</gu, '\\u003c');
  return `'${body}'`;
}
