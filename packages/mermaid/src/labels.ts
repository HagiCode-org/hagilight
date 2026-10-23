import type { MermaidLabelOverrides, MermaidLabels } from './types.js';

export const DEFAULT_LABELS: MermaidLabels = {
  rendering: 'Rendering diagram...',
  errorTitle: 'Diagram Rendering Error',
  viewSource: 'View Mermaid code',
  unableToRender: 'Unable to render diagram',
  syntaxErrorPrefix: 'Syntax error:',
  renderingErrorPrefix: 'Rendering error:',
  noValidDiagram: 'No valid diagram detected',
  unknownDiagramType: 'Unknown diagram type',
  diagramLabel: 'Diagram',
  replay: 'Replay animation',
  expand: 'Enlarge diagram',
  viewer: {
    title: 'Enlarged diagram',
    close: 'Close',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit to window',
    actualSize: 'Actual size',
    hint: 'Scroll to zoom, drag to move, Esc to close',
  },
  trace: {
    pinned: 'Pinned',
    clear: 'Clear selection',
    upstream: 'Upstream {value}',
    downstream: 'Downstream {value}',
  },
};

/** Returns the default labels with each provided key replaced. Unspecified keys keep their defaults. */
export function resolveLabels(overrides: MermaidLabelOverrides = {}): MermaidLabels {
  const { trace, viewer, ...rest } = overrides;
  return {
    ...DEFAULT_LABELS,
    ...rest,
    trace: { ...DEFAULT_LABELS.trace, ...trace },
    viewer: { ...DEFAULT_LABELS.viewer, ...viewer },
  };
}

/** Replaces each `{name}` placeholder with its value. Unknown placeholders are left as written. */
export function formatLabel(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
