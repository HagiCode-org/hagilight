/**
 * Coordinates which Hagilight integration owns the generated RSS routes when the
 * plain-Astro and Starlight packages are both registered in one Astro project.
 * The registry lives on `globalThis` so that separately installed copies of
 * this module still observe each other.
 */

export type RssOwnerPackage = 'astro' | 'starlight';

export interface RssOwnerClaim {
  readonly package: RssOwnerPackage;
  readonly enabled: boolean;
}

/** Property key an integration object uses to advertise its RSS ownership claim. */
export const RSS_OWNER: unique symbol = Symbol.for('@hagicode/hagilight-core/rss-owner');

const RSS_OWNER_REGISTRY = Symbol.for('@hagicode/hagilight-core/rss-owner-registry');

type RegistryHost = typeof globalThis & { [RSS_OWNER_REGISTRY]?: Map<symbol, RssOwnerClaim> };

function registry(): Map<symbol, RssOwnerClaim> {
  const host = globalThis as RegistryHost;
  host[RSS_OWNER_REGISTRY] ??= new Map();
  return host[RSS_OWNER_REGISTRY];
}

/**
 * Record a Starlight RSS claim as soon as the Starlight plugin is created, so a
 * plain-Astro RSS integration earlier in the integration list can defer to it.
 * Returns a callback that withdraws the claim.
 */
export function registerStarlightRssOwner(enabled: boolean): () => void {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('Hagilight RSS owner enabled flag must be a boolean.');
  }
  const token = Symbol('starlight-rss-owner');
  const owners = registry();
  owners.set(token, { package: 'starlight', enabled });
  return () => {
    owners.delete(token);
  };
}

function isOwnerClaim(value: unknown): value is RssOwnerClaim {
  if (!value || typeof value !== 'object') return false;
  const claim = value as Partial<RssOwnerClaim>;
  return (claim.package === 'astro' || claim.package === 'starlight') && typeof claim.enabled === 'boolean';
}

function claimOf(integration: unknown): RssOwnerClaim | undefined {
  if (!integration || typeof integration !== 'object') return undefined;
  const claim = (integration as { [RSS_OWNER]?: unknown })[RSS_OWNER];
  return isOwnerClaim(claim) ? claim : undefined;
}

/**
 * Decide whether the plain-Astro RSS integration should generate routes.
 * Consumes pending Starlight claims. Returns `'starlight'` when an enabled
 * Starlight RSS integration owns the routes, otherwise `'astro'`.
 */
export function resolvePlainAstroRssOwner(integrations: readonly unknown[] = []): RssOwnerPackage {
  const owners = registry();
  const registered = [...owners.values()];
  const starlightOwners = registered.length > 0
    ? registered
    : integrations.map(claimOf).filter((claim): claim is RssOwnerClaim => claim?.package === 'starlight');
  owners.clear();

  const active = starlightOwners.filter((owner) => owner.enabled);
  if (active.length > 1) {
    throw new Error('Hagilight RSS cannot determine a sole route owner because multiple Starlight RSS integrations are enabled.');
  }
  if (active.length === 1) return 'starlight';
  if (starlightOwners.length > 0) {
    throw new Error('Hagilight RSS cannot establish route ownership: Starlight RSS is explicitly disabled while hagilightRss() requests feed generation. Enable Starlight RSS or remove hagilightRss().');
  }
  return 'astro';
}
