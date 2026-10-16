// Browser-safe contract for the comparison article data in @hagicode/hagilight-core.
// Node-only loaders that read the packaged JSON live in ./comparison-articles-source.ts.
// Keep this module free of node: imports so browser bundles can use it.

export const STRUCTURED_ARTICLE_SCHEMA_VERSION = '1.0.0';
export const STRUCTURED_ARTICLE_CATEGORY = 'vs-hagicode';

export interface StructuredArticleSeo {
  title: string;
  description: string;
}

export interface StructuredArticleCtaLink {
  label: string;
  href: string;
}

export interface StructuredArticleRichTextBlock {
  id: string;
  type: 'rich-text';
  content: string[];
}

export interface StructuredArticleBulletListBlock {
  id: string;
  type: 'bullet-list';
  items: string[];
}

export interface StructuredArticleCapabilityItem {
  id: string;
  title: string;
  content: string[];
  bullets?: string[];
}

export interface StructuredArticleCapabilityListBlock {
  id: string;
  type: 'capability-list';
  items: StructuredArticleCapabilityItem[];
}

export interface StructuredArticleComparisonItem {
  id: string;
  label: string;
  agent: string;
  hagicode: string;
  combinedValue?: string;
}

export interface StructuredArticleComparisonGridBlock {
  id: string;
  type: 'comparison-grid';
  items: StructuredArticleComparisonItem[];
}

export interface StructuredArticleCalloutBlock {
  id: string;
  type: 'callout';
  tone: 'info' | 'success' | 'warning';
  title?: string;
  content: string[];
}

export interface StructuredArticleComparisonTableRow {
  id: string;
  /** One entry per header, in header order. The first entry is the row label. */
  cells: string[];
}

export interface StructuredArticleComparisonTableBlock {
  id: string;
  type: 'comparison-table';
  caption?: string;
  /** Column headers. The first one labels the row-label column. */
  headers: string[];
  rows: StructuredArticleComparisonTableRow[];
}

export interface StructuredArticleCtaGroupBlock {
  id: string;
  type: 'cta-group';
  items: Array<StructuredArticleCtaLink & { variant?: 'primary' | 'secondary' }>;
}

export type StructuredArticleBlock =
  | StructuredArticleRichTextBlock
  | StructuredArticleBulletListBlock
  | StructuredArticleCapabilityListBlock
  | StructuredArticleComparisonGridBlock
  | StructuredArticleComparisonTableBlock
  | StructuredArticleCalloutBlock
  | StructuredArticleCtaGroupBlock;

export interface StructuredArticleSection {
  id: string;
  title: string;
  blocks: StructuredArticleBlock[];
}

export interface StructuredArticleFaqItem {
  question: string;
  answer: string;
}

export interface StructuredArticleDetail {
  schemaVersion: string;
  slug: string;
  category: string;
  locale: string;
  updatedAt: string;
  seo: StructuredArticleSeo;
  summary: string;
  sections: StructuredArticleSection[];
  /** Visible FAQ entries; also emitted as FAQPage structured data by the consuming site. */
  faq?: StructuredArticleFaqItem[];
  cta?: {
    primary?: StructuredArticleCtaLink;
    secondary?: StructuredArticleCtaLink;
  };
}

export interface StructuredArticleLocaleManifestEntry {
  slug: string;
  category: string;
  path: string;
  updatedAt: string;
  title: string;
  summary: string;
}

export interface StructuredArticleLocaleManifest {
  schemaVersion: string;
  locale: string;
  generatedAt: string;
  articles: StructuredArticleLocaleManifestEntry[];
}

export interface StructuredArticleRootManifestEntry {
  locale: string;
  path: string;
  updatedAt: string;
}

export interface StructuredArticleRootManifest {
  schemaVersion: string;
  generatedAt: string;
  localeIndexes: StructuredArticleRootManifestEntry[];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, fieldName: string): string {
  assert(
    typeof value === 'string' && value.trim().length > 0,
    `${fieldName} must be a non-empty string.`,
  );

  return value.trim();
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  assert(Array.isArray(value) && value.length > 0, `${fieldName} must be a non-empty array.`);

  return value.map((entry, index) => assertNonEmptyString(entry, `${fieldName}[${index}]`));
}

function assertCtaLink(value: unknown, fieldName: string): StructuredArticleCtaLink {
  assert(isRecord(value), `${fieldName} must be an object.`);

  return {
    label: assertNonEmptyString(value.label, `${fieldName}.label`),
    href: assertNonEmptyString(value.href, `${fieldName}.href`),
  };
}

function ensureUnique(ids: string[], fieldName: string): void {
  const seen = new Set<string>();

  for (const id of ids) {
    assert(!seen.has(id), `${fieldName} contains duplicate id ${id}.`);
    seen.add(id);
  }
}

function validateStructuredArticleBlock(block: unknown, fieldName: string): StructuredArticleBlock {
  assert(isRecord(block), `${fieldName} must be an object.`);

  const id = assertNonEmptyString(block.id, `${fieldName}.id`);
  const type = assertNonEmptyString(block.type, `${fieldName}.type`);

  switch (type) {
    case 'rich-text':
      return {
        id,
        type,
        content: assertStringArray(block.content, `${fieldName}.content`),
      };

    case 'bullet-list':
      return {
        id,
        type,
        items: assertStringArray(block.items, `${fieldName}.items`),
      };

    case 'capability-list': {
      assert(Array.isArray(block.items) && block.items.length > 0, `${fieldName}.items must be a non-empty array.`);
      const items = block.items.map((item, index) => {
        const itemField = `${fieldName}.items[${index}]`;
        assert(isRecord(item), `${itemField} must be an object.`);

        return {
          id: assertNonEmptyString(item.id, `${itemField}.id`),
          title: assertNonEmptyString(item.title, `${itemField}.title`),
          content: assertStringArray(item.content, `${itemField}.content`),
          ...(item.bullets === undefined
            ? {}
            : { bullets: assertStringArray(item.bullets, `${itemField}.bullets`) }),
        };
      });

      ensureUnique(items.map((item) => item.id), `${fieldName}.items`);

      return {
        id,
        type,
        items,
      };
    }

    case 'comparison-grid': {
      assert(Array.isArray(block.items) && block.items.length > 0, `${fieldName}.items must be a non-empty array.`);
      const items = block.items.map((item, index) => {
        const itemField = `${fieldName}.items[${index}]`;
        assert(isRecord(item), `${itemField} must be an object.`);

        return {
          id: assertNonEmptyString(item.id, `${itemField}.id`),
          label: assertNonEmptyString(item.label, `${itemField}.label`),
          agent: assertNonEmptyString(item.agent, `${itemField}.agent`),
          hagicode: assertNonEmptyString(item.hagicode, `${itemField}.hagicode`),
          ...(item.combinedValue === undefined
            ? {}
            : { combinedValue: assertNonEmptyString(item.combinedValue, `${itemField}.combinedValue`) }),
        };
      });

      ensureUnique(items.map((item) => item.id), `${fieldName}.items`);

      return {
        id,
        type,
        items,
      };
    }

    case 'comparison-table': {
      const headers = assertStringArray(block.headers, `${fieldName}.headers`);
      assert(headers.length >= 2, `${fieldName}.headers must contain at least two columns.`);
      assert(Array.isArray(block.rows) && block.rows.length > 0, `${fieldName}.rows must be a non-empty array.`);
      const rows = block.rows.map((row, index) => {
        const rowField = `${fieldName}.rows[${index}]`;
        assert(isRecord(row), `${rowField} must be an object.`);
        const cells = assertStringArray(row.cells, `${rowField}.cells`);
        assert(cells.length === headers.length, `${rowField}.cells must have ${headers.length} entries, one per header.`);

        return {
          id: assertNonEmptyString(row.id, `${rowField}.id`),
          cells,
        };
      });

      ensureUnique(rows.map((row) => row.id), `${fieldName}.rows`);

      return {
        id,
        type,
        ...(block.caption === undefined ? {} : { caption: assertNonEmptyString(block.caption, `${fieldName}.caption`) }),
        headers,
        rows,
      };
    }

    case 'callout':
      return {
        id,
        type,
        tone: ((): StructuredArticleCalloutBlock['tone'] => {
          const tone = assertNonEmptyString(block.tone, `${fieldName}.tone`);
          assert(
            tone === 'info' || tone === 'success' || tone === 'warning',
            `${fieldName}.tone must be info, success, or warning.`,
          );
          return tone;
        })(),
        ...(block.title === undefined ? {} : { title: assertNonEmptyString(block.title, `${fieldName}.title`) }),
        content: assertStringArray(block.content, `${fieldName}.content`),
      };

    case 'cta-group': {
      assert(Array.isArray(block.items) && block.items.length > 0, `${fieldName}.items must be a non-empty array.`);
      const items = block.items.map((item, index) => {
        const itemField = `${fieldName}.items[${index}]`;
        const normalized = assertCtaLink(item, itemField);
        const variant = item && typeof item === 'object' ? item.variant : undefined;

        if (variant === undefined) {
          return normalized;
        }

        const variantValue = assertNonEmptyString(variant, `${itemField}.variant`);
        assert(
          variantValue === 'primary' || variantValue === 'secondary',
          `${itemField}.variant must be primary or secondary.`,
        );
        const validatedVariant: 'primary' | 'secondary' = variantValue;

        return {
          ...normalized,
          variant: validatedVariant,
        };
      });

      return {
        id,
        type,
        items,
      };
    }

    default:
      throw new Error(`${fieldName}.type ${type} is unsupported.`);
  }
}

function validateFaq(value: unknown, fieldName: string): StructuredArticleFaqItem[] {
  assert(Array.isArray(value) && value.length > 0, `${fieldName} must be a non-empty array.`);

  return value.map((entry, index) => {
    const entryField = `${fieldName}[${index}]`;
    assert(isRecord(entry), `${entryField} must be an object.`);

    return {
      question: assertNonEmptyString(entry.question, `${entryField}.question`),
      answer: assertNonEmptyString(entry.answer, `${entryField}.answer`),
    };
  });
}

export function validateStructuredArticleDetail(detail: unknown, sourceLabel = 'structured article'): StructuredArticleDetail {
  assert(isRecord(detail), `${sourceLabel} must be an object.`);

  const schemaVersion = assertNonEmptyString(detail.schemaVersion, `${sourceLabel}.schemaVersion`);
  const slug = assertNonEmptyString(detail.slug, `${sourceLabel}.slug`);
  const category = assertNonEmptyString(detail.category, `${sourceLabel}.category`);
  const locale = assertNonEmptyString(detail.locale, `${sourceLabel}.locale`);
  const updatedAt = assertNonEmptyString(detail.updatedAt, `${sourceLabel}.updatedAt`);
  assert(isRecord(detail.seo), `${sourceLabel}.seo must be an object.`);
  const summary = assertNonEmptyString(detail.summary, `${sourceLabel}.summary`);
  assert(Array.isArray(detail.sections) && detail.sections.length > 0, `${sourceLabel}.sections must be a non-empty array.`);

  assert(
    schemaVersion === STRUCTURED_ARTICLE_SCHEMA_VERSION,
    `${sourceLabel}.schemaVersion must be ${STRUCTURED_ARTICLE_SCHEMA_VERSION}.`,
  );
  assert(category === STRUCTURED_ARTICLE_CATEGORY, `${sourceLabel}.category must be ${STRUCTURED_ARTICLE_CATEGORY}.`);

  const sections = detail.sections.map((section, sectionIndex) => {
    const sectionField = `${sourceLabel}.sections[${sectionIndex}]`;
    assert(isRecord(section), `${sectionField} must be an object.`);
    assert(Array.isArray(section.blocks) && section.blocks.length > 0, `${sectionField}.blocks must be a non-empty array.`);

    const blocks = section.blocks.map((block, blockIndex) =>
      validateStructuredArticleBlock(block, `${sectionField}.blocks[${blockIndex}]`),
    );

    ensureUnique(blocks.map((block) => block.id), `${sectionField}.blocks`);

    return {
      id: assertNonEmptyString(section.id, `${sectionField}.id`),
      title: assertNonEmptyString(section.title, `${sectionField}.title`),
      blocks,
    };
  });

  ensureUnique(sections.map((section) => section.id), `${sourceLabel}.sections`);

  return {
    schemaVersion,
    slug,
    category,
    locale,
    updatedAt,
    seo: {
      title: assertNonEmptyString(detail.seo.title, `${sourceLabel}.seo.title`),
      description: assertNonEmptyString(detail.seo.description, `${sourceLabel}.seo.description`),
    },
    summary,
    sections,
    ...(detail.faq === undefined ? {} : { faq: validateFaq(detail.faq, `${sourceLabel}.faq`) }),
    ...(detail.cta === undefined
      ? {}
      : {
          cta: {
            ...(isRecord(detail.cta) && detail.cta.primary !== undefined
              ? { primary: assertCtaLink(detail.cta.primary, `${sourceLabel}.cta.primary`) }
              : {}),
            ...(isRecord(detail.cta) && detail.cta.secondary !== undefined
              ? { secondary: assertCtaLink(detail.cta.secondary, `${sourceLabel}.cta.secondary`) }
              : {}),
          },
        }),
  };
}
function pickLatestTimestamp(values: string[]): string {
  const sorted = [...values].sort((left, right) => left.localeCompare(right));
  return sorted.at(-1) ?? new Date(0).toISOString();
}

export function buildStructuredArticleDetailPath(locale: string, slug: string): string {
  return `/articles/${locale}/${slug}.json`;
}

export function buildStructuredArticleLocaleManifestPath(locale: string): string {
  return `/articles/${locale}/index.json`;
}

/** Builds one locale manifest from details that are already loaded and validated. */
export function buildStructuredArticleLocaleManifestFromDetails(
  locale: string,
  details: readonly StructuredArticleDetail[],
): StructuredArticleLocaleManifest {
  assert(details.length > 0, `Locale ${locale} must contain at least one structured article detail.`);

  return {
    schemaVersion: STRUCTURED_ARTICLE_SCHEMA_VERSION,
    locale,
    generatedAt: pickLatestTimestamp(details.map((detail) => detail.updatedAt)),
    articles: details.map((detail) => ({
      slug: detail.slug,
      category: detail.category,
      path: buildStructuredArticleDetailPath(locale, detail.slug),
      updatedAt: detail.updatedAt,
      title: detail.seo.title,
      summary: detail.summary,
    })),
  };
}

/** Builds the root manifest from locale manifests that were built from loaded details. */
export function buildStructuredArticleRootManifestFromLocaleManifests(
  localeManifests: readonly StructuredArticleLocaleManifest[],
): StructuredArticleRootManifest {
  assert(localeManifests.length > 0, 'Structured article source must contain at least one locale directory.');

  return {
    schemaVersion: STRUCTURED_ARTICLE_SCHEMA_VERSION,
    generatedAt: pickLatestTimestamp(localeManifests.map((manifest) => manifest.generatedAt)),
    localeIndexes: localeManifests.map((manifest) => ({
      locale: manifest.locale,
      path: buildStructuredArticleLocaleManifestPath(manifest.locale),
      updatedAt: manifest.generatedAt,
    })),
  };
}
