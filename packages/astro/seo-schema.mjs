import { z } from 'astro/zod';
import { isValidSeoImageReference } from './seo-utils.mjs';

const optionalText = z.string().trim().min(1).optional();
const optionalImage = z.string()
  .trim()
  .min(1)
  .refine(isValidSeoImageReference, {
    message: 'Use an absolute HTTP(S) URL or a site-root path beginning with "/".',
  })
  .optional();

export const seoSchema = z.object({
  seo: z.object({
    title: optionalText,
    description: optionalText,
    image: optionalImage,
    author: optionalText,
    publishedDate: z.coerce.date().optional(),
  }).optional(),
});

export { seoSchema as seoFrontmatterSchema };
export default seoSchema;
