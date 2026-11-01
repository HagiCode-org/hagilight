/**
 * Pure matching of edge end points to node boxes, for Pele graphs. Plain numbers in, index out: the DOM layer
 * (adapters.ts) reads the boxes and end points in one coordinate space, and this file decides which node
 * each end belongs to. Edge identifiers are never read, because they do not reliably name their ends.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface EdgeEnds {
  start: Point;
  end: Point;
}

export interface LinkedEdge {
  /** Index into the edges passed in. */
  edge: number;
  /** Index into the boxes passed in: the node the edge leaves. */
  from: number;
  /** Index into the boxes passed in: the node the edge enters. */
  to: number;
}

/** A point this close outside a box still counts as touching it, for rounded borders and sub-pixel error. */
export const CONTAINMENT_TOLERANCE = 2;

/**
 * The widest gap, in viewBox units, between an end point and a box that still matches. Pele stops a line short
 * of its node to leave room for the arrowhead: about 7 units for flowchart arrows and about 12 for class
 * relations in the probe, so 16 covers both with a margin.
 */
export const MATCH_LIMIT = 16;

const area = (box: Box): number => (box.right - box.left) * (box.bottom - box.top);

/** Distance from a point to a box: zero inside it, otherwise the gap to the nearest edge or corner. */
export function distanceToBox(point: Point, box: Box): number {
  const dx = Math.max(box.left - point.x, 0, point.x - box.right);
  const dy = Math.max(box.top - point.y, 0, point.y - box.bottom);
  return Math.hypot(dx, dy);
}

/**
 * The box a point belongs to, as an index, or -1 when none is close enough. A point inside a box (with the
 * tolerance) wins, and of several such boxes the smallest one, so a node nested in a cluster is the node.
 * Otherwise the nearest box within `limit` wins, and between equally near boxes the smaller one.
 */
export function matchPoint(
  point: Point,
  boxes: readonly Box[],
  { tolerance = CONTAINMENT_TOLERANCE, limit = MATCH_LIMIT }: { tolerance?: number; limit?: number } = {},
): number {
  let best = -1;
  let bestArea = Infinity;
  boxes.forEach((box, index) => {
    const inside =
      point.x >= box.left - tolerance && point.x <= box.right + tolerance && point.y >= box.top - tolerance && point.y <= box.bottom + tolerance;
    if (inside && area(box) < bestArea) {
      best = index;
      bestArea = area(box);
    }
  });
  if (best !== -1) return best;

  let bestDistance = Infinity;
  boxes.forEach((box, index) => {
    const distance = distanceToBox(point, box);
    if (distance > limit) return;
    if (distance < bestDistance || (distance === bestDistance && area(box) < bestArea)) {
      best = index;
      bestDistance = distance;
      bestArea = area(box);
    }
  });
  return best;
}

/**
 * Links each edge from the node its start point belongs to to the node its end point belongs to. An edge whose
 * end matches no box, or whose two ends match the same box (a self-loop), is left out; the rest still link.
 */
export function linkEdges(edges: readonly EdgeEnds[], boxes: readonly Box[], options?: { tolerance?: number; limit?: number }): LinkedEdge[] {
  const linked: LinkedEdge[] = [];
  edges.forEach((ends, edge) => {
    const from = matchPoint(ends.start, boxes, options);
    const to = matchPoint(ends.end, boxes, options);
    if (from === -1 || to === -1 || from === to) return;
    linked.push({ edge, from, to });
  });
  return linked;
}
