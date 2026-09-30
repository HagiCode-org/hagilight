// Type fixture for @hagicode/hagilight. Each `@ts-expect-error` line must stay an error.
import type { AstroIntegration } from 'astro';
import {
  hagilight,
  hagilightFavicon,
  hagilightRss,
  type HagilightRssIntegration,
  type HagilightRssOptions,
  type RssFeedCallback,
} from '@hagicode/hagilight/integration';

const rssOptions: HagilightRssOptions = {
  locales: { root: { label: 'English', lang: 'en-US' }, 'zh-CN': { label: '简体中文', lang: 'zh-CN' } },
  getFeed: './src/rss-feed.ts',
};
const rss: HagilightRssIntegration = hagilightRss(rssOptions);
const integrations: AstroIntegration[] = [
  hagilight(),
  hagilight({ enabled: false }),
  hagilightFavicon(),
  hagilightFavicon({ href: '/favicon.svg' }),
  rss,
];
const getFeed: RssFeedCallback = async ({ route, lang }) => ({
  title: `${route} ${lang}`,
  description: 'Updates',
  items: [{ title: 'Post', link: '/post/', pubDate: '2026-01-01' }],
});

// @ts-expect-error The discovery switch is a boolean.
hagilight({ enabled: 'yes' });
// @ts-expect-error getFeed is a project-relative module path, not the callback itself.
hagilightRss({ locales: rssOptions.locales, getFeed });
// @ts-expect-error RSS generation requires a locale map.
hagilightRss({ getFeed: './src/rss-feed.ts' });
// @ts-expect-error Feed callbacks must return a description.
const missingDescription: RssFeedCallback = () => ({ title: 'Feed', items: [] });

export { integrations, missingDescription };
