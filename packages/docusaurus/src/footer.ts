import { resolveConsentCopy } from '@hagicode/hagilight-core/consent-copy';
import { resolveSiteLinks, type SiteLinksOptions } from '@hagicode/hagilight-core/links';
import type { ResolvedConsentOptions } from './options.js';

export interface FooterLinksInput {
  locale: string;
  baseUrl: string;
  links: SiteLinksOptions;
  rssEnabled: boolean;
}

export type FooterLinks = ReturnType<typeof resolveSiteLinks>;

export function resolveFooterLinks({ locale, baseUrl, links, rssEnabled }: FooterLinksInput): FooterLinks {
  const sitemap = links.overrides?.sitemap;
  return resolveSiteLinks(locale, {
    ...links,
    rssFeedUrl: links.rssFeedUrl ?? (rssEnabled ? `${baseUrl}rss.xml` : undefined),
    overrides: {
      ...links.overrides,
      sitemap: { ...sitemap, href: sitemap?.href ?? `${baseUrl}sitemap.xml` },
    },
  });
}

export interface FooterConsentEntries {
  /** The "Cookie settings" label. Absent when consent is off, so no entry renders. */
  consentLabel: string | undefined;
  /** A regional site: the settings entry renders hidden until the consent popup reveals it. */
  regional: boolean;
  /** The session replay entry label, for a regional site with replay opt-in. */
  replayLabel: string | undefined;
}

export function resolveFooterConsent(consent: ResolvedConsentOptions, locale: string): FooterConsentEntries {
  if (!consent.enabled) return { consentLabel: undefined, regional: false, replayLabel: undefined };
  const copy = resolveConsentCopy(locale);
  const regional = consent.regional !== undefined;
  return {
    consentLabel: copy.footerEntry,
    regional,
    replayLabel: regional && consent.regional?.sessionReplay === 'optIn' ? copy.replayEntry : undefined,
  };
}
