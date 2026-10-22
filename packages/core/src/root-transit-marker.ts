import { SITE_LOCALE_CODES, type LocaleSource, type SiteLocale } from './root-transit-locale.js';

/** Same-origin copy of the monitor marker. The official keys `hagicode:site-locale` and `lang` are never written. */
export const LOCALE_MONITOR_STORAGE_KEY = 'hagicode:locale-monitor';
/** Cross-subdomain copy, written with `Domain=.hagicode.com` on hagicode.com hosts only. */
export const LOCALE_MONITOR_COOKIE = 'hagicode_locale_monitor';
export const LOCALE_MONITOR_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
export const LOCALE_MONITOR_SHARED_DOMAIN = 'hagicode.com';

/** Longest marker accepted on read. A valid marker is about 50 characters; the bound keeps the cookie small. */
const MAX_MARKER_LENGTH = 96;
const SOURCES: readonly LocaleSource[] = ['query', 'stored', 'browser', 'default'];
const LABEL = /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/u;
const TIME = /^\d{1,11}$/u;

export interface LocaleMarker {
  locale: SiteLocale;
  source: LocaleSource;
  host: string;
  /** Epoch seconds. */
  time: number;
}

/** A lowercase host name such as `localhost` or `docs.hagicode.com`. */
export function isHostname(value: string): boolean {
  return value.split('.').every((label) => LABEL.test(label));
}

/** Formats `locale|source|host|time`, or returns null when the result would not parse back. */
export function formatLocaleMarker(marker: LocaleMarker): string | null {
  const text = [marker.locale, marker.source, marker.host, String(marker.time)].join('|');
  return parseLocaleMarker(text) ? text : null;
}

/** Strict parse: exactly four fields, a supported locale, a known input, a hostname and a plain epoch time. */
export function parseLocaleMarker(value: string): LocaleMarker | null {
  if (value.length > MAX_MARKER_LENGTH) return null;
  const parts = value.split('|');
  if (parts.length !== 4) return null;
  const [locale, source, host, time] = parts;
  if (!(SITE_LOCALE_CODES as readonly string[]).includes(locale)) return null;
  if (!(SOURCES as readonly string[]).includes(source)) return null;
  if (!isHostname(host) || !TIME.test(time)) return null;
  return { locale: locale as SiteLocale, source: source as LocaleSource, host, time: Number(time) };
}

/** True for the shared domain itself and its subdomains. `evilhagicode.com` and `hagicode.com.evil.test` do not match. */
export function isSharedHost(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Reads the marker cookie from a `document.cookie` string, or null when it is absent. */
export function readLocaleMarkerCookie(cookies: string): string | null {
  for (const pair of cookies.split(';')) {
    const [name, ...value] = pair.trim().split('=');
    if (name === LOCALE_MONITOR_COOKIE) return value.join('=');
  }
  return null;
}

/** The `Set-Cookie`-style string for `document.cookie`. */
export function localeMarkerCookie(marker: string, domain: string): string {
  return `${LOCALE_MONITOR_COOKIE}=${marker}; Domain=.${domain}; Path=/; SameSite=Lax; Secure; Max-Age=${LOCALE_MONITOR_MAX_AGE_SECONDS}`;
}
