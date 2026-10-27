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
