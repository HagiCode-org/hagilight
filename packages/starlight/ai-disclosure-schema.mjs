import { z } from 'astro/zod';

const aiDisclosureSchema = z.object({
  isAITranslation: z.boolean().optional(),
  isAIAuthor: z.boolean().optional(),
});

export { aiDisclosureSchema };
export default aiDisclosureSchema;
