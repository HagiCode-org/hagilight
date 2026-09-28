import type { ZodBoolean, ZodObject, ZodOptional } from "astro/zod";

export const aiDisclosureSchema: ZodObject<{
  isAITranslation: ZodOptional<ZodBoolean>;
  isAIAuthor: ZodOptional<ZodBoolean>;
}>;

export { aiDisclosureSchema as default };
