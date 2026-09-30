import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { hagilightSchema } from '@hagicode/hagilight-starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader({
      generateId: ({ entry }) => entry.replace(/\.[^./]+$/u, '').replace(/\/index$/u, ''),
    }),
    schema: docsSchema({ extend: hagilightSchema }),
  }),
};
