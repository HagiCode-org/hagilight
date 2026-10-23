import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LABELS, formatLabel, resolveLabels } from '@hagicode/hagilight-mermaid/labels';

test('no overrides resolves to the English defaults', () => {
  assert.deepEqual(resolveLabels(), DEFAULT_LABELS);
  assert.equal(resolveLabels().rendering, 'Rendering diagram...');
  assert.equal(resolveLabels().trace.clear, 'Clear selection');
});

test('a partial override changes only the keys it names', () => {
  const labels = resolveLabels({ errorTitle: 'Diagram failed', trace: { clear: 'Reset' } });
  assert.equal(labels.errorTitle, 'Diagram failed');
  assert.equal(labels.trace.clear, 'Reset');
  assert.equal(labels.trace.pinned, DEFAULT_LABELS.trace.pinned);
  assert.equal(labels.replay, DEFAULT_LABELS.replay);
});

test('resolving labels never mutates the defaults', () => {
  resolveLabels({ trace: { upstream: 'Up {value}' } });
  assert.equal(DEFAULT_LABELS.trace.upstream, 'Upstream {value}');
});

test('count placeholders are replaced and unknown placeholders are kept', () => {
  assert.equal(formatLabel(DEFAULT_LABELS.trace.upstream, { value: 3 }), 'Upstream 3');
  assert.equal(formatLabel('{count} of {total}', { count: 2, total: 9 }), '2 of 9');
  assert.equal(formatLabel('{value} and {missing}', { value: 'x' }), 'x and {missing}');
  assert.equal(formatLabel('no placeholders'), 'no placeholders');
});
