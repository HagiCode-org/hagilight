import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { render } from 'pele';

// Markup guard for the Pele engine adapters. The fixtures are Pele 1.13.0 output (see
// test/fixtures/pele/index.mjs for the confirmed selectors). Pele has no releases page, so a
// changed markup shows up here first, naming the marker the adapters rely on.
const { PELE_FIXTURES } = await import('./fixtures/pele/index.mjs');
const fixtureDir = fileURLToPath(new URL('./fixtures/pele/', import.meta.url));

const GRAPH_TYPES = new Set(['flowchart', 'state', 'class', 'er']);

/** Every marker a fixture of this type must carry, as name → pattern. */
function requiredMarkers(type) {
  const common = {
    'root class pele pele-<type>': new RegExp(`class="pele pele-${type}"`),
    'aria-roledescription=<type>': new RegExp(`aria-roledescription="${type}"`),
  };
  if (GRAPH_TYPES.has(type)) {
    return {
      ...common,
      'g.pele-node[data-id]': /<g class="pele-node[^"]*" data-id="[^"]+"/,
      'g.pele-edge[data-id]': /<g class="pele-edge[^"]*" data-id="[^"]+"><path d="/,
    };
  }
  if (type === 'pie') {
    return {
      ...common,
      'path.pele-slice[data-id]': /<path class="pele-slice" data-id="[^"]+"/,
      'slice fill var(--pele-series-N)': /fill="var\(--pele-series-\d+/,
    };
  }
  if (type === 'sequence') {
    return {
      ...common,
      'g.pele-node.pele-actor[data-id]': /<g class="pele-node pele-actor[^"]*" data-id="[^"]+"/,
      'g.pele-edge.pele-message[data-id]': /<g class="pele-edge pele-message" data-id="[^"]+"/,
    };
  }
  throw new Error(`no marker list for fixture type ${type}`);
}

/** Names of the required markers that the markup does not contain. */
function missingMarkers(svg, type) {
  return Object.entries(requiredMarkers(type))
    .filter(([, pattern]) => !pattern.test(svg))
    .map(([name]) => name);
}

/** Throws with the file name and every missing marker, so a failure says what changed. */
function assertMarkers(svg, { type, file }) {
  const missing = missingMarkers(svg, type);
  if (missing.length > 0) {
    throw new Error(`${file} is missing Pele marker(s): ${missing.join(', ')}`);
  }
}

test('every fixture exists and carries every marker the adapters need', () => {
  for (const fixture of PELE_FIXTURES) {
    const path = join(fixtureDir, fixture.file);
    assert.ok(existsSync(path), `${fixture.file} exists`);
    assertMarkers(readFileSync(path, 'utf8'), fixture);
  }
});

test('every fixture type is one the adapters support', () => {
  assert.deepEqual(
    PELE_FIXTURES.map((fixture) => fixture.type).sort(),
    ['class', 'er', 'flowchart', 'pie', 'sequence', 'state'],
  );
});

test('the installed pele still renders every sample with the expected markers', () => {
  // Drift guard: this catches a Pele upgrade that changes markup before a site does.
  for (const fixture of PELE_FIXTURES) {
    const result = render(fixture.source);
    assert.equal(result.type, fixture.type, `${fixture.type} sample is detected as ${fixture.type}`);
    assertMarkers(result.svg, fixture);
  }
});

test('a copy with a removed marker fails and names that marker', () => {
  const flowchart = PELE_FIXTURES.find((fixture) => fixture.type === 'flowchart');
  const svg = readFileSync(join(fixtureDir, flowchart.file), 'utf8');
  const withoutEdges = svg.replaceAll('class="pele-edge"', 'class="pele-link"');
  assert.deepEqual(missingMarkers(withoutEdges, 'flowchart'), ['g.pele-edge[data-id]']);
  assert.throws(() => assertMarkers(withoutEdges, flowchart), /flowchart\.svg is missing Pele marker\(s\): g\.pele-edge\[data-id\]/);
});

test('a copy with the aria-roledescription removed names that marker', () => {
  const pie = PELE_FIXTURES.find((fixture) => fixture.type === 'pie');
  const svg = readFileSync(join(fixtureDir, pie.file), 'utf8');
  const withoutRole = svg.replace(/ aria-roledescription="pie"/, '');
  assert.deepEqual(missingMarkers(withoutRole, 'pie'), ['aria-roledescription=<type>']);
});
