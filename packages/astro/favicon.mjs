import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const faviconPath = fileURLToPath(new URL('./favicon.ico', import.meta.url));
let cachedDataUri;

/**
 * Resolve the bundled HagiCode favicon as an inline data URI.
 * Memoized so the binary is read at most once per process.
 */
export function getHagilightFaviconDataUri() {
  if (cachedDataUri === undefined) {
    const bytes = readFileSync(faviconPath);
    cachedDataUri = `data:image/x-icon;base64,${bytes.toString('base64')}`;
  }
  return cachedDataUri;
}

function isIconLink(entry) {
  return entry?.tag === 'link'
    && typeof entry.attrs?.rel === 'string'
    && /\bicon\b/u.test(entry.attrs.rel);
}

function headHasIconLink(head) {
  return (head ?? []).some(isIconLink);
}

/**
 * Resolve the favicon `<link>` head entry to inject, or `undefined` to skip.
 *
 * Shared by both the `hagilightFavicon` integration and the Starlight plugin so the
 * favicon behavior has a single source of truth.
 *
 * Override options:
 * - Pass `{ href: '/your-favicon.ico' }` to use a consumer-provided favicon instead.
 * - If `head` already contains an icon link, injection is skipped (so manual favicons
 *   are never duplicated).
 *
 * @param {Array<{tag:string, attrs?:Record<string,string>}>} head existing head entries
 * @param {{href?:string}} [options] optional override href
 */
export function resolveFaviconHeadEntry(head = [], options = {}) {
  if (headHasIconLink(head)) return undefined;
  const overrideHref = typeof options.href === 'string' && options.href.trim()
    ? options.href.trim()
    : undefined;
  const href = overrideHref ?? getHagilightFaviconDataUri();
  const attrs = { rel: 'icon', href };
  if (overrideHref === undefined) attrs.type = 'image/x-icon';
  return { tag: 'link', attrs };
}

/**
 * Astro integration that auto-applies the bundled HagiCode favicon.
 *
 * Any site referencing `@hagicode/hagilight` can add `integrations: [hagilightFavicon()]`
 * to get the shared favicon with no further configuration.
 */
export function hagilightFavicon(options = {}) {
  if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
    throw new TypeError('Hagilight favicon options must be an object.');
  }
  return {
    name: '@hagicode/hagilight:favicon',
    hooks: {
      'astro:config:setup'({ config, updateConfig }) {
        const entry = resolveFaviconHeadEntry(config.head, options);
        if (!entry) return;
        updateConfig({
          head: [...(config.head ?? []), entry],
        });
      },
    },
  };
}