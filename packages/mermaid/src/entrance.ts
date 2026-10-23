import { assignRanks, type MermaidGraph } from './graph.js';

export interface MermaidEntranceHandle {
  cancel: () => void;
  finished: Promise<void>;
}

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const NODE_MS = 340;
const LABEL_MS = 240;
const RISE_PX = 6;
const FULL_SEQUENCE_NODE_LIMIT = 80;

/** A dependency graph reads in rank order, so the reveal order is the reading order. */
export function playMermaidEntrance(svg: SVGSVGElement, graph: MermaidGraph): MermaidEntranceHandle | null {
  if (typeof svg.animate !== 'function' || graph.nodes.length === 0) return null;

  const animations: Animation[] = [];
  const restores: Array<() => void> = [];
  const add = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = el.animate(keyframes, { easing: EASE_OUT, fill: 'backwards', ...options });
    animations.push(animation);
    return animation;
  };

  if (graph.nodes.length > FULL_SEQUENCE_NODE_LIMIT) {
    // Per-element choreography on a very large graph costs more than it explains.
    const root = svg.querySelector('g.root') ?? svg;
    add(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
  } else {
    const rank = assignRanks(graph);
    const maxRank = Math.max(...rank, 0);
    // One rank per step: the edge out of a node draws while the next rank is about to land.
    const step = Math.min(190, 900 / Math.max(maxRank, 1));
    const edgeMs = Math.min(300, Math.max(120, step * 0.95));
    const seenInRank = new Map<number, number>();

    svg.querySelectorAll('g.clusters > g').forEach((cluster) => {
      add(cluster, [{ opacity: 0 }, { opacity: 1 }], { duration: 420 });
    });

    graph.nodes.forEach((node) => {
      const slot = seenInRank.get(rank[node.index]) ?? 0;
      seenInRank.set(rank[node.index], slot + 1);
      const delay = rank[node.index] * step + Math.min(slot * 18, 120);
      const placed = node.el.transform?.baseVal?.numberOfItems ? node.el.transform.baseVal.consolidate()?.matrix : null;
      const frames: Keyframe[] = placed
        ? [
            { opacity: 0, transform: `translate(${placed.e}px, ${placed.f + RISE_PX}px) scale(0.94)` },
            { opacity: 1, transform: `translate(${placed.e}px, ${placed.f}px) scale(1)` },
          ]
        : [{ opacity: 0 }, { opacity: 1 }];
      add(node.el, frames, { duration: NODE_MS, delay });
    });

    graph.edges.forEach((edge) => {
      const delay = rank[edge.from] * step + 70;
      const dashed = /edge-pattern-(dotted|dashed)/.test(edge.el.getAttribute('class') ?? '');
      const length = typeof edge.el.getTotalLength === 'function' ? edge.el.getTotalLength() : 0;
      if (dashed || !length) {
        add(edge.el, [{ opacity: 0 }, { opacity: 1 }], { duration: edgeMs, delay });
      } else {
        // The arrowhead is a marker, drawn at full size whatever the dash state; hold it back until the line lands.
        const markerEnd = edge.el.getAttribute('marker-end');
        if (markerEnd) edge.el.removeAttribute('marker-end');
        const draw = add(
          edge.el,
          [
            { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
            { strokeDasharray: `${length}`, strokeDashoffset: '0' },
          ],
          { duration: edgeMs, delay },
        );
        if (markerEnd) {
          const land = () => edge.el.setAttribute('marker-end', markerEnd);
          restores.push(land);
          draw.finished.then(land, land);
        }
      }
      if (edge.labelEl) {
        add(edge.labelEl, [{ opacity: 0 }, { opacity: 1 }], { duration: LABEL_MS, delay: delay + edgeMs * 0.65 });
      }
    });
  }

  const restore = () => restores.forEach((fn) => fn());
  const finished = Promise.allSettled(animations.map((animation) => animation.finished)).then(restore);
  return {
    finished,
    cancel: () => {
      animations.forEach((animation) => animation.cancel());
      restore();
    },
  };
}
