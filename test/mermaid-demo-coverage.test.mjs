import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MERMAID_SAMPLES } from '../examples/demo-web/src/mermaid-samples.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const recorded = JSON.parse(readFileSync(join(root, 'test', 'fixtures', 'mermaid-diagram-types.json'), 'utf8'));
const recordedIds = recorded.types.map(({ id }) => id);

test('the recorded types come from the pinned Mermaid release', async () => {
  const { default: pkg } = await import('mermaid/package.json', { with: { type: 'json' } });
  assert.equal(recorded.mermaid, pkg.version);
});

test('every recorded diagram type has a sample on the demo page', () => {
  const missing = recordedIds.filter((id) => !(id in MERMAID_SAMPLES));
  assert.deepEqual(missing, []);
});

test('no sample is keyed by a type that is not recorded', () => {
  const unrecorded = Object.keys(MERMAID_SAMPLES).filter((id) => !recordedIds.includes(id));
  assert.deepEqual(unrecorded, []);
});

test('each sample is detected as its own type by Mermaid', async () => {
  const { default: mermaid } = await import('mermaid');
  const mismatches = [];
  for (const id of recordedIds) {
    const source = MERMAID_SAMPLES[id];
    // Parsing loads the diagram's detector; some Node builds cannot finish a parse without a DOM, which is harmless here.
    await mermaid.parse(source).catch(() => undefined);
    let detected;
    try {
      detected = mermaid.detectType(source);
    } catch (error) {
      detected = `error: ${error.message.split('\n')[0]}`;
    }
    if (detected !== id) mismatches.push(`${id} detected as ${detected}`);
  }
  assert.deepEqual(mismatches, []);
});

test('the flowchart sample is large enough to exercise the single-fade path', () => {
  const nodes = new Set(MERMAID_SAMPLES['flowchart-v2'].match(/\b[a-z]+\d+\[/g));
  assert.ok(nodes.size > 80, `flowchart sample has ${nodes.size} nodes`);
});
