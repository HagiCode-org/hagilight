import assert from 'node:assert/strict';
import { DEFAULT_POSTHOG_API_KEY, POSTHOG_API_HOST, POSTHOG_DEFAULTS } from '@hagicode/hagilight-core/posthog';

export function executableScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)]
    .filter(([, attrs]) => {
      const type = attrs.match(/\btype=["']([^"']*)["']/iu)?.[1];
      return !type || /^(?:module|(?:text|application)\/javascript)$/iu.test(type);
    })
    .map(([, , body]) => body).join('\n');
}

export function verifyPostHog(html, label) {
  const scripts = executableScripts(html);
  const head = executableScripts(html.slice(0, html.indexOf('</head>')));
  const initialization = /\bposthog\.init\s*\(/gu;
  assert.equal([...scripts.matchAll(initialization)].length, 1, `${label} initializes PostHog once`);
  assert.equal([...head.matchAll(initialization)].length, 1, `${label} initializes PostHog in the head`);
  for (const value of [DEFAULT_POSTHOG_API_KEY, POSTHOG_API_HOST, POSTHOG_DEFAULTS]) {
    assert.ok(head.includes(value), `${label} uses ${value}`);
  }
}
