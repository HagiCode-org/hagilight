import type { MermaidConfig } from 'mermaid';
import type {
  MermaidLayoutConfig,
  MermaidPreset,
  MermaidSemanticTheme,
  MermaidThemeMode,
  MermaidTokenRole,
  MermaidTokens,
} from './types.js';

export interface MermaidThemeOptions {
  /** Custom property names for the theme roles. Unset roles read `--hagilight-mermaid-*`. */
  tokens?: MermaidTokens;
}

/** Custom properties read for each role when a site does not map its own. */
export const TOKEN_PROPERTIES: Record<MermaidTokenRole, `--${string}`> = {
  background: '--hagilight-mermaid-background',
  foreground: '--hagilight-mermaid-foreground',
  primary: '--hagilight-mermaid-primary',
  accent: '--hagilight-mermaid-accent',
  primaryForeground: '--hagilight-mermaid-primary-foreground',
};

const PRESETS: readonly MermaidPreset[] = ['default', 'archify'];

const LIGHT_THEME: MermaidSemanticTheme = {
  mode: 'light',
  base: 'base',
  background: '#ffffff',
  foreground: '#17212b',
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  accent: '#0f766e',
  success: '#166534',
  warning: '#92400e',
  danger: '#b91c1c',
  node: { fill: '#eff6ff', border: '#1d4ed8', text: '#17212b' },
  coreNode: { fill: '#dbeafe', border: '#1e40af', text: '#17212b' },
  cluster: { fill: '#f8fafc', border: '#64748b', text: '#17212b' },
  edge: { line: '#334155', label: '#17212b', arrow: '#1d4ed8' },
};

const DARK_THEME: MermaidSemanticTheme = {
  mode: 'dark',
  base: 'base',
  background: '#111827',
  foreground: '#f8fafc',
  primary: '#60a5fa',
  primaryForeground: '#111827',
  accent: '#5eead4',
  success: '#86efac',
  warning: '#fbbf24',
  danger: '#fca5a5',
  node: { fill: '#1e3a5f', border: '#93c5fd', text: '#f8fafc' },
  coreNode: { fill: '#1d4ed8', border: '#bfdbfe', text: '#ffffff' },
  cluster: { fill: '#1f2937', border: '#94a3b8', text: '#f8fafc' },
  edge: { line: '#cbd5e1', label: '#f8fafc', arrow: '#93c5fd' },
};

const ARCHIFY_LIGHT_THEME: MermaidSemanticTheme = {
  mode: 'light',
  base: 'base',
  background: '#f8fafc',
  foreground: '#0f172a',
  primary: '#0e7490',
  primaryForeground: '#ffffff',
  accent: '#0891b2',
  success: '#15803d',
  warning: '#a16207',
  danger: '#be123c',
  node: { fill: '#ffffff', border: '#0891b2', text: '#0f172a' },
  coreNode: { fill: '#cffafe', border: '#0891b2', text: '#164e63' },
  cluster: { fill: '#f1f5f9', border: '#94a3b8', text: '#0f172a' },
  edge: { line: '#475569', label: '#0f172a', arrow: '#0891b2' },
};

const ARCHIFY_DARK_THEME: MermaidSemanticTheme = {
  mode: 'dark',
  base: 'base',
  background: '#020617',
  foreground: '#f8fafc',
  primary: '#22d3ee',
  primaryForeground: '#020617',
  accent: '#34d399',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#fb7185',
  node: { fill: '#0f172a', border: '#1e293b', text: '#f8fafc' },
  coreNode: { fill: '#083344', border: '#22d3ee', text: '#ecfeff' },
  cluster: { fill: '#0f172a', border: '#475569', text: '#f8fafc' },
  edge: { line: '#22d3ee', label: '#f8fafc', arrow: '#22d3ee' },
};

export const MERMAID_LAYOUT_DEFAULTS: MermaidLayoutConfig = {
  nodeSpacing: 36,
  rankSpacing: 48,
  curve: 'basis',
  padding: 16,
  maxNodeWidth: 280,
  useMaxWidth: true,
};

const cache = new Map<string, MermaidConfig>();

/** Unknown names select the default preset, so a stale stored value never breaks rendering. */
export function resolvePreset(value: unknown): MermaidPreset {
  return PRESETS.includes(value as MermaidPreset) ? (value as MermaidPreset) : 'default';
}

function toMermaidColor(value: string, fallback: string): string {
  if (!value) return fallback;
  if (/^#[0-9a-f]{3,8}$/i.test(value) || /^(?:rgb|rgba|hsl|hsla)\(/i.test(value)) {
    return value;
  }

  // Mermaid's color parser does not understand newer CSS color functions such
  // as oklch(). Let the browser convert supported CSS colors to rgb first.
  if (typeof document !== 'undefined') {
    try {
      const context = document.createElement('canvas').getContext('2d');
      if (context) {
        context.fillStyle = value;
        const converted = context.fillStyle;
        if (converted && !/^okl(?:ch|ab)|^lab|^lch/i.test(converted)) return converted;
      }
    } catch {
      // Canvas color conversion is optional; use the mode-specific fallback.
    }
  }
  return fallback;
}

function readCssToken(property: string, fallback: string): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  return toMermaidColor(value, fallback);
}

function luminance(color: string): number | null {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function getContrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return 7;
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function buildTheme(mode: MermaidThemeMode, tokens: MermaidTokens): MermaidSemanticTheme {
  const fallback = mode === 'dark' ? DARK_THEME : LIGHT_THEME;
  const read = (role: MermaidTokenRole) => readCssToken(tokens[role] ?? TOKEN_PROPERTIES[role], fallback[role]);
  const background = read('background');
  const foreground = read('foreground');
  const primary = read('primary');
  const accent = read('accent');
  const primaryForeground = read('primaryForeground');
  // Low-contrast text falls back to the built-in foreground for the mode.
  const text = getContrastRatio(foreground, background) >= 4.5 ? foreground : fallback.foreground;
  return {
    ...fallback,
    background,
    foreground: text,
    primary,
    accent,
    primaryForeground,
    node: { ...fallback.node, border: primary, text },
    coreNode: { ...fallback.coreNode, border: primary, text: primaryForeground },
    edge: { ...fallback.edge, line: text, arrow: primary, label: text },
  };
}

export function getMermaidSemanticTheme(
  mode: MermaidThemeMode,
  preset: MermaidPreset = 'default',
  options: MermaidThemeOptions = {},
): MermaidSemanticTheme {
  if (resolvePreset(preset) === 'archify') {
    return mode === 'dark' ? ARCHIFY_DARK_THEME : ARCHIFY_LIGHT_THEME;
  }
  return buildTheme(mode, options.tokens ?? {});
}

/**
 * Builds the Mermaid configuration for a mode and preset. Configurations are reused while the
 * resolved colors are unchanged, so a re-render with the same look does not rebuild the object.
 */
export function getMermaidThemeConfig(
  mode: MermaidThemeMode,
  preset: MermaidPreset = 'default',
  options: MermaidThemeOptions = {},
): MermaidConfig {
  const appliedPreset = resolvePreset(preset);
  const semantic = getMermaidSemanticTheme(mode, appliedPreset, options);
  const cacheKey = JSON.stringify([appliedPreset, semantic]);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const themeVariables: NonNullable<MermaidConfig['themeVariables']> = {
    background: semantic.background,
    primaryColor: semantic.node.fill,
    mainBkg: semantic.node.fill,
    nodeBkg: semantic.node.fill,
    nodeBorder: semantic.node.border,
    primaryTextColor: semantic.node.text,
    primaryBorderColor: semantic.node.border,
    lineColor: semantic.edge.line,
    secondaryColor: semantic.coreNode.fill,
    secondaryBorderColor: semantic.coreNode.border,
    tertiaryColor: semantic.cluster.fill,
    tertiaryBorderColor: semantic.cluster.border,
    clusterBkg: semantic.cluster.fill,
    clusterBorder: semantic.cluster.border,
    labelBoxBkg: semantic.background,
    labelBoxBorderColor: semantic.cluster.border,
    fontFamily: 'inherit',
    fontSize: '14px',
  };
  if (appliedPreset === 'archify') {
    Object.assign(themeVariables, {
      nodeTextColor: semantic.node.text,
      secondaryTextColor: semantic.coreNode.text,
      tertiaryTextColor: semantic.cluster.text,
      labelTextColor: semantic.edge.label,
      edgeLabelBackground: semantic.background,
      arrowheadColor: semantic.edge.arrow,
      defaultLinkColor: semantic.edge.line,
    });
  }
  // Mermaid's type omits the top-level useMaxWidth that some diagram types still read.
  const config: MermaidConfig & { useMaxWidth: boolean } = {
    theme: 'base',
    themeVariables,
    flowchart: MERMAID_LAYOUT_DEFAULTS,
    htmlLabels: true,
    startOnLoad: false,
    suppressErrorRendering: true,
    securityLevel: 'strict',
    // Keep this top-level setting for diagram types that read it here. The
    // flowchart renderer reads the explicit setting in the flowchart block.
    useMaxWidth: true,
  };
  cache.set(cacheKey, config);
  return config;
}

/** Drops every cached configuration, so the next call rebuilds from the current tokens. */
export function clearMermaidThemeConfigCache(): void {
  cache.clear();
}
