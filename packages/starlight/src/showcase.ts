import { COPY, getArticlePromotionCopy } from './article-promotion.js';

export type {
  ArticlePromotionCopy as ShowcaseCopy,
  ArticlePromotionFeature as ShowcaseFeature,
  ArticlePromotionGalleryItem as ShowcaseGalleryItem,
} from './article-promotion.js';

/** Returns the read-only showcase copy for a locale, or the English copy when the locale has none. */
export const getShowcaseCopy = getArticlePromotionCopy;

/** Locales that have their own showcase copy. */
export const showcaseLocales: readonly string[] = Object.freeze(Object.keys(COPY));
