import { z } from 'astro/zod';

const articlePromotionSchema = z.object({
  hagicodePromotion: z.boolean().optional(),
});

export { articlePromotionSchema };
export default articlePromotionSchema;
