import type { MermaidSvgPostProcessorConfig } from './types.js';

const DEFAULTS: Required<MermaidSvgPostProcessorConfig> = {
  gradients: true,
  shadows: true,
  coreNodeEmphasis: true,
  maxFilters: 2,
};

export function normalizeMermaidSvgViewBox(svg: SVGSVGElement, padding = 16): void {
  const graph = svg.querySelector<SVGGElement>('.root') ?? svg.querySelector<SVGGElement>(':scope > g');
  if (!graph || typeof graph.getBBox !== 'function') return;

  const bounds = graph.getBBox();
  if (bounds.width <= 0 || bounds.height <= 0) return;

  svg.setAttribute(
    'viewBox',
    `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`,
  );
}

/**
 * Adds scoped semantic classes to Mermaid output. Non-SVG input is returned
 * unchanged so unrelated application SVGs can never be affected.
 */
export function postProcessMermaidSvg(
  svg: string,
  options: MermaidSvgPostProcessorConfig = {},
): string {
  if (typeof DOMParser === 'undefined') return svg;
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;
  if (root.nodeName.toLowerCase() !== 'svg' || document.querySelector('parsererror')) return svg;

  root.classList.add('mermaid-enhanced-svg');
  root.setAttribute('role', 'img');
  root.setAttribute('focusable', 'false');
  root.setAttribute('aria-label', root.getAttribute('aria-label') || 'Mermaid diagram');

  // Mermaid emits a natural-size inline max-width even when useMaxWidth is
  // enabled. Remove that cap so the container can scale the preserved viewBox.
  const incomingStyle = root.getAttribute('style');
  if (incomingStyle) {
    const cleanedStyle = incomingStyle
      .replace(/max-width\s*:\s*[^;]+;?/i, '')
      .trim();
    if (cleanedStyle) root.setAttribute('style', cleanedStyle);
    else root.removeAttribute('style');
  }
  root.setAttribute('width', '100%');

  document.querySelectorAll<SVGGElement>('.node').forEach((node, index) => {
    node.classList.add('mermaid-node');
    node.classList.add(index === 0 ? 'mermaid-node-core' : 'mermaid-node-supporting');
    node.setAttribute('role', 'group');
    // The visible label is aria-hidden below, so the node carries its own name.
    const name = node.textContent?.replace(/\s+/g, ' ').trim();
    if (name) node.setAttribute('aria-label', name);
  });
  document.querySelectorAll<SVGGElement>('.cluster, .subgraph').forEach((cluster) => {
    cluster.classList.add('mermaid-subgraph');
    cluster.setAttribute('role', 'group');
  });
  // Mermaid 11 draws edges as bare paths in `g.edgePaths`; `.edgePath` is the older group form.
  document.querySelectorAll<SVGElement>('.edgePath, g.edgePaths > path, .arrowheadPath').forEach((edge) => {
    edge.classList.add('mermaid-edge');
  });
  document.querySelectorAll<SVGElement>('g.edgeLabel').forEach((label) => {
    label.classList.add('mermaid-edge-label');
  });
  document.querySelectorAll('text, foreignObject').forEach((label) => {
    label.classList.add('mermaid-label');
    label.setAttribute('aria-hidden', 'true');
  });

  const config = { ...DEFAULTS, ...options };
  if (config.gradients) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.id = 'mermaid-enhanced-gradient';
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', '0');
    gradient.setAttribute('x2', '0');
    gradient.setAttribute('y2', '1');
    for (const [offset, opacity] of [['0%', '0.12'], ['100%', '0']] as const) {
      const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', offset);
      stop.setAttribute('stop-color', 'currentColor');
      stop.setAttribute('stop-opacity', opacity);
      gradient.appendChild(stop);
    }
    defs.appendChild(gradient);
    root.insertBefore(defs, root.firstChild);
  }
  if (config.shadows && config.maxFilters > 0) {
    root.classList.add('mermaid-has-shadow');
  }
  return new XMLSerializer().serializeToString(root);
}