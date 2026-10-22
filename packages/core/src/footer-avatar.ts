/**
 * Public contract for the shared footer avatar (`hagilight-footer-imagery`): option parsing and the decorative
 * image attributes that the Astro and Docusaurus footers both render. Browser-safe: no `node:` import.
 */

export interface FooterAvatarOptions {
  /** Show the avatar in the brand block. Defaults to `true`; `false` removes the element and its request. */
  avatar?: boolean;
  /** Swap the avatar for one random pool entry per page view. Defaults to `true`. */
  randomAvatar?: boolean;
}

export interface ResolvedFooterAvatarOptions {
  avatar: boolean;
  randomAvatar: boolean;
}

export const FOOTER_AVATAR_DISPLAY_PX = 64;
export const FOOTER_AVATAR_SOURCE_PX = 128;
/** Below this container width the avatar is hidden, so a narrow footer keeps its text layout. */
export const FOOTER_AVATAR_MIN_CONTAINER_PX = 360;

export interface FooterAvatarImageAttributes {
  width: number;
  height: number;
  alt: '';
  'aria-hidden': 'true';
  loading: 'lazy';
  decoding: 'async';
}

/**
 * Attributes of the decorative `<img>`: no alternative text and hidden from assistive technology. A fresh object on
 * every call, because Astro adds its scoping class to spread attributes and would fail on a shared frozen object.
 */
export function footerAvatarImageAttributes(): FooterAvatarImageAttributes {
  return {
    width: FOOTER_AVATAR_DISPLAY_PX,
    height: FOOTER_AVATAR_DISPLAY_PX,
    alt: '',
    'aria-hidden': 'true',
    loading: 'lazy',
    decoding: 'async',
  };
}

function booleanOption(value: unknown, name: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new TypeError(`Hagilight footer ${name} option must be a boolean.`);
  return value;
}

/**
 * Resolves the footer avatar options. `undefined` gives the defaults; anything that is not an object or a boolean
 * throws a `TypeError`, so bad configuration fails the build.
 */
export function resolveFooterAvatarOptions(input?: { avatar?: unknown; randomAvatar?: unknown }): ResolvedFooterAvatarOptions {
  if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) {
    throw new TypeError('Hagilight footer avatar options must be an object.');
  }
  const avatar = booleanOption(input?.avatar, 'avatar') ?? true;
  const randomAvatar = booleanOption(input?.randomAvatar, 'randomAvatar') ?? true;
  // The random pool only exists when the avatar does, so a disabled avatar carries no pool list or picker.
  return { avatar, randomAvatar: avatar && randomAvatar };
}
