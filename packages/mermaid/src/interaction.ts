import type { MermaidInteractionConfig } from './types.js';
import { buildMermaidGraph, traceFrom, type MermaidGraph, type MermaidTrace } from './graph.js';

export interface MermaidInteractionHandle {
  destroy: () => void;
  clearFocus: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const TRACE_CLASSES = [
  'mermaid-trace-focus',
  'mermaid-trace-up',
  'mermaid-trace-down',
  'mermaid-trace-dim',
  'mermaid-trace-edge-up',
  'mermaid-trace-edge-down',
];
const COMET_LIMIT = 40;
const COMET_HOP_MS = 130;
const COMET_MAX_DELAY_MS = 700;
const COMET_MS = 520;
const CLICK_SLOP_PX = 4;
const MINUS = '−';

const NOOP_HANDLE: MermaidInteractionHandle = { destroy: () => undefined, clearFocus: () => undefined };

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, className?: string): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  if (className) el.setAttribute('class', className);
  return el;
}

function nodeIndexOf(graph: MermaidGraph, target: EventTarget | null): number {
  const el = (target as Element | null)?.closest?.('.mermaid-node');
  return el ? graph.nodes.findIndex((node) => node.el === el) : -1;
}

/** Edges run mostly vertically in top-down layouts, so the side is the free edge of a node; left-right layouts use the top. */
function flowIsVertical(graph: MermaidGraph): boolean {
  let dx = 0;
  let dy = 0;
  graph.edges.forEach((edge) => {
    const from = graph.nodes[edge.from].el.getBoundingClientRect();
    const to = graph.nodes[edge.to].el.getBoundingClientRect();
    dx += Math.abs(from.left + from.width / 2 - (to.left + to.width / 2));
    dy += Math.abs(from.top + from.height / 2 - (to.top + to.height / 2));
  });
  return dy >= dx;
}

function hopBadge(
  node: SVGGElement,
  text: string,
  direction: 'up' | 'down',
  anchor: 'side' | 'top',
): SVGGElement | null {
  if (typeof node.getBBox !== 'function') return null;
  // The group's box already accounts for each child shape's own transform (diamonds, cylinders).
  const box = node.getBBox();
  const width = 12 + text.length * 6;
  const cx = anchor === 'side' ? box.x + box.width : box.x + box.width / 2;
  const cy = anchor === 'side' ? box.y + box.height / 2 : box.y;
  const badge = svgEl('g', `mermaid-trace-hop mermaid-trace-hop-${direction}`);
  const pill = svgEl('rect');
  pill.setAttribute('width', String(width));
  pill.setAttribute('height', '16');
  pill.setAttribute('rx', '8');
  pill.setAttribute('x', String(cx - width / 2));
  pill.setAttribute('y', String(cy - 8));
  const label = svgEl('text');
  label.setAttribute('x', String(cx));
  label.setAttribute('y', String(cy + 3.5));
  label.setAttribute('text-anchor', 'middle');
  label.textContent = text;
  badge.append(pill, label);
  return badge;
}

export function attachMermaidDiagramInteraction(
  root: HTMLElement,
  config: MermaidInteractionConfig = {},
  prebuilt?: MermaidGraph,
): MermaidInteractionHandle {
  if (!config.enabled) return NOOP_HANDLE;
  const svg = root.querySelector<SVGSVGElement>('svg');
  if (!svg) return NOOP_HANDLE;
  const graph = prebuilt ?? buildMermaidGraph(svg);
  if (graph.nodes.length === 0) return NOOP_HANDLE;

  const isReduced = () =>
    config.reducedMotion ?? Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  let pinned: number | null = null;
  let hovered: number | null = null;
  let focused: number | null = null;
  let applied: number | null = null;
  let pointerStart: { x: number; y: number } | null = null;
  const cursor = new Map<string, number>();
  let comets: Animation[] = [];
  let layer: SVGGElement | null = null;

  // One tab stop for the whole graph; arrow keys walk its edges.
  graph.nodes.forEach((node, index) => {
    node.el.setAttribute('tabindex', index === 0 ? '0' : '-1');
    node.el.setAttribute('role', 'button');
    node.el.setAttribute('aria-pressed', 'false');
    if (node.label) node.el.setAttribute('aria-label', node.label);
  });

  const clearTrace = () => {
    comets.forEach((comet) => comet.cancel());
    comets = [];
    layer?.remove();
    layer = null;
    root.classList.remove('mermaid-interaction-active', 'mermaid-tracing');
    svg.querySelectorAll('.mermaid-trace-hop').forEach((badge) => badge.remove());
    const selector = TRACE_CLASSES.map((name) => `.${name}`).join(',');
    svg.querySelectorAll(selector).forEach((el) => el.classList.remove(...TRACE_CLASSES));
  };

  const markNodes = (trace: MermaidTrace) => {
    const anchor = flowIsVertical(graph) ? 'side' : 'top';
    graph.nodes.forEach((node) => {
      const up = trace.upstream.get(node.index);
      const down = trace.downstream.get(node.index);
      if (node.index === trace.focus) {
        node.el.classList.add('mermaid-trace-focus');
        return;
      }
      if (up === undefined && down === undefined) {
        node.el.classList.add('mermaid-trace-dim');
        return;
      }
      if (up !== undefined) node.el.classList.add('mermaid-trace-up');
      if (down !== undefined) node.el.classList.add('mermaid-trace-down');
      // Hop distance from the focus: +n downstream, -n upstream. In a loop the nearer side wins.
      const downstreamFirst = down !== undefined && (up === undefined || down <= up);
      const hop = downstreamFirst ? down : up;
      const badge =
        hop !== undefined
          ? hopBadge(node.el, `${downstreamFirst ? '+' : MINUS}${hop}`, downstreamFirst ? 'down' : 'up', anchor)
          : null;
      if (badge) node.el.appendChild(badge);
    });
  };

  const markEdges = (trace: MermaidTrace) => {
    graph.edges.forEach((edge) => {
      const up = trace.upstreamEdges.has(edge.index);
      const down = trace.downstreamEdges.has(edge.index);
      const targets = edge.labelEl ? [edge.el, edge.labelEl] : [edge.el];
      targets.forEach((el) => {
        if (!up && !down) el.classList.add('mermaid-trace-dim');
        if (up) el.classList.add('mermaid-trace-edge-up');
        if (down) el.classList.add('mermaid-trace-edge-down');
      });
    });
  };

  /** A short light travels each traced edge in the arrow's direction, ordered by hop distance. */
  const flow = (trace: MermaidTrace) => {
    if (isReduced() || typeof SVGElement.prototype.animate !== 'function') return;
    const edgesWithHop: Array<{ index: number; delay: number; direction: 'up' | 'down' }> = [];
    const farthestUp = Math.max(0, ...trace.upstreamEdges.values());
    trace.downstreamEdges.forEach((hop, index) =>
      edgesWithHop.push({ index, direction: 'down', delay: (hop - 1) * COMET_HOP_MS }),
    );
    trace.upstreamEdges.forEach((hop, index) =>
      edgesWithHop.push({ index, direction: 'up', delay: (farthestUp - hop) * COMET_HOP_MS }),
    );
    if (edgesWithHop.length === 0 || edgesWithHop.length > COMET_LIMIT) return;

    const host = svg.querySelector('g.edgePaths')?.parentElement;
    if (!host) return;
    layer = svgEl('g', 'mermaid-trace-layer');
    layer.setAttribute('aria-hidden', 'true');
    host.insertBefore(layer, svg.querySelector('g.edgePaths')?.nextSibling ?? null);

    edgesWithHop.forEach(({ index, delay, direction }) => {
      const source = graph.edges[index].el;
      const length = typeof source.getTotalLength === 'function' ? source.getTotalLength() : 0;
      const d = source.getAttribute('d');
      if (!length || !d || !layer) return;
      const comet = svgEl('path', `mermaid-trace-comet mermaid-trace-comet-${direction}`);
      comet.setAttribute('d', d);
      const head = Math.max(14, length * 0.2);
      comet.style.strokeDasharray = `${head} ${length + head}`;
      layer.appendChild(comet);
      comets.push(
        comet.animate(
          [
            { strokeDashoffset: `${head}`, opacity: 0 },
            { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.8 },
            { strokeDashoffset: `${-length}`, opacity: 0 },
          ],
          {
            duration: COMET_MS,
            delay: Math.min(delay, COMET_MAX_DELAY_MS),
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'both',
          },
        ),
      );
    });
  };

  const report = (trace: MermaidTrace | null) => {
    if (!config.onTraceChange) return;
    config.onTraceChange(
      trace
        ? {
            label: graph.nodes[trace.focus].label,
            upstream: trace.upstream.size,
            downstream: trace.downstream.size,
            pinned: pinned === trace.focus,
          }
        : null,
    );
  };

  const apply = () => {
    const next = hovered ?? focused ?? pinned;
    graph.nodes.forEach((node, index) => node.el.setAttribute('aria-pressed', String(pinned === index)));
    if (next === applied) {
      // Same focus, but pinning may have changed what the summary reports.
      if (next !== null) report(traceFrom(graph, next));
      return;
    }
    applied = next;
    clearTrace();
    if (next === null) {
      report(null);
      return;
    }
    const trace = traceFrom(graph, next);
    root.classList.add('mermaid-interaction-active', 'mermaid-tracing');
    root.classList.toggle('mermaid-reduced-motion', isReduced());
    markNodes(trace);
    markEdges(trace);
    flow(trace);
    report(trace);
  };

  const togglePin = (index: number) => {
    pinned = pinned === index ? null : index;
    apply();
  };

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const index = nodeIndexOf(graph, event.target);
    const next = index === -1 ? null : index;
    if (next === hovered) return;
    hovered = next;
    apply();
  };
  const onPointerLeave = () => {
    if (hovered === null) return;
    hovered = null;
    apply();
  };
  const onPointerDown = (event: PointerEvent) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  };
  const onPointerCancel = () => {
    pointerStart = null;
  };
  const select = (target: EventTarget | null) => {
    const index = nodeIndexOf(graph, target);
    if (index === -1) {
      if (pinned === null) return;
      pinned = null;
      apply();
      return;
    }
    togglePin(index);
  };
  // Touch taps are resolved on pointerup: Chromium retargets the following click away from the
  // node when it lands inside a foreignObject label. Clicks with no pointer (assistive tech) fall
  // through to the click handler.
  const onPointerUp = (event: PointerEvent) => {
    const start = pointerStart;
    pointerStart = null;
    if (event.button !== 0 || !start) return;
    // A drag that ends on a node (fullscreen pan) is not a selection.
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    select(event.target);
  };
  const onClick = (event: MouseEvent) => {
    if (event.detail !== 0) return;
    select(event.target);
  };
  const onFocusIn = (event: FocusEvent) => {
    const index = nodeIndexOf(graph, event.target);
    if (index === -1) return;
    graph.nodes.forEach((node, at) => node.el.setAttribute('tabindex', at === index ? '0' : '-1'));
    focused = index;
    apply();
  };
  const onFocusOut = (event: FocusEvent) => {
    if (nodeIndexOf(graph, event.target) === -1) return;
    focused = null;
    apply();
  };

  const step = (from: number, forward: boolean): number | null => {
    const edges = (forward ? graph.out : graph.inc)[from].map((edgeIndex) => graph.edges[edgeIndex]);
    const neighbours = Array.from(new Set(edges.map((edge) => (forward ? edge.to : edge.from)))).filter(
      (index) => index !== from,
    );
    if (neighbours.length === 0) return null;
    const box = (index: number) => graph.nodes[index].el.getBoundingClientRect();
    neighbours.sort((a, b) => box(a).left - box(b).left || box(a).top - box(b).top);
    // Repeating the same arrow from the same node walks through its neighbours in turn.
    const key = `${from}:${forward ? 'out' : 'in'}`;
    const at = cursor.get(key) ?? 0;
    cursor.set(key, (at + 1) % neighbours.length);
    return neighbours[at % neighbours.length];
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const index = nodeIndexOf(graph, event.target);
    if (index === -1) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      togglePin(index);
      return;
    }
    if (event.key === 'Escape') {
      if (pinned === null) return;
      event.stopPropagation();
      pinned = null;
      apply();
      return;
    }
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !backward) return;
    event.preventDefault();
    const next = step(index, forward);
    if (next !== null) graph.nodes[next].el.focus();
  };

  root.addEventListener('pointerover', onPointerOver);
  root.addEventListener('pointerleave', onPointerLeave);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerCancel);
  root.addEventListener('click', onClick);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('keydown', onKeyDown);

  const clearFocus = () => {
    pinned = null;
    hovered = null;
    focused = null;
    apply();
  };

  return {
    clearFocus,
    destroy: () => {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerleave', onPointerLeave);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerCancel);
      root.removeEventListener('click', onClick);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('keydown', onKeyDown);
      clearTrace();
      applied = null;
      config.onTraceChange?.(null);
    },
  };
}
