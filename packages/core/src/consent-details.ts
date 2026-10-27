/**
 * The popup's details content as data: the categories, the analytics providers a site enables and the cookie and
 * storage names each one uses. The provider names come from the verified SDK behavior recorded in `consent-gate.ts`
 * and `test/fixtures/consent-sdk-storage.json`. Names are data, not copy, so they are not translated.
 */

export type ConsentProvider = 'googleAnalytics' | 'fiftyOneLa' | 'posthog';
export type StorageKind = 'cookie' | 'localStorage' | 'sessionStorage';

export interface StorageEntry {
  /** A literal name, or a pattern where `<key>` is the PostHog project key and `<id>` the GA measurement ID without `G-`. */
  name: string;
  kind: StorageKind;
}

/** Storage that hagilight and its site write whatever the analytics choice is. */
export const NECESSARY_STORAGE: readonly StorageEntry[] = [
  { name: 'hagicode_consent', kind: 'cookie' },
  { name: 'hagicode:consent', kind: 'localStorage' },
  { name: 'hagicode:site-locale', kind: 'localStorage' },
  { name: 'starlight-route', kind: 'localStorage' },
  { name: 'hagicode_locale_monitor', kind: 'cookie' },
  { name: 'hagicode:locale-monitor', kind: 'localStorage' },
  { name: 'hagilight-theme', kind: 'localStorage' },
  { name: 'starlight-theme', kind: 'localStorage' },
  { name: 'hagilight-content-width', kind: 'localStorage' },
  { name: 'hagilight:promoto-banner:dismissed-signature', kind: 'localStorage' },
];

/**
 * Storage written by each analytics provider after a grant. 51LA has no entry yet: its cookie and storage names are
 * not verified (task 1.3), so the details never list guessed names for it.
 */
export const PROVIDER_STORAGE: Readonly<Partial<Record<ConsentProvider, readonly StorageEntry[]>>> = {
  googleAnalytics: [
    { name: '_ga', kind: 'cookie' },
    { name: '_ga_<id>', kind: 'cookie' },
  ],
  posthog: [
    { name: 'ph_<key>_posthog', kind: 'cookie' },
    { name: 'ph_<key>_posthog', kind: 'localStorage' },
    { name: '__ph_opt_in_out_<key>', kind: 'localStorage' },
    { name: 'ph_<key>_session_registered_properties', kind: 'sessionStorage' },
    { name: 'ph_<key>_primary_window_exists', kind: 'sessionStorage' },
  ],
};

export interface ConsentDetails {
  necessary: readonly StorageEntry[];
  analytics: {
    /** Only the providers the site enables; a provider with no verified names is listed with an empty storage list. */
    providers: readonly ConsentProvider[];
    storage: readonly StorageEntry[];
  };
}

/** The details for the providers a site enables. Replay and screen recording are always part of analytics. */
export function consentDetails(enabled: readonly ConsentProvider[]): ConsentDetails {
  const providers = enabled.filter((provider, index) => enabled.indexOf(provider) === index);
  const storage = providers.flatMap((provider) => PROVIDER_STORAGE[provider] ?? []);
  return { necessary: NECESSARY_STORAGE, analytics: { providers, storage } };
}
