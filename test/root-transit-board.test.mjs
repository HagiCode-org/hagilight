import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TRANSIT_BOARD_WINDOW, resolveTransitBoard } from '@hagicode/hagilight-core/root-transit-board';

const input = { locale: 'zh-CN', site: 'https://hagilight.hagicode.com', siteName: 'Hagilight', route: '/en-US/' };
const named = (id, name, url = `https://${id}.example/`, description) => ({ id, name, url, ...(description ? { description } : {}) });

test('the board lists the localized catalog, then this site, then the first rows again', () => {
  const board = resolveTransitBoard(input);
  const ids = board.rows.map((row) => row.id);
  const stops = ids.indexOf('destination');
  assert.equal(board.count, stops);
  assert.ok(board.count > TRANSIT_BOARD_WINDOW, 'the bundled catalog is long enough to scroll');
  assert.equal(board.label, '生态站点');
  assert.deepEqual(ids.slice(stops + 1), ids.slice(0, 2), 'the destination has rows on both sides');
  assert.equal(board.shown, TRANSIT_BOARD_WINDOW);
  assert.equal(board.travel, board.count - 2, 'the destination ends on the middle row');
  const tasks = board.rows.find((row) => row.id === 'hagitask');
  assert.deepEqual([tasks.name, tasks.detail, tasks.aside], ['HagiTask', '任务与工作流管理', 'tasks.hagicode.com']);
  assert.deepEqual(board.rows[stops], { id: 'destination', name: 'Hagilight', detail: '/en-US/', aside: '→', destination: true });
  assert.equal(resolveTransitBoard({ ...input, locale: 'en-US' }).rows.find((row) => row.id === 'hagitask').detail, 'Task and workflow management.');
});

test('a site without a description shows its host once', () => {
  const [row] = resolveTransitBoard({ ...input, relatedSites: [named('plain', 'Plain')] }).rows;
  assert.deepEqual([row.detail, row.aside], ['plain.example', '']);
});

test('the current site is left out of its own board', () => {
  const rows = resolveTransitBoard({ ...input, siteId: 'hagitask' }).rows;
  assert.ok(!rows.some((row) => row.id === 'hagitask'));
  const same = resolveTransitBoard({ ...input, relatedSites: [named('self', 'Self', 'https://hagilight.hagicode.com/'), named('other', 'Other')] });
  assert.deepEqual(same.rows.map((row) => row.id), ['other', 'destination', 'other']);
});

test('a short catalog shrinks the window and never scrolls past the destination', () => {
  const none = resolveTransitBoard({ ...input, relatedSites: [] });
  assert.deepEqual([none.count, none.shown, none.travel, none.rows.length], [0, 1, 0, 1]);
  const two = resolveTransitBoard({ ...input, relatedSites: [named('a', 'A'), named('b', 'B')] });
  assert.deepEqual(two.rows.map((row) => row.id), ['a', 'b', 'destination', 'a', 'b']);
  assert.deepEqual([two.shown, two.travel], [5, 0]);
  const one = resolveTransitBoard({ ...input, relatedSites: [named('a', 'A')] });
  assert.deepEqual([one.shown, one.travel], [3, 0]);
});
