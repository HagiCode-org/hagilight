/**
 * Node-only writer for `.well-known/hagilight.metadata.json`. Kept separate from
 * `site-metadata.ts` so the browser-safe contract never imports `node:` modules.
 */
import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  SITE_METADATA_PATH,
  serializeSiteMetadata,
  type SiteMetadata,
  type SiteMetadataDiscovery,
} from './site-metadata.js';

export interface SiteMetadataLogger {
  info(message: string): void;
  warn(message: string): void;
}

/** Candidate file names per discovery key, in preference order. */
const DISCOVERY_FILES: Readonly<Record<keyof SiteMetadataDiscovery, readonly string[]>> = {
  sitemap: ['sitemap-index.xml', 'sitemap.xml'],
  robots: ['robots.txt'],
  rss: ['rss.xml'],
  llms: ['llms.txt'],
};

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

/**
 * Report which discovery artifacts exist in the finished build output. Paths are
 * relative to the site base, so `sitemap-index.xml` is reported as `/sitemap-index.xml`.
 */
export function findDiscoveryOutputs(outDir: string): SiteMetadataDiscovery {
  const discovery: Record<string, string> = {};
  for (const [key, names] of Object.entries(DISCOVERY_FILES)) {
    const found = names.find((name) => isFile(join(outDir, name)));
    if (found) discovery[key] = `/${found}`;
  }
  return discovery as SiteMetadataDiscovery;
}

export interface WriteSiteMetadataInput {
  /** Build output directory. */
  outDir: string;
  metadata: SiteMetadata;
  /** Site-owned copies, such as `public/` or `static/` files. A site-owned file is never overwritten. */
  siteOwnedFiles?: readonly string[];
  logger: SiteMetadataLogger;
}

export type WriteSiteMetadataResult = 'written' | 'kept';

/**
 * Write the metadata file into the build output. An existing file, either in the
 * output or among the site-owned files, is kept and reported. The write goes to a
 * temporary file that is renamed into place, so readers never see a partial file.
 */
export function writeSiteMetadata({ outDir, metadata, siteOwnedFiles = [], logger }: WriteSiteMetadataInput): WriteSiteMetadataResult {
  const target = join(outDir, SITE_METADATA_PATH);
  const existing = [target, ...siteOwnedFiles].find(isFile);
  if (existing) {
    logger.info(`${SITE_METADATA_PATH} already exists (${existing}); leaving it untouched.`);
    return 'kept';
  }

  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporary, serializeSiteMetadata(metadata), 'utf8');
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  logger.info(`Generated ${SITE_METADATA_PATH}.`);
  return 'written';
}
