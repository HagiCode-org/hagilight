import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_POSTHOG_API_KEY, posthogInitScript } from '@hagicode/hagilight-core/posthog';

const starlightSource = readFileSync(new URL('../packages/starlight/src/index.ts', import.meta.url), 'utf8');
const { locales: starlightLocales } = await import(new URL('../packages/starlight/dist/locales.js', import.meta.url).href);
const analytics = await import(new URL('../packages/docusaurus/dist/analytics.js', import.meta.url).href);
const catalog = await import(new URL('../packages/docusaurus/dist/locales.js', import.meta.url).href);

function starlightStringConstant(name) {
  const value = starlightSource.match(new RegExp(`const ${name} = '([^']*)';`, 'u'))?.[1];
  assert.notEqual(value, undefined, `Starlight declares ${name}`);
  return value;
}

function starlightPatternConstant(name) {
  const literal = starlightSource.match(new RegExp(`const ${name} = (/.+/[a-z]*);`, 'u'))?.[1];
  assert.notEqual(literal, undefined, `Starlight declares ${name}`);
  const flagsStart = literal.lastIndexOf('/');
  return new RegExp(literal.slice(1, flagsStart), literal.slice(flagsStart + 1));
}

test('default analytics IDs match the Starlight package', () => {
  assert.equal(analytics.DEFAULT_GOOGLE_ANALYTICS_ID, starlightStringConstant('DEFAULT_GOOGLE_ANALYTICS_ID'));
  assert.equal(analytics.DEFAULT_FIFTY_ONE_LA_ID, starlightStringConstant('DEFAULT_51LA_ID'));
});

test('PostHog shares its loader and default key between plugins', () => {
  assert.deepEqual(analytics.posthogHeadTags(DEFAULT_POSTHOG_API_KEY), [
    { tagName: 'script', innerHTML: posthogInitScript() },
  ]);
  assert.match(starlightSource, /import \{ DEFAULT_POSTHOG_API_KEY, POSTHOG_API_KEY_PATTERN \} from '@hagicode\/hagilight-core\/posthog'/u);
  assert.match(starlightSource, /coreExport\('PostHog'\)/u);
});

test('analytics ID patterns match the Starlight package', () => {
  const googlePattern = starlightPatternConstant('GOOGLE_ID_PATTERN');
  const fiftyOnePattern = starlightPatternConstant('FIFTY_ONE_LA_ID_PATTERN');
  assert.equal(analytics.GOOGLE_ANALYTICS_ID_PATTERN.source, googlePattern.source);
  assert.equal(analytics.GOOGLE_ANALYTICS_ID_PATTERN.flags, googlePattern.flags);
  assert.equal(analytics.FIFTY_ONE_LA_ID_PATTERN.source, fiftyOnePattern.source);
  assert.equal(analytics.FIFTY_ONE_LA_ID_PATTERN.flags, fiftyOnePattern.flags);
});

test('the locale catalog matches the Starlight locales', () => {
  const starlightToDocusaurus = (key) => (key === 'root' ? 'en-US' : key);
  assert.deepEqual(
    [...catalog.locales].sort(),
    Object.keys(starlightLocales).map(starlightToDocusaurus).sort(),
  );
  for (const [key, entry] of Object.entries(starlightLocales)) {
    const configured = catalog.localeConfigs[starlightToDocusaurus(key)];
    assert.equal(configured.label, entry.label, `${key} label`);
    assert.equal(configured.htmlLang, entry.lang, `${key} lang`);
  }
  assert.equal(catalog.defaultLocale, 'en-US');
  assert.equal(catalog.i18n.defaultLocale, 'en-US');
});

// Interaction parity: the same event names and property sets on both platforms, and no search event on Docusaurus.
const docusaurusSourceDir = new URL('../packages/docusaurus/src/', import.meta.url);
const coreSource = (path) => readFileSync(new URL(`../packages/core/src/${path}`, import.meta.url), 'utf8');
const starlightComponent = (path) => readFileSync(new URL(`../packages/starlight/${path}`, import.meta.url), 'utf8');

function docusaurusSourceFiles(dir = docusaurusSourceDir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) docusaurusSourceFiles(child, found);
    else if (/\.(?:ts|tsx)$/u.test(entry.name)) found.push(child);
  }
  return found;
}

test('404 views, code copies and language switches share event names and property sets with Starlight', async () => {
  const { POSTHOG_EVENTS } = await import('@hagicode/hagilight-core/posthog-events');
  assert.deepEqual(POSTHOG_EVENTS.not_found_viewed, ['path', 'referrer_domain']);
  assert.deepEqual(POSTHOG_EVENTS.code_copied, ['language', 'page_type', 'is_install_page']);
  assert.deepEqual(POSTHOG_EVENTS.locale_changed, ['from', 'to']);
  // Starlight: 404 view in NotFoundHero, language switch in LanguageChooser; both reach the same vocabulary.
  assert.match(starlightComponent('NotFoundHero.astro'), /'not_found_viewed'/u);
  assert.match(starlightComponent('LanguageChooser.astro'), /'locale_changed'/u);
  // Docusaurus: 404 view in the NotFound wrapper; copy and locale links in the shared observers it installs.
  const notFound = readFileSync(new URL('../packages/docusaurus/src/theme/NotFound/Content/index.tsx', import.meta.url), 'utf8');
  assert.match(notFound, /'not_found_viewed'/u);
  const observers = coreSource('posthog-interactions.ts');
  assert.match(observers, /capturePostHogEvent\('code_copied'/u);
  assert.match(observers, /capturePostHogEvent\('locale_changed'/u);
  assert.match(readFileSync(new URL('../packages/docusaurus/src/client/posthog-interactions.ts', import.meta.url), 'utf8'), /installPostHogInteractions/u);
});

test('Docusaurus emits no search event: Pagefind search is Starlight-only, and no Docusaurus source names a search event', () => {
  for (const file of docusaurusSourceFiles()) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /search_used|search_result_clicked/u, file.pathname);
    assert.doesNotMatch(source, /pagefind/iu, file.pathname);
  }
});
