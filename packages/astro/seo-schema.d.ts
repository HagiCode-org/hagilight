import type {
  ZodDate,
  ZodObject,
  ZodOptional,
  ZodString,
} from "astro/zod";

export const seoSchema: ZodObject<{
  seo: ZodOptional<
    ZodObject<{
      title: ZodOptional<ZodString>;
      description: ZodOptional<ZodString>;
      image: ZodOptional<ZodString>;
      author: ZodOptional<ZodString>;
      publishedDate: ZodOptional<ZodDate>;
    }>
  >;
}>;

export { seoSchema as seoFrontmatterSchema };
export { seoSchema as default };
