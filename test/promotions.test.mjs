import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadActivePromotions,
  normalizeActivePromotions,
  parsePromotionContent,
  parsePromotionFlags,
  resolvePromotionDocumentUrls,
} from '@hagicode/hagilight-core/promotions';

function json(payload) {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
  });
}

test('falls back to canonical Index documents when catalog discovery fails', async () => {
  const requested = [];
  const fetchImpl = async (input) => {
    const url = input.toString();
    requested.push(url);
    if (url.endsWith('/index-catalog.json')) throw new Error('catalog unavailable');
    if (url.endsWith('/promote.json')) return json({ promotes: [] });
    if (url.endsWith('/promote_content.json')) return json({ contents: [] });
    throw new Error(`Unexpected URL: ${url}`);
  };

  assert.deepEqual(await resolvePromotionDocumentUrls(fetchImpl), {
    flagsUrl: 'https://index.hagicode.com/promote.json',
    contentUrl: 'https://index.hagicode.com/promote_content.json',
    source: 'fallback',
  });
  assert.deepEqual(await loadActivePromotions({ fetchImpl }), []);
  assert.ok(requested.includes('https://index.hagicode.com/promote.json'));
});

test('selects only active matched promotions with locale and image fallbacks', () => {
  const cards = normalizeActivePromotions(
    parsePromotionFlags({ promotes: [
      { id: 'active', on: true, platforms: ['web'] },
      { id: 'disabled', on: false, platforms: ['web'] },
      { id: 'future', on: true, startTime: '2030-01-01T00:00:00Z', platforms: ['web'] },
      { id: 'missing', on: true, platforms: ['web'] },
    ] }),
    parsePromotionContent({ contents: [
      {
        id: 'active',
        title: { 'de-DE': 'Nur heute', en: 'Today only' },
        description: { en: 'Limited offer' },
        link: 'https://example.com/offer',
        image: { src: '/images/offer.webp', width: 640 },
      },
      {
        id: 'disabled',
        title: { en: 'Disabled' },
        description: { en: 'Not shown' },
        link: 'https://example.com/disabled',
      },
      {
        id: 'future',
        title: { en: 'Future' },
        description: { en: 'Not yet' },
        link: 'https://example.com/future',
      },
      {
        id: 'unsafe',
        title: { en: 'Unsafe link' },
        description: { en: 'Not shown' },
        link: 'javascript:alert(1)',
      },
    ] }),
    'de-DE',
    Date.parse('2029-01-01T00:00:00Z'),
  );

  assert.deepEqual(cards, [{
    id: 'active',
    title: 'Nur heute',
    description: 'Limited offer',
    ctaLabel: 'Learn more',
    link: 'https://example.com/offer',
    image: {
      src: 'https://index.hagicode.com/images/offer.webp',
      alt: 'Nur heute',
      variant: undefined,
      width: 640,
      height: undefined,
    },
  }]);
});

test('falls back to English locale content and returns no cards on remote failure', async () => {
  const localized = normalizeActivePromotions(
    parsePromotionFlags({ promotes: [{ id: 'campaign', on: true, platforms: ['web'] }] }),
    parsePromotionContent({ contents: [{
      id: 'campaign',
      title: { en: 'English title' },
      description: { 'en-US': 'English description' },
      link: '/campaign',
    }] }),
    'unsupported-Latn',
  );
  assert.equal(localized[0]?.title, 'English title');
  assert.equal(localized[0]?.link, '/campaign');
  assert.deepEqual(await loadActivePromotions({ fetchImpl: async () => { throw new Error('offline'); } }), []);
});

function platformContent(ids) {
  return parsePromotionContent({ contents: ids.map((id) => ({
    id,
    title: { en: id },
    description: { en: `${id} description` },
    link: `https://example.com/${id}`,
  })) });
}

function platformCardIds(promotes) {
  return normalizeActivePromotions(
    parsePromotionFlags({ promotes }),
    platformContent(promotes.map((promote) => promote.id)),
    'en',
  ).map((card) => card.id);
}

test('keeps only promotions flagged for the web platform', () => {
  assert.deepEqual(platformCardIds([
    { id: 'hagicode-only', on: true, platforms: ['hagicode'] },
    { id: 'web-only', on: true, platforms: ['web'] },
    { id: 'both', on: true, platforms: ['web', 'hagicode'] },
  ]), ['web-only', 'both']);
});

test('treats the order of platform values as insignificant', () => {
  assert.deepEqual(platformCardIds([
    { id: 'reversed', on: true, platforms: ['hagicode', 'web'] },
  ]), ['reversed']);
});

test('drops promotions with a missing or unusable platforms value without affecting valid siblings', () => {
  assert.deepEqual(platformCardIds([
    { id: 'missing', on: true },
    { id: 'empty', on: true, platforms: [] },
    { id: 'string', on: true, platforms: 'web' },
    { id: 'object', on: true, platforms: { web: true } },
    { id: 'non-string', on: true, platforms: ['web', 7] },
    { id: 'valid', on: true, platforms: ['web'] },
  ]), ['valid']);
});

test('ignores unknown platform values next to web and matches web exactly', () => {
  assert.deepEqual(platformCardIds([
    { id: 'future-platform', on: true, platforms: ['web', 'future-surface'] },
    { id: 'wrong-case', on: true, platforms: ['Web'] },
    { id: 'padded', on: true, platforms: [' web'] },
  ]), ['future-platform']);
});

test('keeps platform-filtered promotions in their published order', () => {
  assert.deepEqual(platformCardIds([
    { id: 'third', on: true, platforms: ['web'] },
    { id: 'skipped', on: true, platforms: ['hagicode'] },
    { id: 'first', on: true, platforms: ['web', 'hagicode'] },
    { id: 'second', on: true, platforms: ['web'] },
  ]), ['third', 'first', 'second']);
});

test('returns no promotions when every active entry is for a non-web platform', async () => {
  const fetchImpl = async (input) => {
    const url = input.toString();
    if (url.endsWith('/index-catalog.json')) throw new Error('catalog unavailable');
    if (url.endsWith('/promote.json')) {
      return json({ promotes: [{ id: 'inside-hagicode', on: true, platforms: ['hagicode'] }] });
    }
    if (url.endsWith('/promote_content.json')) {
      return json({ contents: [{
        id: 'inside-hagicode',
        title: { en: 'Inside Hagicode' },
        description: { en: 'Not for websites' },
        link: 'https://example.com/inside',
      }] });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  assert.deepEqual(await loadActivePromotions({ fetchImpl, locale: 'en' }), []);
});
