import assert from 'node:assert/strict';
import { test } from 'node:test';

const { findConfigurationWarnings } = await import(new URL('../packages/docusaurus/dist/warnings.js', import.meta.url).href);
const { resolveOptions } = await import(new URL('../packages/docusaurus/dist/options.js', import.meta.url).href);
const catalog = await import(new URL('../packages/docusaurus/dist/locales.js', import.meta.url).href);

const isDropdownWarning = (warning) => warning.includes('localeDropdown');
const isCatalogWarning = (warning) => warning.includes('Hagilight locale catalog');

function i18n(locales) {
  const [defaultLocale] = locales;
  return {
    defaultLocale,
    locales,
    currentLocale: defaultLocale,
    path: 'i18n',
    localeConfigs: Object.fromEntries(
      locales.map((locale) => [
        locale,
        { label: locale, htmlLang: locale, direction: 'ltr', baseUrl: locale === defaultLocale ? '/' : `/${locale}/` },
      ]),
    ),
  };
}

function warningsFor(locales, { dropdown = false, languageSelector } = {}) {
  return findConfigurationWarnings(
    {
      siteDir: '/unused',
      siteConfig: {
        themeConfig: { image: 'img/social.png', navbar: { items: dropdown ? [{ type: 'localeDropdown' }] : [] } },
      },
      i18n: i18n(locales),
    },
    resolveOptions(languageSelector === undefined ? {} : { languageSelector }),
  );
}

test('the catalog holds the ten HagiCode locales with en-US first', () => {
  assert.equal(catalog.locales.length, 10);
  assert.equal(catalog.defaultLocale, 'en-US');
  assert.equal(catalog.locales[0], 'en-US');
});

test('several locales without a localeDropdown item warn once', () => {
  const warnings = warningsFor(['en-US', 'zh-CN']);
  assert.equal(warnings.length, 1);
  assert.ok(isDropdownWarning(warnings[0]));
});

test('a localeDropdown navbar item silences the dropdown warning', () => {
  assert.deepEqual(warningsFor(['en-US', 'zh-CN'], { dropdown: true }), []);
});

test('a single-locale site stays silent without a localeDropdown item', () => {
  assert.deepEqual(warningsFor(['en-US']), []);
});

test('disabling the language selector silences every language warning', () => {
  assert.deepEqual(warningsFor(['en-US', 'it-IT'], { languageSelector: { enabled: false } }), []);
  assert.deepEqual(warningsFor(['en-US', 'zh-CN'], { languageSelector: { enabled: false } }), []);
});

test('non-catalog locales warn and name each one', () => {
  const warnings = warningsFor(['en-US', 'it-IT', 'pl-PL'], { dropdown: true });
  assert.equal(warnings.length, 1);
  assert.ok(isCatalogWarning(warnings[0]));
  assert.match(warnings[0], /it-IT, pl-PL are not in the Hagilight locale catalog/u);
});

test('a single non-catalog locale is silent', () => {
  assert.deepEqual(warningsFor(['it-IT']), []);
});

test('a catalog subset with a localeDropdown item produces no warnings', () => {
  assert.deepEqual(warningsFor(['en-US', 'zh-CN', 'ja-JP'], { dropdown: true }), []);
});

test('the full catalog with a localeDropdown item produces no warnings', () => {
  assert.deepEqual(warningsFor([...catalog.locales], { dropdown: true }), []);
});

test('a catalog subset without a dropdown warns about the dropdown only', () => {
  const warnings = warningsFor(['en-US', 'ja-JP']);
  assert.equal(warnings.length, 1);
  assert.ok(isDropdownWarning(warnings[0]));
  assert.ok(!isCatalogWarning(warnings[0]));
});

test('both language warnings appear together when neither condition is met', () => {
  const warnings = warningsFor(['en-US', 'it-IT']);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.some(isDropdownWarning));
  assert.ok(warnings.some(isCatalogWarning));
});
