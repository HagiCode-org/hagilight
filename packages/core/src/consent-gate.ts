/*
 * Consent gate (task 1.1, 1.2, 1.3). The provider table below is filled in as SDK facts are verified; the
 * loader, start and stop logic is added by task 5.1.
 *
 * Verified SDK facts, observed in headless Chromium with the shipped loaders (2026-10-26). Requests to the
 * provider hosts were aborted, so no analytics event left the machine. Fixture: test/fixtures/consent-sdk-storage.json.
 *
 * | Provider | Cookie names | localStorage names | sessionStorage names | Opt-out / clear calls | Stop in place |
 * |---|---|---|---|---|---|
 * | PostHog (`phc_qiVV...PER5`, loader from `posthogInitScript`) | `ph_<key>_posthog` (written after the first `capture` on an opted-in page) | `ph_<key>_posthog`, `__ph_opt_in_out_<key>` (opt-out state) | `ph_<key>_session_registered_properties`, `ph_<key>_primary_window_exists` | `opt_out_capturing()` writes the opt-out state; `opt_in_capturing()` not observed; `clear_opt_in_out_capturing()` removes `__ph_opt_in_out_<key>` only. Opt-out is not a cleanup: `ph_` cookie and storage stay and must be removed by the gate. | Documented: opting out stops all capture, autocapture and session replay on the client. Not observed: the harness never let capture reach the network, so `stopInPlace` stays false until the group-10 browser check (10.2) confirms no request after reject. |
 * | Google Analytics (`G-EN03FMT2Q4`, `gtag.js`) | `_ga`, `_ga_<id>` where `<id>` is the measurement ID without the `G-` prefix (`_ga_EN03FMT2Q4`), both set on the page host after `config` | none | none | `window['ga-disable-<id>'] = true` set before `gtag.js` runs: no cookie and no `collect` request. Set after `config` (the in-place case): `collect` requests are still attempted, so the flag does not stop an initialized page in place. | false, reload on withdrawal |
 * | 51LA (`L6b88a5yK4h2Xnci`, `sdk.51.la/js-sdk-pro.min.js`) | not observed: `sdk.51.la` does not resolve from this machine (DNS) | not observed | not observed | task 1.3 is open: the SDK source could not be fetched here, so no stop or consent API is recorded | always reload (hard-coded) |
 *
 * PostHog replay under `notRequired` (verified 2026-11-01, real posthog-js 1.444.0 with the shipped loader; fixture
 * test/fixtures/posthog-replay-facts.json). Queuing `set_config({ disable_session_recording: true })` and
 * `stopSessionRecording()` right after the loader keeps every `/s/` request silent while events still flow, and a
 * remote config that arrives 1500 ms late does not re-enable recording. An opt-in (`set_config` false plus
 * `startSessionRecording()`) starts recording on the same page. So the init-time flag fallback is not used. The probe
 * needed a non-bot user agent and `navigator.webdriver` false, because posthog-js drops events from headless browsers.
 */
import {
  getConsent as readConsent, onConsentChange as subscribeConsent, regionalBehavior, type ConsentState,
} from './consent.js';
import { pageRegionSource, type RegionDecision, type RegionHolder, type RegionSource } from './consent-region.js';

export type GateProvider = 'googleAnalytics' | 'fiftyOneLa' | 'posthog';
/** `project` follows the PostHog project's recording setting. `off` keeps session replay disabled until a grant. */
export type ReplayMode = 'project' | 'off';
/** What started the providers in this document: an explicit record, or a `notRequired` region decision. */
export type StartReason = 'consent' | 'region';
export type SessionReplayOption = 'optIn' | 'projectDefault' | 'off';

/** The consent reads, subscriptions and region-replay option the gate uses. The page uses the module functions; tests inject a fake. */
export interface ConsentApi {
  getConsent: () => ConsentState;
  onConsentChange: (listener: (state: ConsentState) => void) => () => void;
  /** The session-replay option for `notRequired` starts. Defaults to `optIn`. */
  sessionReplay?: () => SessionReplayOption;
}

const moduleConsentApi: ConsentApi = {
  getConsent: readConsent,
  onConsentChange: subscribeConsent,
  sessionReplay: () => regionalBehavior().sessionReplay,
};

/** The minimal document and window surface the gate touches. Tests pass fakes; the page passes the real globals. */
export interface GateEnvironment {
  document: Document;
  window: Window;
  /** Reloads the page. Called only when a started provider cannot be stopped in place. */
  reload: () => void;
}

export interface GoogleAnalyticsDescriptor {
  measurementId: string;
}

export interface FiftyOneLaDescriptor {
  siteId: string;
}

export interface PostHogDescriptor {
  apiKey: string;
  /** The unchanged output of `posthogInitScript`, injected inline only after a grant. */
  loader: string;
}

export interface ProviderDescriptors {
  googleAnalytics?: GoogleAnalyticsDescriptor;
  fiftyOneLa?: FiftyOneLaDescriptor;
  posthog?: PostHogDescriptor;
}

const DESCRIPTOR_SELECTOR = 'script[type="application/json"][data-hagilight-analytics]';
const PROVIDERS: readonly GateProvider[] = ['googleAnalytics', 'fiftyOneLa', 'posthog'];

/** Post-grant hooks run once after PostHog starts, so later listeners install only from the grant. */
const postGrantHooks: Array<() => void> = [];
export function onPostHogStarted(hook: () => void): void {
  if (typeof hook === 'function') postGrantHooks.push(hook);
}

/** Reads the inert descriptors. A descriptor that does not parse or has the wrong shape is ignored. */
export function readDescriptors(doc: Document): ProviderDescriptors {
  const found: Record<string, unknown> = {};
  for (const element of Array.from(doc.querySelectorAll(DESCRIPTOR_SELECTOR))) {
    const provider = element.getAttribute('data-hagilight-analytics');
    if (!provider || !(PROVIDERS as readonly string[]).includes(provider)) continue;
    try {
      found[provider] = JSON.parse(element.textContent ?? '');
    } catch {
      // Ignore a malformed descriptor: that provider simply does not start.
    }
  }
  const ga = found.googleAnalytics as Partial<GoogleAnalyticsDescriptor> | undefined;
  const la = found.fiftyOneLa as Partial<FiftyOneLaDescriptor> | undefined;
  const ph = found.posthog as Partial<PostHogDescriptor> | undefined;
  return {
    ...(typeof ga?.measurementId === 'string' && ga.measurementId ? { googleAnalytics: { measurementId: ga.measurementId } } : {}),
    ...(typeof la?.siteId === 'string' && la.siteId ? { fiftyOneLa: { siteId: la.siteId } } : {}),
    ...(typeof ph?.apiKey === 'string' && typeof ph.loader === 'string' ? { posthog: { apiKey: ph.apiKey, loader: ph.loader } } : {}),
  };
}

function injectScript(env: GateEnvironment, attributes: Record<string, string>, onLoad?: () => void): HTMLScriptElement {
  const script = env.document.createElement('script');
  for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
  if (onLoad) script.addEventListener('load', onLoad);
  (env.document.head ?? env.document.body).appendChild(script);
  return script;
}

function injectInline(env: GateEnvironment, code: string): void {
  const script = env.document.createElement('script');
  script.textContent = code;
  (env.document.head ?? env.document.body).appendChild(script);
}

/** Cookie names of one provider are removed on the page host, with the same path the SDK sets. */
function expireCookie(env: GateEnvironment, name: string): void {
  try {
    env.document.cookie = `${name}=; Path=/; Max-Age=0`;
  } catch {
    // Cookies blocked: nothing was written either.
  }
}

function cookieNames(env: GateEnvironment): string[] {
  try {
    return env.document.cookie.split(';').map((pair) => pair.split('=')[0].trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function removePrefixedStorage(storage: Storage | undefined, prefix: string): void {
  try {
    if (!storage) return;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage blocked: nothing to clean.
  }
}

function safeStorage(env: GateEnvironment, kind: 'localStorage' | 'sessionStorage'): Storage | undefined {
  try {
    return env.window[kind];
  } catch {
    return undefined;
  }
}

/** Sets PostHog's session recording through its stub methods. They queue safely before the SDK loads. */
function setPostHogReplay(env: GateEnvironment, enabled: boolean): void {
  try {
    const posthog = (env.window as unknown as { posthog?: PostHogReplayApi }).posthog;
    if (enabled) {
      posthog?.set_config?.({ disable_session_recording: false });
      posthog?.startSessionRecording?.();
    } else {
      posthog?.set_config?.({ disable_session_recording: true });
      posthog?.stopSessionRecording?.();
    }
  } catch {
    // The SDK's stub may be absent in a test page; nothing to change.
  }
}

interface PostHogReplayApi {
  set_config?: (config: object) => void;
  startSessionRecording?: () => void;
  stopSessionRecording?: () => void;
}

/** The provider table. `stopInPlace` is true only where the SDK's stop call is verified; otherwise withdrawal reloads. */
interface ProviderSpec {
  /** Whether withdrawal may leave the page as it is. False means the gate reloads after persisting the denial. */
  stopInPlace: boolean;
  start(env: GateEnvironment, descriptors: ProviderDescriptors, options: { replay: ReplayMode }): void;
  stop(env: GateEnvironment, descriptors: ProviderDescriptors): void;
  /** Turns a held replay on after an explicit grant. Only PostHog has replay. */
  enableReplay?(env: GateEnvironment): void;
}

const TABLE: Record<GateProvider, ProviderSpec> = {
  googleAnalytics: {
    stopInPlace: false,
    start(env, descriptors) {
      const id = descriptors.googleAnalytics?.measurementId;
      if (!id) return;
      injectScript(env, { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}` }, () => {
        const win = env.window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
        win.dataLayer = win.dataLayer ?? [];
        win.gtag = function gtag(...args: unknown[]) {
          (win.dataLayer as unknown[]).push(args);
        };
        win.gtag('js', new Date());
        win.gtag('config', id);
      });
    },
    stop(env, descriptors) {
      const id = descriptors.googleAnalytics?.measurementId;
      if (!id) return;
      (env.window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true;
      const bare = id.replace(/^G-/u, '');
      for (const name of cookieNames(env)) {
        if (name === '_ga' || name === `_ga_${bare}`) expireCookie(env, name);
      }
    },
  },
  fiftyOneLa: {
    stopInPlace: false,
    start(env, descriptors) {
      const siteId = descriptors.fiftyOneLa?.siteId;
      if (!siteId) return;
      injectScript(env, { charset: 'UTF-8', id: 'LA_COLLECT', src: 'https://sdk.51.la/js-sdk-pro.min.js' }, () => {
        const la = (env.window as unknown as { LA?: { init: (options: object) => void } }).LA;
        // No screenRecord: 51LA records no screen and has no session replay.
        la?.init({ id: siteId, ck: siteId, autoTrack: true, hashMode: true });
      });
    },
    stop() {
      // No stop API is known for 51LA. The gate reloads after the denial is persisted, and never starts it while denied.
    },
  },
  posthog: {
    stopInPlace: false,
    start(env, descriptors, options) {
      const ph = descriptors.posthog;
      if (!ph) return;
      // A previous opt-out would keep capture off after the grant, so the stored opt-out state is cleared first.
      removeStorageKey(safeStorage(env, 'localStorage'), `__ph_opt_in_out_${ph.apiKey}`);
      injectInline(env, ph.loader);
      // Replay is switched off right after the loader runs, in the same frame, so the queued calls precede the SDK.
      if (options.replay === 'off') setPostHogReplay(env, false);
      for (const hook of postGrantHooks) {
        try {
          hook();
        } catch {
          // A failing hook must not stop the others.
        }
      }
    },
    enableReplay(env) {
      setPostHogReplay(env, true);
    },
    stop(env) {
      try {
        const posthog = (env.window as unknown as { posthog?: { opt_out_capturing?: () => void } }).posthog;
        posthog?.opt_out_capturing?.();
      } catch {
        // The SDK may not have loaded.
      }
      for (const name of cookieNames(env)) {
        if (name.startsWith('ph_')) expireCookie(env, name);
      }
      removePrefixedStorage(safeStorage(env, 'localStorage'), 'ph_');
      removePrefixedStorage(safeStorage(env, 'sessionStorage'), 'ph_');
    },
  },
};

function removeStorageKey(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage blocked.
  }
}

export interface ConsentGate {
  /** The providers this document has started, in the order they started. */
  started(): readonly GateProvider[];
  /** Why the providers started, or undefined before any start. */
  startReason(): StartReason | undefined;
  /** Removes the subscriptions. It does not stop providers that are already running. */
  dispose(): void;
}

/**
 * Starts enabled providers and stops them on withdrawal. A provider starts at most once per document, and nothing
 * starts while the decision is denied. An explicit record starts providers without waiting for the region. An
 * undecided visitor starts providers only when the region decision is `notRequired`, and then writes no record. The
 * region decision is awaited only for an undecided visitor. Withdrawal stops each started provider, then reloads if
 * any of them cannot stop in place.
 */
export function installConsentGate(
  env: GateEnvironment,
  consent: ConsentApi = moduleConsentApi,
  region: RegionSource = pageRegionSource({ holder: env.window as unknown as RegionHolder }),
): ConsentGate {
  /** Providers running now. Withdrawal empties it. */
  const startedOrder: GateProvider[] = [];
  /** Providers ever started in this document. A provider starts at most once per document, even after a withdrawal. */
  const everStarted = new Set<GateProvider>();
  /** PostHog started with replay off and has not been granted replay yet. */
  let replayHeld = false;
  let reason: StartReason | undefined;
  let descriptors: ProviderDescriptors = readDescriptors(env.document);

  const startAll = (why: StartReason, replay: ReplayMode): void => {
    for (const provider of PROVIDERS) {
      if (everStarted.has(provider) || !descriptors[provider]) continue;
      everStarted.add(provider);
      startedOrder.push(provider);
      reason ??= why;
      if (provider === 'posthog' && replay === 'off') replayHeld = true;
      TABLE[provider].start(env, descriptors, { replay });
    }
  };

  const stopAll = (): void => {
    let needsReload = false;
    for (const provider of startedOrder) {
      TABLE[provider].stop(env, descriptors);
      if (!TABLE[provider].stopInPlace) needsReload = true;
    }
    startedOrder.length = 0;
    replayHeld = false;
    if (needsReload) env.reload();
  };

  /** An explicit grant turns on a replay that was held, unless the site set replay to stay off. */
  const enableHeldReplay = (): void => {
    if (!replayHeld || !startedOrder.includes('posthog') || consent.sessionReplay?.() === 'off') return;
    replayHeld = false;
    TABLE.posthog.enableReplay?.(env);
  };

  const apply = (state: ConsentState): void => {
    if (state.analytics === 'granted') {
      startAll('consent', 'project');
      enableHeldReplay();
    } else if (state.analytics === 'denied' && startedOrder.length > 0) {
      stopAll();
    }
  };

  /** A `notRequired` decision starts the providers only for a visitor with no record. Other decisions do nothing. */
  const applyRegion = (decision: RegionDecision): void => {
    if (decision !== 'notRequired') return;
    if (consent.getConsent().analytics !== 'undecided') return;
    startAll('region', consent.sessionReplay?.() === 'projectDefault' ? 'project' : 'off');
  };

  const unsubscribe = consent.onConsentChange(apply);
  apply(consent.getConsent());
  const unsubscribeRegion = region.subscribe(applyRegion);
  return {
    started: () => [...startedOrder],
    startReason: () => reason,
    dispose: () => {
      unsubscribe();
      unsubscribeRegion();
    },
  };
}

/** Installs the gate once per page, reading the real window and document. A second call returns the first gate. */
export function mountConsentGate(win: Window = window, doc: Document = document): ConsentGate {
  const holder = win as unknown as { __hagilightConsentGate?: ConsentGate };
  if (holder.__hagilightConsentGate) return holder.__hagilightConsentGate;
  const gate = installConsentGate({ window: win, document: doc, reload: () => win.location.reload() });
  holder.__hagilightConsentGate = gate;
  return gate;
}
