import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { aiDisclosureSchema } from '@hagicode/hagilight-starlight/ai-disclosure-schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: aiDisclosureSchema }) }),
};
