import test from 'node:test';
import assert from 'node:assert/strict';

import {
  listStructuredArticleLocales,
  listStructuredArticleSlugs,
  loadStructuredArticleDetail,
} from '../packages/core/dist/comparison-articles-source.js';

// Content contract for the *-vs-hagicode comparison articles.
// See openspec/changes/update-comparison-articles/design.md (D2, D6).

const FRESH_UPDATED_AT = '2026-10-15T00:00:00.000Z';

const SHARED_ITEM_SUFFIXES = ['section-2-item-11', 'section-2-item-12'];
const INTERACTIVE_QUESTION_ITEM_SUFFIX = 'section-2-item-13';
const AGENT_WORK_ITEM_SUFFIX = 'section-2-item-14';

// Slugs whose CLI can produce structured interactive questions (InteractiveUserInputPolicy.SupportsQuestions).
const INTERACTIVE_QUESTION_SLUGS = new Set([
  'claude-vs-hagicode',
  'pi-vs-hagicode',
  'omp-vs-hagicode',
  'reasonix-vs-hagicode',
]);

// Only the Claude CLI publishes agent work snapshots.
const AGENT_WORK_SLUGS = new Set(['claude-vs-hagicode']);

// Every supported AIProviderType must map to a slug. Keep in sync with
// repos/hagicode-core/src/PCode.Models/AIProviderType.cs. Adding a provider needs a conscious edit here.
const PROVIDER_SLUG_MAP = {
  ClaudeCodeCli: 'claude',
  CodexCli: 'codex',
  GitHubCopilot: 'copilot',
  CodebuddyCli: 'codebuddy',
  OpenCodeCli: 'opencode',
  HermesCli: 'hermes',
  QoderCli: 'qoder',
  KiroCli: 'kiro',
  KimiCli: 'kimi',
  GeminiCli: 'gemini',
  DeepAgentsCli: 'deepagents',
  ReasonixCli: 'reasonix',
  PiCli: 'pi',
  OmpCli: 'omp',
  JunieCli: 'junie',
  DshCli: 'dsh',
};

// Core rejects these providers as no longer supported, so they intentionally have no article.
const INTENTIONALLY_UNMAPPED_PROVIDERS = {
  IFlowCli: 'rejected by core as "no longer supported"',
};

const PROVIDER_ARTICLE_LOCALES = ['en-US', 'zh-CN'];

function getSection2Blocks(detail, locale, slug) {
  const section = detail.sections.find((item) => item.id.endsWith('-section-2'));
  assert.ok(section, `${locale}/${slug}: section 2 (Why ... Needs HagiCode) is missing`);
  return section.blocks;
}

function getCapabilityItems(detail, locale, slug) {
  return getSection2Blocks(detail, locale, slug)
    .filter((block) => block.type === 'capability-list')
    .flatMap((block) => block.items ?? []);
}

function hasItemSuffix(items, suffix) {
  return items.some((item) => item.id.endsWith(suffix));
}

// Ordered structure fingerprint: section ids, block ids and types, capability item ids.
function structureFingerprint(detail) {
  const entries = [];
  for (const section of detail.sections) {
    entries.push(`section:${section.id}`);
    for (const block of section.blocks) {
      entries.push(`block:${block.id}:${block.type}`);
      for (const item of block.items ?? []) {
        entries.push(`item:${item.id}`);
      }
    }
  }
  return entries;
}

async function loadAllArticles() {
  const locales = await listStructuredArticleLocales();
  const articles = [];
  for (const locale of locales) {
    const slugs = await listStructuredArticleSlugs(locale);
    for (const slug of slugs) {
      const detail = await loadStructuredArticleDetail(locale, slug);
      articles.push({ locale, slug, detail });
    }
  }
  return articles;
}

const articlesPromise = loadAllArticles();

test('every comparison article has the shared items 11 and 12 in section 2', async () => {
  const articles = await articlesPromise;
  assert.ok(articles.length > 0, 'no structured articles were loaded');

  for (const { locale, slug, detail } of articles) {
    const items = getCapabilityItems(detail, locale, slug);
    for (const suffix of SHARED_ITEM_SUFFIXES) {
      assert.ok(
        hasItemSuffix(items, suffix),
        `${slug} [${locale}]: missing capability item ending "${suffix}"`,
      );
    }
  }
});

test('item 13 (interactive questions) appears only for Claude, Pi, OMP and Reasonix', async () => {
  const articles = await articlesPromise;

  for (const { locale, slug, detail } of articles) {
    const items = getCapabilityItems(detail, locale, slug);
    const hasItem = hasItemSuffix(items, INTERACTIVE_QUESTION_ITEM_SUFFIX);
    const expected = INTERACTIVE_QUESTION_SLUGS.has(slug);

    if (expected) {
      assert.ok(hasItem, `${slug} [${locale}]: missing interactive-question item "${INTERACTIVE_QUESTION_ITEM_SUFFIX}"`);
    } else {
      assert.equal(
        hasItem,
        false,
        `${slug} [${locale}]: interactive-question item "${INTERACTIVE_QUESTION_ITEM_SUFFIX}" must not appear for this CLI`,
      );
    }
  }
});

test('item 14 (agent work panel) appears only for the Claude article', async () => {
  const articles = await articlesPromise;

  for (const { locale, slug, detail } of articles) {
    const items = getCapabilityItems(detail, locale, slug);
    const hasItem = hasItemSuffix(items, AGENT_WORK_ITEM_SUFFIX);
    const expected = AGENT_WORK_SLUGS.has(slug);

    if (expected) {
      assert.ok(hasItem, `${slug} [${locale}]: missing agent-work item "${AGENT_WORK_ITEM_SUFFIX}"`);
    } else {
      assert.equal(
        hasItem,
        false,
        `${slug} [${locale}]: agent-work item "${AGENT_WORK_ITEM_SUFFIX}" must not appear for this CLI`,
      );
    }
  }
});

test('locales of the same slug share the same ordered section, block and item ids', async () => {
  const articles = await articlesPromise;
  const bySlug = new Map();
  for (const article of articles) {
    if (!bySlug.has(article.slug)) bySlug.set(article.slug, []);
    bySlug.get(article.slug).push(article);
  }

  for (const [slug, group] of bySlug) {
    const reference = group[0];
    const referenceFingerprint = structureFingerprint(reference.detail);
    for (const other of group.slice(1)) {
      const fingerprint = structureFingerprint(other.detail);
      assert.deepEqual(
        fingerprint,
        referenceFingerprint,
        `${slug}: structure of [${other.locale}] differs from [${reference.locale}]`,
      );
    }
  }
});

test('every comparison article carries the fresh updatedAt timestamp', async () => {
  const articles = await articlesPromise;
  for (const { locale, slug, detail } of articles) {
    assert.equal(
      detail.updatedAt,
      FRESH_UPDATED_AT,
      `${slug} [${locale}]: updatedAt must be ${FRESH_UPDATED_AT}, found ${detail.updatedAt}`,
    );
  }
});

test('the last block of every comparison article is a bullet-list', async () => {
  const articles = await articlesPromise;
  for (const { locale, slug, detail } of articles) {
    const lastSection = detail.sections[detail.sections.length - 1];
    const lastBlock = lastSection.blocks[lastSection.blocks.length - 1];
    assert.equal(
      lastBlock.type,
      'bullet-list',
      `${slug} [${locale}]: last block must be a bullet-list, found ${lastBlock.type}`,
    );
  }
});

test('every supported Agent CLI provider has a comparison article in en-US and zh-CN', async () => {
  for (const [provider, shortName] of Object.entries(PROVIDER_SLUG_MAP)) {
    const slug = `${shortName}-vs-hagicode`;
    for (const locale of PROVIDER_ARTICLE_LOCALES) {
      const slugs = await listStructuredArticleSlugs(locale);
      assert.ok(
        slugs.includes(slug),
        `provider ${provider} is supported but slug ${slug} is missing in [${locale}]`,
      );
    }
  }
});

test('providers rejected by core have no comparison article', async () => {
  const locales = await listStructuredArticleLocales();
  for (const [provider, reason] of Object.entries(INTENTIONALLY_UNMAPPED_PROVIDERS)) {
    const slug = `${provider.replace(/Cli$/, '').toLowerCase()}-vs-hagicode`;
    for (const locale of locales) {
      const slugs = await listStructuredArticleSlugs(locale);
      assert.equal(
        slugs.includes(slug),
        false,
        `provider ${provider} (${reason}) must not have an article, found slug ${slug} in [${locale}]`,
      );
    }
  }
});
