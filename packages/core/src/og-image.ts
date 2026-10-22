/** Width, in pixels, of the Open Graph preview that a convertible image becomes. */
export const OG_IMAGE_WIDTH = 1200;
/** Height, in pixels, of the Open Graph preview that a convertible image becomes. */
export const OG_IMAGE_HEIGHT = 630;
/** Format of the Open Graph preview that a convertible image becomes. */
export const OG_IMAGE_FORMAT = 'jpeg';
/** Encoder quality of the Open Graph preview that a convertible image becomes. */
export const OG_IMAGE_QUALITY = 80;

export type OgImageClassification = 'compatible' | 'convertible' | 'unrecognised';

const COMPATIBLE_EXTENSIONS: ReadonlySet<string> = new Set(['jpg', 'jpeg', 'png', 'gif']);
const CONVERTIBLE_EXTENSIONS: ReadonlySet<string> = new Set(['avif', 'webp']);

/**
 * Classify a declared preview image by the extension of its path. The query and fragment are
 * ignored, the scheme and host of an absolute URL are ignored, and the extension is compared in
 * lower case. The image bytes are never read, so the result does not depend on the site or host.
 */
export function classifyOgImage(reference: string): OgImageClassification {
  const path = reference.replace(/[?#].*$/u, '').replace(/^[a-z][a-z\d+.-]*:\/\/[^/]*/iu, '');
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const extension = dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
  if (COMPATIBLE_EXTENSIONS.has(extension)) return 'compatible';
  if (CONVERTIBLE_EXTENSIONS.has(extension)) return 'convertible';
  return 'unrecognised';
}
