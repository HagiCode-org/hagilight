// Browser checks for the Pele engine of @hagicode/hagilight-mermaid. Served by test/mermaid-pele-browser.mjs,
// which reads `window.__peleResults` once `window.__peleDone` is set. With `?record=1` the page also
// records the Mermaid post-processing snapshot from the previous build (see test/fixtures/pele/).

const PKG = '/packages/mermaid/dist';
const RECORD = new URLSearchParams(location.search).get('record') === '1';
const { PELE_FIXTURES } = await import('/test/fixtures/pele/index.mjs');
const { renderMermaid } = await import(`${PKG}/index.js`);
const { postProcessMermaidSvg } = await import(`${PKG}/svg.js`);
const { buildMermaidGraph, traceFrom } = await import(`${PKG}/graph.js`);
// Record mode takes the baseline from the pre-change module (HEAD's svg.ts, transpiled to svg-head.js).
const baseline = RECORD ? await import(`${PKG}/svg-head.js`) : null;
const results = [];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (actual, expected, message = 'values differ') => {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(read, label, timeout = 15000) {
  const start = performance.now();
  for (;;) {
    const value = read();
    if (value) return value;
    if (performance.now() - start > timeout) throw new Error(`timed out waiting for ${label}`);
    await sleep(25);
  }
}
async function check(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, message: error?.message ?? String(error) });
  }
}

/** A fresh, attached host. Every check starts from an empty body. */
function fresh() {
  document.body.replaceChildren();
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

const parse = (svg) => new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
const fixtureText = async (file) => (await fetch(`/test/fixtures/pele/${file}`)).text();

/** Mermaid samples for the post-processing snapshot. The same strings are rendered by the real mermaid module. */
const MERMAID_SAMPLES = {
  flowchart: 'flowchart LR\n  A[Start] --> B{Choice}\n  B -->|yes| C[Done]',
  pie: 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85',
  sequence: 'sequenceDiagram\n  Alice->>Bob: Hi\n  Bob-->>Alice: Hello',
};

async function renderMermaidSources() {
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base' });
  const out = {};
  for (const [name, source] of Object.entries(MERMAID_SAMPLES)) {
    out[name] = (await mermaid.render(`snapshot-${name}`, source)).svg;
  }
  return out;
}

async function svgChecks() {
  for (const fixture of PELE_FIXTURES) {
    await check(`pele ${fixture.type}: post-processing marks the root and keeps the type`, async () => {
      const raw = await fixtureText(fixture.file);
      const root = parse(postProcessMermaidSvg(raw, {}, 'pele'));
      same(root.getAttribute('class').split(' ').includes('mermaid-enhanced-svg'), true, 'enhanced class');
      same(root.getAttribute('role'), 'img', 'role');
      same(root.getAttribute('data-mermaid-type'), fixture.roledescription, 'type from aria-roledescription');
      assert(root.getAttribute('viewBox'), 'viewBox is kept');
      same(root.getAttribute('width'), '100%', 'width');
      assert(!root.hasAttribute('height'), 'the fixed height attribute is removed');
      assert(!/max-width/.test(root.getAttribute('style') ?? ''), 'no max-width cap');
      same(root.getElementsByTagName('linearGradient').length, 0, 'no Mermaid gradient');
      same(root.classList.contains('mermaid-has-shadow'), false, 'no Mermaid shadow');
    });
  }

  await check('pele output without a viewBox gets one from width and height', async () => {
    const raw = (await fixtureText('flowchart.svg')).replace(/ viewBox="[^"]*"/, '');
    const root = parse(postProcessMermaidSvg(raw, {}, 'pele'));
    same(root.getAttribute('viewBox'), '0 0 438 64', 'viewBox from width and height');
  });

  await check('pele output keeps its text out of the accessibility tree', async () => {
    const root = parse(postProcessMermaidSvg(await fixtureText('pie.svg'), {}, 'pele'));
    const labels = [...root.getElementsByTagName('text')];
    assert(labels.length > 0, 'pie has labels');
    assert(labels.every((label) => label.getAttribute('aria-hidden') === 'true'), 'every text is aria-hidden');
  });

  await check('pele nodes get the neutral node class, but not Mermaid core emphasis or edge classes', async () => {
    const root = parse(postProcessMermaidSvg(await fixtureText('flowchart.svg'), {}, 'pele'));
    same(root.querySelectorAll('.mermaid-node').length, 3, 'neutral node class on each Pele node');
    same(root.querySelectorAll('.mermaid-node-core, .mermaid-node-supporting').length, 0, 'Mermaid core and supporting classes');
    same(root.querySelectorAll('.mermaid-edge').length, 0, 'mermaid-edge');
  });

  await check('mermaid output matches the recorded snapshot (post-processing unchanged)', async () => {
    const rendered = await renderMermaidSources();
    if (RECORD) {
      const outputs = Object.fromEntries(Object.entries(rendered).map(([name, svg]) => [name, baseline.postProcessMermaidSvg(svg)]));
      results.push({ name: 'snapshot recorded', ok: true, snapshot: outputs });
      return;
    }
    const outputs = Object.fromEntries(Object.entries(rendered).map(([name, svg]) => [name, postProcessMermaidSvg(svg)]));
    const expected = await (await fetch('/test/fixtures/pele/mermaid-postprocess-snapshot.json')).json();
    same(outputs, expected, 'snapshot');
  });
}

/** The computed color of a CSS color value, so a hex from the theme can be compared with what the browser paints. */
function paintedColor(value) {
  const probe = document.createElement('div');
  probe.style.color = value;
  document.body.append(probe);
  const painted = getComputedStyle(probe).color;
  probe.remove();
  return painted;
}

async function themeChecks() {
  const { peleVariables } = await import(`${PKG}/pele-theme.js`);
  const PIE = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85';

  await check('a Pele pie chart fills its slices with the mapped series colors', async () => {
    const host = fresh();
    let loads = 0;
    const handle = renderMermaid(host, PIE, { engine: 'pele', mode: 'light', peleLoader: () => { loads += 1; return import('pele'); } });
    const slice = await waitFor(() => host.querySelector('path.pele-slice'), 'the Pele pie slices');
    const container = host.querySelector('.mermaid-container');
    const expected = peleVariables('light', 'default')['--pele-series-1'];
    same(container.style.getPropertyValue('--pele-series-1'), expected, 'series 1 on the container');
    same(getComputedStyle(slice).fill, paintedColor(expected), 'slice fill');

    handle.update({ mode: 'dark' });
    await waitFor(() => host.querySelector('.mermaid-container')?.dataset.mermaidMode === 'dark', 'the dark restyle');
    const darkExpected = peleVariables('dark', 'default')['--pele-series-1'];
    same(getComputedStyle(host.querySelector('path.pele-slice')).fill, paintedColor(darkExpected), 'slice fill after a mode change');
    same(loads, 1, 'Pele is loaded once across the mode change');
    handle.destroy();
  });

  await check('a Pele pie chart labels its slices in the background color', async () => {
    const host = fresh();
    renderMermaid(host, PIE, { engine: 'pele', mode: 'light' });
    const labels = await waitFor(() => host.querySelector('.pele-slice-labels'), 'the Pele slice labels');
    const background = peleVariables('light', 'default')['--pele-bg'];
    same(getComputedStyle(labels).fill, paintedColor(background), 'label fill follows --pele-bg');
  });
}

/** Linked node pairs, as keys, from the drawn start to the drawn end of each edge. */
function linkedPairs(svg) {
  const graph = buildMermaidGraph(svg);
  return graph.edges.map((edge) => [graph.nodes[edge.from].key, graph.nodes[edge.to].key]);
}

async function graphChecks() {
  // The keys are the Pele node ids; the edge ids (L_my_node_other_node_0, edge0, id_Animal_Duck_1) are never parsed.
  const expected = {
    flowchart: [['my_node', 'other_node'], ['other_node', 'third_node']],
    state: [['root_start', 'Still'], ['Still', 'Moving'], ['Moving', 'Still']],
    class: [['Animal', 'Duck']],
    er: [['CUSTOMER', 'ORDER']],
  };
  for (const [type, pairs] of Object.entries(expected)) {
    await check(`pele ${type}: each edge links the nodes its ends touch`, async () => {
      const host = fresh();
      host.innerHTML = postProcessMermaidSvg(await fixtureText(`${type}.svg`), {}, 'pele');
      const svg = host.querySelector('svg');
      same(linkedPairs(svg).map((pair) => pair.join('>')).sort(), pairs.map((pair) => pair.join('>')).sort(), 'linked pairs');
    });
  }

  await check('pele pie and sequence have no graph, so no node tab stops', async () => {
    for (const type of ['pie', 'sequence']) {
      const host = fresh();
      host.innerHTML = postProcessMermaidSvg(await fixtureText(`${type}.svg`), {}, 'pele');
      same(buildMermaidGraph(host.querySelector('svg')).nodes.length, 0, `${type} nodes`);
    }
  });
}

/** The graph facts that must match between engines: node keys, linked pairs, and trace counts per node. */
async function graphSummary(engine, source) {
  const host = fresh();
  renderMermaid(host, source, { engine, entrance: false });
  const svg = await waitFor(() => host.querySelector('.mermaid-diagram-container > svg'), `the ${engine} diagram`);
  const graph = buildMermaidGraph(svg);
  return {
    nodes: graph.nodes.map((node) => node.key).sort(),
    links: graph.edges.map((edge) => `${graph.nodes[edge.from].key}>${graph.nodes[edge.to].key}`).sort(),
    trace: Object.fromEntries(
      graph.nodes.map((node, index) => {
        const trace = traceFrom(graph, index);
        return [node.key, [trace.upstream.size, trace.downstream.size]];
      }),
    ),
  };
}

async function parityChecks() {
  const source = 'flowchart LR\n  A[Start] --> B[Middle]\n  B --> C[End]\n  A --> C';
  await check('the same flowchart has equal nodes, links and trace counts under both engines', async () => {
    const pele = await graphSummary('pele', source);
    const mermaid = await graphSummary('mermaid', source);
    same(pele.nodes, ['A', 'B', 'C'], 'Pele nodes');
    same(pele.links, ['A>B', 'A>C', 'B>C'], 'Pele links');
    same(pele, mermaid, 'graph under each engine');
  });
}

/** Animations on the elements a reveal plays on: nodes for a graph, slices for a pie. */
const animated = (elements) => elements.filter((element) => element.getAnimations().length > 0).length;

async function entranceChecks() {
  const FLOW = 'flowchart LR\n  A[Start] --> B[Middle]\n  B --> C[End]';
  const PIE_SOURCE = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85';

  await check('a Pele flowchart reveals its nodes, edges and arrowheads in rank order', async () => {
    const host = fresh();
    renderMermaid(host, FLOW, { engine: 'pele' });
    const svg = await waitFor(() => host.querySelector('.mermaid-diagram-container > svg'), 'the Pele flowchart');
    await waitFor(() => svg.querySelectorAll('g.pele-node').length === 3 && animated([...svg.querySelectorAll('g.pele-node')]) === 3, 'the node reveal');
    const markers = [...svg.querySelectorAll('.pele-marker')];
    assert(markers.length > 0, 'the arrowheads exist');
    assert(animated(markers) === markers.length, 'every arrowhead is animated with its edge');
  });

  await check('a Pele pie uses the generic reveal and gets no node tab stops', async () => {
    const host = fresh();
    renderMermaid(host, PIE_SOURCE, { engine: 'pele' });
    const svg = await waitFor(() => host.querySelector('.mermaid-diagram-container > svg'), 'the Pele pie');
    await waitFor(() => svg.getAnimations({ subtree: true }).length > 0, 'the generic reveal');
    same(host.querySelectorAll('[tabindex="0"], [tabindex="-1"]').length, 0, 'tab stops on the pie');
  });

  await check('reduced motion plays no reveal on a Pele flowchart', async () => {
    const host = fresh();
    renderMermaid(host, FLOW, { engine: 'pele', interaction: { reducedMotion: true } });
    const svg = await waitFor(() => host.querySelector('.mermaid-diagram-container > svg'), 'the Pele flowchart');
    await sleep(120);
    same(animated([...svg.querySelectorAll('g.pele-node')]), 0, 'animated nodes');
  });

  await check('replay plays a Pele flowchart reveal again', async () => {
    // A source that has not played yet, so the first reveal runs by itself and replay repeats it.
    const host = fresh();
    const handle = renderMermaid(host, 'flowchart LR\n  A[Replay start] --> B[Replay middle]\n  B --> C[Replay end]', { engine: 'pele' });
    const svg = await waitFor(() => host.querySelector('.mermaid-diagram-container > svg'), 'the Pele flowchart');
    await waitFor(() => animated([...svg.querySelectorAll('g.pele-node')]) === 3, 'the first reveal');
    await waitFor(() => animated([...svg.querySelectorAll('g.pele-node')]) === 0, 'the first reveal to finish', 8000);
    handle.replay();
    await waitFor(() => animated([...svg.querySelectorAll('g.pele-node')]) === 3, 'the replayed reveal');
    handle.destroy();
  });

  await check('switching engine clears a pinned trace', async () => {
    const host = fresh();
    const handle = renderMermaid(host, FLOW, { engine: 'pele', entrance: false });
    const svg = await waitFor(() => host.querySelector('.mermaid-diagram-container > svg'), 'the Pele flowchart');
    const node = svg.querySelector('g.pele-node[data-id="B"]');
    node.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Every node of this small graph is connected to B, so the focus class is what marks the trace.
    await waitFor(() => host.querySelector('.mermaid-trace-focus'), 'the pinned trace');
    same(svg.querySelector('g.pele-node[data-id="B"]').getAttribute('aria-pressed'), 'true', 'B is pinned');
    handle.update({ engine: 'mermaid' });
    await waitFor(() => host.querySelector('.mermaid-diagram-container > svg')?.querySelector('g.node') ?? null, 'the Mermaid flowchart');
    same(host.querySelectorAll('.mermaid-trace-dim, .mermaid-trace-focus, .mermaid-trace-up, .mermaid-trace-down').length, 0, 'trace classes after the switch');
    handle.destroy();
  });
}

async function run() {
  await svgChecks();
  await graphChecks();
  await parityChecks();
  await entranceChecks();
  await themeChecks();
}

try {
  await run();
} finally {
  window.__peleResults = results;
  window.__peleDone = true;
}
