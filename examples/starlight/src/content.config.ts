import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { articlePromotionSchema } from '@hagicode/hagilight-starlight/article-promotion-schema';
import { aiDisclosureSchema } from '@hagicode/hagilight-starlight/ai-disclosure-schema';
import { rssSchema } from '@hagicode/hagilight-starlight/rss-schema';
import { z } from 'astro/zod';

const hagilightSchema = z.object({
  ...aiDisclosureSchema.shape,
  ...articlePromotionSchema.shape,
  ...rssSchema.shape,
});
export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: hagilightSchema }) }),
};
