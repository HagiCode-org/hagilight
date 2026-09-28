import type { ZodBoolean, ZodObject, ZodOptional } from "astro/zod";

export const rssSchema: ZodObject<{
  rss: ZodOptional<ZodBoolean>;
}>;

export { rssSchema as default };
