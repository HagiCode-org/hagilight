import {
  DEFAULT_LOCALE, LEGACY_SITE_LOCALE_STORAGE_KEY, SITE_LOCALE_STORAGE_KEY, resolveTransitLocale,
  type LocaleInputEvidence, type LocaleSource,
} from './root-transit-locale.js';
import {
  LOCALE_MONITOR_SHARED_DOMAIN, LOCALE_MONITOR_STORAGE_KEY, formatLocaleMarker, isHostname, isSharedHost,
  localeMarkerCookie, parseLocaleMarker, readLocaleMarkerCookie, type LocaleMarker,
} from './root-transit-marker.js';

export interface LocaleMonitorOptions {
  /** The domain the marker cookie is shared on. `false` keeps the marker on the visitor's own origin. */
  sharedDomain?: string | false;
}

/** Turns the `localeMonitor` prop into the shared domain: null when the monitor is off, `sharedDomain: null` for same-origin only. */
export function resolveLocaleMonitor(option: boolean | LocaleMonitorOptions | undefined): { sharedDomain: string | null } | null {
  if (!option) return null;
  const configured = option === true ? LOCALE_MONITOR_SHARED_DOMAIN : (option.sharedDomain ?? LOCALE_MONITOR_SHARED_DOMAIN);
  if (configured === false) return { sharedDomain: null };
  const domain = configured.trim().toLowerCase();
  if (!domain.includes('.') || !isHostname(domain)) {
    throw new TypeError('Hagilight RootTransit: localeMonitor.sharedDomain must be a domain such as hagicode.com, or false.');
  }
  return { sharedDomain: domain };
}

const UNAVAILABLE = 'unavailable';
const EMPTY = '—';
const INPUT_LABEL: Record<LocaleSource, string> = {
  query: '?lang=',
  stored: 'hagicode:site-locale',
  browser: 'navigator.languages',
  default: 'default',
};

/** One read of a browser input. A throwing read is recorded as failed, so its row can say so. */
interface Snapshot<T> {
  value: T | null;
  failed: boolean;
}

function read<T>(step: () => T | null): Snapshot<T> {
  try {
    return { value: step(), failed: false };
  } catch {
    return { value: null, failed: true };
  }
}

/** A blocked or throwing write loses only this step; the page keeps working. */
function attempt(step: () => void): void {
  try {
    step();
  } catch {
    // Storage and cookies may be blocked. Nothing else depends on this write.
  }
}

function describeInput(evidence: LocaleInputEvidence, failed: boolean): string {
  if (evidence.raw === null) return failed ? UNAVAILABLE : EMPTY;
  if (evidence.locale && evidence.locale !== evidence.raw) return `${evidence.raw} → ${evidence.locale}`;
  return evidence.raw;
}

function describeMarker({ locale, source, host }: LocaleMarker): string {
  return `${locale} · ${INPUT_LABEL[source]} · ${host}`;
}

/** The cookie copy wins when present; a malformed value is shown as unavailable rather than replaced by the local copy. */
function describeShared(cookie: Snapshot<string>, localCopy: Snapshot<string>): string {
  const raw = cookie.value ?? localCopy.value;
  if (raw !== null) {
    const marker = parseLocaleMarker(raw);
    return marker ? describeMarker(marker) : UNAVAILABLE;
  }
  return cookie.failed || localCopy.failed ? UNAVAILABLE : EMPTY;
}

function setRow(panel: HTMLElement, key: string, value: string, detected: boolean): void {
  const row = panel.querySelector<HTMLElement>(`[data-locale-trace="${key}"]`);
  const valueCell = row?.querySelector<HTMLElement>('[data-locale-value]');
  const verdict = row?.querySelector<HTMLElement>('[data-locale-verdict]');
  if (!row || !valueCell || !verdict) return;
  row.dataset.state = detected ? 'used' : 'idle';
  valueCell.textContent = value;
  verdict.textContent = detected ? 'detected' : '';
}

/**
 * Observation only. Takes one snapshot of the four inputs and the shared marker, fills the rows as text, then records
 * the marker once. It adds no listeners and no timers, and it never changes the forward target or the links.
 */
export function mountLocaleMonitor(win: Window, doc: Document): void {
  const panel = doc.querySelector<HTMLElement>('[data-locale-monitor]');
  if (!panel) return;
  const sharedDomain = panel.dataset.sharedDomain || null;

  const query = read(() => new URLSearchParams(win.location.search).get('lang'));
  const stored = read(() => win.localStorage.getItem(SITE_LOCALE_STORAGE_KEY));
  const legacy = read(() => win.localStorage.getItem(LEGACY_SITE_LOCALE_STORAGE_KEY));
  const browser = read(() => [...win.navigator.languages]);
  const cookie = read(() => readLocaleMarkerCookie(doc.cookie));
  const localCopy = read(() => win.localStorage.getItem(LOCALE_MONITOR_STORAGE_KEY));

  const resolution = resolveTransitLocale({
    requestedLang: query.value,
    storedLocale: stored.value,
    legacyStoredLocale: legacy.value,
    clientLanguages: browser.value ?? [],
  });
  const { evidence, source } = resolution;
  setRow(panel, 'query', describeInput(evidence.query, query.failed), source === 'query');
  setRow(panel, 'stored', describeInput(evidence.stored, stored.failed || legacy.failed), source === 'stored');
  setRow(panel, 'browser', describeInput(evidence.browser, browser.failed), source === 'browser');
  setRow(panel, 'default', DEFAULT_LOCALE, source === 'default');
  setRow(panel, 'shared', describeShared(cookie, localCopy), false);

  const host = win.location.hostname;
  const marker = formatLocaleMarker({ locale: resolution.locale, source, host, time: Math.floor(Date.now() / 1000) });
  if (!marker) return;
  attempt(() => win.localStorage.setItem(LOCALE_MONITOR_STORAGE_KEY, marker));
  if (sharedDomain && isSharedHost(host, sharedDomain)) {
    attempt(() => { doc.cookie = localeMarkerCookie(marker, sharedDomain); });
  }
}
