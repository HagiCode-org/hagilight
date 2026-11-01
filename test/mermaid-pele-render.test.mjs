import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { fakeNode, installMermaidStub, restoreMermaidStub, settle } from './support/mermaid-dom-stub.mjs';

// The Pele render backend: a direct, synchronous call on the loaded module, with Mermaid never loaded.
const { renderMermaid } = await import('../packages/mermaid/dist/render.js');

const hadStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => installMermaidStub({ storageKey: 'hagilight-mermaid:engine' }));
afterEach(() => restoreMermaidStub(hadStorage));

/** Polls until the host holds a predicate's match, so the real dynamic import has time to resolve. */
async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(`timed out waiting for ${label}`);
}

/** Every node under `node`, depth first. */
function walk(node, found = []) {
  found.push(node);
  for (const child of node.children) walk(child, found);
  return found;
}

const withClass = (host, name) => walk(host).filter((node) => String(node.className ?? '').split(' ').includes(name));

/** A Pele module stand-in: records each render and returns an SVG that names its source. */
function fakePele(label = 'FAKE') {
  const sources = [];
  return {
    sources,
    module: {
      render: (source) => {
        sources.push(source);
        return { svg: `<svg data-probe="${label}" class="pele pele-pie"></svg>`, width: 10, height: 10, type: 'pie', mermaidType: 'pie' };
      },
    },
  };
}

const PIE = 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85';

test('the default import renders a Pele diagram into the host', async () => {
  const host = fakeNode();
  renderMermaid(host, PIE, { engine: 'pele' });
  await waitFor(() => host.children[0]?.dataset?.mermaidPreset === 'default', 'the Pele diagram');
  const diagramHost = withClass(host, 'mermaid-diagram-container')[0];
  assert.match(diagramHost.innerHTML, /class="pele pele-pie"/);
  assert.match(diagramHost.innerHTML, /aria-roledescription="pie"/);
});

test('Pele is imported once and reused by later renders', async () => {
  const { module, sources } = fakePele();
  let loads = 0;
  const peleLoader = async () => {
    loads += 1;
    return module;
  };
  renderMermaid(fakeNode(), PIE, { engine: 'pele', peleLoader });
  renderMermaid(fakeNode(), 'pie title Other\n  "A" : 1', { engine: 'pele', peleLoader });
  await waitFor(() => sources.length === 2, 'both Pele renders');
  assert.equal(loads, 1);
});

test('a custom peleLoader replaces the import and Mermaid is not loaded', async () => {
  const { module, sources } = fakePele('CUSTOM');
  let mermaidLoads = 0;
  const host = fakeNode();
  renderMermaid(host, PIE, {
    engine: 'pele',
    peleLoader: async () => module,
    loadMermaid: async () => {
      mermaidLoads += 1;
      throw new Error('Mermaid must not load for Pele');
    },
  });
  await waitFor(() => sources.length === 1, 'the custom Pele render');
  await settle();
  assert.equal(mermaidLoads, 0);
  assert.match(withClass(host, 'mermaid-diagram-container')[0].innerHTML, /data-probe="CUSTOM"/);
});

test('a failing Pele import shows the error panel and the handle stays usable', async () => {
  const { module } = fakePele('RECOVERED');
  const host = fakeNode();
  const handle = renderMermaid(host, PIE, {
    engine: 'pele',
    peleLoader: async () => {
      throw new Error('Cannot find package pele');
    },
  });
  await waitFor(() => withClass(host, 'mermaid-error-message').length === 1, 'the error panel');
  assert.equal(withClass(host, 'mermaid-error-message')[0].textContent, 'Cannot find package pele');

  handle.update({ peleLoader: async () => module });
  await waitFor(() => withClass(host, 'mermaid-diagram-container').length === 1, 'recovery after the failure');
  assert.match(withClass(host, 'mermaid-diagram-container')[0].innerHTML, /data-probe="RECOVERED"/);
  assert.equal(withClass(host, 'mermaid-error-message').length, 0);
});

test('a failed import is not kept: the next render asks the loader again', async () => {
  const { module } = fakePele('SECOND');
  let attempts = 0;
  const peleLoader = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('first attempt fails');
    return module;
  };
  const first = fakeNode();
  renderMermaid(first, PIE, { engine: 'pele', peleLoader });
  await waitFor(() => withClass(first, 'mermaid-error-message').length === 1, 'the first failure');

  const second = fakeNode();
  renderMermaid(second, PIE, { engine: 'pele', peleLoader });
  await waitFor(() => withClass(second, 'mermaid-diagram-container').length === 1, 'the retried render');
  assert.equal(attempts, 2);
});

/** A Pele module that answers after `delay` ms, so a slower earlier render can finish last. */
function delayedPele(label, delay) {
  return {
    loader: () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              render: () => ({ svg: `<svg data-probe="${label}" class="pele pele-pie"></svg>`, width: 1, height: 1, type: 'pie', mermaidType: 'pie' }),
            }),
          delay,
        ),
      ),
  };
}

/** A Mermaid module that answers after `delay` ms, for switching engines in the same test. */
function delayedMermaid(label, delay) {
  return () =>
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            default: {
              initialize: () => {},
              render: async () => ({ svg: `<svg data-probe="${label}"></svg>` }),
            },
          }),
        delay,
      ),
    );
}

test('switching engines twice quickly leaves only the latest render in the host', async () => {
  const host = fakeNode();
  const first = delayedPele('FIRST', 40);
  const handle = renderMermaid(host, PIE, { engine: 'pele', peleLoader: first.loader });
  handle.update({ engine: 'mermaid', loadMermaid: delayedMermaid('SECOND', 5) });
  const third = delayedPele('THIRD', 1);
  handle.update({ engine: 'pele', peleLoader: third.loader });

  await waitFor(() => withClass(host, 'mermaid-diagram-container').length === 1, 'the latest render');
  await new Promise((resolve) => setTimeout(resolve, 80));
  const containers = withClass(host, 'mermaid-container');
  assert.equal(containers.length, 1, 'one container after the earlier renders finish');
  const html = withClass(host, 'mermaid-diagram-container')[0].innerHTML;
  assert.match(html, /data-probe="THIRD"/);
  assert.doesNotMatch(html, /FIRST|SECOND/);
});

test('destroy empties the host and a late Pele render never writes to it', async () => {
  const host = fakeNode();
  const late = delayedPele('LATE', 30);
  const handle = renderMermaid(host, PIE, { engine: 'pele', peleLoader: late.loader });
  handle.destroy();
  assert.equal(host.children.length, 0, 'destroy empties the host');
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(host.children.length, 0, 'the late render does not refill the host');
});

/** A Pele source error with the shape `PeleError` has: name, code, line and column. */
function peleError(message, { code = 'syntax', line = 0, column = 0 } = {}) {
  return Object.assign(new Error(message), { name: 'PeleError', code, line, column, type: null, mermaidType: null, snippet: '' });
}

/** Renders `source` with a Pele module that throws `error`, then returns the error panel's message text. */
async function errorMessageFor(error) {
  const host = fakeNode();
  renderMermaid(host, PIE, {
    engine: 'pele',
    peleLoader: async () => ({
      render: () => {
        throw error;
      },
    }),
  });
  await waitFor(() => withClass(host, 'mermaid-error-message').length === 1, 'the error panel');
  return { host, message: withClass(host, 'mermaid-error-message')[0] };
}

test('a Pele parse error keeps its position and gets the syntax label', async () => {
  const { message } = await errorMessageFor(
    peleError('Parse error on line 3:\n  C ---> \n--------^\nExpecting NODE_STRING', { line: 3, column: 9 }),
  );
  assert.match(message.textContent, /^Syntax error \(line 3, column 9\):\n {2}C ---> /);
});

test('a Pele error whose message lacks the position gets line and column added', async () => {
  const { message } = await errorMessageFor(peleError('Unexpected token', { line: 2, column: 5 }));
  assert.equal(message.textContent, 'Unexpected token (line 2, column 5)');
});

test('a Pele error without a line adds nothing', async () => {
  const { message } = await errorMessageFor(peleError('Something failed', { line: 0, column: 0 }));
  assert.equal(message.textContent, 'Something failed');
});

test('a Pele no-diagram-type error uses the same label as Mermaid', async () => {
  const { message } = await errorMessageFor(peleError('No diagram type detected for the given text.', { code: 'unsupported-diagram' }));
  assert.equal(message.textContent, 'No valid diagram detected for the given text.');
});

test('markup in a Pele message is shown literally and creates no element', async () => {
  const payload = '<img src=x onerror=alert(1)>';
  const { host, message } = await errorMessageFor(peleError(`Parse error on line 1: ${payload}`, { line: 1, column: 1 }));
  assert.equal(message.textContent, `Syntax error: ${payload} (line 1, column 1)`);
  assert.equal(message.children.length, 0, 'no child element is built from the message');
  assert.equal(walk(host).filter((node) => node.tagName === 'IMG').length, 0, 'no img element exists');
});

const { PELE_DEGRADED_TYPES } = await import('../packages/mermaid/dist/pele-degraded.js');

/** The notice element of a rendered Pele diagram, or undefined. */
function noticeOf(host) {
  return withClass(host, 'mermaid-engine-notice')[0];
}

/** Renders a Pele diagram whose module reports `type`, and returns the host. */
async function renderReportingType(type) {
  const host = fakeNode();
  renderMermaid(host, `${type} probe`, {
    engine: 'pele',
    peleLoader: async () => ({
      render: () => ({ svg: `<svg class="pele pele-${type}"></svg>`, width: 1, height: 1, type, mermaidType: type }),
    }),
  });
  await waitFor(() => withClass(host, 'mermaid-diagram-container').length === 1, `the ${type} render`);
  return host;
}

test('every listed degraded type shows the notice above the diagram', async () => {
  assert.ok(PELE_DEGRADED_TYPES.length > 0, 'the degraded list is not empty');
  for (const type of PELE_DEGRADED_TYPES) {
    const notice = noticeOf(await renderReportingType(type));
    assert.ok(notice, `${type} shows the notice`);
    assert.equal(notice.textContent, 'This diagram type is simplified by the Pele engine. Switch to Mermaid for the full layout.');
    assert.equal(notice.attributes.role, 'note');
  }
});

test('a type off the degraded list shows no notice', async () => {
  for (const type of ['flowchart', 'pie', 'sequence']) {
    assert.ok(!PELE_DEGRADED_TYPES.includes(type), `${type} is not listed`);
    assert.equal(noticeOf(await renderReportingType(type)), undefined, `${type} shows no notice`);
  }
});

test('the Mermaid engine never shows the Pele notice', async () => {
  const host = fakeNode();
  renderMermaid(host, 'c4 probe', {
    engine: 'mermaid',
    loadMermaid: async () => {
      throw new Error('stop after the engine choice');
    },
  });
  await settle();
  assert.equal(noticeOf(host), undefined);
});
