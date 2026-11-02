/**
 * Shared popup markup for the consent popup (`CookieConsent.astro` and the Docusaurus client). It is a string, so the
 * same markup renders in both frameworks. The DOM wiring lives in `consent-popup.ts`.
 */
import { resolveConsentCopy, type ConsentCopy } from './consent-copy/index.js';
import { consentDetails, type ConsentProvider, type StorageEntry } from './consent-details.js';
import { CONSENT_CONFIG_ID, DEFAULT_POLICY_VERSION } from './consent.js';
import { isAssignedCountryCode } from './consent-region.js';
import { DEFAULT_LOCALE, SITE_LOCALE_CODES } from './root-transit-locale.js';

export const CONSENT_PROVIDERS: readonly ConsentProvider[] = ['googleAnalytics', 'posthog', 'fiftyOneLa'];

/** Brand names stay as written in every locale. */
const PROVIDER_LABEL: Readonly<Record<ConsentProvider, string>> = {
  googleAnalytics: 'Google Analytics',
  posthog: 'PostHog',
  fiftyOneLa: '51LA',
};

const POLICY = /^[A-Za-z0-9._-]{1,32}$/u;

/** The regional options a regional site passes through to the page. Absent means global consent. */
export interface RegionalPopupOptions {
  regions: 'default' | readonly string[];
  countryCode?: string;
  /** The name of a function the site defines on `window`. */
  regionHook?: string;
  settingsEntry: 'requiredOnly' | 'always';
  sessionReplay: 'optIn' | 'projectDefault' | 'off';
}

export interface ConsentPopupOptions {
  /** The page locale. An unsupported value renders `en-US`. */
  locale?: string;
  /** The analytics providers the site enables. Their storage names appear in the details. */
  providers: readonly ConsentProvider[];
  /** An absolute HTTP(S) URL or a site-relative path. Omitted means no privacy link. */
  privacyUrl?: string;
  /** Defaults to `1`. Changing it asks every visitor again. */
  policyVersion?: string;
  /** Set only for a regional site. Its absence keeps the global descriptor and markup unchanged. */
  regional?: RegionalPopupOptions;
}

export interface ResolvedConsentPopupOptions {
  locale: string;
  providers: readonly ConsentProvider[];
  privacyUrl: string | undefined;
  policyVersion: string;
  regional?: RegionalPopupOptions;
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

const HOOK_NAME = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/u;
const REGIONAL_ONLY_OPTIONS = ['countryCode', 'regionHook', 'settingsEntry', 'sessionReplay'] as const;

/** Throws a TypeError that names the option unless it is `default` or a non-empty list of assigned upper-case codes. */
export function validateRegions(value: unknown): 'default' | string[] {
  if (value === 'default') return 'default';
  if (Array.isArray(value) && value.length > 0 && value.every((code) => isAssignedCountryCode(code))) return [...value];
  throw new TypeError('analytics.consent.regions must be "default" or a non-empty list of upper-case ISO 3166-1 alpha-2 country codes.');
}

/** Throws a TypeError that names the option unless the value is one assigned upper-case ISO 3166-1 alpha-2 code. */
export function validateCountryCode(value: unknown): string {
  if (!isAssignedCountryCode(value)) {
    throw new TypeError('analytics.consent.countryCode must be one upper-case ISO 3166-1 alpha-2 country code, such as "DE".');
  }
  return value;
}

/** Throws a TypeError that names the option unless the value is the name of a function on `window`, not code. */
export function validateHookName(value: unknown): string {
  if (typeof value !== 'string' || !HOOK_NAME.test(value)) {
    throw new TypeError('analytics.consent.regionHook must be the name of a function defined on window, such as "siteRegion".');
  }
  return value;
}

/** Throws a TypeError that names the option unless it is `requiredOnly` or `always`. */
export function validateSettingsEntry(value: unknown): 'requiredOnly' | 'always' {
  if (value === 'requiredOnly' || value === 'always') return value;
  throw new TypeError('analytics.consent.settingsEntry must be "requiredOnly" or "always".');
}

/** Throws a TypeError that names the option unless it is `optIn`, `projectDefault` or `off`. */
export function validateSessionReplay(value: unknown): 'optIn' | 'projectDefault' | 'off' {
  if (value === 'optIn' || value === 'projectDefault' || value === 'off') return value;
  throw new TypeError('analytics.consent.sessionReplay must be "optIn", "projectDefault" or "off".');
}

/**
 * Validates the regional options of `analytics.consent` for every integration. Returns `undefined` when no regional option
 * is set, so a global site stays exactly as it was. A regional-only option without `regions` throws, and so does `regions`
 * with consent disabled, because either would silently widen or hide a compliance setting.
 */
export function resolveRegionalOptions(input: Record<string, unknown> | undefined, enabled = true): RegionalPopupOptions | undefined {
  const given = (key: string): boolean => input?.[key] !== undefined;
  if (!given('regions') && !REGIONAL_ONLY_OPTIONS.some((key) => given(key))) return undefined;
  if (!given('regions')) {
    const key = REGIONAL_ONLY_OPTIONS.find((option) => given(option));
    throw new TypeError(`analytics.consent.${key} needs analytics.consent.regions: regions is required when a regional option is set.`);
  }
  if (enabled === false) throw new TypeError('analytics.consent.regions cannot be set while analytics.consent.enabled is false.');
  return {
    regions: validateRegions(input?.regions),
    ...(given('countryCode') ? { countryCode: validateCountryCode(input?.countryCode) } : {}),
    ...(given('regionHook') ? { regionHook: validateHookName(input?.regionHook) } : {}),
    settingsEntry: given('settingsEntry') ? validateSettingsEntry(input?.settingsEntry) : 'requiredOnly',
    sessionReplay: given('sessionReplay') ? validateSessionReplay(input?.sessionReplay) : 'optIn',
  };
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
    ...(options.regional ? { regional: options.regional } : {}),
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
  const regional = resolved.regional
    ? {
      mode: 'regional',
      regions: resolved.regional.regions,
      ...(resolved.regional.countryCode !== undefined ? { countryCode: resolved.regional.countryCode } : {}),
      ...(resolved.regional.regionHook !== undefined ? { regionHook: resolved.regional.regionHook } : {}),
      settingsEntry: resolved.regional.settingsEntry,
      sessionReplay: resolved.regional.sessionReplay,
    }
    : {};
  const payload = {
    policyVersion: resolved.policyVersion,
    privacyUrl: resolved.privacyUrl ?? null,
    providers: resolved.providers,
    locale: resolved.locale,
    ...regional,
  };
  return JSON.stringify(payload).replace(/</gu, '\\u003c');
}

/** The ID of the descriptor script, so the popup and the gate can read the same element. */
export const CONSENT_DESCRIPTOR_ID = CONSENT_CONFIG_ID;

/**
 * The popup's HTML: a hidden, labelled, non-modal region with two equal actions and an expandable details section. A
 * regional site with session replay opt-in also gets a hidden replay section, with equal Allow and Not now actions. A
 * global site renders exactly the markup it always did.
 */
export function renderConsentMarkup(options: ConsentPopupOptions): string {
  const resolved = resolveConsentPopupOptions(options);
  const copy: ConsentCopy = resolveConsentCopy(resolved.locale);
  const details = consentDetails(resolved.providers);
  const providerLabels = details.analytics.providers.map((provider) => PROVIDER_LABEL[provider]).join(', ');
  const privacy = resolved.privacyUrl
    ? `<p class="hagilight-consent__privacy"><a href="${escapeHtml(resolved.privacyUrl)}">${escapeHtml(copy.privacyLink)}</a></p>`
    : '';
  const replayOptIn = resolved.regional?.sessionReplay === 'optIn';
  const replay = replayOptIn
    ? [
      `<div class="hagilight-consent__replay" data-hagilight-consent-replay hidden>`,
      `<h2 class="hagilight-consent__title" id="hagilight-consent-replay-title">${escapeHtml(copy.replayTitle)}</h2>`,
      `<p class="hagilight-consent__intro">${escapeHtml(copy.replayBody)}</p>`,
      `<div class="hagilight-consent__actions">`,
      `<button type="button" class="hagilight-consent__button" data-consent-replay-allow>${escapeHtml(copy.replayAllow)}</button>`,
      `<button type="button" class="hagilight-consent__button" data-consent-replay-decline>${escapeHtml(copy.replayDecline)}</button>`,
      `</div>`,
      privacy,
      `</div>`,
    ]
    : [];
  const body = [
    `<h2 class="hagilight-consent__title" id="hagilight-consent-title">${escapeHtml(copy.title)}</h2>`,
    `<p class="hagilight-consent__intro">${escapeHtml(copy.intro)}</p>`,
    `<p class="hagilight-consent__choice" data-consent-choice data-choice-granted="${escapeHtml(copy.choiceAccepted)}" data-choice-denied="${escapeHtml(copy.choiceRejected)}" data-choice-undecided="${escapeHtml(copy.choiceUndecided)}">${escapeHtml(copy.choiceLabel)}: <span data-consent-choice-value>${escapeHtml(copy.choiceUndecided)}</span></p>`,
    `<div class="hagilight-consent__actions">`,
    `<button type="button" class="hagilight-consent__button" data-consent-accept>${escapeHtml(copy.accept)}</button>`,
    `<button type="button" class="hagilight-consent__button" data-consent-reject>${escapeHtml(copy.reject)}</button>`,
    `</div>`,
    `<button type="button" class="hagilight-consent__toggle" data-consent-toggle aria-expanded="false" aria-controls="hagilight-consent-details">${escapeHtml(copy.details)}</button>`,
    `<div class="hagilight-consent__details" id="hagilight-consent-details" data-consent-details hidden>`,
    `<section class="hagilight-consent__category hagilight-consent__category--necessary"><h3>${escapeHtml(copy.necessaryTitle)}</h3><p>${escapeHtml(copy.necessaryBody)}</p><ul>${storageList(details.necessary)}</ul></section>`,
    `<section class="hagilight-consent__category hagilight-consent__category--analytics"><h3>${escapeHtml(copy.analyticsTitle)}</h3><p>${escapeHtml(copy.analyticsBody)}${providerLabels ? ` (${escapeHtml(providerLabels)})` : ''}</p><ul>${storageList(details.analytics.storage)}</ul></section>`,
    `<p class="hagilight-consent__withdraw">${escapeHtml(copy.withdraw)}</p>`,
    privacy,
    `</div>`,
  ];
  if (!replayOptIn) {
    return [
      `<section class="hagilight-consent" data-hagilight-consent data-state="undecided" role="region" aria-labelledby="hagilight-consent-title" hidden>`,
      ...body,
      `</section>`,
    ].join('');
  }
  return [
    `<section class="hagilight-consent" data-hagilight-consent data-state="undecided" role="region" aria-labelledby="hagilight-consent-title" hidden>`,
    `<div class="hagilight-consent__main" data-consent-main>`,
    ...body,
    `</div>`,
    ...replay,
    `</section>`,
  ].join('');
}
