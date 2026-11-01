import assert from 'node:assert/strict';
import { test } from 'node:test';

// Geometry matching for Pele graphs: plain numbers, no DOM. Boxes are { left, top, right, bottom }.
const { CONTAINMENT_TOLERANCE, MATCH_LIMIT, distanceToBox, linkEdges, matchPoint } = await import('../packages/mermaid/dist/geometry.js');

const box = (left, top, right, bottom) => ({ left, top, right, bottom });
const at = (x, y) => ({ x, y });

test('close nodes: each end links to the node it touches', () => {
  const boxes = [box(0, 0, 100, 50), box(120, 0, 220, 50)];
  const linked = linkEdges([{ start: at(100, 25), end: at(120, 25) }], boxes);
  assert.deepEqual(linked, [{ edge: 0, from: 0, to: 1 }]);
});

test('the nearer of two close nodes wins when the point is outside both', () => {
  const boxes = [box(0, 0, 100, 50), box(130, 0, 230, 50)];
  // 4 units right of the first box, 26 left of the second: the first is nearer.
  assert.equal(matchPoint(at(104, 25), boxes), 0);
});

test('nested boxes: a point inside a cluster and a node resolves to the smaller node', () => {
  const cluster = box(-10, -10, 230, 70);
  const node = box(0, 0, 100, 50);
  assert.equal(matchPoint(at(50, 25), [cluster, node]), 1);
  assert.equal(matchPoint(at(50, 25), [node, cluster]), 0);
});

test('nested boxes: an edge end on the cluster border links to the cluster when no node is there', () => {
  const cluster = box(-10, -10, 230, 70);
  const node = box(0, 0, 100, 50);
  // 5 units outside the cluster's left border and far from the node.
  assert.equal(matchPoint(at(-15, 35), [cluster, node]), 0);
});

test('a self-loop is left out and the other edges still link', () => {
  const boxes = [box(0, 0, 100, 50), box(200, 0, 300, 50)];
  const linked = linkEdges(
    [
      { start: at(50, 10), end: at(90, 40) },
      { start: at(100, 25), end: at(200, 25) },
    ],
    boxes,
  );
  assert.deepEqual(linked, [{ edge: 1, from: 0, to: 1 }]);
});

test('an unmatched end is left out and the rest of the graph is still built', () => {
  const boxes = [box(0, 0, 100, 50), box(200, 0, 300, 50)];
  const linked = linkEdges(
    [
      { start: at(100, 25), end: at(900, 900) },
      { start: at(100, 25), end: at(200, 25) },
    ],
    boxes,
  );
  assert.deepEqual(linked, [{ edge: 1, from: 0, to: 1 }]);
});

test('a line that stops short of the box by a marker length still matches', () => {
  const boxes = [box(0, 0, 100, 50), box(0, 100, 100, 150)];
  // The class relation probe: the line starts about 12 units below the first box.
  assert.equal(matchPoint(at(50, 62), boxes), 0);
  assert.ok(distanceToBox(at(50, 62), boxes[0]) <= MATCH_LIMIT);
});

test('a point farther than the limit matches no box', () => {
  const boxes = [box(0, 0, 100, 50)];
  assert.equal(matchPoint(at(100 + MATCH_LIMIT + 1, 25), boxes), -1);
  assert.equal(matchPoint(at(100 + MATCH_LIMIT, 25), boxes), 0);
});

test('a point just outside the containment tolerance is matched by distance', () => {
  const boxes = [box(0, 0, 100, 50)];
  assert.equal(matchPoint(at(100 + CONTAINMENT_TOLERANCE + 1, 25), boxes), 0);
});

test('equal distances prefer the smaller box', () => {
  const large = box(0, 0, 400, 400);
  const small = box(0, 0, 40, 40);
  // Both boxes are at distance 0 (the point is inside both): the smaller one wins.
  assert.equal(matchPoint(at(20, 20), [large, small]), 1);
});

test('distanceToBox is zero inside and measures the nearest edge or corner outside', () => {
  const target = box(0, 0, 10, 10);
  assert.equal(distanceToBox(at(5, 5), target), 0);
  assert.equal(distanceToBox(at(13, 5), target), 3);
  assert.equal(distanceToBox(at(13, 14), target), 5);
});

test('no edges and no boxes produce no links', () => {
  assert.deepEqual(linkEdges([], []), []);
  assert.deepEqual(linkEdges([{ start: at(0, 0), end: at(1, 1) }], []), []);
});
