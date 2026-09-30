import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HeadEntry } from './head.js';

export type { HeadEntry } from './head.js';

export interface FaviconLinkEntry extends HeadEntry {
  tag: 'link';
  attrs: { rel: 'icon'; href: string; type?: 'image/x-icon' };
}

export interface FaviconOptions {
  /** Consumer-provided favicon URL used instead of the bundled HagiCode icon. */
  href?: string;
}

const faviconPath = fileURLToPath(new URL('../favicon.ico', import.meta.url));
let cachedDataUri: string | undefined;

/** Bundled HagiCode favicon as an inline data URI, read at most once per process. */
export function getHagilightFaviconDataUri(): string {
  cachedDataUri ??= `data:image/x-icon;base64,${readFileSync(faviconPath).toString('base64')}`;
  return cachedDataUri;
}

function isIconLink(entry: HeadEntry | undefined): boolean {
  const rel = entry?.attrs?.rel;
  return entry?.tag === 'link' && typeof rel === 'string' && /\bicon\b/u.test(rel);
}

/**
 * Resolve the favicon `<link>` head entry to inject, or `undefined` when the
 * existing head already declares an icon.
 */
export function resolveFaviconHeadEntry(
  head: readonly HeadEntry[] | undefined = [],
  options: FaviconOptions = {},
): FaviconLinkEntry | undefined {
  if ((head ?? []).some(isIconLink)) return undefined;
  const overrideHref = typeof options.href === 'string' && options.href.trim()
    ? options.href.trim()
    : undefined;
  if (overrideHref !== undefined) return { tag: 'link', attrs: { rel: 'icon', href: overrideHref } };
  return { tag: 'link', attrs: { rel: 'icon', href: getHagilightFaviconDataUri(), type: 'image/x-icon' } };
}
