// Node-only loaders for the comparison article data packaged with @hagicode/hagilight-core.
// Browser code must import ./comparison-articles.ts instead.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildStructuredArticleLocaleManifestFromDetails,
  buildStructuredArticleRootManifestFromLocaleManifests,
  validateStructuredArticleDetail,
  type StructuredArticleDetail,
  type StructuredArticleLocaleManifest,
  type StructuredArticleRootManifest,
} from './comparison-articles.js';

/**
 * Packaged data root. Resolved from this module's location so that the data of the installed
 * core version is used from any working directory. The compiled file lives in `dist/`, so `..`
 * is the package root both in the workspace and in an installed tarball.
 */
export const STRUCTURED_ARTICLE_SOURCE_ROOT = fileURLToPath(
  new URL('../data/comparison-articles/', import.meta.url),
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function readStructuredArticleFile(filePath: string, sourceRoot: string): Promise<StructuredArticleDetail> {
  const raw = JSON.parse(await readFile(filePath, 'utf8'));
  return validateStructuredArticleDetail(raw, path.relative(sourceRoot, filePath));
}

export async function listStructuredArticleLocales(sourceRoot = STRUCTURED_ARTICLE_SOURCE_ROOT): Promise<string[]> {
  const entries = await readdir(sourceRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function listStructuredArticleSlugs(
  locale: string,
  sourceRoot = STRUCTURED_ARTICLE_SOURCE_ROOT,
): Promise<string[]> {
  const localeRoot = path.join(sourceRoot, locale);
  const entries = await readdir(localeRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/u, ''))
    .sort((left, right) => left.localeCompare(right));
}

export async function loadStructuredArticleDetail(
  locale: string,
  slug: string,
  sourceRoot = STRUCTURED_ARTICLE_SOURCE_ROOT,
): Promise<StructuredArticleDetail> {
  const filePath = path.join(sourceRoot, locale, `${slug}.json`);
  const detail = await readStructuredArticleFile(filePath, sourceRoot);

  assert(detail.locale === locale, `${locale}/${slug}.json locale must match directory name.`);
  assert(detail.slug === slug, `${locale}/${slug}.json slug must match file name.`);

  return detail;
}

export async function loadStructuredArticleLocaleDetails(
  locale: string,
  sourceRoot = STRUCTURED_ARTICLE_SOURCE_ROOT,
): Promise<StructuredArticleDetail[]> {
  const slugs = await listStructuredArticleSlugs(locale, sourceRoot);
  const details = await Promise.all(slugs.map((slug) => loadStructuredArticleDetail(locale, slug, sourceRoot)));

  return details.sort((left, right) => left.slug.localeCompare(right.slug));
}

export async function buildStructuredArticleLocaleManifest(
  locale: string,
  sourceRoot = STRUCTURED_ARTICLE_SOURCE_ROOT,
): Promise<StructuredArticleLocaleManifest> {
  const details = await loadStructuredArticleLocaleDetails(locale, sourceRoot);

  return buildStructuredArticleLocaleManifestFromDetails(locale, details);
}

export async function buildStructuredArticleRootManifest(
  sourceRoot = STRUCTURED_ARTICLE_SOURCE_ROOT,
): Promise<StructuredArticleRootManifest> {
  const locales = await listStructuredArticleLocales(sourceRoot);
  assert(locales.length > 0, 'Structured article source must contain at least one locale directory.');

  const localeManifests = await Promise.all(
    locales.map((locale) => buildStructuredArticleLocaleManifest(locale, sourceRoot)),
  );

  return buildStructuredArticleRootManifestFromLocaleManifests(localeManifests);
}
