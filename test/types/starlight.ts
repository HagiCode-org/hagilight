// Type fixture for @hagicode/hagilight-starlight. Each `@ts-expect-error` line must stay an error.
import starlight from '@astrojs/starlight';
import hagilight, { type HagilightStarlightOptions, type HagilightPostHogOptions } from '@hagicode/hagilight-starlight';
import { locales, type LocaleDefinition } from '@hagicode/hagilight-starlight/locales';
import {
  aiDisclosureSchema,
  articlePromotionSchema,
  hagilightSchema,
  rssSchema,
  type HagilightFrontmatter,
} from '@hagicode/hagilight-starlight/schema';

const options: HagilightStarlightOptions = {
  header: { enabled: true },
  notFoundPage: { enabled: false },
  rss: { enabled: true, includeDocs: false, includeBlog: true },
  analytics: { googleAnalytics: { measurementId: 'G-TEST123' }, fiftyOneLa: { enabled: false } },
  seo: {
    image: '/share-card.svg',
    organization: { name: 'Example', url: 'https://example.test/', logo: '/logo.png' },
  },
  contentComponents: { pageTitle: true, markdownContent: false },
  themes: { enabled: true },
  aiDisclosures: { isAITranslation: true, sourceLocale: 'root' },
  hagicodePromotion: { enabled: false },
  promoto: { enabled: true },
  contentImages: { enabled: false },
  links: { siteId: 'example', siteUrl: 'https://example.test/' },
};
const english: LocaleDefinition = locales.root;
const integration = starlight({ title: 'Example', locales, plugins: [hagilight(options), hagilight()] });
const frontmatter: HagilightFrontmatter = hagilightSchema.parse({ rss: false, seo: { title: 'Title' } });
const shapes = [aiDisclosureSchema.shape.isAIAuthor, articlePromotionSchema.shape.hagicodePromotion, rssSchema.shape.rss];

// @ts-expect-error Section switches are option objects, not booleans.
hagilight({ header: false });
// @ts-expect-error Theme picker enabled is a boolean.
hagilight({ themes: { enabled: 'yes' } });
// @ts-expect-error SEO enabled is a boolean.
hagilight({ seo: { enabled: 'yes' } });
// @ts-expect-error Unknown top-level options are rejected.
hagilight({ unknownOption: true });
// @ts-expect-error Google Analytics 4 measurement IDs start with "G-".
hagilight({ analytics: { googleAnalytics: { measurementId: 'UA-1234' } } });
// @ts-expect-error RSS content filters are booleans.
hagilight({ rss: { includeBlog: 'no' } });
// @ts-expect-error SEO organizations require a URL.
hagilight({ seo: { organization: { name: 'Example' } } });
// @ts-expect-error The body-image toggle is an options object, not a boolean.
hagilight({ contentImages: false });
// @ts-expect-error The body-image enabled switch is a boolean.
hagilight({ contentImages: { enabled: 'yes' } });

export { english, frontmatter, integration, shapes };

const posthog: HagilightPostHogOptions = { apiKey: 'phc_Custom123' };
hagilight({ analytics: { posthog } });
hagilight({ analytics: {} });
hagilight({ analytics: { posthog: {} } });
hagilight({ analytics: { posthog: { enabled: false } } });
// @ts-expect-error PostHog options are an object.
hagilight({ analytics: { posthog: true } });
// @ts-expect-error PostHog enabled is boolean.
hagilight({ analytics: { posthog: { enabled: 'yes' } } });
// @ts-expect-error PostHog project keys are strings.
hagilight({ analytics: { posthog: { apiKey: 42 } } });
// @ts-expect-error The PostHog key field is apiKey.
hagilight({ analytics: { posthog: { key: 'phc_Test' } } });

hagilight({ metadata: false });
hagilight({ metadata: { name: 'HagiCode Docs', description: 'Documentation for HagiCode.' } });
// @ts-expect-error The metadata option is a boolean or an options object.
hagilight({ metadata: 'yes' });
// @ts-expect-error The metadata description is a string.
hagilight({ metadata: { description: 42 } });
// @ts-expect-error Misspelled metadata fields are rejected.
hagilight({ metadata: { site: 'HagiCode Docs' } });
// The search option: off by default, zero-results is the only other value, and it is a closed set.
hagilight({ analytics: { posthog: { searchQuery: 'off' } } });
hagilight({ analytics: { posthog: { searchQuery: 'zero-results' } } });
// @ts-expect-error searchQuery accepts only off or zero-results.
hagilight({ analytics: { posthog: { searchQuery: 'everything' } } });
