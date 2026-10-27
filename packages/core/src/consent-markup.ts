/**
 * Shared popup markup for the consent popup (`CookieConsent.astro` and the Docusaurus client). It is a string, so the
 * same markup renders in both frameworks. The DOM wiring lives in `consent-popup.ts`.
 */
import { resolveConsentCopy, type ConsentCopy } from './consent-copy/index.js';
import { consentDetails, type ConsentProvider, type StorageEntry } from './consent-details.js';
import { CONSENT_CONFIG_ID, DEFAULT_POLICY_VERSION } from './consent.js';
import { DEFAULT_LOCALE, SITE_LOCALE_CODES } from './root-transit-locale.js';

export const CONSENT_PROVIDERS: readonly ConsentProvider[] = ['googleAnalytics', 'posthog', 'fiftyOneLa'];

/** Brand names stay as written in every locale. */
const PROVIDER_LABEL: Readonly<Record<ConsentProvider, string>> = {
  googleAnalytics: 'Google Analytics',
  posthog: 'PostHog',
  fiftyOneLa: '51LA',
};

const POLICY = /^[A-Za-z0-9._-]{1,32}$/u;

export interface ConsentPopupOptions {
  /** The page locale. An unsupported value renders `en-US`. */
  locale?: string;
  /** The analytics providers the site enables. Their storage names appear in the details. */
  providers: readonly ConsentProvider[];
  /** An absolute HTTP(S) URL or a site-relative path. Omitted means no privacy link. */
  privacyUrl?: string;
  /** Defaults to `1`. Changing it asks every visitor again. */
  policyVersion?: string;
}

export interface ResolvedConsentPopupOptions {
  locale: string;
  providers: readonly ConsentProvider[];
  privacyUrl: string | undefined;
  policyVersion: string;
}

/** Throws a TypeError that names the option when the value is not an absolute HTTP(S) URL or a site-relative path. */
export function validatePrivacyUrl(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new TypeError('analytics.consent.privacyUrl must be a string.');
  const trimmed = value.trim();
  if (/^https?:\/\/[^\s]+$/iu.test(trimmed)) {
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      throw new TypeError(`analytics.consent.privacyUrl is not a valid URL: ${trimmed}`);
    }
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !/\s/u.test(trimmed)) return trimmed;
  throw new TypeError('analytics.consent.privacyUrl must be an absolute http(s) URL or a site-relative path starting with "/".');
}

/** Throws a TypeError that names the option when the policy version is not 1 to 32 safe characters. */
export function validatePolicyVersion(value: unknown): string {
  if (value === undefined) return DEFAULT_POLICY_VERSION;
  if (typeof value !== 'string' || !POLICY.test(value)) {
    throw new TypeError('analytics.consent.policyVersion must be 1 to 32 letters, digits, dots, underscores or hyphens.');
  }
  return value;
}

/** The locale code the popup renders: the page locale when it is in `SITE_LOCALES`, otherwise `en-US`. */
function effectiveLocale(locale: unknown): string {
  return typeof locale === 'string' && (SITE_LOCALE_CODES as readonly string[]).includes(locale) ? locale : DEFAULT_LOCALE;
}

export function resolveConsentPopupOptions(options: ConsentPopupOptions): ResolvedConsentPopupOptions {
  const providers = options.providers.filter((provider, index, all) => all.indexOf(provider) === index);
  return {
    locale: effectiveLocale(options.locale),
    providers,
    privacyUrl: validatePrivacyUrl(options.privacyUrl),
    policyVersion: validatePolicyVersion(options.policyVersion),
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function storageList(entries: readonly StorageEntry[]): string {
  return entries.map((entry) => `<li><code>${escapeHtml(entry.name)}</code> <span>${escapeHtml(entry.kind)}</span></li>`).join('');
}

/**
 * The config descriptor for `<script type="application/json" id="hagilight-consent-config">`. It holds only the policy
 * version, the privacy URL, the enabled providers and the locale. `<` is escaped so the JSON cannot close the script.
 */
export function consentDescriptor(options: ConsentPopupOptions): string {
  const resolved = resolveConsentPopupOptions(options);
  const payload = {
    policyVersion: resolved.policyVersion,
    privacyUrl: resolved.privacyUrl ?? null,
    providers: resolved.providers,
    locale: resolved.locale,
  };
  return JSON.stringify(payload).replace(/</gu, '\\u003c');
}

/** The ID of the descriptor script, so the popup and the gate can read the same element. */
export const CONSENT_DESCRIPTOR_ID = CONSENT_CONFIG_ID;

/** The popup's HTML: a hidden, labelled, non-modal region with two equal actions and an expandable details section. */
export function renderConsentMarkup(options: ConsentPopupOptions): string {
  const resolved = resolveConsentPopupOptions(options);
  const copy: ConsentCopy = resolveConsentCopy(resolved.locale);
  const details = consentDetails(resolved.providers);
  const providerLabels = details.analytics.providers.map((provider) => PROVIDER_LABEL[provider]).join(', ');
  const privacy = resolved.privacyUrl
    ? `<p class="hagilight-consent__privacy"><a href="${escapeHtml(resolved.privacyUrl)}">${escapeHtml(copy.privacyLink)}</a></p>`
    : '';
  return [
    `<section class="hagilight-consent" data-hagilight-consent data-state="undecided" role="region" aria-labelledby="hagilight-consent-title" hidden>`,
    `<h2 class="hagilight-consent__title" id="hagilight-consent-title">${escapeHtml(copy.title)}</h2>`,
    `<p class="hagilight-consent__intro">${escapeHtml(copy.intro)}</p>`,
    `<p class="hagilight-consent__choice" data-consent-choice data-choice-granted="${escapeHtml(copy.choiceAccepted)}" data-choice-denied="${escapeHtml(copy.choiceRejected)}" data-choice-undecided="${escapeHtml(copy.choiceUndecided)}">${escapeHtml(copy.choiceLabel)}: <span data-consent-choice-value>${escapeHtml(copy.choiceUndecided)}</span></p>`,
    `<div class="hagilight-consent__actions">`,
    `<button type="button" class="hagilight-consent__button" data-consent-accept>${escapeHtml(copy.accept)}</button>`,
    `<button type="button" class="hagilight-consent__button" data-consent-reject>${escapeHtml(copy.reject)}</button>`,
    `</div>`,
    `<button type="button" class="hagilight-consent__toggle" data-consent-toggle aria-expanded="false" aria-controls="hagilight-consent-details">${escapeHtml(copy.details)}</button>`,
    `<div class="hagilight-consent__details" id="hagilight-consent-details" data-consent-details hidden>`,
    `<section class="hagilight-consent__category"><h3>${escapeHtml(copy.necessaryTitle)}</h3><p>${escapeHtml(copy.necessaryBody)}</p><ul>${storageList(details.necessary)}</ul></section>`,
    `<section class="hagilight-consent__category"><h3>${escapeHtml(copy.analyticsTitle)}</h3><p>${escapeHtml(copy.analyticsBody)}${providerLabels ? ` (${escapeHtml(providerLabels)})` : ''}</p><ul>${storageList(details.analytics.storage)}</ul></section>`,
    `<p class="hagilight-consent__withdraw">${escapeHtml(copy.withdraw)}</p>`,
    privacy,
    `</div>`,
    `</section>`,
  ].join('');
}
