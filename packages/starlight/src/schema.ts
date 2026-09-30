import { z } from 'astro/zod';
import { seoSchema } from '@hagicode/hagilight-core/seo-schema';

/** Per-page AI disclosure flags that override the plugin `aiDisclosures` defaults. */
export const aiDisclosureSchema = z.object({
  isAITranslation: z.boolean().optional(),
  isAIAuthor: z.boolean().optional(),
});

/** Per-page switch for the end-of-article HagiCode introduction. */
export const articlePromotionSchema = z.object({
  hagicodePromotion: z.boolean().optional(),
});

/** Per-page switch that excludes a page from generated RSS feeds when `false`. */
export const rssSchema = z.object({
  rss: z.boolean().optional(),
});

/**
 * Every frontmatter field read by the Hagilight Starlight plugin, including the
 * shared `seo` object. Pass it to Starlight as `docsSchema({ extend: hagilightSchema })`.
 */
export const hagilightSchema = z.object({
  ...aiDisclosureSchema.shape,
  ...articlePromotionSchema.shape,
  ...rssSchema.shape,
  ...seoSchema.shape,
});

export type HagilightFrontmatter = z.infer<typeof hagilightSchema>;
