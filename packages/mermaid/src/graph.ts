/**
 * Graph model of a rendered Mermaid SVG. Mermaid's unified renderer (flowchart, state, class, ER,
 * requirement, mindmap, swimlane) emits `g.nodes > g.node` and `g.edgePaths > path`, and Sankey draws
 * its links as `g.links > g.link > path`, so the model is read from the DOM instead of re-parsing the
 * diagram source. Diagram types without that structure (sequence, gantt, ...) yield an empty graph;
 * `adapters.ts` describes their parts instead.
 */

export interface MermaidGraphNode {
  index: number;
  el: SVGGElement;
  /** Logical Mermaid id (`A` in `flowchart-A-0`) when the renderer exposes one. */
  key: string | null;
  label: string;
}

export interface MermaidGraphEdge {
  index: number;
  el: SVGPathElement;
  from: number;
  to: number;
  labelEl: SVGGElement | null;
}

export interface MermaidGraph {
  nodes: MermaidGraphNode[];
  edges: MermaidGraphEdge[];
  /** Outgoing edge indexes per node. */
  out: number[][];
  /** Incoming edge indexes per node. */
  inc: number[][];
}

export interface MermaidTrace {
  focus: number;
  /** Hop distance from the focus for each ancestor (always >= 1). */
  upstream: Map<number, number>;
  /** Hop distance from the focus for each descendant (always >= 1). */
  downstream: Map<number, number>;
  upstreamEdges: Map<number, number>;
  downstreamEdges: Map<number, number>;
}

const NODE_KEY = /-(?:flowchart|state|class|classId|er)-(.+?)-\d+$/;
/** Flowchart-style edges are `L_<from>_<to>_<n>`; class diagrams use `id_<from>_<to>_<n>`. */
const EDGE_ID = /^(?:L|id)_(.+)_\d+$/;
const EDGE_PATHS = 'g.edgePaths > path, g.edges > path, g.links > g.link > path';
const POINT_TOLERANCE = 8;

function textOf(node: Element): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** A node's name: its first non-empty label, so a class node reads `Duck`, not `Duck+swim() : void`. */
function labelOf(node: Element): string {
  for (const label of Array.from(node.querySelectorAll('.label'))) {
    const text = textOf(label);
    if (text) return text;
  }
  return textOf(node);
}

function splitFlowchartEdge(dataId: string | null, keys: Map<string, number>): [number, number] | null {
  const body = dataId ? EDGE_ID.exec(dataId)?.[1] : null;
  if (!body) return null;
  let found: [number, number] | null = null;
  for (let at = body.indexOf('_'); at !== -1; at = body.indexOf('_', at + 1)) {
    const from = keys.get(body.slice(0, at));
    const to = keys.get(body.slice(at + 1));
    if (from === undefined || to === undefined) continue;
    // An ambiguous split (`a_b_c` as a|b_c or a_b|c) cannot be settled by name; use geometry.
    if (found) return null;
    found = [from, to];
  }
  return found;
}

function nodeCenterAndBox(node: SVGGElement): { x: number; y: number; w: number; h: number } | null {
  if (typeof node.getBBox !== 'function') return null;
  const box = node.getBBox();
  const translate = node.transform?.baseVal?.numberOfItems ? node.transform.baseVal.consolidate()?.matrix : null;
  const tx = translate?.e ?? 0;
  const ty = translate?.f ?? 0;
  return { x: tx + box.x, y: ty + box.y, w: box.width, h: box.height };
}

function nearestNode(boxes: Array<ReturnType<typeof nodeCenterAndBox>>, x: number, y: number): number {
  let best = -1;
  let bestDistance = POINT_TOLERANCE;
  boxes.forEach((box, index) => {
    if (!box) return;
    const dx = Math.max(box.x - x, 0, x - (box.x + box.w));
    const dy = Math.max(box.y - y, 0, y - (box.y + box.h));
    const distance = Math.hypot(dx, dy);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

export function buildMermaidGraph(svg: SVGSVGElement): MermaidGraph {
  const nodeEls = Array.from(svg.querySelectorAll<SVGGElement>('g.nodes > g.node'));
  const edgeEls = Array.from(svg.querySelectorAll<SVGPathElement>(EDGE_PATHS));
  const nodes: MermaidGraphNode[] = nodeEls.map((el, index) => ({
    index,
    el,
    key: NODE_KEY.exec(el.id)?.[1] ?? null,
    label: labelOf(el),
  }));
  // Sankey keeps each node's name in a separate label list, in node order.
  const outsideLabels = Array.from(svg.querySelectorAll('g.node-labels > text'));
  if (outsideLabels.length === nodes.length) {
    nodes.forEach((node) => {
      if (!node.label) node.label = textOf(outsideLabels[node.index]);
    });
  }
  const keys = new Map<string, number>();
  nodes.forEach((node) => {
    if (node.key !== null) keys.set(node.key, node.index);
  });

  const labelById = new Map<string, SVGGElement>();
  svg.querySelectorAll<SVGGElement>('g.edgeLabels g.label[data-id]').forEach((label) => {
    labelById.set(label.getAttribute('data-id') ?? '', label);
  });

  let boxes: Array<ReturnType<typeof nodeCenterAndBox>> | null = null;
  const edges: MermaidGraphEdge[] = [];
  edgeEls.forEach((el) => {
    let ends = splitFlowchartEdge(el.getAttribute('data-id'), keys);
    if (!ends && typeof el.getTotalLength === 'function') {
      boxes ??= nodeEls.map(nodeCenterAndBox);
      const length = el.getTotalLength();
      const head = el.getPointAtLength(0);
      const tail = el.getPointAtLength(length);
      const from = nearestNode(boxes, head.x, head.y);
      const to = nearestNode(boxes, tail.x, tail.y);
      if (from !== -1 && to !== -1 && from !== to) ends = [from, to];
    }
    if (!ends) return;
    const dataId = el.getAttribute('data-id') ?? '';
    edges.push({
      index: edges.length,
      el,
      from: ends[0],
      to: ends[1],
      labelEl: labelById.get(dataId)?.closest<SVGGElement>('g.edgeLabel') ?? null,
    });
  });

  const out: number[][] = nodes.map(() => []);
  const inc: number[][] = nodes.map(() => []);
  edges.forEach((edge) => {
    out[edge.from].push(edge.index);
    inc[edge.to].push(edge.index);
  });
  return { nodes, edges, out, inc };
}

/**
 * Longest-path layering with back edges ignored, so cycles (retry loops) cannot push a node past
 * its natural column. Rank 0 are sources; the result drives the entrance order.
 */
export function assignRanks(graph: MermaidGraph): number[] {
  const count = graph.nodes.length;
  const state = new Array<0 | 1 | 2>(count).fill(0);
  const back = new Set<number>();
  const visit = (start: number) => {
    const stack: Array<{ node: number; next: number }> = [{ node: start, next: 0 }];
    state[start] = 1;
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const edgeIndex = graph.out[frame.node][frame.next++];
      if (edgeIndex === undefined) {
        state[frame.node] = 2;
        stack.pop();
        continue;
      }
      const target = graph.edges[edgeIndex].to;
      if (state[target] === 1) back.add(edgeIndex);
      else if (state[target] === 0) {
        state[target] = 1;
        stack.push({ node: target, next: 0 });
      }
    }
  };
  const sources = graph.nodes.filter((node) => graph.inc[node.index].length === 0).map((node) => node.index);
  [...sources, ...graph.nodes.map((node) => node.index)].forEach((index) => {
    if (state[index] === 0) visit(index);
  });

  const rank = new Array<number>(count).fill(0);
  const pending = graph.nodes.map((node) => graph.inc[node.index].filter((edge) => !back.has(edge)).length);
  const queue = graph.nodes.filter((node) => pending[node.index] === 0).map((node) => node.index);
  for (let at = 0; at < queue.length; at += 1) {
    const node = queue[at];
    graph.out[node].forEach((edgeIndex) => {
      if (back.has(edgeIndex)) return;
      const target = graph.edges[edgeIndex].to;
      rank[target] = Math.max(rank[target], rank[node] + 1);
      pending[target] -= 1;
      if (pending[target] === 0) queue.push(target);
    });
  }
  return rank;
}

function walk(
  graph: MermaidGraph,
  start: number,
  adjacency: number[][],
  next: (edge: MermaidGraphEdge) => number,
): { nodes: Map<number, number>; edges: Map<number, number> } {
  const nodes = new Map<number, number>();
  const edges = new Map<number, number>();
  const seen = new Set<number>([start]);
  let frontier = [start];
  for (let hop = 1; frontier.length; hop += 1) {
    const following: number[] = [];
    frontier.forEach((node) => {
      adjacency[node].forEach((edgeIndex) => {
        if (!edges.has(edgeIndex)) edges.set(edgeIndex, hop);
        const other = next(graph.edges[edgeIndex]);
        if (seen.has(other)) return;
        seen.add(other);
        nodes.set(other, hop);
        following.push(other);
      });
    });
    frontier = following;
  }
  return { nodes, edges };
}

/** Everything that reaches the focus node, and everything it reaches, with hop distances. */
export function traceFrom(graph: MermaidGraph, focus: number): MermaidTrace {
  const down = walk(graph, focus, graph.out, (edge) => edge.to);
  const up = walk(graph, focus, graph.inc, (edge) => edge.from);
  return {
    focus,
    upstream: up.nodes,
    downstream: down.nodes,
    upstreamEdges: up.edges,
    downstreamEdges: down.edges,
  };
}
