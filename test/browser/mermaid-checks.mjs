// Browser checks for @hagicode/hagilight-mermaid. Served by test/mermaid-browser.mjs, which reads
// `window.__mermaidResults` once `window.__mermaidDone` is set. The suite comes from `?suite=`.

const PKG = '/packages/mermaid/dist';
const fixtures = await (await fetch('/test/fixtures/mermaid-diagrams.json')).json();
const { renderMermaid, mountMermaidDiagrams } = await import(`${PKG}/index.js`);
const { getMermaidThemeConfig, clearMermaidThemeConfigCache } = await import(`${PKG}/theme.js`);
const { postProcessMermaidSvg } = await import(`${PKG}/svg.js`);
const { buildMermaidGraph, assignRanks, traceFrom } = await import(`${PKG}/graph.js`);
const { attachMermaidDiagramInteraction } = await import(`${PKG}/interaction.js`);
const realLoader = () => import('mermaid');
const SUITE = new URLSearchParams(location.search).get('suite') ?? 'default';
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function same(actual, expected, message = 'values differ') {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}
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

/** Port of the web app's flowchart stand-in: `g.nodes > g.node` plus `g.edgePaths > path` with `data-id`. */
function flowchartStub(name) {
  const { nodes, edges } = fixtures.stubs[name];
  const host = fresh();
  const edgeMarkup = edges
    .map(([from, to], index) => `<path id="r-L_${from}_${to}_0" data-id="L_${from}_${to}_0" data-edge="true" class="flowchart-link mermaid-edge" d="M0,${index * 10}L10,${index * 10}"></path>`)
    .join('');
  const labelMarkup = edges
    .filter(([, , label]) => label)
    .map(([from, to, label]) => `<g class="edgeLabel mermaid-edge-label"><g class="label" data-id="L_${from}_${to}_0"><text>${label}</text></g></g>`)
    .join('');
  const nodeMarkup = nodes
    .map((id, index) => `<g id="r-flowchart-${id}-${index}" class="node default mermaid-node"><rect width="10" height="10"></rect><g class="label"><text>${id}</text></g></g>`)
    .join('');
  host.innerHTML = `<svg class="flowchart"><g class="root"><g class="clusters"></g><g class="edgePaths">${edgeMarkup}</g><g class="edgeLabels">${labelMarkup}</g><g class="nodes">${nodeMarkup}</g></g></svg>`;
  return host;
}

/** Mermaid stand-in whose render time depends on the source, for overlap and teardown checks. */
function fakeMermaid(delays) {
  return {
    default: {
      initialize() {},
      async render(_id, text) {
        await sleep(delays[text] ?? 0);
        return { svg: `<svg xmlns="http://www.w3.org/2000/svg" class="flowchart" viewBox="0 0 10 10"><text>${text}</text></svg>` };
      },
    },
  };
}

const fire = (target, type, init = {}) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }));
const touch = (target, type, init = {}) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', ...init }));
const tap = (target) => {
  fire(target, 'pointerdown', { clientX: 5, clientY: 5 });
  fire(target, 'pointerup', { clientX: 5, clientY: 5 });
};
const key = (target, name) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
const delayOf = (animation) => animation.effect.getTiming().delay;

// ---------- default suite: rendering, toolbar, mount, SVG, graph, interaction, motion, theme ----------

async function renderChecks() {
  await check('a valid flowchart renders one enhanced SVG with an accessible name', async () => {
    const host = fresh();
    renderMermaid(host, 'flowchart LR\n  A --> B', { mode: 'light', loadMermaid: realLoader, entrance: false, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('.mermaid-container svg.mermaid-enhanced-svg'), 'SVG');
    same(svg.getAttribute('role'), 'img', 'role');
    same(svg.getAttribute('aria-label'), 'Diagram', 'aria-label');
    same(host.querySelectorAll('svg').length, 1, 'SVG count');
    same(host.querySelector('.mermaid-container').dataset.mermaidMode, 'light', 'mode attribute');
    same(host.querySelector('.mermaid-container').dataset.mermaidPreset, 'default', 'preset attribute');
  });

  await check('empty source leaves the host empty and never loads mermaid', async () => {
    const host = fresh();
    let loads = 0;
    renderMermaid(host, '  \n ', { loadMermaid: async () => (loads += 1, realLoader()) });
    await sleep(80);
    same(host.childElementCount, 0, 'host children');
    same(loads, 0, 'loader calls');
  });

  await check('a syntax error shows the error panel with the source in a details element', async () => {
    const host = fresh();
    const source = 'flowchart LR\n  A -->';
    renderMermaid(host, source, { loadMermaid: realLoader });
    const panel = await waitFor(() => host.querySelector('.mermaid-error-container'), 'error panel');
    same(panel.querySelector('.mermaid-error-title').textContent, 'Diagram Rendering Error', 'title');
    assert(/^(Syntax error:|Rendering error:)/.test(panel.querySelector('.mermaid-error-message').textContent), 'message keeps a label prefix');
    same(panel.querySelector('summary').textContent, 'View Mermaid code', 'summary');
    same(panel.querySelector('pre.mermaid-error-code').textContent, source, 'source');
  });

  await check('a failing loader shows its message, and update recovers with a working loader', async () => {
    const host = fresh();
    const handle = renderMermaid(host, 'flowchart LR\n  A --> B', { loadMermaid: async () => { throw new Error('module missing'); } });
    const panel = await waitFor(() => host.querySelector('.mermaid-error-container'), 'error panel');
    same(panel.querySelector('.mermaid-error-message').textContent, 'module missing', 'message');
    handle.update({ loadMermaid: realLoader });
    await waitFor(() => host.querySelector('.mermaid-enhanced-svg'), 'recovered diagram');
    same(host.querySelector('.mermaid-error-container'), null, 'error panel after recovery');
    handle.destroy();
  });

  await check('only the latest update reaches the host when renders overlap', async () => {
    const host = fresh();
    const loadMermaid = async () => fakeMermaid({ OLD: 300, NEW: 10 });
    const handle = renderMermaid(host, 'OLD', { loadMermaid, entrance: false });
    handle.update({ source: 'NEW' });
    await waitFor(() => host.textContent.includes('NEW'), 'NEW render');
    await sleep(400);
    assert(host.textContent.includes('NEW') && !host.textContent.includes('OLD'), 'the stale OLD render must not appear');
    handle.destroy();
  });

  await check('destroy discards a pending render and leaves the host empty', async () => {
    const host = fresh();
    const handle = renderMermaid(host, 'SLOW', { loadMermaid: async () => fakeMermaid({ SLOW: 200 }), entrance: false });
    await sleep(20);
    handle.destroy();
    await sleep(400);
    same(host.childElementCount, 0, 'host children after destroy');
  });

  await check('the toolbar shows for a graph, with the replay label from options', async () => {
    const host = fresh();
    renderMermaid(host, 'flowchart LR\n  A --> B', { loadMermaid: realLoader, entrance: false, labels: { replay: 'Play again' } });
    await waitFor(() => host.querySelector('.mermaid-toolbar'), 'toolbar');
    const replay = host.querySelector('.mermaid-replay');
    same(replay.getAttribute('aria-label'), 'Play again', 'replay label');
    assert(replay.querySelector('svg'), 'replay icon');
  });

  await check('a pie chart has no toolbar', async () => {
    const host = fresh();
    renderMermaid(host, fixtures.charts.pie, { loadMermaid: realLoader, entrance: false });
    await waitFor(() => host.querySelector('.mermaid-diagram-container svg'), 'pie SVG');
    same(host.querySelector('.mermaid-toolbar'), null, 'toolbar');
  });

  await check('interaction disabled means no toolbar', async () => {
    const host = fresh();
    renderMermaid(host, 'flowchart LR\n  A --> B', { loadMermaid: realLoader, entrance: false, interaction: { enabled: false } });
    await waitFor(() => host.querySelector('.mermaid-diagram-container svg'), 'SVG');
    same(host.querySelector('.mermaid-toolbar'), null, 'toolbar');
    same(host.querySelector('.mermaid-node').getAttribute('tabindex'), null, 'tab stop');
  });

  await check('the trace chip text comes from labels, with the count substituted', async () => {
    const host = fresh();
    renderMermaid(host, 'flowchart LR\n  A --> B', {
      loadMermaid: realLoader,
      entrance: false,
      labels: { trace: { upstream: 'Up {value}', downstream: 'Down {value}' } },
    });
    await waitFor(() => host.querySelector('.mermaid-toolbar'), 'toolbar');
    const node = host.querySelector('.mermaid-node[aria-label="A"]');
    fire(node, 'pointerover');
    const chip = await waitFor(() => host.querySelector('.mermaid-trace-chip'), 'trace chip');
    same(chip.querySelector('.mermaid-trace-chip-up').textContent, 'Up 0', 'upstream text');
    same(chip.querySelector('.mermaid-trace-chip-down').textContent, 'Down 1', 'downstream text');
  });
}

async function mountChecks() {
  await check('mount renders each block, isolates the bad one, skips mounted blocks and destroys cleanly', async () => {
    const root = fresh();
    root.innerHTML = `
      <pre class="mermaid">flowchart LR\n  A --> B</pre>
      <pre><code class="language-mermaid">flowchart LR\n  X -->\n</code></pre>
      <pre class="mermaid">pie title Pets\n  "Dogs" : 386\n  "Cats" : 85</pre>`;
    const mount = mountMermaidDiagrams(root, { loadMermaid: realLoader, entrance: false, mode: 'light' });
    same(mount.handles.length, 3, 'handles');
    await waitFor(() => root.querySelectorAll('.mermaid-diagram-container svg').length === 2 && root.querySelector('.mermaid-error-container'), 'three blocks settled');
    same(root.querySelectorAll('.mermaid-container').length, 3, 'containers');
    same(root.querySelectorAll('.mermaid-error-container').length, 1, 'error panels');
    const again = mountMermaidDiagrams(root, { loadMermaid: realLoader });
    same(again.handles.length, 0, 'second mount handles');
    same(root.querySelectorAll('.mermaid-container').length, 3, 'containers after remount');
    mount.destroy();
    same(root.querySelectorAll('.mermaid-container').length, 0, 'containers after destroy');
  });
}

async function svgChecks() {
  await check('post-processing strips max-width, marks the SVG, and returns non-SVG input unchanged', async () => {
    const processed = postProcessMermaidSvg('<svg xmlns="http://www.w3.org/2000/svg" style="max-width: 300px; color: red" viewBox="0 0 10 10"><g class="node"><text>x</text></g></svg>');
    assert(!/max-width/.test(processed), 'max-width removed');
    assert(processed.includes('mermaid-enhanced-svg') && processed.includes('role="img"'), 'class and role set');
    same(postProcessMermaidSvg('<p>plain</p>'), '<p>plain</p>', 'non-SVG markup');
    same(postProcessMermaidSvg('not xml <'), 'not xml <', 'malformed input');
  });

  await check('a flowchart viewBox is recomputed from the graph bounds with 16px padding', async () => {
    const host = fresh();
    renderMermaid(host, 'flowchart LR\n  A --> B', { loadMermaid: realLoader, entrance: false, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'flowchart SVG');
    const box = svg.querySelector('.root').getBBox();
    const [x, y, width, height] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const near = (a, b) => Math.abs(a - b) < 0.01;
    assert(near(x, box.x - 16) && near(y, box.y - 16) && near(width, box.width + 32) && near(height, box.height + 32), `viewBox ${svg.getAttribute('viewBox')} vs bounds ${JSON.stringify(box)}`);
  });
}

function flowchartGraph(name) {
  return buildMermaidGraph(flowchartStub(name).querySelector('svg'));
}

async function graphChecks() {
  await check('the graph reads nodes, edge endpoints and edge labels', async () => {
    const graph = flowchartGraph('linked');
    same(graph.nodes.map((node) => node.key), ['A', 'B', 'C'], 'keys');
    same(graph.nodes.map((node) => node.label), ['A', 'B', 'C'], 'labels');
    same(graph.edges.map((edge) => [edge.from, edge.to]), [[0, 1], [1, 2]], 'endpoints');
    assert(graph.edges[0].labelEl !== null && graph.edges[1].labelEl === null, 'edge label elements');
    same(graph.out[1], [1], 'out');
    same(graph.inc[1], [0], 'inc');
  });

  await check('node ids containing underscores resolve', async () => {
    const graph = flowchartGraph('underscores');
    same(graph.edges.map((edge) => [edge.from, edge.to]), [[1, 0]], 'endpoints');
  });

  await check('an ambiguous edge id with no usable geometry yields no edge', async () => {
    same(flowchartGraph('ambiguous').edges, [], 'edges');
  });

  await check('a diagram without nodes yields an empty graph', async () => {
    const host = fresh();
    host.innerHTML = '<svg class="sequence"><g></g></svg>';
    const graph = buildMermaidGraph(host.querySelector('svg'));
    same([graph.nodes, graph.edges], [[], []], 'graph');
  });

  await check('traceFrom measures hop distance both ways from the focus', async () => {
    const trace = traceFrom(flowchartGraph('diamond'), 1);
    same([...trace.upstream], [[0, 1]], 'upstream');
    same(Object.fromEntries(trace.downstream), { 2: 1, 3: 1, 4: 2 }, 'downstream');
    same([...trace.upstreamEdges.keys()], [0], 'upstream edges');
    same([...trace.downstreamEdges.keys()].sort(), [1, 2, 3], 'downstream edges');
  });

  await check('traceFrom uses the shortest distance when two paths reach a node', async () => {
    const trace = traceFrom(flowchartGraph('diamond'), 0);
    same(trace.downstream.get(3), 1, 'D distance');
    same(trace.downstream.get(4), 2, 'E distance');
  });

  await check('traceFrom terminates on cycles and reports a loop member on both sides', async () => {
    const trace = traceFrom(flowchartGraph('loop'), 1);
    assert(trace.upstream.has(2) && trace.downstream.has(2), 'loop member on both sides');
    assert(!trace.upstream.has(1), 'focus is not its own ancestor');
  });

  await check('assignRanks layers by longest path from the sources', async () => {
    same(assignRanks(flowchartGraph('layered')), [0, 1, 2, 3], 'ranks');
  });

  await check('assignRanks ignores back edges so a retry loop does not push nodes forward', async () => {
    same(assignRanks(flowchartGraph('loop')), [0, 1, 2], 'ranks');
  });

  await check('assignRanks ranks every node of a single cycle', async () => {
    assert(assignRanks(flowchartGraph('cycle')).length === 2, 'two ranks');
  });
}

async function interactionChecks() {
  const setup = (config = {}) => {
    const host = flowchartStub('trace');
    const summaries = [];
    const handle = attachMermaidDiagramInteraction(host, {
      enabled: true,
      reducedMotion: true,
      onTraceChange: (summary) => summaries.push(summary),
      ...config,
    });
    const node = (id) => host.querySelector(`[id$="flowchart-${id}-${'ABCD'.indexOf(id)}"]`);
    return { host, handle, summaries, node };
  };

  await check('interaction does nothing unless enabled', async () => {
    const host = flowchartStub('pair');
    attachMermaidDiagramInteraction(host, {});
    fire(host.querySelector('.mermaid-node'), 'pointerover');
    same(host.querySelector('.mermaid-trace-focus'), null, 'focus class');
  });

  await check('the graph has one tab stop and names each node', async () => {
    const { node } = setup();
    same(['A', 'B', 'C', 'D'].map((id) => node(id).getAttribute('tabindex')), ['0', '-1', '-1', '-1'], 'tab stops');
    same(node('B').getAttribute('role'), 'button', 'role');
    same(node('B').getAttribute('aria-label'), 'B', 'name');
  });

  await check('hover traces upstream and downstream, dims the rest, and reports the summary', async () => {
    const { host, node, summaries } = setup();
    fire(node('B'), 'pointerover');
    assert(host.classList.contains('mermaid-tracing'), 'tracing class');
    assert(node('B').classList.contains('mermaid-trace-focus'), 'focus');
    assert(node('A').classList.contains('mermaid-trace-up'), 'A upstream');
    assert(node('C').classList.contains('mermaid-trace-down'), 'C downstream');
    assert(node('D').classList.contains('mermaid-trace-dim'), 'D dimmed');
    same(host.querySelectorAll('.mermaid-trace-edge-up, .mermaid-trace-edge-down').length, 2, 'traced edges');
    same(summaries.at(-1), { label: 'B', upstream: 1, downstream: 1, pinned: false }, 'summary');
    fire(host, 'pointerleave');
    assert(!host.classList.contains('mermaid-tracing'), 'tracing cleared');
    assert(host.querySelector('.mermaid-trace-dim') === null, 'dim cleared');
    same(summaries.at(-1), null, 'null summary');
  });

  await check('touch hover is ignored, a tap pins, and a tap on empty space clears the pin', async () => {
    const { host, node, summaries } = setup();
    touch(node('B'), 'pointerover');
    assert(!host.classList.contains('mermaid-tracing'), 'touch hover ignored');
    tap(node('B'));
    fire(host, 'pointerleave');
    same(node('B').getAttribute('aria-pressed'), 'true', 'pressed');
    same(summaries.at(-1)?.pinned, true, 'pinned summary');
    tap(host);
    same(node('B').getAttribute('aria-pressed'), 'false', 'released');
    assert(!host.classList.contains('mermaid-tracing'), 'trace cleared');
  });

  await check('a drag that ends on a node is not a selection', async () => {
    const { node } = setup();
    fire(node('B'), 'pointerdown', { clientX: 0, clientY: 0 });
    fire(node('B'), 'pointerup', { clientX: 40, clientY: 0 });
    same(node('B').getAttribute('aria-pressed'), 'false', 'pressed');
  });

  await check('arrow keys walk edges, Enter pins, and Escape releases', async () => {
    const { node, summaries } = setup();
    node('A').focus();
    same(summaries.at(-1)?.label, 'A', 'focus summary');
    key(node('A'), 'ArrowDown');
    same(document.activeElement, node('B'), 'focus after ArrowDown');
    same(node('B').getAttribute('tabindex'), '0', 'roving tab stop');
    same(node('A').getAttribute('tabindex'), '-1', 'previous tab stop');
    key(node('B'), 'Enter');
    same(summaries.at(-1)?.pinned, true, 'pinned after Enter');
    key(node('B'), 'ArrowUp');
    same(document.activeElement, node('A'), 'focus after ArrowUp');
    key(node('A'), 'Escape');
    same(node('B').getAttribute('aria-pressed'), 'false', 'released after Escape');
  });

  await check('destroy removes trace classes, badges, layers and listeners', async () => {
    const { host, node, handle, summaries } = setup();
    fire(node('B'), 'pointerover');
    handle.destroy();
    same(host.querySelector('[class*="mermaid-trace"]'), null, 'trace artefacts');
    same(summaries.at(-1), null, 'final summary');
    fire(node('B'), 'pointerover');
    assert(!host.classList.contains('mermaid-tracing'), 'listeners detached');
  });

  await check('reduced motion skips the travelling light', async () => {
    const original = SVGElement.prototype.animate;
    let calls = 0;
    SVGElement.prototype.animate = function (...args) {
      calls += 1;
      return original.apply(this, args);
    };
    try {
      const { node } = setup({ reducedMotion: true });
      fire(node('B'), 'pointerover');
      same(calls, 0, 'animate calls');
    } finally {
      SVGElement.prototype.animate = original;
    }
  });

  await check('destroy with a pinned trace leaves the SVG as Mermaid produced it', async () => {
    const host = flowchartStub('trace');
    const svg = host.querySelector('svg');
    const before = { elements: svg.querySelectorAll('*').length, classes: [...svg.querySelectorAll('[class]')].map((el) => el.getAttribute('class')).join('|') };
    const handle = attachMermaidDiagramInteraction(host, { enabled: true, reducedMotion: false });
    tap(host.querySelector('[id$="flowchart-B-1"]'));
    assert(svg.querySelector('.mermaid-trace-focus'), 'pinned trace present');
    handle.destroy();
    const after = { elements: svg.querySelectorAll('*').length, classes: [...svg.querySelectorAll('[class]')].map((el) => el.getAttribute('class')).join('|') };
    same(after, before, 'class and element counts');
    same(svg.getAnimations({ subtree: true }).length, 0, 'running animations');
  });
}

async function entranceChecks() {
  await check('nodes reveal in rank order, one step apart', async () => {
    const host = fresh();
    renderMermaid(host, `flowchart LR\n  A --> B\n  B --> C\n%% rank-${Date.now()}`, { loadMermaid: realLoader, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'SVG');
    const nodeNamed = (label) => svg.querySelector(`.mermaid-node[aria-label="${label}"]`);
    const delays = await waitFor(() => {
      const values = ['A', 'B', 'C'].map((label) => nodeNamed(label)?.getAnimations()[0]);
      return values.every(Boolean) ? values.map(delayOf) : null;
    }, 'node animations');
    assert(delays[0] < delays[1] && delays[1] < delays[2], `delays ${JSON.stringify(delays)}`);
  });

  await check('entrance false shows the diagram with no reveal', async () => {
    const host = fresh();
    renderMermaid(host, `flowchart LR\n  A --> B\n%% off-${Date.now()}`, { loadMermaid: realLoader, entrance: false, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'SVG');
    await sleep(200);
    same(svg.querySelectorAll('.mermaid-node').length > 0 && [...svg.querySelectorAll('.mermaid-node')].every((node) => node.getAnimations().length === 0), true, 'no node animations');
  });

  await check('a graph over 80 nodes gets one fade of the whole graph', async () => {
    const lines = Array.from({ length: 84 }, (_, index) => `n${index} --> n${index + 1}`);
    const host = fresh();
    renderMermaid(host, `flowchart LR\n  ${lines.join('\n  ')}`, { loadMermaid: realLoader, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'SVG', 30000);
    await waitFor(() => svg.querySelector('g.root')?.getAnimations().length === 1, 'root fade', 5000);
    same(svg.querySelectorAll('.mermaid-node')[0].getAnimations().length, 0, 'node animations');
  });

  await check('a diagram below the fold plays once it scrolls into view', async () => {
    const spacer = fresh();
    spacer.style.height = '2400px';
    const host = document.createElement('div');
    document.body.append(host);
    renderMermaid(host, `flowchart LR\n  A --> B\n%% fold-${Date.now()}`, { loadMermaid: realLoader, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'SVG');
    await sleep(300);
    same(svg.querySelector('.mermaid-node').getAnimations().length, 0, 'before scrolling');
    host.scrollIntoView();
    await waitFor(() => svg.querySelector('.mermaid-node').getAnimations().length > 0, 'reveal after scrolling');
  });

  await check('the same source plays its reveal once, then remounts without replaying', async () => {
    const source = `flowchart LR\n  A --> B\n%% once-${Date.now()}`;
    const first = fresh();
    renderMermaid(first, source, { loadMermaid: realLoader, interaction: { enabled: false } });
    const firstSvg = await waitFor(() => first.querySelector('svg.mermaid-enhanced-svg'), 'first SVG');
    await waitFor(() => firstSvg.querySelector('.mermaid-node').getAnimations().length > 0, 'first reveal');
    const second = fresh();
    renderMermaid(second, source, { loadMermaid: realLoader, interaction: { enabled: false } });
    const secondSvg = await waitFor(() => second.querySelector('svg.mermaid-enhanced-svg'), 'second SVG');
    await sleep(200);
    same(secondSvg.querySelector('.mermaid-node').getAnimations().length, 0, 'second reveal');
  });

  await check('a solid edge draws with its arrowhead held back until the line lands', async () => {
    // Watch marker-end from before the render, so the removal during the reveal is recorded.
    const removals = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) if (!record.target.hasAttribute('marker-end')) removals.push(record.target);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['marker-end'], subtree: true });
    const host = fresh();
    renderMermaid(host, `flowchart LR\n  A --> B\n%% arrow-${Date.now()}`, { loadMermaid: realLoader, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'SVG');
    const edge = await waitFor(() => svg.querySelector('g.edgePaths > path'), 'edge');
    const markerEnd = await waitFor(() => (edge.hasAttribute('marker-end') ? edge.getAttribute('marker-end') : null) ?? (removals.length ? 'held' : null), 'arrowhead');
    await waitFor(() => edge.getAnimations().length === 0 && edge.hasAttribute('marker-end'), 'draw finished and arrowhead restored', 5000);
    observer.disconnect();
    assert(removals.includes(edge), 'the arrowhead was held back during the draw');
    assert(markerEnd !== null, 'the edge carried an arrowhead');
    same(edge.getAttribute('marker-end'), svg.querySelector('g.edgePaths > path').getAttribute('marker-end'), 'arrowhead restored');
  });

  await check('a dashed edge fades in and never animates its dash pattern', async () => {
    const host = fresh();
    renderMermaid(host, `flowchart LR\n  A -.-> B\n%% dash-${Date.now()}`, { loadMermaid: realLoader, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'SVG');
    const edge = await waitFor(() => svg.querySelector('.edge-pattern-dashed') ?? svg.querySelector('g.edgePaths > path'), 'dashed edge', 5000);
    const animation = await waitFor(() => edge.getAnimations()[0], 'edge animation', 5000);
    const keys = Object.keys(animation.effect.getKeyframes()[0]).filter((key) => !['offset', 'easing', 'composite', 'computedOffset'].includes(key));
    same(keys, ['opacity'], 'keyframe properties');
  });

  await check('destroy during a reveal restores the arrowheads', async () => {
    const host = fresh();
    const handle = renderMermaid(host, `flowchart LR\n  A --> B\n%% cancel-${Date.now()}`, { loadMermaid: realLoader, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'SVG');
    const edges = [...svg.querySelectorAll('g.edgePaths > path')];
    await waitFor(() => edges.some((edge) => edge.getAnimations().length > 0), 'reveal started', 5000);
    handle.destroy();
    assert(edges.length > 0 && edges.every((edge) => edge.getAttribute('marker-end')), 'every arrowhead restored after destroy');
  });

  await check('replay plays the reveal again on the handle', async () => {
    const host = fresh();
    const handle = renderMermaid(host, `flowchart LR\n  A --> B\n%% replay-${Date.now()}`, { loadMermaid: realLoader, interaction: { enabled: false } });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'SVG');
    await waitFor(() => svg.querySelector('.mermaid-node').getAnimations().length > 0, 'first reveal');
    await waitFor(() => svg.querySelector('.mermaid-node').getAnimations().length === 0, 'first reveal finished', 5000);
    handle.replay();
    assert(svg.querySelector('.mermaid-node').getAnimations().length > 0, 'replay animation');
    handle.destroy();
  });
}

async function modeChecks() {
  await check('auto mode re-renders when the document theme changes', async () => {
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    const host = fresh();
    const handle = renderMermaid(host, 'flowchart LR\n  A --> B', { mode: 'auto', loadMermaid: realLoader, entrance: false, interaction: { enabled: false } });
    await waitFor(() => host.querySelector('.mermaid-container[data-mermaid-mode]'), 'first render');
    root.setAttribute('data-theme', 'dark');
    await waitFor(() => host.querySelector('.mermaid-container')?.dataset.mermaidMode === 'dark', 'dark re-render');
    root.setAttribute('data-theme', 'light');
    await waitFor(() => host.querySelector('.mermaid-container')?.dataset.mermaidMode === 'light', 'light re-render');
    root.removeAttribute('data-theme');
    handle.destroy();
  });

  await check('an explicit mode ignores the document theme', async () => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    const host = fresh();
    const handle = renderMermaid(host, 'flowchart LR\n  A --> B', { mode: 'light', loadMermaid: realLoader, entrance: false, interaction: { enabled: false } });
    await waitFor(() => host.querySelector('.mermaid-container[data-mermaid-mode]'), 'render');
    same(host.querySelector('.mermaid-container').dataset.mermaidMode, 'light', 'explicit mode');
    root.removeAttribute('data-theme');
    handle.destroy();
  });
}

/** Same key scheme as the web capture: tag plus sorted classes, counted over the SVG and its descendants. */
function structureOf(svg) {
  const counts = {};
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    const cls = el.getAttribute('class');
    const key = el.tagName.toLowerCase() + (cls ? '.' + cls.split(/\s+/).filter(Boolean).sort().join('.') : '');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Sets the snapshot's token values on :root, as the web app's CSS does, and removes them afterwards. */
async function withTokens(values, run) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(values)) root.style.setProperty(name, value);
  try {
    return await run();
  } finally {
    for (const name of Object.keys(values)) root.style.removeProperty(name);
  }
}

async function parityChecks() {
  const snapshot = await (await fetch('/test/fixtures/mermaid-web-theme.json')).json();
  await check('the Mermaid configuration matches the web app for every mode and preset, with and without tokens', async () => {
    for (const entry of snapshot.configs) {
      const config = await withTokens(entry.mapped ? snapshot.tokens : {}, () => {
        clearMermaidThemeConfigCache();
        return getMermaidThemeConfig(entry.mode, entry.preset, { tokens: entry.mapped ? snapshot.tokenMap : undefined });
      });
      same(JSON.parse(JSON.stringify(config)), entry.config, `${entry.mode}/${entry.preset}${entry.mapped ? ' with tokens' : ''}`);
    }
    clearMermaidThemeConfigCache();
  });

  await check('rendered SVG structure matches the web app for every chart, mode and preset', async () => {
    const mismatches = [];
    for (const entry of snapshot.structures) {
      const host = fresh();
      const source = fixtures.charts[entry.chart];
      const actual = await withTokens(snapshot.tokens, async () => {
        renderMermaid(host, source, {
          mode: entry.mode,
          preset: entry.preset,
          tokens: snapshot.tokenMap,
          loadMermaid: realLoader,
          entrance: false,
          interaction: { enabled: false },
        });
        const svg = await waitFor(() => host.querySelector('.mermaid-diagram-container svg.mermaid-enhanced-svg'), `${entry.chart} SVG`);
        return structureOf(svg);
      });
      if (JSON.stringify(actual) !== JSON.stringify(entry.structure)) mismatches.push(`${entry.chart}/${entry.mode}/${entry.preset}`);
    }
    same(mismatches, [], 'mismatched structures');
  });
}

async function phoneChecks() {
  await check('a diagram has no horizontal page overflow at 390px', async () => {
    const host = fresh();
    host.style.width = '100%';
    renderMermaid(host, fixtures.charts.flowchart, { loadMermaid: realLoader, entrance: false });
    const container = await waitFor(() => host.querySelector('.mermaid-container svg.mermaid-enhanced-svg') && host.querySelector('.mermaid-container'), 'container');
    await sleep(100);
    assert(container.scrollWidth <= container.clientWidth + 1, `container ${container.scrollWidth} > ${container.clientWidth}`);
    const doc = document.documentElement;
    assert(doc.scrollWidth <= doc.clientWidth + 1, `page ${doc.scrollWidth} > ${doc.clientWidth}`);
  });
}

async function reducedMotionChecks() {
  await check('reduced motion: no reveal starts, and the static trace still applies', async () => {
    assert(matchMedia('(prefers-reduced-motion: reduce)').matches, 'reduce preference is emulated');
    const host = fresh();
    renderMermaid(host, `flowchart LR\n  A --> B\n%% reduced-${Date.now()}`, { loadMermaid: realLoader });
    const svg = await waitFor(() => host.querySelector('svg.mermaid-enhanced-svg'), 'SVG');
    await sleep(400);
    same(svg.getAnimations({ subtree: true }).length, 0, 'animations');
    fire(host.querySelector('.mermaid-node[aria-label="A"]'), 'pointerover');
    assert(svg.querySelector('.mermaid-trace-focus'), 'static focus class');
    same(host.querySelectorAll('.mermaid-trace-comet').length, 0, 'comets');
  });
}

const suites = {
  default: [renderChecks, mountChecks, svgChecks, graphChecks, interactionChecks, entranceChecks, modeChecks, parityChecks],
  phone: [phoneChecks],
  reduced: [reducedMotionChecks],
};

for (const run of suites[SUITE] ?? []) {
  await run();
}
window.__mermaidResults = { suite: SUITE, results };
window.__mermaidDone = true;
