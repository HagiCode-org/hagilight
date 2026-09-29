import type { APIRoute } from 'astro';
import { generateRssFeed } from '@hagicode/hagilight/rss';

export const GET: APIRoute = ({ site }) => generateRssFeed({
  site,
  baseUrl: import.meta.env.BASE_URL,
  language: 'en-US',
  title: 'Hagilight core footer demo',
  description: 'Pages published by the plain Astro core footer example.',
  items: [
    {
      title: 'Shared links. No Starlight required.',
      description: 'An independent Astro demo of the localized Hagilight core footer.',
      link: '/',
      date: new Date('2026-09-27T00:00:00.000Z'),
    },
    {
      title: '共享链接，不依赖 Starlight。',
      description: '这是一个独立 Astro 示例，展示 Hagilight core 包提供的本地化页脚。',
      link: '/zh-CN/',
    },
  ],
});
