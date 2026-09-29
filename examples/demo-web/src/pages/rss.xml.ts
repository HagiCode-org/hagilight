import type { APIRoute } from 'astro';
import { generateRssFeed } from '@hagicode/hagilight/rss';

export const GET: APIRoute = ({ site }) => generateRssFeed({
  site,
  baseUrl: import.meta.env.BASE_URL,
  language: 'en-US',
  title: 'Hagilight core package showcase',
  description: 'English and Simplified Chinese pages introducing the Hagilight core Astro package.',
  items: [
    {
      title: 'Explore Hagilight core, without Starlight.',
      description: 'A bilingual, standalone Astro tour of the shared components and build integrations in @hagicode/hagilight.',
      link: '/',
    },
    {
      title: '探索 Hagilight core，无需 Starlight。',
      description: '通过独立的 Astro 双语示例，了解 @hagicode/hagilight 提供的共享组件和构建集成。',
      link: '/zh-CN/',
    },
  ],
});
