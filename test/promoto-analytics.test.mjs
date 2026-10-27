import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  PROMOTO_IMPRESSION_DELAY_MS,
  capturePromoto,
  createPromotoAnalytics,
} from '../packages/core/dist/promoto-analytics.js';
import { POSTHOG_EVENTS } from '../packages/core/dist/posthog-events.js';

// A fake clock: timers fire only when `advance` moves time past their due time.
function fakeClock() {
  let now = 0;
  let pending = [];
  return {
    timers: {
      now: () => now,
      setTimeout(callback, delayMs) {
        const handle = { callback, due: now + delayMs, cancelled: false };
        pending.push(handle);
        return handle;
      },
      clearTimeout(handle) {
        if (handle) handle.cancelled = true;
      },
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = pending.filter((handle) => !handle.cancelled && handle.due <= target)
          .sort((a, b) => a.due - b.due)[0];
        if (!due) break;
        pending = pending.filter((handle) => handle !== due);
        now = due.due;
        due.callback();
      }
      now = target;
    },
  };
}

function recorder() {
  const calls = [];
  return { calls, report: (event, input) => calls.push([event, input]) };
}

function loadedPostHog(overrides = {}) {
  const calls = [];
  return {
    calls,
    __loaded: true,
    has_opted_out_capturing: () => false,
    capture: (event, properties) => calls.push([event, properties]),
    ...overrides,
  };
}

test('no impression before one second, exactly one after, and none on repeat visibility', () => {
  const clock = fakeClock();
  const log = recorder();
  const analytics = createPromotoAnalytics({ timers: clock.timers, rotating: () => true, report: log.report });

  analytics.show({ promoId: 'omniroute', position: 2 });
  clock.advance(PROMOTO_IMPRESSION_DELAY_MS - 1);
  assert.equal(log.calls.length, 0);
  clock.advance(1);
  assert.deepEqual(log.calls, [['promoto_impression', { promo_id: 'omniroute', position: 2, rotating: true }]]);

  analytics.show(undefined);
  analytics.show({ promoId: 'omniroute', position: 2 });
  clock.advance(5000);
  assert.equal(log.calls.length, 1, 'a promotion already reported on this page is not reported again');
});

test('hiding before one second cancels the attempt, and it restarts from zero when visible again', () => {
  const clock = fakeClock();
  const log = recorder();
  const analytics = createPromotoAnalytics({ timers: clock.timers, report: log.report });

  analytics.show({ promoId: 'a', position: 1 });
  clock.advance(600);
  analytics.show(undefined);
  clock.advance(5000);
  assert.equal(log.calls.length, 0);

  analytics.show({ promoId: 'a', position: 1 });
  clock.advance(999);
  assert.equal(log.calls.length, 0, 'the wait starts again, not where it stopped');
  clock.advance(1);
  assert.equal(log.calls.length, 1);
});

test('a running wait survives repeated visibility updates for the same promotion', () => {
  const clock = fakeClock();
  const log = recorder();
  const analytics = createPromotoAnalytics({ timers: clock.timers, report: log.report });

  analytics.show({ promoId: 'a', position: 1 });
  clock.advance(500);
  analytics.show({ promoId: 'a', position: 1 });
  clock.advance(500);
  assert.equal(log.calls.length, 1, 'the timer started at the first show, not the second');
});

test('rotating away cancels the pending impression of the previous promotion', () => {
  const clock = fakeClock();
  const log = recorder();
  const analytics = createPromotoAnalytics({ timers: clock.timers, report: log.report });

  analytics.show({ promoId: 'a', position: 1 });
  clock.advance(400);
  analytics.show({ promoId: 'b', position: 2 });
  clock.advance(600);
  assert.deepEqual(log.calls.map(([, input]) => input.promo_id), [], 'a had only 400 ms');
  clock.advance(400);
  assert.deepEqual(log.calls.map(([, input]) => input.promo_id), ['b']);
});

test('a new page key allows a new impression of the same promotion', () => {
  const clock = fakeClock();
  const log = recorder();
  const analytics = createPromotoAnalytics({ timers: clock.timers, report: log.report });

  analytics.show({ promoId: 'a', position: 1 });
  clock.advance(1000);
  analytics.resetPage();
  analytics.show({ promoId: 'a', position: 1 });
  clock.advance(1000);
  assert.equal(log.calls.length, 2);
});

test('dismissal reports the dismissed promotion, the time since it first appeared and the distinct count', () => {
  const clock = fakeClock();
  const log = recorder();
  const analytics = createPromotoAnalytics({ timers: clock.timers, report: log.report });

  analytics.show({ promoId: 'a', position: 1 });
  clock.advance(5000);
  analytics.show({ promoId: 'b', position: 2 });
  clock.advance(2000);
  assert.deepEqual(analytics.dismissed('b'), { visible_ms: 2000, seen_count: 2 });
});

test('dismissing before the impression delay sends no impression for that promotion', () => {
  const clock = fakeClock();
  const log = recorder();
  const analytics = createPromotoAnalytics({ timers: clock.timers, report: log.report });

  analytics.show({ promoId: 'c', position: 1 });
  clock.advance(500);
  analytics.dismissed('c');
  clock.advance(5000);
  assert.equal(log.calls.length, 0);
});

test('a dismissal payload is sanitized and captured through the guarded helper', () => {
  const clock = fakeClock();
  const analytics = createPromotoAnalytics({ timers: clock.timers });
  const posthog = loadedPostHog();

  analytics.show({ promoId: 'b', position: 2 });
  clock.advance(1500);
  capturePromoto('promoto_dismissed', { promo_id: 'b', ...analytics.dismissed('b') }, posthog);
  assert.deepEqual(posthog.calls, [['promoto_dismissed', { promo_id: 'b', visible_ms: 1500, seen_count: 1 }]]);
});

test('a throwing capture never escapes the helper', () => {
  const posthog = loadedPostHog({ capture: () => { throw new Error('network'); } });
  assert.doesNotThrow(() => capturePromoto('promoto_paged', { from: 1, to: 2, method: 'click' }, posthog));
  assert.doesNotThrow(() => capturePromoto('promoto_dismissed', { promo_id: 'x', visible_ms: 1, seen_count: 1 }, {
    __loaded: true,
    has_opted_out_capturing: () => { throw new Error('boom'); },
    capture() {},
  }));
});

test('paging events carry from, to and method, and the vocabulary allowlists exactly those properties', () => {
  const posthog = loadedPostHog();
  capturePromoto('promoto_paged', { from: 3, to: 1, method: 'click', extra: 'dropped' }, posthog);
  capturePromoto('promoto_paged', { from: 1, to: 2, method: 'auto' }, posthog);
  assert.deepEqual(posthog.calls, [
    ['promoto_paged', { from: 3, to: 1, method: 'click' }],
    ['promoto_paged', { from: 1, to: 2, method: 'auto' }],
  ]);
  assert.deepEqual(POSTHOG_EVENTS.promoto_impression, ['promo_id', 'position', 'rotating']);
  assert.deepEqual(POSTHOG_EVENTS.promoto_dismissed, ['promo_id', 'visible_ms', 'seen_count']);
  assert.deepEqual(POSTHOG_EVENTS.promoto_paged, ['from', 'to', 'method']);
});

test('nothing is sent when PostHog is absent, not loaded, or the visitor opted out, and nothing is queued', () => {
  const event = ['promoto_paged', { from: 1, to: 2, method: 'click' }];
  assert.doesNotThrow(() => capturePromoto(...event, undefined));

  const stub = { capture: (...args) => stub.queued.push(args), queued: [] };
  capturePromoto(...event, stub);
  assert.deepEqual(stub.queued, [], 'a stub that has not loaded is not sent to, so nothing replays later');

  const optedOut = loadedPostHog({ has_opted_out_capturing: () => true });
  capturePromoto(...event, optedOut);
  assert.deepEqual(optedOut.calls, []);

  const loaded = loadedPostHog();
  capturePromoto(...event, loaded);
  assert.equal(loaded.calls.length, 1);
});

test('an unloaded PostHog gets no impression, even after the delay', () => {
  const clock = fakeClock();
  const analytics = createPromotoAnalytics({ timers: clock.timers });
  analytics.show({ promoId: 'a', position: 1 });
  assert.doesNotThrow(() => clock.advance(PROMOTO_IMPRESSION_DELAY_MS));
});

test('the banner keeps its behavior: reduced motion sends no automatic paging and the paging and dismissal calls stay contained', async () => {
  const source = await readFile(new URL('../packages/core/src/promoto-banner.ts', import.meta.url), 'utf8');

  assert.match(source, /private readonly onPrevious = \(\) => this\.move\(-1, 'click'\);/u);
  assert.match(source, /private readonly onNext = \(\) => this\.move\(1, 'click'\);/u);
  assert.match(source, /if \(event\.target === event\.currentTarget\) this\.move\(1, 'auto'\);/u);
  assert.match(source, /if \(method === 'auto' && this\.reducedMotion\) return;/u);
  // Pausing toggles rotation and never reaches the paging call.
  assert.doesNotMatch(source.slice(source.indexOf('private readonly onPause'), source.indexOf('private readonly onDismiss')), /move\(/u);
  // The dismissal event is captured before the existing signature save, and only after the duplicate guard.
  const dismiss = source.slice(source.indexOf('private readonly onDismiss'), source.indexOf('// The progress line'));
  assert.ok(dismiss.indexOf('if (!signature || this.dismissing) return;') < dismiss.indexOf('this.trackDismissal();'));
  assert.ok(dismiss.indexOf('this.trackDismissal();') < dismiss.indexOf('this.dismissedSignature = signature;'));
  // The tracker never throws into the banner.
  assert.match(source, /private syncImpressions\(\): void \{\s*try \{/u);
  assert.match(source, /private trackDismissal\(\): void \{\s*try \{/u);
});
