import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkContentImageRegistration,
  registerContentImages,
  rehypeContentImages,
  resolveContentImageOptions,
  satteriContentImages,
} from '@hagicode/hagilight-core/content-images';

const MARKER = 'hagilight-content-image';

const img = (properties = {}) => ({ type: 'element', tagName: 'img', properties: { src: '/a.png', alt: 'A', ...properties }, children: [] });
const element = (tagName, children = [], properties = {}) => ({ type: 'element', tagName, properties, children });
const mdxImg = (attributes = [{ type: 'mdxJsxAttribute', name: 'src', value: '/a.png' }]) => ({
  type: 'mdxJsxTextElement',
  name: 'img',
  attributes,
  children: [],
});
const mdxNode = (name, children = [], attributes = []) => ({ type: 'mdxJsxFlowElement', name, attributes, children });
const root = (...children) => ({ type: 'root', children });

function runUnified(tree, options) {
  rehypeContentImages(options)(tree);
  return tree;
}

function satteriContext(parents) {
  return {
    parent: (node) => parents.get(node),
    setProperty(node, key, value) {
      if (node.type === 'element') {
        node.properties[key] = value;
        return;
      }
      const attribute = node.attributes.find((item) => item.name === key);
      if (attribute) attribute.value = value;
      else node.attributes.push({ type: 'mdxJsxAttribute', name: key, value });
    },
  };
}

function runSatteri(tree, options) {
  const plugin = satteriContentImages(options);
  const parents = new Map();
  const ctx = satteriContext(parents);
  const walk = (node, parent) => {
    if (parent) parents.set(node, parent);
    if (node.type === 'element' && node.tagName === 'img') plugin.element.visit(node, ctx);
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'img') {
      plugin.mdxJsxTextElement.visit(node, ctx);
    }
    for (const child of node.children ?? []) walk(child, node);
  };
  walk(tree, undefined);
  return tree;
}

const classesOf = (node) => {
  const value = node.properties?.className ?? [];
  return Array.isArray(value) ? value : value.split(' ');
};
const attr = (node, name) => node.attributes.find((item) => item.name === name)?.value;

test('unified: sets baseline loading, decoding, and marker class on a Markdown image', () => {
  const tree = runUnified(root(img()));
  const [node] = tree.children;
  assert.equal(node.properties.loading, 'lazy');
  assert.equal(node.properties.decoding, 'async');
  assert.deepEqual(classesOf(node), [MARKER]);
  assert.equal(node.properties.src, '/a.png');
  assert.equal(node.properties.alt, 'A');
});

test('satteri: sets the same baseline on a Markdown image', () => {
  const tree = runSatteri(root(img()));
  const [node] = tree.children;
  assert.equal(node.properties.loading, 'lazy');
  assert.equal(node.properties.decoding, 'async');
  assert.deepEqual(classesOf(node), [MARKER]);
});

test('author loading and decoding win; existing classes kept with one marker', () => {
  const author = img({ loading: 'eager', decoding: 'sync', className: ['screenshot', 'wide'] });
  runUnified(root(author));
  assert.equal(author.properties.loading, 'eager');
  assert.equal(author.properties.decoding, 'sync');
  assert.deepEqual(classesOf(author), ['screenshot', 'wide', MARKER]);
});

test('satteri: string class value is merged once, with author values kept', () => {
  const author = img({ loading: 'eager', className: 'screenshot wide' });
  runSatteri(root(author));
  assert.equal(author.properties.loading, 'eager');
  assert.equal(author.properties.decoding, 'async');
  assert.deepEqual(classesOf(author), ['screenshot', 'wide', MARKER]);
});

test('repeated processing is idempotent', () => {
  const once = runUnified(root(img({ className: [MARKER] })));
  const twice = runUnified(structuredClone(once));
  assert.deepEqual(twice, once);
  assert.deepEqual(classesOf(twice.children[0]), [MARKER]);
});

test('empty alt text and identity attributes are unchanged', () => {
  const node = img({ alt: '', title: 'T', width: 10, height: 20, src: '/x.png' });
  runUnified(root(node));
  assert.equal(node.properties.alt, '');
  assert.equal(node.properties.title, 'T');
  assert.equal(node.properties.width, 10);
  assert.equal(node.properties.height, 20);
  assert.equal(node.properties.src, '/x.png');
});

test('images inside picture are skipped; non-img elements untouched', () => {
  const pictureImg = img();
  const video = element('video', [], { controls: true });
  const tree = runUnified(root(element('picture', [element('source', [], { srcSet: '/a.webp' }), pictureImg]), video));
  assert.equal(pictureImg.properties.loading, undefined);
  assert.equal(pictureImg.properties.className, undefined);
  assert.deepEqual(tree.children[1], video);
  assert.equal(video.properties.loading, undefined);
});

test('satteri: skips an img whose parent is picture', () => {
  const pictureImg = img();
  runSatteri(root(element('picture', [pictureImg])));
  assert.equal(pictureImg.properties.loading, undefined);
  assert.equal(pictureImg.properties.className, undefined);
});

test('unified: MDX JSX img gets attributes appended, author values kept', () => {
  const eager = mdxImg([
    { type: 'mdxJsxAttribute', name: 'src', value: '/a.png' },
    { type: 'mdxJsxAttribute', name: 'loading', value: 'eager' },
    { type: 'mdxJsxAttribute', name: 'class', value: 'shot' },
  ]);
  runUnified(root(mdxNode('p', [eager])));
  assert.equal(attr(eager, 'loading'), 'eager');
  assert.equal(attr(eager, 'decoding'), 'async');
  assert.equal(attr(eager, 'class'), `shot ${MARKER}`);
  assert.equal(eager.attributes.filter((item) => item.name === 'class').length, 1);
});

test('satteri: MDX JSX img sets attributes one name at a time', () => {
  const plain = mdxImg();
  runSatteri(root(mdxNode('p', [plain])));
  assert.equal(attr(plain, 'loading'), 'lazy');
  assert.equal(attr(plain, 'decoding'), 'async');
  assert.equal(attr(plain, 'class'), MARKER);
  assert.equal(plain.attributes.filter((item) => item.name === 'attributes').length, 0);
});

test('MDX img inside picture is skipped by both adapters', () => {
  const inside = mdxImg();
  runUnified(root(mdxNode('picture', [inside])));
  assert.equal(attr(inside, 'loading'), undefined);
  const insideSatteri = mdxImg();
  runSatteri(root(mdxNode('picture', [insideSatteri])));
  assert.equal(attr(insideSatteri, 'loading'), undefined);
});

test('MDX class written as an expression is left unchanged; baseline still applied', () => {
  const expressionClass = mdxImg([
    { type: 'mdxJsxAttribute', name: 'class', value: { type: 'mdxJsxAttributeValueExpression', value: 'cls' } },
  ]);
  runUnified(root(mdxNode('p', [expressionClass])));
  assert.equal(attr(expressionClass, 'loading'), 'lazy');
  assert.equal(attr(expressionClass, 'class').type, 'mdxJsxAttributeValueExpression');
});

test('author-set loading on MDX stays; decoding applied', () => {
  const node = mdxImg([{ type: 'mdxJsxAttribute', name: 'loading', value: 'eager' }]);
  runSatteri(root(mdxNode('p', [node])));
  assert.equal(attr(node, 'loading'), 'eager');
  assert.equal(attr(node, 'decoding'), 'async');
});

test('direct options change defaults and class name', () => {
  const node = img();
  runUnified(root(node), { loading: 'eager', decoding: 'auto', className: 'figure-img' });
  assert.equal(node.properties.loading, 'eager');
  assert.equal(node.properties.decoding, 'auto');
  assert.deepEqual(classesOf(node), ['figure-img']);
});

test('option validation names the offending option', () => {
  assert.throws(() => resolveContentImageOptions({ loading: 'fast' }), /loading option/u);
  assert.throws(() => resolveContentImageOptions({ decoding: 'later' }), /decoding option/u);
  assert.throws(() => resolveContentImageOptions({ className: '' }), /className option/u);
  assert.throws(() => resolveContentImageOptions({ className: 'a b' }), /className option/u);
  assert.throws(() => resolveContentImageOptions(null), TypeError);
  assert.throws(() => rehypeContentImages({ loading: 'fast' }), /loading option/u);
  assert.throws(() => satteriContentImages({ className: ' ' }), /className option/u);
});

function config(processor) {
  return { markdown: { processor } };
}

function logger() {
  const warnings = [];
  return { warnings, warn: (message) => warnings.push(message) };
}

function sattProcessor(consumer = []) {
  return { name: 'satteri', options: { hastPlugins: [...consumer] } };
}

function unifiedProcessor(consumer = []) {
  return { name: 'unified', options: { rehypePlugins: [...consumer] } };
}

const consumerA = () => {};
const consumerB = () => {};

test('registration appends to hastPlugins after consumer plugins and never assigns rehypePlugins', () => {
  const processor = sattProcessor([consumerA, consumerB]);
  const cfg = config(processor);
  registerContentImages({ config: cfg, logger: logger(), enabled: true });
  assert.equal(processor.options.hastPlugins.length, 3);
  assert.equal(processor.options.hastPlugins[0], consumerA);
  assert.equal(processor.options.hastPlugins[1], consumerB);
  assert.equal(cfg.markdown.rehypePlugins, undefined);
});

test('unified registration appends to rehypePlugins', () => {
  const processor = unifiedProcessor([consumerA]);
  registerContentImages({ config: config(processor), logger: logger(), enabled: true });
  assert.equal(processor.options.rehypePlugins.length, 2);
  assert.equal(processor.options.rehypePlugins[0], consumerA);
});

test('unsupported processor warns exactly once and changes nothing', () => {
  const processor = { name: 'shiki', options: {} };
  const log = logger();
  registerContentImages({ config: config(processor), logger: log, enabled: true });
  registerContentImages({ config: config(processor), logger: log, enabled: true });
  assert.equal(log.warnings.length, 1);
  assert.match(log.warnings[0], /"shiki"/u);
  assert.deepEqual(processor.options, {});
});

test('config:done re-check passes while the entry exists and warns once when it is gone', () => {
  const processor = sattProcessor();
  const cfg = config(processor);
  const log = logger();
  registerContentImages({ config: cfg, logger: log, enabled: true });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: true });
  assert.equal(log.warnings.length, 0);

  const replaced = config(sattProcessor());
  checkContentImageRegistration({ config: replaced, logger: log, enabled: true });
  checkContentImageRegistration({ config: replaced, logger: log, enabled: true });
  assert.equal(log.warnings.length, 1);
});

test('config:done re-check is silent for an opted-out site', () => {
  const processor = sattProcessor();
  const cfg = config(processor);
  const log = logger();
  registerContentImages({ config: cfg, logger: log, enabled: false });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: false });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: true });
  assert.equal(log.warnings.length, 0);
});

const INTEGRATION_ORDERS = [
  ['enabled', 'enabled'],
  ['enabled', 'disabled'],
  ['disabled', 'enabled'],
  ['disabled', 'disabled'],
];

const processorFactories = {
  satteri: sattProcessor,
  unified: unifiedProcessor,
};

for (const [processorName, makeProcessor] of Object.entries(processorFactories)) {
  for (const order of INTEGRATION_ORDERS) {
    test(`${processorName} matrix: ${order.join(' then ')} leaves consumer plugins intact`, () => {
      const processor = makeProcessor([consumerA, consumerB]);
      const listKey = processorName === 'satteri' ? 'hastPlugins' : 'rehypePlugins';
      const cfg = config(processor);
      const log = logger();
      for (const mode of order) {
        registerContentImages({ config: cfg, logger: log, enabled: mode === 'enabled' });
      }
      const list = processor.options[listKey];
      const hasEntry = list.length === 3;
      assert.equal(hasEntry, order.includes('enabled') && !order.includes('disabled'));
      assert.deepEqual(list.slice(0, 2), [consumerA, consumerB]);
      assert.equal(log.warnings.length, 0);
    });
  }

  test(`${processorName} matrix: single integration, default, registers exactly one entry`, () => {
    const processor = makeProcessor();
    registerContentImages({ config: config(processor), logger: logger(), enabled: true });
    const listKey = processorName === 'satteri' ? 'hastPlugins' : 'rehypePlugins';
    assert.equal(processor.options[listKey].length, 1);
  });

  test(`${processorName} matrix: single integration opted out registers nothing`, () => {
    const processor = makeProcessor();
    registerContentImages({ config: config(processor), logger: logger(), enabled: false });
    const listKey = processorName === 'satteri' ? 'hastPlugins' : 'rehypePlugins';
    assert.equal(processor.options[listKey].length, 0);
  });
}

test('opt-out after enabled removes only the adapter it did not append', () => {
  const processor = sattProcessor([consumerA]);
  const cfg = config(processor);
  registerContentImages({ config: cfg, logger: logger(), enabled: true });
  registerContentImages({ config: cfg, logger: logger(), enabled: false });
  assert.deepEqual(processor.options.hastPlugins, [consumerA]);
});

test('registered adapter runs for an image in the processed tree', () => {
  const processor = sattProcessor();
  registerContentImages({ config: config(processor), logger: logger(), enabled: true });
  const [plugin] = processor.options.hastPlugins;
  const node = img();
  const tree = root(node);
  const parents = new Map([[node, tree]]);
  plugin.element.visit(node, satteriContext(parents));
  assert.deepEqual(classesOf(node), [MARKER]);
});
