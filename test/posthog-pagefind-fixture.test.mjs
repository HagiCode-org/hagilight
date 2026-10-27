/*
 * Fixture test for the Pagefind result count (task 3.1).
 *
 * Count source: the DOM total, read as the first number of the settled `.pagefind-ui__message` after the query
 * text is removed. The message is localized but its number is not, and the read needs no second index load, so
 * the Pagefind JS API is not used. A search whose message has no number is zero results only when the list is empty.
 *
 * Fixtures: `zero-results.html` and `settled-one-result.html` are recorded from the built Starlight demo
 * (examples/demo-starlight-web, de-DE) in headless Chromium, with Pagefind 1.x markup. The demo's index has no
 * query that returns 12 results, so `synthetic-twelve-results.html` is the recorded one-result page with its message
 * changed to "12 results"; it checks that the parse reads a larger number, not that a real 12-result page was captured.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readResultsCount } from '@hagicode/hagilight-core/posthog-interactions';

const fixture = (name) => readFileSync(new URL(`./fixtures/pagefind/${name}`, import.meta.url), 'utf8');

/** A read-only view of a fixture page with the two selectors the count uses. */
function domOf(html) {
  const message = html.match(/<p class="pagefind-ui__message[^"]*">([^<]*)<\/p>/u)?.[1];
  const links = [...html.matchAll(/<a class="pagefind-ui__result-link[^"]*"/gu)].map(() => ({}));
  return {
    querySelector: (selector) => (selector === '.pagefind-ui__message' && message !== undefined ? { textContent: message } : null),
    querySelectorAll: (selector) => (selector === 'a.pagefind-ui__result-link' ? links : []),
  };
}

test('a recorded zero-result page reads 0, and the query text is never counted', () => {
  assert.equal(readResultsCount(domOf(fixture('zero-results.html')), 'zzqqxxnoresult'), 0);
});

test('a recorded one-result page reads 1 from the message, not from the rendered sub-links', () => {
  const dom = domOf(fixture('settled-one-result.html'));
  assert.equal(readResultsCount(dom, 'install'), 1);
});

test('a total with more than one digit is read whole (synthetic, from the recorded template)', () => {
  assert.equal(readResultsCount(domOf(fixture('synthetic-twelve-results.html')), 'install'), 12);
});

test('an unreadable message with rendered links is unknown rather than zero', () => {
  const html = fixture('settled-one-result.html').replace('1 result for install', 'Searching');
  assert.equal(readResultsCount(domOf(html), 'install'), undefined);
});
