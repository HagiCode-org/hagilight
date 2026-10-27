/**
 * First-party link policy shared by the footer, header and promotion banner.
 *
 * Kept free of JSON imports so the browser-side promotion banner can use it
 * without pulling in the link catalog. `links.ts` re-exports these helpers.
 */

export type LinkClass = 'same-origin' | 'first-party' | 'third-party';
export type LinkRel = 'noopener' | 'noopener noreferrer';
export type CampaignMedium = 'article' | 'footer' | 'promoto';

export interface ClassifyLinkOptions {
  /** The hosting site's origin, e.g. `https://docs.hagicode.com`, when known. */
  origin?: string;
}

export interface CampaignTagOptions extends ClassifyLinkOptions {
  /** The hosting site's identifier. Without it, no tag is added. */
  siteId?: string | null;
  medium: CampaignMedium;
  /** The promotion id or stable link id, sent as `utm_campaign`. Omitted leaves the key unset. */
  campaign?: string | null;
  /** Where the link sits, sent as `utm_content`, for example `footer` or `promoto_banner`. */
  content?: string | null;
}

const PLACEHOLDER_ORIGIN = 'https://hagilight.invalid';
const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/iu;
const FIRST_PARTY_GITHUB_ORG = 'hagicode-org';

function originOf(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const { origin } = new URL(value);
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
}

function isFirstPartyUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === 'hagicode.com' || host.endsWith('.hagicode.com')) return true;
  if (host !== 'github.com') return false;
  const [organization] = url.pathname.split('/').filter(Boolean);
  return organization?.toLowerCase() === FIRST_PARTY_GITHUB_ORG;
}

/**
 * Classifies a destination from its parsed URL. Relative destinations are
 * same-origin; anything that is not http(s) is treated as third-party, which
 * keeps a strict relation attribute on it.
 */
export function classifyLink(href: string, options: ClassifyLinkOptions = {}): LinkClass {
  const input = href.trim();
  if (!input) return 'third-party';
  if (!SCHEME_PATTERN.test(input) && !input.startsWith('//')) return 'same-origin';

  let url: URL;
  try {
    url = new URL(input, options.origin ?? PLACEHOLDER_ORIGIN);
  } catch {
    return 'third-party';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'third-party';
  if (url.origin === originOf(options.origin)) return 'same-origin';
  return isFirstPartyUrl(url) ? 'first-party' : 'third-party';
}

/** The relation attribute for a new-tab link of the given class. */
export function getLinkRel(linkClass: LinkClass): LinkRel {
  return linkClass === 'third-party' ? 'noopener noreferrer' : 'noopener';
}

/**
 * Adds `utm_source=<siteId>`, `utm_medium=<medium>`, and, when given,
 * `utm_campaign=<campaign>` and `utm_content=<content>` to first-party
 * `hagicode.com` destinations. Existing `utm_*` keys win, other parameters and
 * the fragment are preserved, and every other class of destination is returned
 * unchanged.
 */
export function withCampaignUtm(href: string, options: CampaignTagOptions): string {
  const siteId = options.siteId?.trim();
  if (!siteId) return href;

  let url: URL;
  try {
    url = new URL(href.trim(), options.origin ?? PLACEHOLDER_ORIGIN);
  } catch {
    return href;
  }
  if (url.protocol !== 'https:') return href;
  if (url.origin === originOf(options.origin)) return href;
  const host = url.hostname.toLowerCase();
  if (host !== 'hagicode.com' && !host.endsWith('.hagicode.com')) return href;

  const existingKeys = new Set(
    url.search.replace(/^\?/u, '').split('&').filter(Boolean).map((pair) => pair.split('=')[0]),
  );
  const additions: string[] = [];
  if (!existingKeys.has('utm_source')) additions.push(`utm_source=${encodeURIComponent(siteId)}`);
  if (!existingKeys.has('utm_medium')) additions.push(`utm_medium=${options.medium}`);
  const campaign = options.campaign?.trim();
  if (campaign && !existingKeys.has('utm_campaign')) additions.push(`utm_campaign=${encodeURIComponent(campaign)}`);
  const content = options.content?.trim();
  if (content && !existingKeys.has('utm_content')) additions.push(`utm_content=${encodeURIComponent(content)}`);
  if (additions.length === 0) return href;

  const current = url.search.replace(/^\?/u, '');
  url.search = [current, ...additions].filter(Boolean).join('&');
  return url.toString();
}
