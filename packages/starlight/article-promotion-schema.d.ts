import type { ZodBoolean, ZodObject, ZodOptional } from "astro/zod";

export const articlePromotionSchema: ZodObject<{
  hagicodePromotion: ZodOptional<ZodBoolean>;
}>;

export { articlePromotionSchema as default };
