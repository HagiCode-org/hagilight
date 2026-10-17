import test from 'node:test';
import assert from 'node:assert/strict';

import {
  listStructuredArticleLocales,
  listStructuredArticleSlugs,
  loadStructuredArticleDetail,
} from '../packages/core/dist/comparison-articles-source.js';

// Content contract for the *-vs-hagicode comparison articles.
// See openspec/changes/update-comparison-articles/design.md (D2, D6).

// en-US and zh-CN (plus the page listed in REWRITTEN_EXTRA_PAGES) carry the rewritten comparison structure (design D8: real comparisons with a
// table, choose-when guidance, a co-use guide and an FAQ). The other locales keep the earlier
// template until their English source has proven itself in search, so they follow the legacy contract.
const REWRITTEN_LOCALES = ['en-US', 'zh-CN'];
// Single pages in another locale that were rewritten because they already earn search impressions:
// "qodercli" lands on the ru-RU page (231 impressions in the 2026-09-16 to 10-13 Search Console window).
const REWRITTEN_EXTRA_PAGES = new Set(['ru-RU/qoder-vs-hagicode']);
const REWRITTEN_UPDATED_AT = '2026-10-16T00:00:00.000Z';
const LEGACY_UPDATED_AT = '2026-10-15T00:00:00.000Z';
const MAX_DESCRIPTION_LENGTH = 155;
const MIN_TABLE_ROWS = 8;
const MIN_FAQ = 4;
const MAX_FAQ = 6;
// Product facts that are the same for every article by nature are exempt from the boilerplate check:
// the HagiCode setup steps, HagiCode's own limits in the not-a-fit callout, and the interactive-question
// item that describes one feature shared by the four CLIs that support it.
const BOILERPLATE_EXEMPT_BLOCK_SUFFIXES = ['section-5-steps', 'section-4-not-a-fit'];
const BOILERPLATE_EXEMPT_ITEM_SUFFIXES = ['section-6-interactive-questions'];
// A paragraph this long that reappears in this many articles of one locale is boilerplate.
const SHARED_PARAGRAPH_MIN_LENGTH = 60;
const SHARED_PARAGRAPH_MAX_ARTICLES = 2;

const SHARED_ITEM_SUFFIXES = ['section-2-item-11', 'section-2-item-12'];
const INTERACTIVE_QUESTION_ITEM_SUFFIX = 'section-2-item-13';
const AGENT_WORK_ITEM_SUFFIX = 'section-2-item-14';
const REWRITTEN_INTERACTIVE_QUESTION_ITEM_SUFFIX = 'section-6-interactive-questions';
const REWRITTEN_AGENT_WORK_ITEM_SUFFIX = 'section-6-agent-work';

// Slugs whose CLI can produce structured interactive questions (InteractiveUserInputPolicy.SupportsQuestions).
const INTERACTIVE_QUESTION_SLUGS = new Set([
  'claude-vs-hagicode',
  'pi-vs-hagicode',
  'omp-vs-hagicode',
  'reasonix-vs-hagicode',
]);

// Only Claude publishes agent work snapshots.
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

const isRewritten = ({ locale, slug }) => REWRITTEN_LOCALES.includes(locale) || REWRITTEN_EXTRA_PAGES.has(`${locale}/${slug}`);
const isLegacy = (article) => !isRewritten(article);

function getSection6Items(detail) {
  const section = detail.sections.find((item) => item.id.endsWith('-section-6'));
  return section ? section.blocks.flatMap((block) => block.items ?? []) : [];
}

function collectParagraphs(detail) {
  const paragraphs = [detail.summary];
  for (const section of detail.sections) {
    for (const block of section.blocks) {
      if (BOILERPLATE_EXEMPT_BLOCK_SUFFIXES.some((suffix) => block.id.endsWith(suffix))) continue;
      paragraphs.push(...(block.content ?? []));
      for (const item of block.items ?? []) {
        if (typeof item === 'string') {
          paragraphs.push(item);
        } else if (item.content) {
          if (BOILERPLATE_EXEMPT_ITEM_SUFFIXES.some((suffix) => item.id.endsWith(suffix))) continue;
          paragraphs.push(...item.content, ...(item.bullets ?? []));
        }
      }
    }
  }
  for (const entry of detail.faq ?? []) {
    paragraphs.push(entry.answer);
  }
  return paragraphs.map((text) => text.trim());
}

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

test('legacy locales have the shared items 11 and 12 in section 2', async () => {
  const articles = (await articlesPromise).filter(isLegacy);
  assert.ok(articles.length > 0, 'no legacy-locale articles were loaded');

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

test('legacy locales: item 13 (interactive questions) appears only for Claude, Pi, OMP and Reasonix', async () => {
  const articles = (await articlesPromise).filter(isLegacy);

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

test('legacy locales: item 14 (agent work panel) appears only for the Claude article', async () => {
  const articles = (await articlesPromise).filter(isLegacy);

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

test('locales of the same slug share the same ordered section, block and item ids within a contract generation', async () => {
  const articles = await articlesPromise;
  const bySlug = new Map();
  for (const article of articles) {
    const key = `${article.slug}|${isRewritten(article) ? 'rewritten' : 'legacy'}`;
    if (!bySlug.has(key)) bySlug.set(key, []);
    bySlug.get(key).push(article);
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

test('every comparison article carries the updatedAt timestamp of its contract generation', async () => {
  const articles = await articlesPromise;
  for (const article of articles) {
    const { locale, slug, detail } = article;
    const expected = isRewritten(article) ? REWRITTEN_UPDATED_AT : LEGACY_UPDATED_AT;
    assert.equal(
      detail.updatedAt,
      expected,
      `${slug} [${locale}]: updatedAt must be ${expected}, found ${detail.updatedAt}`,
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


// ---------------------------------------------------------------------------
// Rewritten comparison contract (en-US, zh-CN)
// ---------------------------------------------------------------------------

test('rewritten articles have the seven comparison sections in order', async () => {
  const articles = (await articlesPromise).filter(isRewritten);
  assert.ok(articles.length > 0, 'no rewritten articles were loaded');

  for (const { locale, slug, detail } of articles) {
    assert.deepEqual(
      detail.sections.map((section) => section.id),
      [1, 2, 3, 4, 5, 6, 7].map((number) => `${slug}-section-${number}`),
      `${slug} [${locale}]: section ids`,
    );
  }
});

test('rewritten articles carry a real comparison table', async () => {
  const articles = (await articlesPromise).filter(isRewritten);

  for (const { locale, slug, detail } of articles) {
    const tables = detail.sections.flatMap((section) => section.blocks).filter((block) => block.type === 'comparison-table');
    assert.equal(tables.length, 1, `${slug} [${locale}]: expected exactly one comparison-table`);
    const [table] = tables;
    assert.equal(table.headers.length, 3, `${slug} [${locale}]: table needs a label column and two agent columns`);
    assert.ok(table.rows.length >= MIN_TABLE_ROWS, `${slug} [${locale}]: table needs at least ${MIN_TABLE_ROWS} rows`);
  }
});

test('rewritten articles state when HagiCode is not a fit and how to use both tools together', async () => {
  const articles = (await articlesPromise).filter(isRewritten);

  for (const { locale, slug, detail } of articles) {
    const blockIds = detail.sections.flatMap((section) => section.blocks.map((block) => block.id));
    for (const suffix of ['section-4-choose-agent', 'section-4-choose-hagicode', 'section-4-not-a-fit', 'section-5-steps', 'section-5-notes']) {
      assert.ok(blockIds.includes(`${slug}-${suffix}`), `${slug} [${locale}]: missing block ${slug}-${suffix}`);
    }
  }
});

test('rewritten articles have a short answer-first description and 4 to 6 FAQ entries', async () => {
  const articles = (await articlesPromise).filter(isRewritten);

  for (const { locale, slug, detail } of articles) {
    assert.ok(
      [...detail.seo.description].length <= MAX_DESCRIPTION_LENGTH,
      `${slug} [${locale}]: description is ${[...detail.seo.description].length} characters, limit ${MAX_DESCRIPTION_LENGTH}`,
    );
    assert.ok(detail.faq, `${slug} [${locale}]: faq is missing`);
    assert.ok(
      detail.faq.length >= MIN_FAQ && detail.faq.length <= MAX_FAQ,
      `${slug} [${locale}]: faq has ${detail.faq?.length} entries, expected ${MIN_FAQ}-${MAX_FAQ}`,
    );
  }
});

test('rewritten articles: interactive-question and agent-work items only for the CLIs that support them', async () => {
  const articles = (await articlesPromise).filter(isRewritten);

  for (const { locale, slug, detail } of articles) {
    const items = getSection6Items(detail);
    const hasQuestions = items.some((item) => item.id.endsWith(REWRITTEN_INTERACTIVE_QUESTION_ITEM_SUFFIX));
    const hasAgentWork = items.some((item) => item.id.endsWith(REWRITTEN_AGENT_WORK_ITEM_SUFFIX));

    assert.equal(hasQuestions, INTERACTIVE_QUESTION_SLUGS.has(slug), `${slug} [${locale}]: interactive-question item`);
    assert.equal(hasAgentWork, AGENT_WORK_SLUGS.has(slug), `${slug} [${locale}]: agent-work item`);
  }
});

test('rewritten articles share no long paragraph across more than two articles of a locale', async () => {
  const articles = (await articlesPromise).filter(isRewritten);

  for (const locale of REWRITTEN_LOCALES) {
    const seen = new Map();
    for (const article of articles.filter((entry) => entry.locale === locale)) {
      for (const paragraph of new Set(collectParagraphs(article.detail))) {
        if (paragraph.length < SHARED_PARAGRAPH_MIN_LENGTH) continue;
        if (!seen.has(paragraph)) seen.set(paragraph, []);
        seen.get(paragraph).push(article.slug);
      }
    }

    const boilerplate = [...seen].filter(([, slugs]) => slugs.length > SHARED_PARAGRAPH_MAX_ARTICLES);
    assert.deepEqual(
      boilerplate.map(([paragraph, slugs]) => `${slugs.length}x ${paragraph.slice(0, 70)}`),
      [],
      `[${locale}]: paragraphs repeated across more than ${SHARED_PARAGRAPH_MAX_ARTICLES} articles`,
    );
  }
});
