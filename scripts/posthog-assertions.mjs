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

/**
 * Checks one built page. `framework` is the `site_framework` the page must register; `pageType`, when given,
 * is the page type it must carry in its site context.
 */
export function verifyPostHog(html, label, { framework, pageType } = {}) {
  const scripts = executableScripts(html);
  const head = executableScripts(html.slice(0, html.indexOf('</head>')));
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
