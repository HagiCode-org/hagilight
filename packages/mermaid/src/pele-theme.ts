import { mixColors } from './palette.js';
import { getContrastRatio, getMermaidSemanticTheme } from './theme.js';
import type { MermaidPreset, MermaidThemeMode, MermaidTokens } from './types.js';

/** Text on a surface, and slice labels on a series color, must hold this ratio (WCAG AA for normal text). */
export const PELE_MIN_CONTRAST = 4.5;

/** Pele reads `--pele-series-1` to `--pele-series-8` for categorical fills. */
export const PELE_SERIES_COUNT = 8;

const DEFAULT_RADIUS = '4px';
const DEFAULT_FONT = 'sans-serif';

/** Every custom property the mapping writes, in order. Pele reads each of them, with its own fallback. */
export const PELE_VARIABLE_NAMES: readonly string[] = [
  '--pele-bg',
  '--pele-fg',
  '--pele-muted',
  '--pele-line',
  '--pele-surface',
  '--pele-surface-alt',
  '--pele-border',
  '--pele-accent',
  '--pele-font',
  '--pele-radius',
  ...Array.from({ length: PELE_SERIES_COUNT }, (_, index) => `--pele-series-${index + 1}`),
];

export interface PeleThemeOptions {
  /** Site token names for the theme roles, the same option Mermaid takes. */
  tokens?: MermaidTokens;
  /** Font stack for the diagram text. Defaults to `sans-serif`; the render path passes the container's font. */
  font?: string;
}

/**
 * Moves `color` toward black or white, whichever gives more contrast on `background`, until the pair reaches
 * `minimum`. A color that already passes is returned unchanged. The palette's colors are hex, so the steps
 * are exact; any other form is passed through, as the contrast check cannot read it.
 */
export function ensureContrast(color: string, background: string, minimum = PELE_MIN_CONTRAST): string {
  if (getContrastRatio(background, color) >= minimum) return color;
  const target = getContrastRatio(background, '#000000') >= getContrastRatio(background, '#ffffff') ? '#000000' : '#ffffff';
  let candidate = color;
  for (let step = 1; step <= 50; step += 1) {
    candidate = mixColors(color, target, step / 50);
    if (getContrastRatio(background, candidate) >= minimum) return candidate;
  }
  return candidate;
}

/**
 * The custom properties for Pele in one mode and preset. Series colors come from the preset palette, adjusted per
 * background so the slice label (drawn in the background color) holds 4.5:1 on each slice.
 */
export function peleVariables(mode: MermaidThemeMode, preset: MermaidPreset = 'default', options: PeleThemeOptions = {}): Record<string, string> {
  const theme = getMermaidSemanticTheme(mode, preset, { tokens: options.tokens });
  const { background, foreground } = theme;
  // Secondary text: a mix toward the background, kept only when it still reads at 4.5:1.
  const mutedMix = mixColors(foreground, background, 0.35);
  const muted = getContrastRatio(mutedMix, background) >= PELE_MIN_CONTRAST ? mutedMix : foreground;
  const series = Object.fromEntries(
    theme.series.slice(0, PELE_SERIES_COUNT).map((tone, index) => [`--pele-series-${index + 1}`, ensureContrast(tone.mark, background)]),
  );
  return {
    '--pele-bg': background,
    '--pele-fg': foreground,
    '--pele-muted': muted,
    '--pele-line': theme.edge.line,
    '--pele-surface': theme.node.fill,
    '--pele-surface-alt': theme.cluster.fill,
    '--pele-border': theme.node.border,
    '--pele-accent': theme.accent,
    '--pele-font': options.font ?? DEFAULT_FONT,
    '--pele-radius': DEFAULT_RADIUS,
    ...series,
  };
}

/** Writes the variables as inline custom properties on the container. Pele's SVG inherits them; no render call. */
export function applyPeleVariables(element: { style: { setProperty: (name: string, value: string) => void } }, variables: Record<string, string>): void {
  for (const [name, value] of Object.entries(variables)) element.style.setProperty(name, value);
}

/** The container's computed font stack, so Pele text matches the page. Falls back to `sans-serif` without a DOM. */
export function peleFontFamily(element: unknown): string {
  if (typeof getComputedStyle !== 'function' || typeof Element === 'undefined' || !(element instanceof Element)) return DEFAULT_FONT;
  return getComputedStyle(element).fontFamily || DEFAULT_FONT;
}
