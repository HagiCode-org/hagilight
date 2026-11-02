import assert from 'node:assert/strict';
import {
  DEFAULT_POSTHOG_API_KEY,
  POSTHOG_API_HOST,
  POSTHOG_DEFAULTS,
  POSTHOG_PERSON_PROFILES,
  POSTHOG_UI_HOST,
} from '@hagicode/hagilight-core/posthog';
import { POSTHOG_SUPER_PROPERTIES } from '@hagicode/hagilight-core/posthog-events';

export function executableScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)]
    .filter(([, attrs]) => {
      const type = attrs.match(/\btype=["']([^"']*)["']/iu)?.[1];
      return !type || /^(?:module|(?:text|application)\/javascript)$/iu.test(type);
    })
    .map(([, , body]) => body).join('\n');
}

const CONSENT_DESCRIPTOR = /<script\b[^>]*data-hagilight-analytics="posthog"[^>]*>([\s\S]*?)<\/script>/giu;

/**
 * The PostHog loader text a markup fragment carries: its executable scripts, plus the loader inside a consent
 * descriptor. A consent-gated page ships the same unchanged loader there, inert until the visitor grants consent.
 */
// The plain-Astro head inserts its descriptors with one inline script: a single-quoted string literal passed to insertAdjacentHTML.
const INSERTED_MARKUP = /insertAdjacentHTML\('beforeend',\s*('(?:[^'\\]|\\.)*')\)/gu;

function insertedMarkup(html) {
  // The literal is a string constant written by the integration, so evaluating it only decodes that string.
  return [...html.matchAll(INSERTED_MARKUP)].map(([, literal]) => Function(`return ${literal};`)());
}

function loaderSources(html) {
  const executable = executableScripts(html).replace(INSERTED_MARKUP, '');
  const descriptors = [html, ...insertedMarkup(html)]
    .flatMap((markup) => [...markup.matchAll(CONSENT_DESCRIPTOR)].map(([, body]) => JSON.parse(body).loader));
  return [executable, ...descriptors].join('\n');
}

/**
 * Checks one built page. `framework` is the `site_framework` the page must register; `pageType`, when given,
 * is the page type it must carry in its site context.
 */
export function verifyPostHog(html, label, { framework, pageType } = {}) {
  const scripts = loaderSources(html);
  const head = loaderSources(html.slice(0, html.indexOf('</head>')));
  const initialization = /\bposthog\.init\s*\(/gu;
  assert.equal([...scripts.matchAll(initialization)].length, 1, `${label} initializes PostHog once`);
  assert.equal([...head.matchAll(initialization)].length, 1, `${label} initializes PostHog in the head`);
  for (const value of [DEFAULT_POSTHOG_API_KEY, POSTHOG_API_HOST, POSTHOG_UI_HOST, POSTHOG_DEFAULTS, POSTHOG_PERSON_PROFILES]) {
    assert.ok(head.includes(value), `${label} uses ${value}`);
  }
  // Minifiers write `true` as `!0` and drop key quotes, so both spellings are accepted.
  assert.equal([...head.matchAll(/"?capture_exceptions"?:(?:true|!0)/gu)].length, 1, `${label} enables exception capture once`);
  assert.equal([...head.matchAll(/\bposthog\.register\(/gu)].length, 1, `${label} registers its super properties once`);
  for (const property of POSTHOG_SUPER_PROPERTIES) {
    assert.ok(head.includes(`${property}:`), `${label} registers ${property}`);
  }
  // The site context is the object literal that names the framework; minified heads drop its key quotes.
  const context = head.match(/\{[^{}]*(?:"framework"|\bframework):"[^"]*"[^{}]*\}/u)?.[0];
  assert.ok(context, `${label} carries a site context`);
  assert.doesNotMatch(context, /https?:|[\/?#]/u, `${label} sends no URL, path, query or hash in its context`);
  if (framework !== undefined) assert.match(context, new RegExp(`"?framework"?:"${framework}"`, 'u'), `${label} registers site_framework ${framework}`);
  if (pageType !== undefined) assert.match(context, new RegExp(`"?pageType"?:"${pageType}"`, 'u'), `${label} registers page_type ${pageType}`);
}

const PROMOTO_EVENT_NAMES = ['promoto_impression', 'promoto_dismissed', 'promoto_paged'];

/**
 * The promotion banner ships the dismiss control, the per-slide promotion id and the three events.
 * Slides are created at run time, so the id and the events are checked in the bundled scripts and the
 * dismiss control in the markup. `text` is the built page and bundle text, concatenated.
 */
export function verifyPromotoAnalytics(text, label) {
  assert.ok(text.includes('data-promoto-dismiss'), `${label} ships the promotion dismiss control`);
  assert.ok(text.includes('promotoId'), `${label} ships the per-slide promotion id`);
  for (const name of PROMOTO_EVENT_NAMES) assert.ok(text.includes(name), `${label} ships ${name}`);
}

/**
 * Consent checks for one built page. With consent on, a page carries one popup and no executable provider loader;
 * the providers sit in inert descriptors. With consent off (`enabled: false`), it carries no popup or consent config.
 * Starlight's popup is static markup; the plain-Astro integration mounts its popup at run time, so a page without the
 * static markup is accepted when it carries the consent config.
 */
export function verifyConsentPage(html, label, { enabled }) {
  const popups = [...html.matchAll(/<section\b[^>]*\bdata-hagilight-consent\b/giu)].length;
  const config = html.includes('id="hagilight-consent-config"') || html.includes('id=\\"hagilight-consent-config\\"') || html.includes('hagilight-consent-config');
  if (enabled) {
    assert.ok(popups <= 1, `${label} carries at most one consent popup`);
    assert.ok(config || popups === 1, `${label} carries the consent config or its popup`);
    assert.doesNotMatch(executableScripts(html), /<script[^>]+\bsrc="https:\/\/(?:www\.googletagmanager\.com\/gtag\/js|sdk\.51\.la\/js-sdk-pro\.min\.js)/u, `${label} loads no provider script before consent`);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc="https:\/\/(?:www\.googletagmanager\.com\/gtag\/js|sdk\.51\.la\/)/u, `${label} has no provider src`);
  } else {
    assert.equal(popups, 0, `${label} has no consent popup when consent is off`);
    assert.equal(config, false, `${label} has no consent config when consent is off`);
    assert.equal(html.includes('data-consent-preferences'), false, `${label} has no Cookie settings entry when consent is off`);
  }
}

const CONSENT_CONFIG_TAG = /<script\b([^>]*\bid="hagilight-consent-config"[^>]*)>([\s\S]*?)<\/script>/gu;
const REGIONAL_KEYS = ['mode', 'regions', 'countryCode', 'regionHook', 'settingsEntry', 'sessionReplay'];

/**
 * The parsed consent descriptor of one built page. It is read from the page and from the markup the plain-Astro head
 * inserts, where a page may carry a copy in both places. Every copy must be inert JSON and must agree on everything
 * but `locale`: the head copy is written once per site, so its locale is the default one, and the runtime reads the
 * page locale from `documentElement.lang`. The JSON never executes and is parsed here.
 */
export function readConsentDescriptor(html, label) {
  const tags = [html, ...insertedMarkup(html)].flatMap((markup) => [...markup.matchAll(CONSENT_CONFIG_TAG)]);
  assert.ok(tags.length >= 1, `${label} carries a consent descriptor`);
  const descriptors = tags.map(([, attrs, body]) => {
    assert.match(attrs, /\btype="application\/json"/u, `${label} keeps the consent descriptor inert JSON`);
    return JSON.parse(body);
  });
  const withoutLocale = ({ locale: _locale, ...rest }) => rest;
  for (const descriptor of descriptors) {
    assert.deepEqual(withoutLocale(descriptor), withoutLocale(descriptors[0]), `${label} copies of the consent descriptor agree`);
  }
  return descriptors[0];
}

/**
 * Checks the consent descriptor. `regional` is undefined for a global site, which must carry no regional key at all, or
 * the options the regional build was given. Defaults apply to the options a build leaves unset.
 */
export function verifyConsentDescriptor(descriptor, label, regional) {
  if (regional === undefined) {
    for (const key of REGIONAL_KEYS) assert.equal(key in descriptor, false, `${label} global descriptor has no ${key}`);
    return;
  }
  assert.equal(descriptor.mode, 'regional', `${label} descriptor mode is regional`);
  assert.deepEqual(descriptor.regions, regional.regions, `${label} descriptor lists the configured regions`);
  assert.equal(descriptor.settingsEntry, regional.settingsEntry, `${label} descriptor settingsEntry`);
  assert.equal(descriptor.sessionReplay, regional.sessionReplay, `${label} descriptor sessionReplay`);
  assert.equal(descriptor.countryCode, regional.countryCode, `${label} descriptor countryCode`);
  assert.equal(descriptor.regionHook, regional.regionHook, `${label} descriptor regionHook`);
}

function consentEntries(html, attribute) {
  return [...html.matchAll(/<[a-z][\w-]*\b[^>]*>/giu)]
    .map(([tag]) => tag)
    .filter((tag) => new RegExp(`\\s${attribute}(?:=|\\s|/?>)`, 'u').test(tag));
}

/**
 * Checks the footer entries and the popup's replay markup of one built page. A global page renders no regional entry and
 * no replay markup. A regional page renders the Cookie settings entry hidden, and the replay entry hidden as well when
 * session replay is opt-in; the replay section of the static popup follows the same option.
 */
export function verifyConsentEntries(html, label, regional) {
  const settings = consentEntries(html, 'data-consent-entry').filter((tag) => /\bdata-consent-entry="settings"/u.test(tag));
  const replay = consentEntries(html, 'data-consent-entry').filter((tag) => /\bdata-consent-entry="replay"/u.test(tag));
  const replayPopup = html.includes('data-hagilight-consent-replay');
  const staticPopup = /<section\b[^>]*\bdata-hagilight-consent\b/u.test(html);
  if (regional === undefined) {
    assert.equal(consentEntries(html, 'data-consent-entry').length, 0, `${label} renders no regional consent entry`);
    assert.equal(html.includes('data-consent-mode="replay"'), false, `${label} renders no replay entry`);
    assert.equal(replayPopup, false, `${label} renders no replay section in the popup`);
    return;
  }
  // A page without a consent footer, such as the RootTransit splash, renders no entry at all; that is allowed.
  if (!html.includes('data-consent-preferences')) {
    assert.equal(settings.length + replay.length, 0, `${label} renders no consent entry without a consent footer`);
    return;
  }
  assert.equal(settings.length, 1, `${label} renders one Cookie settings entry for the regional footer`);
  assert.match(settings[0], /\shidden(?=[\s>=])/u, `${label} hides the Cookie settings entry until the popup reveals it`);
  if (regional.sessionReplay === 'optIn') {
    assert.equal(replay.length, 1, `${label} renders one session replay entry`);
    assert.match(replay[0], /\bdata-consent-mode="replay"/u, `${label} marks the replay entry`);
    assert.match(replay[0], /\shidden(?=[\s>=])/u, `${label} hides the replay entry until the popup reveals it`);
  } else {
    assert.equal(replay.length, 0, `${label} renders no session replay entry`);
    assert.equal(html.includes('data-consent-mode="replay"'), false, `${label} renders no replay entry`);
  }
  // The popup is static markup on Starlight and Docusaurus pages; plain-Astro pages mount it at run time.
  if (staticPopup) assert.equal(replayPopup, regional.sessionReplay === 'optIn', `${label} replay section follows sessionReplay`);
}

/**
 * The search option reaches a built page only when it is not the default: `off` (or omitted) adds no config
 * line, and `zero-results` adds exactly one. The interaction observers ship in the bundled scripts, which the
 * browser step checks; here the markup must carry the option and nothing else.
 */
export function verifyPostHogInteractions(html, label, { searchQuery = 'off' } = {}) {
  const scripts = executableScripts(html);
  const configLines = [...scripts.matchAll(/window\.__hagilightPosthogConfig = /gu)].length;
  assert.equal(configLines, searchQuery === 'off' ? 0 : 1, `${label} carries the ${searchQuery} search option`);
  if (searchQuery === 'off') assert.doesNotMatch(scripts, /__hagilightPosthogConfig/u, `${label} omits the default search option`);
}
