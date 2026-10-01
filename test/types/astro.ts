// Type fixture for @hagicode/hagilight. Each `@ts-expect-error` line must stay an error.
import type { AstroIntegration } from 'astro';
import {
  hagilight,
  hagilightFavicon,
  type HagilightRssOptions,
  type RssFeedCallback,
} from '@hagicode/hagilight/integration';

const rssOptions: HagilightRssOptions = {
  getFeed: './src/rss-feed.ts',
};
const integrations: AstroIntegration[] = [
  hagilight(),
  hagilight({ enabled: false }),
  hagilight({ rss: false }),
  hagilight({ rss: rssOptions }),
  hagilightFavicon(),
  hagilightFavicon({ href: '/favicon.svg' }),
];
const getFeed: RssFeedCallback = async ({ route, lang }) => ({
  title: `${route} ${lang}`,
  description: 'Updates',
  items: [{ title: 'Post', link: '/post/', pubDate: '2026-01-01' }],
});

// @ts-expect-error The discovery switch is a boolean.
hagilight({ enabled: 'yes' });
// @ts-expect-error getFeed is a project-relative module path, not the callback itself.
hagilight({ rss: { getFeed } });
// @ts-expect-error RSS content locales, when provided, must be a locale map.
hagilight({ rss: { locales: 'en' } });
// @ts-expect-error Feed callbacks must return a description.
const missingDescription: RssFeedCallback = () => ({ title: 'Feed', items: [] });

export { integrations, missingDescription };
