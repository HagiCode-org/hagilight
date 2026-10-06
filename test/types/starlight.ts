// Type fixture for @hagicode/hagilight-starlight. Each `@ts-expect-error` line must stay an error.
import starlight from '@astrojs/starlight';
import hagilight, { type HagilightStarlightOptions } from '@hagicode/hagilight-starlight';
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

export { english, frontmatter, integration, shapes };
