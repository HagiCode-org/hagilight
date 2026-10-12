import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import starlightHagilight from '@hagicode/hagilight-starlight';
import { hagilight } from '@hagicode/hagilight/integration';

const SATTERI_LIST = 'hastPlugins';
const logger = () => {
  const warnings = [];
  return { warnings, warn: (message) => warnings.push(message) };
};

function astroConfig(processor = { name: 'satteri', options: { hastPlugins: [] } }) {
  return {
    site: 'https://example.test/',
    base: '/',
    srcDir: pathToFileURL('/nonexistent-hagilight/src/'),
    publicDir: pathToFileURL('/nonexistent-hagilight/public/'),
    root: pathToFileURL('/nonexistent-hagilight/'),
    integrations: [],
    markdown: { processor },
  };
}

function starlightIntegrations(options) {
  const integrations = [];
  starlightHagilight(options).hooks['config:setup']({
    astroConfig: { site: 'https://example.test/', base: '/' },
    config: { components: {}, logo: undefined },
    updateConfig: () => {},
    addIntegration: (integration) => integrations.push(integration),
  });
  return integrations;
}

function runStarlightSetup(config, log) {
  const [integration] = starlightIntegrations({ rss: { enabled: false } });
  integration.hooks['astro:config:setup']({
    config,
    logger: log,
    injectRoute: () => {},
    updateConfig: () => {},
  });
  return integration;
}

function runPlainSetup(config, options, log) {
  hagilight(options).hooks['astro:config:setup']({
    config,
    logger: log,
    injectRoute: () => {},
    addMiddleware: () => {},
    updateConfig: () => {},
  });
}

test('starlight plugin registers content images by default', () => {
  const processor = { name: 'satteri', options: { [SATTERI_LIST]: [] } };
  runStarlightSetup(astroConfig(processor), logger());
  assert.equal(processor.options[SATTERI_LIST].length, 1);
});

test('starlight contentImages enabled false registers nothing', () => {
  const processor = { name: 'satteri', options: { [SATTERI_LIST]: [] } };
  const [integration] = starlightIntegrations({ contentImages: { enabled: false }, rss: { enabled: false } });
  integration.hooks['astro:config:setup']({
    config: astroConfig(processor),
    logger: logger(),
    injectRoute: () => {},
    updateConfig: () => {},
  });
  assert.equal(processor.options[SATTERI_LIST].length, 0);
});

test('starlight rejects invalid contentImages values by naming the option', () => {
  assert.throws(() => starlightHagilight({ contentImages: 'yes' }), /contentImages options must be an object/u);
  assert.throws(() => starlightHagilight({ contentImages: { enabled: 'yes' } }), /contentImages enabled option must be a boolean/u);
});

test('plain-Astro hagilight({ enabled: false }) still registers content images', () => {
  const processor = { name: 'satteri', options: { [SATTERI_LIST]: [] } };
  runPlainSetup(astroConfig(processor), { enabled: false }, logger());
  assert.equal(processor.options[SATTERI_LIST].length, 1);
});

test('plain-Astro contentImages false and { enabled: false } register nothing', () => {
  for (const contentImages of [false, { enabled: false }]) {
    const processor = { name: 'satteri', options: { [SATTERI_LIST]: [] } };
    runPlainSetup(astroConfig(processor), { contentImages }, logger());
    assert.equal(processor.options[SATTERI_LIST].length, 0, JSON.stringify(contentImages));
  }
});

test('plain-Astro default registers content images with a site and no contentImages key', () => {
  const processor = { name: 'satteri', options: { [SATTERI_LIST]: [] } };
  runPlainSetup(astroConfig(processor), { rss: false }, logger());
  assert.equal(processor.options[SATTERI_LIST].length, 1);
});

test('plain-Astro rejects invalid contentImages values by naming the option', () => {
  assert.throws(() => hagilight({ contentImages: 'yes' }), /content images option/u);
  assert.throws(() => hagilight({ contentImages: { enabled: 'yes' } }), /content images enabled option/u);
});

test('starlight opt-out wins over hagilight() default, in either hook order', () => {
  for (const order of ['starlight-first', 'plain-first']) {
    const processor = { name: 'satteri', options: { [SATTERI_LIST]: [] } };
    const config = astroConfig(processor);
    const log = logger();
    const [starlight] = starlightIntegrations({ contentImages: { enabled: false }, rss: { enabled: false } });
    const runStarlight = () => starlight.hooks['astro:config:setup']({
      config,
      logger: log,
      injectRoute: () => {},
      updateConfig: () => {},
    });
    const runPlain = () => runPlainSetup(config, { rss: false }, log);
    if (order === 'starlight-first') {
      runStarlight();
      runPlain();
    } else {
      runPlain();
      runStarlight();
    }
    assert.equal(processor.options[SATTERI_LIST].length, 0, order);
    assert.equal(log.warnings.length, 0, order);
  }
});

function visitMdxImage(plugin, src, fileURL) {
  let replaced;
  const node = { type: 'element', tagName: 'img', properties: { src, alt: 'A' }, children: [] };
  plugin.element.visit(node, {
    sourceFormat: 'mdx',
    fileURL,
    data: { astro: { localImagePaths: new Set([src]) } },
    parent: () => undefined,
    setProperty() {},
    prependChild() {},
    replaceNode(_original, newNode) {
      replaced = newNode;
    },
  });
  return replaced;
}

test('registration records publicDir: an image in public/ keeps its markup and one under src is wrapped', () => {
  const processor = { name: 'satteri', options: { [SATTERI_LIST]: [] } };
  runPlainSetup(astroConfig(processor), { rss: false }, logger());
  const [plugin] = processor.options[SATTERI_LIST];
  const page = pathToFileURL('/nonexistent-hagilight/src/content/docs/page.mdx');
  assert.equal(visitMdxImage(plugin, '../../../public/a.png', page), undefined);
  assert.equal(visitMdxImage(plugin, '../../assets/a.png', page)?.name, 'HagilightContentPicture');
});

test('registration adds one content-image adapter per processor, however often setup runs', () => {
  const processor = { name: 'satteri', options: { [SATTERI_LIST]: [] } };
  const config = astroConfig(processor);
  runPlainSetup(config, { rss: false }, logger());
  runPlainSetup(config, { rss: false }, logger());
  assert.equal(processor.options[SATTERI_LIST].length, 1);
});

test('an unsupported Markdown processor logs one content-image warning across repeated setup', () => {
  const processor = { name: 'remark-like', options: {} };
  const log = logger();
  runPlainSetup(astroConfig(processor), { rss: false }, log);
  runPlainSetup(astroConfig(processor), { rss: false }, log);
  const imageWarnings = log.warnings.filter((message) => /content images/u.test(message));
  assert.equal(imageWarnings.length, 1);
  assert.match(imageWarnings[0], /"remark-like" Markdown processor/u);
});
