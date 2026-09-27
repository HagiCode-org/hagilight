import { z } from 'astro/zod';

const rssSchema = z.object({
  rss: z.boolean().optional(),
});

export { rssSchema };
export default rssSchema;
