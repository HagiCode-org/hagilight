import type { StarlightPlugin } from "@astrojs/starlight";

export interface HagilightOptions {
  header?: boolean | { enabled?: boolean };
  notFoundPage?: boolean | { enabled?: boolean };
  rss?: boolean | { enabled?: boolean };
  analytics?: Record<string, unknown>;
  seo?: unknown;
  contentComponents?: Record<string, boolean>;
  aiDisclosures?: unknown;
  hagicodePromotion?: unknown;
  promoto?: { enabled?: boolean; links?: Record<string, string> };
  links?: Record<string, string>;
  [key: string]: unknown;
}

export default function hagilight(options?: HagilightOptions): StarlightPlugin;
