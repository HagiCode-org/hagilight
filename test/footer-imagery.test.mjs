import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('../', import.meta.url));
const coreRoot = join(root, 'packages/core');
const footerDir = join(coreRoot, 'assets/footer');
const KIB = 1024;
const manifest = JSON.parse(readFileSync(join(footerDir, 'manifest.json'), 'utf8'));
const corePackage = JSON.parse(readFileSync(join(coreRoot, 'package.json'), 'utf8'));
const read = (path) => readFileSync(join(root, path), 'utf8');

const { footerAvatarImageAttributes, resolveFooterAvatarOptions } = await import(
  new URL('../packages/core/dist/footer-avatar.js', import.meta.url).href);
const { randomPoolAttribute, randomPoolFromManifest } = await import(
  new URL('../packages/core/dist/random-image.js', import.meta.url).href);
const { FooterView } = await import(new URL('../packages/docusaurus/dist/theme/Footer/FooterView.js', import.meta.url).href);
const { resolveFooterLinks } = await import(new URL('../packages/docusaurus/dist/footer.js', import.meta.url).href);

/** Pixel size of an AVIF file, read from its `ispe` box. */
function avifSize(buffer) {
  const index = buffer.indexOf('ispe', 0, 'ascii');
  assert.ok(index > 0, 'AVIF has an ispe box');
  return { width: buffer.readUInt32BE(index + 8), height: buffer.readUInt32BE(index + 12) };
}

/** Pixel size of a WebP file, read from its RIFF header. */
function webpSize(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
}

const FILE_SIZE = { 'avatar.avif': avifSize, 'avatar.webp': webpSize };

test('the footer avatar files match their manifest: bytes, dimensions and the per-file budget', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.decorative, true);
  assert.equal(manifest.display.cssPx, 64);
  assert.equal(manifest.display.sourcePx, 128);
  assert.deepEqual(manifest.files.map(({ type }) => type), ['image/avif', 'image/webp']);
  for (const entry of manifest.files) {
    const path = join(footerDir, entry.file);
    assert.ok(existsSync(path), `${entry.file} exists`);
    const bytes = readFileSync(path);
    assert.equal(statSync(path).size, entry.bytes, `${entry.file} recorded bytes`);
    assert.ok(entry.bytes <= manifest.budgets.perFileKiB * KIB, `${entry.file} is ${entry.bytes} bytes, over the ${manifest.budgets.perFileKiB} KiB budget`);
    assert.deepEqual(FILE_SIZE[entry.file](bytes), { width: entry.width, height: entry.height }, `${entry.file} dimensions`);
    assert.equal(entry.width, manifest.display.sourcePx);
  }
});

test('the footer avatar is the audited hero-avatars object, and its pool excludes both defaults', () => {
  assert.equal(manifest.source.album, 'hero-avatars');
  assert.equal(manifest.source.objectKey, 'hero-avatars/aurora-04.avif');
  assert.equal(manifest.source.bytes, 32017);
  const pool = manifest.pool;
  assert.equal(pool.album, 'hero-avatars');
  assert.equal(pool.maxBytes, 40 * KIB);
  assert.ok(pool.entries.length >= 12 && pool.entries.length <= 200, 'pool holds 12 to 200 entries');
  const keys = pool.entries.map(({ key }) => key);
  assert.equal(new Set(keys).size, keys.length, 'pool keys are unique');
  assert.ok(!keys.includes('aurora-04') && !keys.includes('ember-01'), 'the pool excludes both vendored defaults');
  for (const entry of pool.entries) assert.ok(entry.bytes <= pool.maxBytes, `${entry.key} is within the byte cap`);
  assert.equal(randomPoolFromManifest(pool).length, keys.length);
});

test('the footer manifest carries its provenance and a dated audit', () => {
  assert.match(manifest.audit.checkedOn, /^\d{4}-\d{2}-\d{2}$/u);
  assert.equal(manifest.audit.verdict, 'pass');
  assert.ok(manifest.audit.notes.trim());
  assert.ok(manifest.transforms.length >= 3, 'the transforms are recorded');
});

test('the footer pack ships the avatar files, the manifest and the option and picker modules', () => {
  for (const target of ['./assets/footer/avatar.avif', './assets/footer/avatar.webp', './assets/footer/manifest.json']) {
    assert.equal(corePackage.exports[target], target.replace(/^\.\//u, './'));
    assert.ok(existsSync(join(coreRoot, target.replace(/^\.\//u, ''))), `${target} is in the source tree`);
  }
  assert.ok(corePackage.files.includes('assets/**/*'), 'the assets folder is in the tarball files list');
  assert.equal(corePackage.exports['./footer-avatar'].default, './dist/footer-avatar.js');
  assert.equal(corePackage.exports['./random-image'].default, './dist/random-image.js');
  assert.ok(existsSync(join(coreRoot, 'dist/random-image.js')));
  assert.ok(existsSync(join(coreRoot, 'FooterAvatarPicker.astro')));
});

test('the Docusaurus footer renders the same avatar attributes and pool markup as the Astro footer', () => {
  const pool = randomPoolFromManifest(manifest.pool);
  const links = resolveFooterLinks({ locale: 'en-US', baseUrl: '/', links: {}, rssEnabled: false });
  const render = (avatar) => renderToStaticMarkup(createElement(FooterView, { links, version: '1.0.0', year: 2026, avatar }));
  const picture = (html) => html.match(/<picture class="hagilight-brand__avatar"[^>]*>[\s\S]*?<\/picture>/u)?.[0];

  const html = render({ avif: '/avatar.avif', webp: '/avatar.webp', randomPool: pool });
  const block = picture(html);
  assert.ok(block, 'the avatar picture renders');
  assert.equal(block.match(/^<picture ([^>]*)>/u)[1].includes(`data-random-pool="${randomPoolAttribute(pool).replace(/"/gu, '&quot;')}"`), true, 'pool attribute');
  assert.match(block, /<source type="image\/avif" srcSet="\/avatar\.avif"\/>/u);
  assert.match(block, /<source type="image\/webp" srcSet="\/avatar\.webp"\/>/u);
  const img = block.match(/<img [^>]*\/>/u)[0];
  for (const [name, value] of Object.entries(footerAvatarImageAttributes())) {
    assert.ok(img.includes(`${name}="${value}"`), `img has ${name}="${value}"`);
  }
  assert.ok(html.indexOf('hagilight-brand__avatar') < html.indexOf('hagilight-brand__headline'), 'the avatar sits beside the headline');

  const withoutPool = picture(render({ avif: '/avatar.avif', webp: '/avatar.webp' }));
  assert.doesNotMatch(withoutPool, /data-random-pool/u, 'no pool markup when the random option is off');
  assert.equal(picture(render(undefined)), undefined, 'no avatar element when the avatar option is off');
});

test('the Astro and Docusaurus footers share one attribute contract and one picker', () => {
  const astroBrand = read('packages/core/FooterBrand.astro');
  const docusaurusView = read('packages/docusaurus/src/theme/Footer/FooterView.tsx');
  for (const source of [astroBrand, docusaurusView]) {
    assert.match(source, /className="hagilight-brand__avatar"|class="hagilight-brand__avatar"/u);
    assert.match(source, /footerAvatarImageAttributes\(\)/u);
    assert.match(source, /hagilight-brand__title/u);
  }
  assert.match(read('packages/docusaurus/src/client/random-image.ts'), /mountRandomImages\(document\)/u);
  assert.match(read('packages/core/FooterAvatarPicker.astro'), /mountRandomImages\(document\)/u);
  assert.match(astroBrand, /\{avatarOptions\.randomAvatar && <FooterAvatarPicker \/>\}/u);
  assert.match(read('packages/docusaurus/src/index.ts'), /options\.footerAvatar\.randomAvatar \? '\.\/client\/random-image\.js'|client\/random-image\.js/u);
});

test('the footer avatar option defaults on and a disabled avatar drops its pool', () => {
  assert.deepEqual(resolveFooterAvatarOptions(), { avatar: true, randomAvatar: true });
  assert.deepEqual(resolveFooterAvatarOptions({ avatar: false }), { avatar: false, randomAvatar: false });
});

test('the picker bundle stays within 2 KiB minified', async (context) => {
  let esbuild;
  try {
    esbuild = createRequire(import.meta.url)('esbuild');
  } catch {
    context.skip('esbuild is not installed; measure the picker bundle with the Astro build instead');
    return;
  }
  const entry = join(coreRoot, 'dist/random-image.js');
  const bundle = await esbuild.build({
    stdin: { contents: `import { mountRandomImages } from ${JSON.stringify(entry)};\nvoid mountRandomImages(document);`, resolveDir: root },
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    write: false,
  });
  const size = bundle.outputFiles[0].contents.length;
  assert.ok(size <= 2 * KIB, `the picker is ${size} bytes minified, over 2 KiB`);
});
