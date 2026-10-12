import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkContentImageRegistration,
  registerContentImages,
  rehypeContentImages,
  satteriContentImages,
} from '@hagicode/hagilight-core/content-images';

const SHARP = 'astro/assets/services/sharp';
const NOOP = 'astro/assets/services/noop';

const img = (src, properties = {}) => ({ type: 'element', tagName: 'img', properties: { src, alt: 'A', ...properties }, children: [] });
const element = (tagName, children = [], properties = {}) => ({ type: 'element', tagName, properties, children });
const root = (...children) => ({ type: 'root', children });
const placeholder = (node) => JSON.parse(node.properties.__ASTRO_IMAGE_);

function runSatteriPlugin(plugin, tree, { sourceFormat = 'markdown', localImagePaths = [] } = {}) {
  const data = { astro: { localImagePaths: new Set(localImagePaths) } };
  const parents = new Map();
  const ctx = {
    sourceFormat,
    data,
    parent: (node) => parents.get(node),
    setProperty(node, key, value) {
      node.properties[key] = value;
    },
    replaceNode(node, newNode) {
      const parent = parents.get(node);
      parent.children[parent.children.indexOf(node)] = newNode;
      parents.set(newNode, parent);
      parents.set(node, newNode);
      for (const child of newNode.children) parents.set(child, newNode);
    },
  };
  const walk = (node, parent) => {
    if (parent) parents.set(node, parent);
    if (node.type === 'element' && node.tagName === 'img') plugin.element.visit(node, ctx);
    for (const child of [...(node.children ?? [])]) walk(child, node);
  };
  walk(tree, undefined);
  return tree;
}

const satteriPictureRun = (tree, options) => runSatteriPlugin(satteriContentImages(), tree, options);

function runUnifiedPicture(tree, path, localImagePaths) {
  const data = { astro: { localImagePaths } };
  rehypeContentImages()(tree, { path, data });
  return tree;
}

function config(processor, entrypoint) {
  const cfg = { markdown: { processor } };
  if (entrypoint !== undefined) cfg.image = { service: { entrypoint } };
  return cfg;
}

function logger() {
  const warnings = [];
  return { warnings, warn: (message) => warnings.push(message) };
}

const satteriProcessor = (consumer = []) => ({ name: 'satteri', options: { hastPlugins: [...consumer] } });
const unifiedProcessor = (consumer = []) => ({ name: 'unified', options: { rehypePlugins: [...consumer] } });
const consumerA = () => {};

test('satteri: eligible local .md image is wrapped in picture with AVIF and WebP sources', () => {
  const node = img('./assets/a.png');
  const tree = satteriPictureRun(root(node), { localImagePaths: ['./assets/a.png'] });
  const [picture] = tree.children;
  assert.equal(picture.tagName, 'picture');
  const [avif, webp, original] = picture.children;
  assert.equal(avif.tagName, 'source');
  assert.equal(webp.tagName, 'source');
  assert.equal(original, node);
  assert.equal(placeholder(avif).format, 'avif');
  assert.equal(placeholder(webp).format, 'webp');
  assert.deepEqual(placeholder(avif).densities, [1]);
  assert.equal(placeholder(avif).src, './assets/a.png');
  assert.equal(placeholder(avif).type, 'image/avif');
  assert.equal(placeholder(webp).type, 'image/webp');
  assert.equal(original.properties.loading, 'lazy');
  assert.equal(original.properties.decoding, 'async');
});

test('satteri: encoded image path is matched by its decoded src', () => {
  const tree = satteriPictureRun(root(img('./my%20image.png')), { localImagePaths: ['./my image.png'] });
  assert.equal(tree.children[0].tagName, 'picture');
  assert.equal(placeholder(tree.children[0].children[0]).src, './my image.png');
});

test('satteri: MDX, site-root, remote, and raw HTML images are left unchanged', () => {
  const cases = [
    { name: 'mdx source', src: './assets/a.png', sourceFormat: 'mdx', localImagePaths: ['./assets/a.png'] },
    { name: 'site-root', src: '/a.png', sourceFormat: 'markdown', localImagePaths: ['./assets/a.png'] },
    { name: 'remote', src: 'https://example.com/a.png', sourceFormat: 'markdown', localImagePaths: [] },
    { name: 'raw HTML (not collected as an import)', src: './raw.png', sourceFormat: 'markdown', localImagePaths: ['./assets/a.png'] },
  ];
  for (const { name, src, sourceFormat, localImagePaths } of cases) {
    const tree = satteriPictureRun(root(img(src)), { sourceFormat, localImagePaths });
    assert.equal(tree.children[0].tagName, 'img', name);
    assert.equal(tree.children[0].properties.src, src, name);
  }
});

test('satteri: an img already inside picture is not wrapped again', () => {
  const inside = img('./assets/a.png');
  const tree = satteriPictureRun(root(element('picture', [element('source', [], { srcSet: '/a.webp' }), inside])), {
    localImagePaths: ['./assets/a.png'],
  });
  const [picture] = tree.children;
  assert.equal(picture.children.length, 2);
  assert.equal(picture.children[1], inside);
  assert.equal(inside.properties.loading, undefined);
});

test('satteri: placeholder indices are unique and never plain integers', () => {
  const tree = satteriPictureRun(root(img('./assets/a.png'), img('./assets/a.png'), img('./assets/b.png')), {
    localImagePaths: ['./assets/a.png', './assets/b.png'],
  });
  const indices = tree.children.flatMap((picture) => picture.children.slice(0, 2).map((source) => placeholder(source).index));
  assert.equal(new Set(indices).size, indices.length);
  for (const index of indices) assert.match(index, /^picture-(avif|webp)-\d+$/u);
});

test('unified: eligible local .md image is wrapped, with localImagePaths as an array', () => {
  const node = img('./assets/a.png');
  const tree = runUnifiedPicture(root(node), '/site/src/page.md', ['./assets/a.png']);
  const [picture] = tree.children;
  assert.equal(picture.tagName, 'picture');
  assert.equal(placeholder(picture.children[0]).format, 'avif');
  assert.equal(placeholder(picture.children[1]).format, 'webp');
  assert.equal(picture.children[2], node);
});

test('unified: localImagePaths as a Set is accepted', () => {
  const tree = root(img('./assets/a.png'));
  rehypeContentImages()(tree, { path: '/site/src/page.md', data: { astro: { localImagePaths: new Set(['./assets/a.png']) } } });
  assert.equal(tree.children[0].tagName, 'picture');
});

test('unified: MDX source and site-root images are left unchanged', () => {
  const mdxTree = runUnifiedPicture(root(img('./assets/a.png')), '/site/src/page.mdx', ['./assets/a.png']);
  assert.equal(mdxTree.children[0].tagName, 'img');
  const rootTree = runUnifiedPicture(root(img('/a.png')), '/site/src/page.md', ['./assets/a.png']);
  assert.equal(rootTree.children[0].tagName, 'img');
});

test('unified: an img already inside picture is not wrapped again', () => {
  const inside = img('./assets/a.png');
  const tree = runUnifiedPicture(root(element('picture', [inside])), '/site/src/page.md', ['./assets/a.png']);
  assert.equal(tree.children[0].children.length, 1);
  assert.equal(tree.children[0].children[0], inside);
});

test('registration wires the picture step on satteri and it wraps only after the sharp check', () => {
  const processor = satteriProcessor([consumerA]);
  const cfg = config(processor, SHARP);
  const log = logger();
  registerContentImages({ config: cfg, logger: log, enabled: true });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: true });
  assert.equal(log.warnings.length, 0);
  const [, plugin] = processor.options.hastPlugins;
  const tree = runSatteriPlugin(plugin, root(img('./assets/a.png')), { localImagePaths: ['./assets/a.png'] });
  assert.equal(tree.children[0].tagName, 'picture');
});

test('no-op image service: picture step is skipped, one warning, baseline kept', () => {
  const processor = satteriProcessor();
  const cfg = config(processor, NOOP);
  const log = logger();
  registerContentImages({ config: cfg, logger: log, enabled: true });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: true });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: true });
  assert.equal(log.warnings.length, 1);
  assert.match(log.warnings[0], /no-op/u);
  const [plugin] = processor.options.hastPlugins;
  const node = img('./assets/a.png');
  const tree = runSatteriPlugin(plugin, root(node), { localImagePaths: ['./assets/a.png'] });
  assert.equal(tree.children[0], node);
  assert.equal(node.properties.loading, 'lazy');
  assert.deepEqual(node.properties.className, ['hagilight-content-image']);
});

test('no-op image service: unified transformer also skips the picture step', () => {
  const processor = unifiedProcessor();
  const cfg = config(processor, NOOP);
  const log = logger();
  registerContentImages({ config: cfg, logger: log, enabled: true });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: true });
  assert.equal(log.warnings.length, 1);
  const transformer = processor.options.rehypePlugins[0]();
  const tree = root(img('./assets/a.png'));
  transformer(tree, { path: '/site/src/page.md', data: { astro: { localImagePaths: ['./assets/a.png'] } } });
  assert.equal(tree.children[0].tagName, 'img');
});

test('opt-out: no picture step is registered, and the re-check stays silent', () => {
  const processor = satteriProcessor([consumerA]);
  const cfg = config(processor, SHARP);
  const log = logger();
  registerContentImages({ config: cfg, logger: log, enabled: true });
  registerContentImages({ config: cfg, logger: log, enabled: false });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: false });
  assert.deepEqual(processor.options.hastPlugins, [consumerA]);
  assert.equal(log.warnings.length, 0);
});
