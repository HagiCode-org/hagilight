/**
 * Decides which Hagilight integration writes `hagilight.metadata.json` when the
 * plain-Astro integration and the Starlight plugin are both registered. Same
 * `globalThis` pattern as `rss-ownership.ts`, so separately installed copies of
 * this module still see each other.
 *
 * Ownership is decided by claims: the Starlight plugin claims at creation, and the
 * plain-Astro integration asks at config setup. The write is coordinated at build
 * time. The owner hands over its write closure. Each deferring peer reports when
 * its own build hook has finished (for example after `llms.txt`), and the write runs
 * once the owner and every pending peer are done, whichever hook finishes last.
 * Output therefore does not depend on hook or registration order.
 */

export type SiteMetadataOwnerPackage = 'astro' | 'starlight';

export interface SiteMetadataOwnerClaim {
  readonly package: SiteMetadataOwnerPackage;
  readonly enabled: boolean;
}

interface Registry {
  readonly claims: Map<symbol, SiteMetadataOwnerClaim>;
  readonly pending: Set<symbol>;
  ownerWrite?: () => void;
}

const REGISTRY_KEY = Symbol.for('@hagicode/hagilight-core/site-metadata-registry');

type RegistryHost = typeof globalThis & { [REGISTRY_KEY]?: Registry };

function registry(): Registry {
  const host = globalThis as RegistryHost;
  host[REGISTRY_KEY] ??= { claims: new Map(), pending: new Set() };
  return host[REGISTRY_KEY];
}

/**
 * Record the Starlight claim as soon as the plugin is created, so a plain-Astro
 * integration listed earlier can defer to it. Returns a callback that withdraws it.
 */
export function registerStarlightSiteMetadataOwner(enabled: boolean): () => void {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('Hagilight site metadata owner enabled flag must be a boolean.');
  }
  const token = Symbol('starlight-site-metadata-owner');
  registry().claims.set(token, { package: 'starlight', enabled });
  return () => {
    registry().claims.delete(token);
  };
}

/**
 * Return `'starlight'` when an enabled Starlight claim is registered, else `'astro'`.
 * Call it at plain-Astro config setup, after the Starlight plugin was created.
 */
export function resolveSiteMetadataOwner(): SiteMetadataOwnerPackage {
  const claims = [...registry().claims.values()];
  return claims.some((claim) => claim.package === 'starlight' && claim.enabled) ? 'starlight' : 'astro';
}

/**
 * Called by a deferring peer at config setup. The owner waits for this participant
 * until it calls `reportSiteMetadataBuilt` with the returned token.
 */
export function expectSiteMetadataReport(): symbol {
  const token = Symbol('site-metadata-peer');
  registry().pending.add(token);
  return token;
}

/** Called by a deferring peer when its build hook has finished. */
export function reportSiteMetadataBuilt(token: symbol): void {
  const state = registry();
  state.pending.delete(token);
  flush(state);
}

/**
 * Called by the owner in its build hook with the closure that writes the file.
 * Runs now when no peer is pending, otherwise when the last pending peer reports.
 */
export function completeSiteMetadataOwnerBuild(write: () => void): void {
  const state = registry();
  state.ownerWrite = write;
  flush(state);
}

function flush(state: Registry): void {
  if (!state.ownerWrite || state.pending.size > 0) return;
  const write = state.ownerWrite;
  state.ownerWrite = undefined;
  write();
}
