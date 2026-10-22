import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';

const { FOOTER_BRAND_LOCALES, pickFooterBrandLinks, resolveFooterBrand } = await import(
  new URL('../packages/core/dist/footer-brand.js', import.meta.url).href);
const { resolveSiteLinks } = await import(new URL('../packages/core/dist/links.js', import.meta.url).href);
const { resolveFooterLinks } = await import(new URL('../packages/docusaurus/dist/footer.js', import.meta.url).href);
const { FooterView } = await import(new URL('../packages/docusaurus/dist/theme/Footer/FooterView.js', import.meta.url).href);

const LOCALES = ['en-US', 'zh-CN', 'zh-Hant', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU'];
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the footer product statement covers every locale with all three pillars', () => {
  assert.deepEqual([...FOOTER_BRAND_LOCALES].sort(), [...LOCALES].sort());
  for (const locale of LOCALES) {
    const brand = resolveFooterBrand(locale);
    assert.equal(brand.locale, locale);
    assert.equal(brand.name, 'HagiCode');
    assert.ok(brand.headline.trim() && brand.summary.trim(), `${locale} has a headline and a summary`);
    assert.deepEqual(brand.pillars.map((pillar) => pillar.id), ['smart', 'efficient', 'fun']);
    for (const pillar of brand.pillars) {
      assert.ok(pillar.label.trim() && pillar.description.trim(), `${locale} ${pillar.id} is complete`);
    }
    assert.match(brand.summary, /HagiCode|Hagi/u);
    assert.match(brand.summary, /OpenSpec/u);
    assert.match(brand.summary, /Hero Scenario/u);
  }
});

test('an unknown locale falls back to English', () => {
  assert.equal(resolveFooterBrand('xx-XX').locale, 'en-US');
  assert.equal(resolveFooterBrand(undefined).locale, 'en-US');
});

test('the product statement states no figures, ratings, or customer claims', () => {
  for (const locale of LOCALES) {
    const brand = resolveFooterBrand(locale);
    const text = [brand.headline, brand.summary, ...brand.pillars.map((pillar) => pillar.description)].join(' ');
    assert.doesNotMatch(text, /\d/u, `${locale} copy carries no numbers`);
  }
});

test('calls to action come from the resolved quick links and follow consumer removals', () => {
  const all = resolveSiteLinks('en-US');
  const picked = pickFooterBrandLinks(all.quick);
  assert.equal(picked.primary?.id, 'downloadClient');
  assert.equal(picked.secondary?.id, 'productDocs');

  const trimmed = resolveSiteLinks('en-US', { removeLinks: { quick: ['downloadClient', 'productDocs'] } });
  assert.deepEqual(pickFooterBrandLinks(trimmed.quick), {});

  const renamed = resolveSiteLinks('en-US', { overrides: { downloadClient: { label: 'Get the app' } } });
  assert.equal(pickFooterBrandLinks(renamed.quick).primary?.label, 'Get the app');
});

test('the Docusaurus footer renders the product statement before the link sections', () => {
  const links = resolveFooterLinks({ locale: 'zh-CN', baseUrl: '/', links: {}, rssEnabled: false });
  const html = renderToStaticMarkup(createElement(FooterView, { links, version: '0.0.0', year: 2026 }));
  const brand = resolveFooterBrand('zh-CN');
  assert.ok(html.indexOf('hagilight-brand') < html.indexOf('hagilight-footer__sections'));
  assert.match(html, /<section class="hagilight-brand" lang="zh-CN" aria-labelledby="hagilight-brand-title">/u);
  assert.ok(html.includes(`id="hagilight-brand-title">${brand.headline}</h2>`));
  for (const pillar of brand.pillars) {
    assert.ok(html.includes(`<dt>${pillar.label}</dt><dd>${pillar.description}</dd>`));
  }
  const primary = html.match(/<a class="hagilight-brand__primary"[^>]*>/u)?.[0] ?? '';
  assert.match(primary, /data-ga-label="downloadClient"/u);
  assert.match(primary, /data-ga-location="footer_brand"/u);
  assert.match(html, /<a class="hagilight-brand__secondary"[^>]*data-ga-label="productDocs"/u);
});

test('the Docusaurus footer drops the buttons but keeps the statement when both links are removed', () => {
  const links = resolveFooterLinks({
    locale: 'en-US',
    baseUrl: '/',
    links: { removeLinks: { quick: ['downloadClient', 'productDocs'] } },
    rssEnabled: false,
  });
  const html = renderToStaticMarkup(createElement(FooterView, { links, version: '0.0.0', year: 2026 }));
  assert.match(html, /hagilight-brand__headline/u);
  assert.doesNotMatch(html, /hagilight-brand__actions/u);
});

test('Astro footers mount the shared brand component and ship it in the core package', () => {
  assert.match(read('../packages/core/Footer.astro'), /<FooterBrand locale=\{resolvedLinks\.locale\} links=\{resolvedLinks\.quick\} avatar=\{avatar\} randomAvatar=\{randomAvatar\} \/>/u);
  assert.match(read('../packages/starlight/Footer.astro'), /import FooterBrand from '@hagicode\/hagilight-core\/FooterBrand'/u);
  assert.match(read('../packages/starlight/Footer.astro'), /<FooterBrand locale=\{resolvedLinks\.locale\} links=\{resolvedLinks\.quick\} avatar=\{avatar\} randomAvatar=\{randomAvatar\} \/>/u);
  const manifest = JSON.parse(read('../packages/core/package.json'));
  assert.equal(manifest.exports['./FooterBrand'], './FooterBrand.astro');
});

test('the scroll-driven reveal is progressive and respects reduced motion', () => {
  for (const css of [read('../packages/core/FooterBrand.astro'), read('../packages/docusaurus/styles.css')]) {
    const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    assert.match(motion, /@supports \(animation-timeline: view\(\)\)/u);
    assert.match(motion, /animation-timeline: view\(\)/u);
    const before = css.slice(0, css.indexOf('@media (prefers-reduced-motion: no-preference)'));
    assert.doesNotMatch(before, /animation-timeline/u, 'no animation outside the guarded block');
  }
});
