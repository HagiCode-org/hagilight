import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  buildStructuredArticleDetailPath,
  buildStructuredArticleLocaleManifestFromDetails,
  buildStructuredArticleLocaleManifestPath,
  buildStructuredArticleRootManifestFromLocaleManifests,
  validateStructuredArticleDetail,
} from '../packages/core/dist/comparison-articles.js';
import {
  buildStructuredArticleLocaleManifest,
  buildStructuredArticleRootManifest,
  listStructuredArticleLocales,
  listStructuredArticleSlugs,
  loadStructuredArticleDetail,
  loadStructuredArticleLocaleDetails,
} from '../packages/core/dist/comparison-articles-source.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(testDir, '..', 'packages', 'core');
const packagedDataRoot = path.join(coreRoot, 'data', 'comparison-articles');
const distModuleUrl = pathToFileURL(path.join(coreRoot, 'dist', 'comparison-articles-source.js')).href;

const scratchRoot = await mkdtemp(path.join(os.tmpdir(), 'hagilight-comparison-articles-'));
test.after(() => rm(scratchRoot, { recursive: true, force: true }));

async function readPackagedDetail(locale, slug) {
  return JSON.parse(await readFile(path.join(packagedDataRoot, locale, `${slug}.json`), 'utf8'));
}

async function writeFixtureArticle(root, locale, fileName, detail) {
  await mkdir(path.join(root, locale), { recursive: true });
  await writeFile(path.join(root, locale, fileName), JSON.stringify(detail), 'utf8');
}

test('structured article source exposes expected locale folders and baseline slugs', async () => {
  const locales = await listStructuredArticleLocales();
  const zhSlugs = await listStructuredArticleSlugs('zh-CN');
  const enSlugs = await listStructuredArticleSlugs('en-US');

  assert.deepEqual(locales, [
    'de-DE',
    'en-US',
    'es-ES',
    'fr-FR',
    'ja-JP',
    'ko-KR',
    'pt-BR',
    'ru-RU',
    'zh-CN',
    'zh-Hant',
  ]);
  assert.equal(zhSlugs.includes('claude-vs-hagicode'), true);
  assert.equal(zhSlugs.includes('copilot-vs-hagicode'), true);
  assert.equal(zhSlugs.includes('kiro-vs-hagicode'), true);
  assert.equal(zhSlugs.includes('omp-vs-hagicode'), true);
  assert.equal(zhSlugs.includes('junie-vs-hagicode'), true);
  assert.equal(zhSlugs.includes('dsh-vs-hagicode'), true);
  assert.deepEqual(enSlugs, [
    'claude-vs-hagicode',
    'codebuddy-vs-hagicode',
    'codex-vs-hagicode',
    'copilot-vs-hagicode',
    'deepagents-vs-hagicode',
    'dsh-vs-hagicode',
    'gemini-vs-hagicode',
    'hermes-vs-hagicode',
    'junie-vs-hagicode',
    'kimi-vs-hagicode',
    'kiro-vs-hagicode',
    'omp-vs-hagicode',
    'opencode-vs-hagicode',
    'pi-vs-hagicode',
    'qoder-vs-hagicode',
    'reasonix-vs-hagicode',
  ]);
});

test('structured article manifests keep canonical locale and detail paths', async () => {
  const rootManifest = await buildStructuredArticleRootManifest();
  const zhManifest = await buildStructuredArticleLocaleManifest('zh-CN');
  const englishManifest = await buildStructuredArticleLocaleManifest('en-US');
  const chineseClaude = await loadStructuredArticleDetail('zh-CN', 'claude-vs-hagicode');
  const englishClaude = await loadStructuredArticleDetail('en-US', 'claude-vs-hagicode');

  assert.equal(rootManifest.schemaVersion, '1.0.0');
  assert.deepEqual(rootManifest.localeIndexes.map((entry) => entry.path), [
    '/articles/de-DE/index.json',
    '/articles/en-US/index.json',
    '/articles/es-ES/index.json',
    '/articles/fr-FR/index.json',
    '/articles/ja-JP/index.json',
    '/articles/ko-KR/index.json',
    '/articles/pt-BR/index.json',
    '/articles/ru-RU/index.json',
    '/articles/zh-CN/index.json',
    '/articles/zh-Hant/index.json',
  ]);
  assert.equal(zhManifest.locale, 'zh-CN');
  assert.equal(englishManifest.locale, 'en-US');
  assert.equal(zhManifest.articles.find((entry) => entry.slug === 'claude-vs-hagicode')?.path, '/articles/zh-CN/claude-vs-hagicode.json');
  assert.equal(englishManifest.articles[0]?.path, '/articles/en-US/claude-vs-hagicode.json');
  assert.equal(chineseClaude.sections.some((section) => section.blocks.some((block) => block.type === 'capability-list')), true);
  assert.equal(englishClaude.sections.at(-1)?.blocks.at(-1)?.type, 'bullet-list');
});

test('the root manifest lists every locale with the latest updatedAt of its articles', async () => {
  const rootManifest = await buildStructuredArticleRootManifest();
  const englishManifest = await buildStructuredArticleLocaleManifest('en-US');
  const englishEntry = rootManifest.localeIndexes.find((entry) => entry.locale === 'en-US');

  assert.equal(englishEntry?.updatedAt, englishManifest.generatedAt);
  assert.equal(rootManifest.generatedAt, rootManifest.localeIndexes.map((entry) => entry.updatedAt).sort().at(-1));
});

test('locale manifests summarize every article with slug, category, path, updatedAt, title and summary', async () => {
  const manifest = await buildStructuredArticleLocaleManifest('en-US');
  const slugs = await listStructuredArticleSlugs('en-US');

  assert.deepEqual(manifest.articles.map((entry) => entry.slug), slugs);
  for (const entry of manifest.articles) {
    assert.deepEqual(Object.keys(entry).sort(), ['category', 'path', 'slug', 'summary', 'title', 'updatedAt']);
    assert.equal(entry.category, 'vs-hagicode');
    assert.equal(entry.path, buildStructuredArticleDetailPath('en-US', entry.slug));
  }
});

test('loading a locale returns its details sorted by slug', async () => {
  const details = await loadStructuredArticleLocaleDetails('ja-JP');
  const slugs = details.map((detail) => detail.slug);

  assert.deepEqual(slugs, [...slugs].sort((left, right) => left.localeCompare(right)));
  assert.equal(details.length, (await listStructuredArticleSlugs('ja-JP')).length);
});

test('the default data root is the packaged data, not the working directory', async () => {
  const locales = await listStructuredArticleLocales(packagedDataRoot);
  assert.equal(locales.length, 10);
  const explicit = await buildStructuredArticleRootManifest(packagedDataRoot);
  const implicit = await buildStructuredArticleRootManifest();
  assert.deepEqual(explicit, implicit);
});

test('loaders read the packaged data from a different working directory', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'hagilight-comparison-cwd-'));
  try {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const m = await import(${JSON.stringify(distModuleUrl)});
         const root = await m.buildStructuredArticleRootManifest();
         const en = await m.buildStructuredArticleLocaleManifest('en-US');
         process.stdout.write(JSON.stringify({ locales: root.localeIndexes.length, en: en.articles.length, cwd: process.cwd() }));`,
      ],
      { cwd, encoding: 'utf8' },
    );
    const result = JSON.parse(output);
    const expected = await buildStructuredArticleRootManifest();

    assert.equal(result.locales, expected.localeIndexes.length);
    assert.equal(result.en, (await buildStructuredArticleLocaleManifest('en-US')).articles.length);
    // Windows may report 8.3 short names (RUNNER~1) for one side; compare resolved paths.
    assert.equal(await realpath(result.cwd), await realpath(cwd));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('a file whose locale does not match its directory fails to load and names the file', async () => {
  const root = path.join(scratchRoot, 'locale-mismatch');
  const detail = await readPackagedDetail('en-US', 'claude-vs-hagicode');
  await writeFixtureArticle(root, 'en-US', 'claude-vs-hagicode.json', { ...detail, locale: 'de-DE' });

  await assert.rejects(
    loadStructuredArticleDetail('en-US', 'claude-vs-hagicode', root),
    /en-US\/claude-vs-hagicode\.json locale must match directory name\./u,
  );
});

test('a file whose slug does not match its file name fails to load and names the file', async () => {
  const root = path.join(scratchRoot, 'slug-mismatch');
  const detail = await readPackagedDetail('en-US', 'claude-vs-hagicode');
  await writeFixtureArticle(root, 'en-US', 'codex-vs-hagicode.json', detail);

  await assert.rejects(
    loadStructuredArticleDetail('en-US', 'codex-vs-hagicode', root),
    /en-US\/codex-vs-hagicode\.json slug must match file name\./u,
  );
});

test('a malformed article with a wrong category is rejected with the field path', async () => {
  const detail = await readPackagedDetail('en-US', 'claude-vs-hagicode');

  assert.throws(
    () => validateStructuredArticleDetail({ ...detail, category: 'comparison' }, 'en-US/claude-vs-hagicode.json'),
    /en-US\/claude-vs-hagicode\.json\.category must be vs-hagicode\./u,
  );
});

test('a malformed article with a wrong schemaVersion is rejected with the field path', async () => {
  const detail = await readPackagedDetail('en-US', 'claude-vs-hagicode');

  assert.throws(
    () => validateStructuredArticleDetail({ ...detail, schemaVersion: '2.0.0' }, 'en-US/claude-vs-hagicode.json'),
    /en-US\/claude-vs-hagicode\.json\.schemaVersion must be 1\.0\.0\./u,
  );
});

test('a malformed article with a duplicate section id is rejected', async () => {
  const detail = await readPackagedDetail('en-US', 'claude-vs-hagicode');
  const duplicated = structuredClone(detail);
  duplicated.sections[1].id = duplicated.sections[0].id;

  assert.throws(
    () => validateStructuredArticleDetail(duplicated, 'fixture'),
    /fixture\.sections contains duplicate id /u,
  );
});

test('a malformed article with a duplicate block id is rejected', async () => {
  const detail = await readPackagedDetail('en-US', 'claude-vs-hagicode');
  const duplicated = structuredClone(detail);
  const sectionIndex = duplicated.sections.findIndex((section) => section.blocks.length > 1);
  const blocks = duplicated.sections[sectionIndex].blocks;
  blocks[1].id = blocks[0].id;

  assert.throws(
    () => validateStructuredArticleDetail(duplicated, 'fixture'),
    new RegExp(`fixture\\.sections\\[${sectionIndex}\\]\\.blocks contains duplicate id `, 'u'),
  );
});

test('a malformed article with a duplicate capability item id is rejected', async () => {
  const detail = await readPackagedDetail('en-US', 'claude-vs-hagicode');
  const duplicated = structuredClone(detail);
  const block = duplicated.sections.flatMap((section) => section.blocks).find((item) => item.type === 'capability-list');
  block.items[1].id = block.items[0].id;

  assert.throws(
    () => validateStructuredArticleDetail(duplicated, 'fixture'),
    /fixture\.sections\[\d+\]\.blocks\[\d+\]\.items contains duplicate id /u,
  );
});

test('builders take loaded details and produce the same manifests as the Node loaders', async () => {
  const details = await loadStructuredArticleLocaleDetails('fr-FR');
  const fromDetails = buildStructuredArticleLocaleManifestFromDetails('fr-FR', details);
  const fromLoader = await buildStructuredArticleLocaleManifest('fr-FR');

  assert.deepEqual(fromDetails, fromLoader);
  assert.equal(buildStructuredArticleLocaleManifestPath('fr-FR'), '/articles/fr-FR/index.json');
  assert.equal(buildStructuredArticleDetailPath('fr-FR', 'claude-vs-hagicode'), '/articles/fr-FR/claude-vs-hagicode.json');

  const root = buildStructuredArticleRootManifestFromLocaleManifests([fromDetails]);
  assert.deepEqual(root.localeIndexes, [
    { locale: 'fr-FR', path: '/articles/fr-FR/index.json', updatedAt: fromDetails.generatedAt },
  ]);
});

test('the raw JSON export resolves to the packaged file content', async () => {
  const { default: raw } = await import(
    '@hagicode/hagilight-core/comparison-articles-data/en-US/claude-vs-hagicode.json',
    { with: { type: 'json' } }
  );
  const packaged = await readPackagedDetail('en-US', 'claude-vs-hagicode');

  assert.deepEqual(raw, packaged);
  assert.equal(raw.slug, 'claude-vs-hagicode');
});

test('a packaged data file that is not a documented export stays private', async () => {
  await assert.rejects(
    import('@hagicode/hagilight-core/data/comparison-articles/en-US/claude-vs-hagicode.json', {
      with: { type: 'json' },
    }),
    (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  );
});

test('the data set holds 136 article files in 10 locales', async () => {
  const locales = await listStructuredArticleLocales();
  let total = 0;
  for (const locale of locales) {
    total += (await listStructuredArticleSlugs(locale)).length;
  }

  assert.equal(locales.length, 10);
  assert.equal(total, 136);
});

test('a comparison-table block is validated with its headers and rows', async () => {
  const detail = await readPackagedDetail('en-US', 'claude-vs-hagicode');
  const table = {
    id: 'fixture-table',
    type: 'comparison-table',
    caption: 'Fixture',
    headers: ['Aspect', 'Agent', 'HagiCode'],
    rows: [{ id: 'fixture-row-1', cells: ['Price', 'Free', 'Free'] }],
  };
  const withTable = structuredClone(detail);
  withTable.sections[0].blocks.push(table);

  const validated = validateStructuredArticleDetail(withTable, 'fixture');
  assert.deepEqual(validated.sections[0].blocks.at(-1), table);

  const shortRow = structuredClone(withTable);
  shortRow.sections[0].blocks.at(-1).rows[0].cells = ['Price', 'Free'];
  assert.throws(
    () => validateStructuredArticleDetail(shortRow, 'fixture'),
    /fixture\.sections\[0\]\.blocks\[\d+\]\.rows\[0\]\.cells must have 3 entries, one per header\./u,
  );

  const oneColumn = structuredClone(withTable);
  oneColumn.sections[0].blocks.at(-1).headers = ['Aspect'];
  assert.throws(
    () => validateStructuredArticleDetail(oneColumn, 'fixture'),
    /headers must contain at least two columns\./u,
  );

  const duplicateRows = structuredClone(withTable);
  duplicateRows.sections[0].blocks.at(-1).rows.push({ id: 'fixture-row-1', cells: ['Mode', 'CLI', 'GUI'] });
  assert.throws(
    () => validateStructuredArticleDetail(duplicateRows, 'fixture'),
    /\.rows contains duplicate id fixture-row-1\./u,
  );
});

test('faq entries are optional but must be complete when present', async () => {
  const detail = await readPackagedDetail('en-US', 'claude-vs-hagicode');
  const { faq: _ignored, ...withoutFaq } = detail;

  assert.equal(validateStructuredArticleDetail(withoutFaq, 'fixture').faq, undefined);

  const entry = { question: 'Is it free?', answer: 'Yes.' };
  assert.deepEqual(validateStructuredArticleDetail({ ...withoutFaq, faq: [entry] }, 'fixture').faq, [entry]);
  assert.throws(
    () => validateStructuredArticleDetail({ ...withoutFaq, faq: [] }, 'fixture'),
    /fixture\.faq must be a non-empty array\./u,
  );
  assert.throws(
    () => validateStructuredArticleDetail({ ...withoutFaq, faq: [{ question: 'Is it free?' }] }, 'fixture'),
    /fixture\.faq\[0\]\.answer must be a non-empty string\./u,
  );
});
