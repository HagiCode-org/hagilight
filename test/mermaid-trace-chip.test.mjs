import assert from 'node:assert/strict';
import { test } from 'node:test';
import { traceChipKey } from '../packages/mermaid/dist/chip.js';
import { DEFAULT_LABELS } from '@hagicode/hagilight-mermaid/labels';

const pinned = { label: 'Process', upstream: 1, downstream: 2, pinned: true };

test('the same summary and labels give the same chip key', () => {
  assert.equal(traceChipKey({ ...pinned }, DEFAULT_LABELS), traceChipKey(pinned, DEFAULT_LABELS));
  assert.equal(traceChipKey(null, DEFAULT_LABELS), traceChipKey(null, DEFAULT_LABELS));
});

test('a change to the pin, the label, a count or the place changes the chip key', () => {
  const base = traceChipKey(pinned, DEFAULT_LABELS);
  assert.notEqual(traceChipKey({ ...pinned, pinned: false }, DEFAULT_LABELS), base);
  assert.notEqual(traceChipKey({ ...pinned, label: 'Check' }, DEFAULT_LABELS), base);
  assert.notEqual(traceChipKey({ ...pinned, upstream: 0 }, DEFAULT_LABELS), base);
  assert.notEqual(traceChipKey({ ...pinned, position: { index: 1, total: 3 } }, DEFAULT_LABELS), base);
});

test('a cleared summary and a changed clear label have their own keys', () => {
  assert.notEqual(traceChipKey(null, DEFAULT_LABELS), traceChipKey(pinned, DEFAULT_LABELS));
  const relabelled = { ...DEFAULT_LABELS, trace: { ...DEFAULT_LABELS.trace, clear: 'Reset' } };
  assert.notEqual(traceChipKey(pinned, relabelled), traceChipKey(pinned, DEFAULT_LABELS));
});
