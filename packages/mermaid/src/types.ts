import type { Mermaid, MermaidConfig } from 'mermaid';

/** Color mode a site asks for. `auto` follows the document's theme, then the system preference. */
export type MermaidMode = 'light' | 'dark' | 'auto';

/** Color mode after `auto` is resolved. */
export type MermaidThemeMode = 'light' | 'dark';

/** Appearance preset. `archify` uses fixed palettes and its own stylesheet. */
export type MermaidPreset = 'default' | 'archify';

/** Semantic roles a site color can map to. */
export type MermaidTokenRole = 'background' | 'foreground' | 'primary' | 'accent' | 'primaryForeground';

/** Maps each role to the custom property a site defines, for example `{ background: '--background' }`. */
export type MermaidTokens = Partial<Record<MermaidTokenRole, `--${string}`>>;

/** User-visible strings. `{value}` is replaced by the count in trace labels. */
export interface MermaidLabels {
  rendering: string;
  errorTitle: string;
  viewSource: string;
  unableToRender: string;
  syntaxErrorPrefix: string;
  renderingErrorPrefix: string;
  noValidDiagram: string;
  unknownDiagramType: string;
  diagramLabel: string;
  replay: string;
  /** Opens the enlarged viewer. */
  expand: string;
  viewer: {
    /** Accessible name of the viewer dialog. */
    title: string;
    close: string;
    zoomIn: string;
    zoomOut: string;
    /** Fits the whole diagram in the viewer. */
    fit: string;
    /** Shows the diagram at its natural size. */
    actualSize: string;
    /** One line under the diagram that tells how to move around. */
    hint: string;
  };
  trace: {
    pinned: string;
    clear: string;
    upstream: string;
    downstream: string;
  };
}

/** Partial label overrides. Unspecified keys keep the English defaults. */
export interface MermaidLabelOverrides extends Partial<Omit<MermaidLabels, 'trace' | 'viewer'>> {
  trace?: Partial<MermaidLabels['trace']>;
  viewer?: Partial<MermaidLabels['viewer']>;
}

export interface MermaidSemanticTheme {
  mode: MermaidThemeMode;
  base: 'base';
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  node: { fill: string; border: string; text: string };
  coreNode: { fill: string; border: string; text: string };
  cluster: { fill: string; border: string; text: string };
  edge: { line: string; label: string; arrow: string };
}

export interface MermaidLayoutConfig {
  nodeSpacing: number;
  rankSpacing: number;
  curve: 'basis' | 'linear' | 'natural' | 'step' | 'monotoneX' | 'monotoneY';
  padding: number;
  maxNodeWidth: number;
  /** Flowcharts default this to false internally, so the responsive sizing stays explicit. */
  useMaxWidth: boolean;
}

export interface MermaidSvgPostProcessorConfig {
  gradients?: boolean;
  shadows?: boolean;
  coreNodeEmphasis?: boolean;
  maxFilters?: number;
}

export interface MermaidTraceSummary {
  /** Text of the node being traced, or of the pie slice, bar, message or other part being focused. */
  label: string;
  /** Count of nodes that reach it. Zero for a focused part of a chart. */
  upstream: number;
  /** Count of nodes it reaches. Zero for a focused part of a chart. */
  downstream: number;
  pinned: boolean;
  /** Set for a focused part of a chart: its 1-based place among the parts of its kind, and how many there are. */
  position?: { index: number; total: number };
}

export interface MermaidInteractionConfig {
  /** Path tracing, part focus and keyboard access. On by default; `false` renders a static diagram. */
  enabled?: boolean;
  /** Whether a click or tap pins the traced or focused part. On by default; `false` leaves clicks to the host page. */
  pin?: boolean;
  /** Overrides the system reduced-motion preference when set. */
  reducedMotion?: boolean;
  /** Called with the active trace, or null when nothing is traced. */
  onTraceChange?: (summary: MermaidTraceSummary | null) => void;
}

/** Minimal shape of a loaded `mermaid` module. The default export is the Mermaid API. */
export interface MermaidModule {
  default: Pick<Mermaid, 'initialize' | 'render'>;
}

export interface MermaidRenderOptions {
  /** Color mode. Defaults to `auto`. */
  mode?: MermaidMode;
  /** Appearance preset. Defaults to `default`; an unknown name falls back to it. */
  preset?: MermaidPreset;
  /** Overrides for user-visible strings. */
  labels?: MermaidLabelOverrides;
  /** Custom property names for the theme roles. Defaults to `--hagilight-mermaid-*`. */
  tokens?: MermaidTokens;
  /** Path tracing options, or `{ enabled: false }`. */
  interaction?: MermaidInteractionConfig;
  /** Play the reveal when the diagram is first in view. Defaults to `true`. */
  entrance?: boolean;
  /** Offer the enlarged viewer (zoom, pan, fit) through a toolbar button. Defaults to `true`. */
  viewer?: boolean;
  /**
   * How the diagram sizes inside its host. `width` fills the width and lets the height follow, so the host
   * grows with the diagram. `contain` fits the whole diagram in the host's height, for fixed-height tiles.
   * Defaults to `width`.
   */
  fit?: 'width' | 'contain';
  /** Supplies the `mermaid` module. Defaults to a dynamic import of `mermaid`. */
  loadMermaid?: () => Promise<MermaidModule>;
  /** Extra class names for the diagram container. */
  className?: string;
}

/** Changes accepted by `handle.update`. Omitted fields keep their current value. */
export interface MermaidUpdate extends Partial<Omit<MermaidRenderOptions, 'className'>> {
  /** New Mermaid source. */
  source?: string;
}

export interface MermaidHandle {
  /** Re-renders with new source or options. Only the latest call reaches the host. */
  update: (changes?: MermaidUpdate) => void;
  /** Clears any pinned trace and plays the reveal again. */
  replay: () => void;
  /** Clears any pinned or hovered trace. */
  clearFocus: () => void;
  /** Opens the enlarged viewer. Does nothing while the diagram is loading, failed to render, or the viewer is off. */
  expand: () => void;
  /** Closes the enlarged viewer. */
  collapse: () => void;
  /** Discards pending renders, removes listeners and animations, and empties the host. */
  destroy: () => void;
}

export type MermaidMountOptions = MermaidRenderOptions;

export interface MermaidMountHandle {
  /** Rendered diagrams, one per block that mounted. */
  readonly handles: readonly MermaidHandle[];
  /** Destroys every diagram this mount created. */
  destroy: () => void;
}

export type { MermaidConfig };
