import type { HtmlTagObject } from '@docusaurus/types';
import { consentDescriptor, type ConsentPopupOptions, CONSENT_DESCRIPTOR_ID } from '@hagicode/hagilight-core/consent-markup';
import { posthogInitScript, type PostHogSiteContext } from '@hagicode/hagilight-core/posthog';

export function posthogHeadTags(apiKey: string, context?: PostHogSiteContext): HtmlTagObject[] {
  return [{ tagName: 'script', innerHTML: posthogInitScript(apiKey, context) }];
}

/** Inert data for the consent gate: a JSON script that never executes, so no provider loads before a grant. */
export function consentDescriptorTag(provider: string, payload: Record<string, string>): HtmlTagObject {
  return {
    tagName: 'script',
    attributes: { type: 'application/json', 'data-hagilight-analytics': provider },
    innerHTML: JSON.stringify(payload).replace(/</gu, '\\u003c'),
  };
}

/** The popup's config descriptor, read by the client module once. It holds no IDs. */
export function consentConfigTag(config: ConsentPopupOptions): HtmlTagObject {
  return { tagName: 'script', attributes: { type: 'application/json', id: CONSENT_DESCRIPTOR_ID }, innerHTML: consentDescriptor(config) };
}

export const DEFAULT_GOOGLE_ANALYTICS_ID = 'G-EN03FMT2Q4';
export const DEFAULT_FIFTY_ONE_LA_ID = 'L6b88a5yK4h2Xnci';
export const GOOGLE_ANALYTICS_ID_PATTERN = /^G-[A-Z0-9]+$/u;
export const FIFTY_ONE_LA_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;

export function googleAnalyticsHeadTags(measurementId: string): HtmlTagObject[] {
  return [
    {
      tagName: 'script',
      attributes: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}` },
    },
    {
      tagName: 'script',
      innerHTML: [
        'window.dataLayer = window.dataLayer || [];',
        'function gtag(){dataLayer.push(arguments);}',
        "gtag('js', new Date());",
        `gtag('config', ${JSON.stringify(measurementId)});`,
      ].join('\n'),
    },
  ];
}

export function fiftyOneLaHeadTags(siteId: string): HtmlTagObject[] {
  return [
    {
      tagName: 'script',
      attributes: { charset: 'UTF-8', id: 'LA_COLLECT', src: 'https://sdk.51.la/js-sdk-pro.min.js' },
    },
    {
      tagName: 'script',
      innerHTML: `LA.init(${JSON.stringify({ id: siteId, ck: siteId, autoTrack: true, hashMode: true })});`,
    },
  ];
}
