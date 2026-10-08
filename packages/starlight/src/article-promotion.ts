import { COPY } from './article-promotion-copy/index.js';

export interface ArticlePromotionFeature {
  id: 'smart' | 'efficient' | 'fun';
  /** Localized pillar word. */
  label: string;
  description: string;
}

export interface ArticlePromotionGalleryItem {
  /** Matches an entry in `assets/showcase/manifest.json`. */
  id: string;
  caption: string;
  alt: string;
}

export interface ArticlePromotionCopy {
  title: string;
  lead: string;
  subheadline: string;
  /** Text alternative of the lead gallery image. */
  imageAlt: string;
  features: readonly ArticlePromotionFeature[];
  visitLabel: string;
  /** Secondary call to action. */
  docsLabel: string;
  galleryHeading: string;
  gallery: readonly ArticlePromotionGalleryItem[];
  /** Visible caption beside the Windows download button. */
  windowsLabel: string;
  /** Text of the static fallback link to the Microsoft Store listing. */
  windowsStoreLabel: string;
  /** Accessible name and tooltip for the Microsoft Store badge and its fallback link. */
  windowsStoreAriaLabel: string;
  /** Link to the all-platforms downloads page. */
  allDownloadsLabel: string;
  shareLabel: string;
  /** One sentence ending with the website address. */
  shareText: string;
}

export { COPY };

export function resolveArticlePromotion(frontmatterValue: unknown, siteDefault: boolean = true): boolean {
  if (typeof siteDefault !== 'boolean') {
    throw new TypeError('Hagilight hagicodePromotion enabled default must be a boolean.');
  }
  if (frontmatterValue !== undefined && typeof frontmatterValue !== 'boolean') {
    throw new TypeError('Hagilight frontmatter hagicodePromotion must be a boolean.');
  }
  return (frontmatterValue as boolean | undefined) ?? siteDefault;
}

export function getArticlePromotionCopy(lang: string | undefined): ArticlePromotionCopy {
  return (lang === undefined ? undefined : COPY[lang]) ?? COPY['en-US']!;
}
