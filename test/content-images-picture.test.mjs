import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  checkContentImageRegistration,
  registerContentImages,
  rehypeContentImages,
  satteriContentImages,
} from '@hagicode/hagilight-core/content-images';

const SHARP = 'astro/assets/services/sharp';
const NOOP = 'astro/assets/services/noop';
const DOCS = '/site/src/content/docs';
const MDX_PATH = `${DOCS}/page.mdx`;
const PUBLIC_PICTURE = { enabled: true, publicDir: '/site/public' };

const img = (src, properties = {}) => ({ type: 'element', tagName: 'img', properties: { src, alt: 'A', ...properties }, children: [] });
const element = (tagName, children = [], properties = {}) => ({ type: 'element', tagName, properties, children });
const mdxElement = (name, children = [], attributes = []) => ({ type: 'mdxJsxFlowElement', name, attributes, children });
const mdxRawImg = (src) => mdxElement('img', [], [{ type: 'mdxJsxAttribute', name: 'src', value: src }]);
const root = (...children) => ({ type: 'root', children });
const placeholder = (node) => JSON.parse(node.properties.__ASTRO_IMAGE_);
const attribute = (node, name) => node.attributes.find((item) => item.name === name);
const attributeText = (node, name) => {
  const value = attribute(node, name)?.value;
  return typeof value === 'string' ? value : undefined;
};
const expressionOf = (node, name) => attribute(node, name).value.value;
const collect = (node, predicate, found = []) => {
  if (predicate(node)) found.push(node);
  for (const child of node.children ?? []) collect(child, predicate, found);
  return found;
};
const componentPictures = (tree) => collect(tree, (node) => node.name === 'HagilightContentPicture');
const pictureCount = (tree) => collect(tree, (node) => node.tagName === 'picture' || node.name === 'HagilightContentPicture').length;
const esmNodes = (tree) => tree.children.filter((node) => node.type === 'mdxjsEsm');
const esmSources = (tree) => esmNodes(tree).map((node) => node.value);
const estreeSources = (tree) => esmNodes(tree).map((node) => node.data.estree.body[0].source.value);

function runSatteriPlugin(plugin, tree, { sourceFormat = 'markdown', localImagePaths = [], fileURL } = {}) {
  const data = { astro: { localImagePaths: new Set(localImagePaths) } };
  const parents = new Map();
  const ctx = {
    sourceFormat,
    fileURL,
    data,
    parent: (node) => parents.get(node),
    setProperty(node, key, value) {
      if (node.properties) {
        node.properties[key] = value;
        return;
      }
      const existing = attribute(node, key);
      if (existing) existing.value = value;
      else node.attributes.push({ type: 'mdxJsxAttribute', name: key, value });
    },
    replaceNode(node, newNode) {
      const parent = parents.get(node);
      parent.children[parent.children.indexOf(node)] = newNode;
      parents.set(newNode, parent);
      parents.set(node, newNode);
      for (const child of newNode.children ?? []) parents.set(child, newNode);
    },
    prependChild(node, childNode) {
      const items = Array.isArray(childNode) ? childNode : [childNode];
      node.children.unshift(...items);
      for (const item of items) parents.set(item, node);
    },
  };
  const walk = (node, parent) => {
    if (parent) parents.set(node, parent);
    if (node.type === 'element' && node.tagName === 'img') plugin.element.visit(node, ctx);
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'img') {
      plugin[node.type].visit(node, ctx);
    }
    for (const child of [...(node.children ?? [])]) walk(child, node);
  };
  walk(tree, undefined);
  return tree;
}

const satteriPictureRun = (tree, options = {}) => runSatteriPlugin(satteriContentImages({}, options.picture), tree, options);

function runUnifiedPicture(tree, path, localImagePaths, picture) {
  const data = { astro: { localImagePaths } };
  rehypeContentImages({}, picture)(tree, { path, data });
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

test('satteri: site-root, remote, and raw HTML images are left unchanged', () => {
  const cases = [
    { name: 'site-root', src: '/a.png', localImagePaths: ['./assets/a.png'] },
    { name: 'remote', src: 'https://example.com/a.png', localImagePaths: [] },
    { name: 'raw HTML (not collected as an import)', src: './raw.png', localImagePaths: ['./assets/a.png'] },
  ];
  for (const { name, src, localImagePaths } of cases) {
    const tree = satteriPictureRun(root(img(src)), { localImagePaths });
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

test('satteri: MDX source image becomes a Picture component with its imports', () => {
  const tree = satteriPictureRun(root(img('./assets/a.png')), { sourceFormat: 'mdx', localImagePaths: ['./assets/a.png'] });
  const [component] = componentPictures(tree);
  assert.equal(component.type, 'mdxJsxFlowElement');
  assert.equal(component.name, 'HagilightContentPicture');
  assert.equal(expressionOf(component, 'src'), 'HagilightContentImage0');
  assert.equal(expressionOf(component, 'formats'), '["avif","webp"]');
  assert.equal(attributeText(component, 'fallbackFormat'), 'webp');
  assert.deepEqual(esmSources(tree).sort(), [
    'import HagilightContentImage0 from "./assets/a.png";',
    'import { Picture as HagilightContentPicture } from "astro:assets";',
  ].sort());
});

test('satteri mdx: eligible image keeps baseline attributes, title, and picture formats', () => {
  const tree = satteriPictureRun(root(img('./assets/a.png', { title: 'Cover' })), {
    sourceFormat: 'mdx',
    localImagePaths: ['./assets/a.png'],
  });
  const [component] = componentPictures(tree);
  assert.equal(attributeText(component, 'alt'), 'A');
  assert.equal(attributeText(component, 'title'), 'Cover');
  assert.equal(attributeText(component, 'loading'), 'lazy');
  assert.equal(attributeText(component, 'decoding'), 'async');
  assert.equal(attributeText(component, 'class'), 'hagilight-content-image');
  assert.equal(expressionOf(component, 'formats'), '["avif","webp"]');
  assert.equal(attributeText(component, 'fallbackFormat'), 'webp');
});

test('satteri mdx: two distinct images and a repeat share one component import and two asset imports', () => {
  const tree = satteriPictureRun(root(img('./assets/a.png'), img('./assets/b.png'), img('./assets/a.png')), {
    sourceFormat: 'mdx',
    localImagePaths: ['./assets/a.png', './assets/b.png'],
  });
  const sources = esmSources(tree);
  assert.equal(sources.length, 3);
  assert.equal(sources.filter((text) => text.includes('astro:assets')).length, 1);
  assert.deepEqual(sources.filter((text) => text.includes('./assets')).sort(), [
    'import HagilightContentImage0 from "./assets/a.png";',
    'import HagilightContentImage1 from "./assets/b.png";',
  ]);
  assert.deepEqual(componentPictures(tree).map((node) => expressionOf(node, 'src')), [
    'HagilightContentImage0',
    'HagilightContentImage1',
    'HagilightContentImage0',
  ]);
});

test('satteri mdx: each document gets its own component and asset imports', () => {
  const plugin = satteriContentImages();
  const options = { sourceFormat: 'mdx', localImagePaths: ['./assets/a.png'] };
  const first = runSatteriPlugin(plugin, root(img('./assets/a.png')), options);
  const second = runSatteriPlugin(plugin, root(img('./assets/a.png')), options);
  assert.equal(esmNodes(first).length, 2);
  assert.equal(esmNodes(second).length, 2);
});

test('satteri mdx: an author picture or Picture keeps its image unwrapped', () => {
  const inPicture = img('./assets/a.png');
  const inComponent = img('./assets/b.png');
  const tree = satteriPictureRun(root(
    element('picture', [inPicture]),
    mdxElement('Picture', [inComponent], [{ type: 'mdxJsxAttribute', name: 'src', value: './assets/b.png' }]),
  ), { sourceFormat: 'mdx', localImagePaths: ['./assets/a.png', './assets/b.png'] });
  assert.equal(componentPictures(tree).length, 0);
  assert.equal(esmNodes(tree).length, 0);
  assert.equal(tree.children[0].children[0], inPicture);
  assert.equal(tree.children[1].children[0], inComponent);
});

test('satteri mdx: site-root, remote, and raw HTML images stay unwrapped', () => {
  const site = img('/a.png');
  const remote = img('https://example.com/a.png');
  const raw = mdxRawImg('./assets/a.png');
  const tree = satteriPictureRun(root(site, remote, raw), { sourceFormat: 'mdx', localImagePaths: ['./assets/a.png'] });
  assert.equal(tree.children[0], site);
  assert.equal(tree.children[1], remote);
  assert.equal(tree.children[2], raw);
  assert.equal(componentPictures(tree).length, 0);
  assert.equal(esmNodes(tree).length, 0);
  assert.equal(attributeText(raw, 'class'), 'hagilight-content-image');
  assert.equal(attributeText(raw, 'loading'), 'lazy');
  assert.equal(attributeText(raw, 'decoding'), 'async');
});

test('satteri mdx: a disabled picture step leaves MDX images unwrapped', () => {
  const node = img('./assets/a.png');
  const tree = satteriPictureRun(root(node), {
    sourceFormat: 'mdx',
    localImagePaths: ['./assets/a.png'],
    picture: { enabled: false },
  });
  assert.equal(tree.children[0], node);
  assert.equal(esmNodes(tree).length, 0);
  assert.equal(node.properties.loading, 'lazy');
});

test('satteri mdx: an image without alt gets alt="" so Picture accepts it', () => {
  const tree = satteriPictureRun(root({ type: 'element', tagName: 'img', properties: { src: './assets/a.png' }, children: [] }), {
    sourceFormat: 'mdx',
    localImagePaths: ['./assets/a.png'],
  });
  assert.equal(attributeText(componentPictures(tree)[0], 'alt'), '');
});

test('unified: MDX source image becomes a Picture component with ESTree imports and attribute expressions', () => {
  const tree = runUnifiedPicture(root(img('./assets/a.png', { title: 'Cover' })), MDX_PATH, ['./assets/a.png']);
  const [component] = componentPictures(tree);
  assert.equal(component.type, 'mdxJsxFlowElement');
  const srcValue = attribute(component, 'src').value;
  assert.equal(srcValue.type, 'mdxJsxAttributeValueExpression');
  assert.deepEqual(srcValue.data.estree.body[0].expression, { type: 'Identifier', name: 'HagilightContentImage0' });
  const formats = attribute(component, 'formats').value.data.estree.body[0].expression;
  assert.equal(formats.type, 'ArrayExpression');
  assert.deepEqual(formats.elements.map((item) => item.value), ['avif', 'webp']);
  assert.equal(attributeText(component, 'fallbackFormat'), 'webp');
  assert.equal(attributeText(component, 'title'), 'Cover');
  assert.equal(attributeText(component, 'class'), 'hagilight-content-image');
  assert.equal(attributeText(component, 'loading'), 'lazy');
  assert.equal(attributeText(component, 'decoding'), 'async');
  assert.deepEqual(estreeSources(tree).sort(), ['./assets/a.png', 'astro:assets']);
  for (const node of esmNodes(tree)) assert.equal(node.data.estree.type, 'Program');
});

test('unified: site-root images are left unchanged in an .md page', () => {
  const rootTree = runUnifiedPicture(root(img('/a.png')), `${DOCS}/page.md`, ['./assets/a.png']);
  assert.equal(rootTree.children[0].tagName, 'img');
});

test('unified: localImagePaths as an array is wrapped in an .md page', () => {
  const node = img('./assets/a.png');
  const tree = runUnifiedPicture(root(node), `${DOCS}/page.md`, ['./assets/a.png']);
  const [picture] = tree.children;
  assert.equal(picture.tagName, 'picture');
  assert.equal(placeholder(picture.children[0]).format, 'avif');
  assert.equal(placeholder(picture.children[1]).format, 'webp');
  assert.equal(picture.children[2], node);
});

test('unified: localImagePaths as a Set is accepted', () => {
  const tree = root(img('./assets/a.png'));
  rehypeContentImages()(tree, { path: `${DOCS}/page.md`, data: { astro: { localImagePaths: new Set(['./assets/a.png']) } } });
  assert.equal(tree.children[0].tagName, 'picture');
});

test('unified: an img already inside picture is not wrapped again', () => {
  const inside = img('./assets/a.png');
  const tree = runUnifiedPicture(root(element('picture', [inside])), `${DOCS}/page.md`, ['./assets/a.png']);
  assert.equal(tree.children[0].children.length, 1);
  assert.equal(tree.children[0].children[0], inside);
});

test('unified mdx: two distinct images and a repeat share one component import and two asset imports', () => {
  const tree = runUnifiedPicture(root(img('./assets/a.png'), img('./assets/b.png'), img('./assets/a.png')), MDX_PATH, [
    './assets/a.png',
    './assets/b.png',
  ]);
  assert.equal(esmNodes(tree).length, 3);
  assert.deepEqual(estreeSources(tree).sort(), ['./assets/a.png', './assets/b.png', 'astro:assets']);
  assert.deepEqual(componentPictures(tree).map((node) => expressionOf(node, 'src')), [
    'HagilightContentImage0',
    'HagilightContentImage1',
    'HagilightContentImage0',
  ]);
});

test('unified mdx: an author picture or Picture keeps its image unwrapped', () => {
  const inPicture = img('./assets/a.png');
  const inComponent = img('./assets/b.png');
  const tree = runUnifiedPicture(root(
    element('picture', [inPicture]),
    mdxElement('Picture', [inComponent], [{ type: 'mdxJsxAttribute', name: 'src', value: './assets/b.png' }]),
  ), MDX_PATH, ['./assets/a.png', './assets/b.png']);
  assert.equal(componentPictures(tree).length, 0);
  assert.equal(esmNodes(tree).length, 0);
  assert.equal(tree.children[0].children[0], inPicture);
  assert.equal(tree.children[1].children[0], inComponent);
});

test('unified mdx: site-root, remote, and raw HTML images stay unwrapped', () => {
  const site = img('/a.png');
  const remote = img('https://example.com/a.png');
  const raw = mdxRawImg('./assets/a.png');
  const tree = runUnifiedPicture(root(site, remote, raw), MDX_PATH, ['./assets/a.png']);
  assert.equal(tree.children[0], site);
  assert.equal(tree.children[1], remote);
  assert.equal(tree.children[2], raw);
  assert.equal(componentPictures(tree).length, 0);
  assert.equal(esmNodes(tree).length, 0);
  assert.equal(attributeText(raw, 'class'), 'hagilight-content-image');
});

test('unified mdx: a disabled picture step leaves MDX images unwrapped', () => {
  const node = img('./assets/a.png');
  const tree = runUnifiedPicture(root(node), MDX_PATH, ['./assets/a.png'], { enabled: false });
  assert.equal(tree.children[0], node);
  assert.equal(esmNodes(tree).length, 0);
});

test('unified mdx: each run of the transformer keeps its own imports', () => {
  const transformer = rehypeContentImages();
  const first = root(img('./assets/a.png'));
  const second = root(img('./assets/a.png'));
  const data = { astro: { localImagePaths: ['./assets/a.png'] } };
  transformer(first, { path: MDX_PATH, data });
  transformer(second, { path: MDX_PATH, data });
  assert.equal(esmNodes(first).length, 2);
  assert.equal(esmNodes(second).length, 2);
});

test('unified mdx: an image without alt gets alt="" so Picture accepts it', () => {
  const tree = runUnifiedPicture(root({ type: 'element', tagName: 'img', properties: { src: './assets/a.png' }, children: [] }), MDX_PATH, [
    './assets/a.png',
  ]);
  assert.equal(attributeText(componentPictures(tree)[0], 'alt'), '');
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

test('no-op image service: MDX images are not wrapped on the Sätteri processor', () => {
  const processor = satteriProcessor();
  const cfg = config(processor, NOOP);
  const log = logger();
  registerContentImages({ config: cfg, logger: log, enabled: true });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: true });
  const [plugin] = processor.options.hastPlugins;
  const node = img('./assets/a.png');
  const tree = runSatteriPlugin(plugin, root(node), { sourceFormat: 'mdx', localImagePaths: ['./assets/a.png'] });
  assert.equal(tree.children[0], node);
  assert.equal(esmNodes(tree).length, 0);
  assert.equal(log.warnings.length, 1);
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
  transformer(tree, { path: `${DOCS}/page.md`, data: { astro: { localImagePaths: ['./assets/a.png'] } } });
  assert.equal(tree.children[0].tagName, 'img');
});

test('no-op image service: unified MDX transformer also skips the picture step', () => {
  const processor = unifiedProcessor();
  const cfg = config(processor, NOOP);
  const log = logger();
  registerContentImages({ config: cfg, logger: log, enabled: true });
  checkContentImageRegistration({ config: cfg, logger: log, enabled: true });
  const transformer = processor.options.rehypePlugins[0]();
  const tree = root(img('./assets/a.png'));
  transformer(tree, { path: MDX_PATH, data: { astro: { localImagePaths: ['./assets/a.png'] } } });
  assert.equal(tree.children[0].tagName, 'img');
  assert.equal(log.warnings.length, 1);
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

// Public-directory and extension rules, for both Markdown and MDX pages on each processor.
const EXTENSION_SRCS = ['./assets/a.svg', './assets/a.SVG', './assets/a.gif', './assets/a.svg?v=2', './assets/a.gif#frame'];
const EXTENSION_WRAPPED_SRC = './assets/a.png?v=2';

for (const [sourceFormat, extension] of [['markdown', 'md'], ['mdx', 'mdx']]) {
  const fileURL = pathToFileURL(`${DOCS}/page.${extension}`);

  test(`public/ (satteri .${extension}): a relative path into publicDir keeps its markup, one under src is wrapped`, () => {
    const inPublic = img('../../../public/a.png');
    const inSrc = img('../../assets/a.png');
    const tree = satteriPictureRun(root(inPublic, inSrc), {
      sourceFormat,
      fileURL,
      localImagePaths: ['../../../public/a.png', '../../assets/a.png'],
      picture: PUBLIC_PICTURE,
    });
    assert.ok(tree.children.includes(inPublic));
    assert.equal(pictureCount(tree), 1);
  });

  test(`public/ (satteri .${extension}): an aliased path is treated as not public and is wrapped`, () => {
    const aliased = img('@assets/a.png');
    const tree = satteriPictureRun(root(aliased), {
      sourceFormat,
      fileURL,
      localImagePaths: ['@assets/a.png'],
      picture: PUBLIC_PICTURE,
    });
    assert.equal(pictureCount(tree), 1);
  });

  test(`public/ (satteri .${extension}): without publicDir only the public check is skipped, SVG stays skipped`, () => {
    const inPublic = img('../../../public/a.png');
    const svg = img('../../../public/a.svg');
    const tree = satteriPictureRun(root(inPublic, svg), {
      sourceFormat,
      fileURL,
      localImagePaths: ['../../../public/a.png', '../../../public/a.svg'],
      picture: { enabled: true },
    });
    assert.equal(pictureCount(tree), 1);
    assert.ok(tree.children.includes(svg));
  });

  test(`public/ (satteri .${extension}): without a document location the public check is skipped`, () => {
    const tree = satteriPictureRun(root(img('../../../public/a.png')), {
      sourceFormat,
      localImagePaths: ['../../../public/a.png'],
      picture: PUBLIC_PICTURE,
    });
    assert.equal(pictureCount(tree), 1);
  });

  test(`extensions (satteri .${extension}): SVG and GIF, with a case, query, or fragment, are skipped; a PNG with a query is wrapped`, () => {
    const skipped = EXTENSION_SRCS.map((src) => img(src));
    const tree = satteriPictureRun(root(...skipped, img(EXTENSION_WRAPPED_SRC)), {
      sourceFormat,
      fileURL,
      localImagePaths: [...EXTENSION_SRCS, EXTENSION_WRAPPED_SRC],
      picture: PUBLIC_PICTURE,
    });
    for (const node of skipped) assert.ok(tree.children.includes(node));
    assert.equal(pictureCount(tree), 1);
  });
}

for (const extension of ['md', 'mdx']) {
  const path = `${DOCS}/page.${extension}`;

  test(`public/ (unified .${extension}): a relative path into publicDir keeps its markup, one under src is wrapped`, () => {
    const inPublic = img('../../../public/a.png');
    const inSrc = img('../../assets/a.png');
    const tree = runUnifiedPicture(root(inPublic, inSrc), path, ['../../../public/a.png', '../../assets/a.png'], PUBLIC_PICTURE);
    assert.ok(tree.children.includes(inPublic));
    assert.equal(pictureCount(tree), 1);
  });

  test(`public/ (unified .${extension}): an aliased path is treated as not public and is wrapped`, () => {
    const tree = runUnifiedPicture(root(img('@assets/a.png')), path, ['@assets/a.png'], PUBLIC_PICTURE);
    assert.equal(pictureCount(tree), 1);
  });

  test(`public/ (unified .${extension}): without publicDir only the public check is skipped, SVG stays skipped`, () => {
    const svg = img('../../../public/a.svg');
    const tree = runUnifiedPicture(root(img('../../../public/a.png'), svg), path, ['../../../public/a.png', '../../../public/a.svg'], {
      enabled: true,
    });
    assert.equal(pictureCount(tree), 1);
    assert.ok(tree.children.includes(svg));
  });

  test(`extensions (unified .${extension}): SVG and GIF, with a case, query, or fragment, are skipped; a PNG with a query is wrapped`, () => {
    const skipped = EXTENSION_SRCS.map((src) => img(src));
    const tree = runUnifiedPicture(root(...skipped, img(EXTENSION_WRAPPED_SRC)), path, [...EXTENSION_SRCS, EXTENSION_WRAPPED_SRC], PUBLIC_PICTURE);
    for (const node of skipped) assert.ok(tree.children.includes(node));
    assert.equal(pictureCount(tree), 1);
  });
}
