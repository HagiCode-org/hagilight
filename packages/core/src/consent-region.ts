/**
 * Region decision (`@hagicode/hagilight-core/consent-region`). It answers one question for the visitor: does this
 * visitor need an analytics decision before providers start? The answer is one of `required`, `notRequired` or
 * `unknown`. Every consumer treats `unknown` exactly like `required`, so a visitor whose location cannot be identified
 * gets the consent popup and no provider.
 *
 * Sources are consulted in a fixed order: the site's `countryCode`, the site's `regionHook`, the same-origin
 * `/cdn-cgi/trace` endpoint (only its `loc` line), and a coarse time-zone fallback. The whole resolution is bounded by
 * a deadline that falls back to `required`. No visitor IP address leaves the page, and no location request goes to any
 * host other than the page's own origin. The module never throws and never writes storage.
 */

export type RegionDecision = 'required' | 'notRequired' | 'unknown';

/** `default` applies the built-in country set; an array replaces it entirely. Absent means regional behavior is off. */
export type RegionsOption = 'default' | readonly string[];

export interface RegionConfig {
  regions?: RegionsOption;
  /** An explicit ISO 3166-1 alpha-2 code. Present but invalid resolves to `unknown` without consulting other sources. */
  countryCode?: string;
  /** Resolved by name by the integration. A missing function yields `unknown` when it is called. */
  regionHook?: () => unknown;
}

/** Test seams. The page supplies the defaults from `pageRegionEnvironment()`. */
export interface RegionEnvironment {
  /** The page URL. Absent means there is no page, so a configured decision is `unknown`. */
  href?: string;
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  /** Returns the time-zone identifier. A throw or a non-string is treated as unreadable. */
  timeZone?: () => unknown;
  traceTimeoutMs?: number;
  deadlineMs?: number;
  /** Where the once-per-document resolution is stored. The page uses `window`. */
  holder?: RegionHolder;
}

export interface RegionHolder {
  __hagilightRegion?: RegionShared;
}

interface RegionShared {
  decision?: RegionDecision;
  promise?: Promise<RegionDecision>;
  listeners: Set<(decision: RegionDecision) => void>;
}

export interface RegionSource {
  /** The decision, or `pending` until resolution completes. */
  current(): RegionDecision | 'pending';
  /** Calls `listener` once the decision exists, immediately when it already does. Returns an unsubscribe function. */
  subscribe(listener: (decision: RegionDecision) => void): () => void;
}

export const TRACE_PATH = '/cdn-cgi/trace';
/** Abandons the trace request early so the time-zone fallback still runs before the deadline. */
export const TRACE_TIMEOUT_MS = 1200;
/** The trace body is read only this far. The real body is a few hundred bytes. */
export const TRACE_MAX_BYTES = 4096;
/** The whole resolution. A hung source leaves the decision at `required` when this passes. */
export const RESOLUTION_DEADLINE_MS = 1800;

/** The default consent-required set: EU27, EEA (IS, LI, NO), GB, CH and BR. A product configuration, not a legal finding. */
export const DEFAULT_REQUIRED_COUNTRIES: readonly string[] = Object.freeze([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH', 'BR',
]);

/** Officially assigned ISO 3166-1 alpha-2 codes. User-assigned or reserved codes such as XX, T1 or QQ are not listed. */
const ASSIGNED_COUNTRY_CODES: ReadonlySet<string> = new Set(
  (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '
    + 'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '
    + 'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO '
    + 'JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR '
    + 'MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO '
    + 'RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV '
    + 'TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
  ).split(' '),
);

const COUNTRY_CODE = /^[A-Z]{2}$/u;

/** True only for an upper-case, officially assigned ISO 3166-1 alpha-2 code. */
export function isAssignedCountryCode(value: unknown): value is string {
  return typeof value === 'string' && COUNTRY_CODE.test(value) && ASSIGNED_COUNTRY_CODES.has(value);
}

/** The country set a configuration selects. An absent or `default` option uses the built-in set. */
export function requiredCountrySet(regions: RegionsOption | undefined): ReadonlySet<string> {
  if (regions === undefined || regions === 'default') return new Set(DEFAULT_REQUIRED_COUNTRIES);
  return new Set(regions);
}

/** Maps a valid country to `required` or `notRequired` under the selected set. */
export function decisionForCountry(country: string, set: ReadonlySet<string>): RegionDecision {
  return set.has(country) ? 'required' : 'notRequired';
}

const EUROPE_AND_EXCEPTIONS: ReadonlySet<string> = new Set([
  'Atlantic/Reykjavik', 'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Faroe', 'Africa/Ceuta',
  'Arctic/Longyearbyen', 'Asia/Nicosia', 'Asia/Famagusta', 'Asia/Istanbul',
  // Brazilian zones.
  'America/Sao_Paulo', 'America/Bahia', 'America/Manaus', 'America/Fortaleza', 'America/Belem', 'America/Recife',
  'America/Cuiaba', 'America/Campo_Grande', 'America/Noronha', 'America/Porto_Velho', 'America/Rio_Branco',
  'America/Boa_Vista', 'America/Araguaina', 'America/Maceio', 'America/Santarem', 'America/Eirunepe',
  // French outermost regions.
  'America/Martinique', 'America/Guadeloupe', 'America/Cayenne', 'America/Marigot', 'America/St_Barthelemy',
  'Indian/Reunion', 'Indian/Mayotte',
]);

/**
 * The time-zone fallback. Europe and the listed EU/EEA/Brazil/French-territory zones require consent. Other Americas,
 * Asia, Australia and Pacific zones do not. Anything else, including UTC, an empty or missing identifier and an
 * unreadable clock, is `unknown`, which requires consent.
 */
export function classifyTimeZone(timeZone: unknown): RegionDecision {
  if (typeof timeZone !== 'string' || timeZone.length === 0) return 'unknown';
  if (timeZone.startsWith('Europe/') || EUROPE_AND_EXCEPTIONS.has(timeZone)) return 'required';
  if (['America/', 'Asia/', 'Australia/', 'Pacific/'].some((prefix) => timeZone.startsWith(prefix))) return 'notRequired';
  return 'unknown';
}

/** Reads the `loc` line of a trace body. Only that line is used. The IP line is never returned. */
export function parseTraceCountry(body: string): string | undefined {
  for (const line of body.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('loc=')) continue;
    const value = trimmed.slice('loc='.length);
    return isAssignedCountryCode(value) ? value : undefined;
  }
  return undefined;
}

/** Reads at most `limit` bytes of a response body and then stops the stream. */
async function readCapped(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader?.();
  if (!reader) return (await response.text()).slice(0, limit);
  const decoder = new TextDecoder();
  let text = '';
  let received = 0;
  while (received < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value.subarray(0, limit - received);
    received += chunk.byteLength;
    text += decoder.decode(chunk, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return text + decoder.decode();
}

/** One same-origin trace request with credentials omitted and no cache. Any failure yields no country. */
async function readTraceCountry(env: RegionEnvironment): Promise<string | undefined> {
  if (!env.href || typeof env.fetch !== 'function') return undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.traceTimeoutMs ?? TRACE_TIMEOUT_MS);
  try {
    const url = new URL(TRACE_PATH, env.href);
    const response = await env.fetch(url.href, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    return parseTraceCountry(await readCapped(response, TRACE_MAX_BYTES));
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function readTimeZone(env: RegionEnvironment): unknown {
  try {
    if (env.timeZone) return env.timeZone();
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * Adapts a custom hook result. A state is taken as it is, a boolean maps to `notRequired` for `false` and `required`
 * for `true`, and anything else is `unknown`. A throw or a rejected promise is `unknown`.
 */
export function adaptHookValue(value: unknown): RegionDecision {
  if (value === 'required' || value === 'notRequired' || value === 'unknown') return value;
  if (value === false) return 'notRequired';
  if (value === true) return 'required';
  return 'unknown';
}

async function hookDecision(hook: () => unknown): Promise<RegionDecision> {
  try {
    return adaptHookValue(await hook());
  } catch {
    return 'unknown';
  }
}

async function decideFromSources(config: RegionConfig, env: RegionEnvironment): Promise<RegionDecision> {
  const set = requiredCountrySet(config.regions);
  if (config.countryCode !== undefined) {
    return isAssignedCountryCode(config.countryCode) ? decisionForCountry(config.countryCode, set) : 'unknown';
  }
  if (typeof config.regionHook === 'function') return hookDecision(config.regionHook);
  const country = await readTraceCountry(env);
  if (country !== undefined) return decisionForCountry(country, set);
  return classifyTimeZone(readTimeZone(env));
}

/**
 * Resolves one visitor's decision. Without a regional configuration or a hook the answer is `required` with no request and no time
 * read. Without a page URL or `fetch`, a configured decision is `unknown`. Otherwise the sources run, bounded by the
 * deadline, which resolves to `required`. A late source answer does not change the result. The function never rejects.
 */
export async function resolveRegionDecision(config: RegionConfig, env: RegionEnvironment = pageRegionEnvironment()): Promise<RegionDecision> {
  try {
    if (config.regions === undefined && config.regionHook === undefined) return 'required';
    if (!env.href || typeof env.fetch !== 'function') return 'unknown';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<RegionDecision>((resolve) => {
      timer = setTimeout(() => resolve('required'), env.deadlineMs ?? RESOLUTION_DEADLINE_MS);
    });
    try {
      return await Promise.race([decideFromSources(config, env).catch((): RegionDecision => 'unknown'), deadline]);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return 'unknown';
  }
}

/** The page environment: the page URL, `window.fetch` and `window` as the once-per-document holder. Empty without a window. */
export function pageRegionEnvironment(): RegionEnvironment {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return {};
    return {
      href: window.location.href,
      fetch: (input, init) => window.fetch(input, init),
      holder: window as unknown as RegionHolder,
    };
  } catch {
    return {};
  }
}

const moduleHolder: RegionHolder = {};

function sharedState(env: RegionEnvironment): RegionShared {
  const holder = env.holder ?? moduleHolder;
  if (!holder.__hagilightRegion) holder.__hagilightRegion = { listeners: new Set() };
  return holder.__hagilightRegion;
}

/**
 * Starts the resolution at most once per document and returns its promise. Later calls, including from another bundle
 * on the same page, share the first one. The decision is announced to listeners exactly once.
 */
export function startRegionResolution(config: RegionConfig, env: RegionEnvironment = pageRegionEnvironment()): Promise<RegionDecision> {
  const state = sharedState(env);
  if (!state.promise) {
    state.promise = resolveRegionDecision(config, env).then((decision) => {
      if (state.decision === undefined) {
        state.decision = decision;
        for (const listener of [...state.listeners]) {
          try {
            listener(decision);
          } catch {
            // One failing listener must not stop the others.
          }
        }
      }
      return state.decision;
    });
  }
  return state.promise;
}

/** The decision, or `pending` until resolution completes or when it was never started. */
export function getRegionDecision(env: RegionEnvironment = pageRegionEnvironment()): RegionDecision | 'pending' {
  try {
    return sharedState(env).decision ?? 'pending';
  } catch {
    return 'pending';
  }
}

/** Calls `listener` with the decision: now when it exists, otherwise once it resolves. Returns an unsubscribe function. */
export function onRegionDecision(listener: (decision: RegionDecision) => void, env: RegionEnvironment = pageRegionEnvironment()): () => void {
  try {
    if (typeof listener !== 'function') return () => {};
    const state = sharedState(env);
    if (state.decision !== undefined) {
      listener(state.decision);
      return () => {};
    }
    state.listeners.add(listener);
    return () => {
      state.listeners.delete(listener);
    };
  } catch {
    return () => {};
  }
}

/** The page-backed source the gate and the popup read. It has no state of its own. */
export function pageRegionSource(env: RegionEnvironment = pageRegionEnvironment()): RegionSource {
  return {
    current: () => getRegionDecision(env),
    subscribe: (listener) => onRegionDecision(listener, env),
  };
}
