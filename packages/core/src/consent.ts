/**
 * Analytics consent state, browser-safe (`@hagicode/hagilight-core/consent`). One compact record holds the visitor's
 * analytics choice. It is written to cookie `hagicode_consent` on hagicode.com hosts only, and always to localStorage
 * `hagicode:consent`. A choice that cannot be stored lives in memory for the page session. Every exported function
 * is non-throwing: a call that cannot act returns its safe default.
 */
import { isSharedHost } from './root-transit-marker.js';

export const CONSENT_STORAGE_KEY = 'hagicode:consent';
export const CONSENT_COOKIE = 'hagicode_consent';
export const CONSENT_SHARED_DOMAIN = 'hagicode.com';
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
/** Dispatched on `document` after every effective analytics change, with the new state as `detail`. */
export const CONSENT_CHANGE_EVENT = 'hagilight:consent-change';
/** Dispatched on `document` by `openConsentPreferences()`; the popup listens for it. */
export const CONSENT_PREFERENCES_EVENT = 'hagilight:consent-preferences';
/** The id of the JSON config descriptor that the popup emits. Its `policyVersion` is read lazily. */
export const CONSENT_CONFIG_ID = 'hagilight-consent-config';
export const DEFAULT_POLICY_VERSION = '1';

const RECORD_VERSION = '1';
/** A normal record is about 25 characters; the cap keeps the cookie and the stored value small. */
const MAX_RECORD_LENGTH = 64;
/** A timestamp further ahead of the clock than this is invalid, rather than valid for longer than intended. */
const CLOCK_SKEW_SECONDS = 300;
const STATES: readonly string[] = ['granted', 'denied'];
const TIME = /^\d{1,11}$/u;
const POLICY = /^[A-Za-z0-9._-]{1,32}$/u;

export type AnalyticsDecision = 'granted' | 'denied';
export type AnalyticsConsent = AnalyticsDecision | 'undecided';

export interface ConsentState {
  /** Strictly necessary storage is always granted. */
  necessary: 'granted';
  analytics: AnalyticsConsent;
}

export interface ConsentRecord {
  state: AnalyticsDecision;
  /** Epoch seconds. */
  time: number;
  policyVersion: string;
}

export interface ConsentChoice {
  analytics: boolean;
}

export type ConsentListener = (state: ConsentState) => void;

export interface ConsentOptions {
  /**
   * Optional site-supplied region check. Returning `false` means consent is not required for this visitor. Any other
   * result, a throw, or no hook at all means consent is required.
   */
  regionHook?: () => unknown;
}

/** Strict parse: exact field count, a known version and state, a plain epoch time and a bounded policy version. */
export function parseConsentRecord(value: unknown): ConsentRecord | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_RECORD_LENGTH) return null;
  const parts = value.split('|');
  if (parts.length !== 4) return null;
  const [version, state, time, policyVersion] = parts;
  if (version !== RECORD_VERSION) return null;
  if (!STATES.includes(state)) return null;
  if (!TIME.test(time) || !POLICY.test(policyVersion)) return null;
  return { state: state as AnalyticsDecision, time: Number(time), policyVersion };
}

/** Formats `1|state|time|policyVersion`, or returns null when the result would not parse back. */
export function formatConsentRecord(record: ConsentRecord): string | null {
  if (typeof record !== 'object' || record === null) return null;
  const text = [RECORD_VERSION, record.state, String(record.time), record.policyVersion].join('|');
  return parseConsentRecord(text) ? text : null;
}

/**
 * The decision a record gives at `now` (epoch seconds) under the site's policy version. A record is no decision when
 * it is older than 180 days, dated further ahead than the clock-skew allowance, or written under another policy version.
 */
export function decisionFromRecord(record: ConsentRecord | null, now: number, policyVersion: string): AnalyticsConsent {
  if (!record || record.policyVersion !== policyVersion) return 'undecided';
  const age = now - record.time;
  if (age > CONSENT_MAX_AGE_SECONDS) return 'undecided';
  if (-age > CLOCK_SKEW_SECONDS) return 'undecided';
  return record.state;
}

/** Reads the value of one cookie from a `document.cookie` string, or null when it is absent. */
export function readCookieValue(cookies: string, name: string): string | null {
  for (const pair of cookies.split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    if (pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim();
  }
  return null;
}

interface ConsentEnvironment {
  window: Window | undefined;
  document: Document | undefined;
}

function environment(): ConsentEnvironment {
  try {
    return {
      window: typeof window === 'undefined' ? undefined : window,
      document: typeof document === 'undefined' ? undefined : document,
    };
  } catch {
    return { window: undefined, document: undefined };
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** The site's policy version from its JSON config descriptor, read lazily. Anything unusable falls back to `1`. */
export function currentPolicyVersion(): string {
  try {
    const { document: doc } = environment();
    const element = doc?.getElementById(CONSENT_CONFIG_ID);
    if (!element?.textContent) return DEFAULT_POLICY_VERSION;
    const value = (JSON.parse(element.textContent) as { policyVersion?: unknown } | null)?.policyVersion;
    return typeof value === 'string' && POLICY.test(value) ? value : DEFAULT_POLICY_VERSION;
  } catch {
    return DEFAULT_POLICY_VERSION;
  }
}

function sharedHostname(): string | undefined {
  try {
    const hostname = environment().window?.location?.hostname;
    return hostname && isSharedHost(hostname, CONSENT_SHARED_DOMAIN) ? hostname : undefined;
  } catch {
    return undefined;
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return environment().window?.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredRecord(): ConsentRecord | null {
  try {
    const storage = localStorageOrNull();
    return storage ? parseConsentRecord(storage.getItem(CONSENT_STORAGE_KEY)) : null;
  } catch {
    return null;
  }
}

function readSharedCookieRecord(): ConsentRecord | null {
  try {
    if (!sharedHostname()) return null;
    const cookies = environment().document?.cookie ?? '';
    return parseConsentRecord(readCookieValue(cookies, CONSENT_COOKIE));
  } catch {
    return null;
  }
}

/** The choice made in this page session, kept when storage is unavailable. It is never reported as persisted. */
let sessionRecord: ConsentRecord | null = null;

/**
 * The newest valid record among the shared cookie, localStorage and the session copy. A tie goes to the stored copy,
 * so another tab's choice written in the same second wins over this page's own memory.
 */
function currentRecord(now: number, policyVersion: string): ConsentRecord | null {
  const candidates = [readSharedCookieRecord(), readStoredRecord(), sessionRecord];
  let best: ConsentRecord | null = null;
  for (const candidate of candidates) {
    if (decisionFromRecord(candidate, now, policyVersion) === 'undecided') continue;
    if (!best || (candidate as ConsentRecord).time > best.time) best = candidate;
  }
  return best;
}

function currentDecision(): AnalyticsConsent {
  const record = currentRecord(nowSeconds(), currentPolicyVersion());
  return record ? record.state : 'undecided';
}

function writeStored(text: string): void {
  try {
    localStorageOrNull()?.setItem(CONSENT_STORAGE_KEY, text);
  } catch {
    // Blocked or full storage: the session copy still holds the choice for this page.
  }
}

function writeSharedCookie(text: string): void {
  try {
    const hostname = sharedHostname();
    const doc = environment().document;
    if (!hostname || !doc) return;
    doc.cookie = `${CONSENT_COOKIE}=${text}; Domain=.${CONSENT_SHARED_DOMAIN}; Path=/; SameSite=Lax; Secure; Max-Age=${CONSENT_MAX_AGE_SECONDS}`;
  } catch {
    // Cookies blocked: localStorage and the session copy still hold the choice.
  }
}

const listeners = new Set<ConsentListener>();
/** The analytics decision last announced to listeners, or undefined until the first observation. */
let announced: AnalyticsConsent | undefined;
let storageListenerInstalled = false;

function baseline(): AnalyticsConsent {
  if (announced === undefined) announced = currentDecision();
  return announced;
}

function deliver(state: ConsentState): void {
  for (const listener of [...listeners]) {
    try {
      listener(state);
    } catch {
      // One failing subscriber must not stop the others or the DOM event.
    }
  }
  try {
    const { document: doc } = environment();
    doc?.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: state }));
  } catch {
    // No DOM event support: subscribers were still notified.
  }
}

/** Notifies once for each effective change of the analytics decision. Unchanged decisions are silent. */
function announceChange(): void {
  const previous = baseline();
  const next = currentDecision();
  announced = next;
  if (next === previous) return;
  deliver({ necessary: 'granted', analytics: next });
}

function ensureStorageListener(): void {
  if (storageListenerInstalled) return;
  try {
    const win = environment().window;
    if (!win) return;
    win.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === null || event.key === CONSENT_STORAGE_KEY) announceChange();
    });
    storageListenerInstalled = true;
  } catch {
    // Without the storage event, other tabs' choices are seen on the next read.
  }
}

let regionHook: (() => unknown) | undefined;

/** Sets site options. Only the region hook exists so far; unknown or unusable values are ignored. */
export function configureConsent(options: ConsentOptions): void {
  try {
    regionHook = typeof options?.regionHook === 'function' ? options.regionHook : undefined;
  } catch {
    regionHook = undefined;
  }
}

/** Whether this visitor needs a decision. Without a hook, or when the hook throws or does not answer `false`, it does. */
export function isConsentRequired(): boolean {
  try {
    return regionHook ? regionHook() !== false : true;
  } catch {
    return true;
  }
}

/** The current consent state. `analytics` is `undecided` when there is no valid record for the site's policy version. */
export function getConsent(): ConsentState {
  try {
    return { necessary: 'granted', analytics: currentDecision() };
  } catch {
    return { necessary: 'granted', analytics: 'undecided' };
  }
}

/**
 * Stores the analytics choice and notifies subscribers and the DOM event when the decision changes. Invalid arguments
 * are ignored, and the stored decision is left as it was.
 */
export function setConsent(choice: ConsentChoice): void {
  try {
    if (typeof choice !== 'object' || choice === null || typeof choice.analytics !== 'boolean') return;
    ensureStorageListener();
    baseline();
    const record: ConsentRecord = {
      state: choice.analytics ? 'granted' : 'denied',
      time: nowSeconds(),
      policyVersion: currentPolicyVersion(),
    };
    sessionRecord = record;
    const text = formatConsentRecord(record);
    if (text) {
      writeSharedCookie(text);
      writeStored(text);
    }
    announceChange();
  } catch {
    // Never throw into the page.
  }
}

/**
 * Subscribes to analytics changes. Returns an unsubscribe function. A subscriber that throws does not affect the others.
 */
export function onConsentChange(callback: ConsentListener): () => void {
  try {
    if (typeof callback !== 'function') return () => {};
    ensureStorageListener();
    baseline();
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  } catch {
    return () => {};
  }
}

/** Asks the page's popup to show its details and choices again. It has no effect when no popup is mounted. */
export function openConsentPreferences(): void {
  try {
    environment().document?.dispatchEvent(new CustomEvent(CONSENT_PREFERENCES_EVENT));
  } catch {
    // Nothing to open.
  }
}
