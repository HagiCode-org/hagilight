import { z } from 'astro/zod';
import { isValidSeoImageReference } from './seo.js';

const optionalText = z.string().trim().min(1).optional();
const optionalImage = z.string()
  .trim()
  .min(1)
  .refine(isValidSeoImageReference, {
    message: 'Use an absolute HTTP(S) URL or a site-root path beginning with "/".',
  })
  .optional();

/** Frontmatter schema for the optional `seo` object consumed by Hagilight SEO helpers. */
export const seoSchema = z.object({
  seo: z.object({
    title: optionalText,
    description: optionalText,
    image: optionalImage,
    author: optionalText,
    publishedDate: z.coerce.date().optional(),
  }).optional(),
});

export type SeoFrontmatter = z.infer<typeof seoSchema>;
