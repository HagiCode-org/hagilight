import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COPY } from '../packages/starlight/dist/article-promotion.js';

const root = fileURLToPath(new URL('../packages/starlight/', import.meta.url));
const assetsDir = join(root, 'assets', 'showcase');
const KIB = 1024;
const manifest = JSON.parse(readFileSync(join(assetsDir, 'manifest.json'), 'utf8'));
const component = readFileSync(join(root, 'ArticlePromotion.astro'), 'utf8');
const shippedFiles = readdirSync(assetsDir).filter((file) => file !== 'manifest.json').sort();

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
  assert.equal(chunk, 'VP8 ');
  return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
}

test('provenance manifest and shipped showcase files match one to one', () => {
  assert.equal(manifest.schemaVersion, 1);
  const ids = manifest.assets.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, 'manifest ids are unique');
  assert.deepEqual(manifest.assets.map(({ file }) => file).sort(), shippedFiles);
  for (const asset of manifest.assets) {
    assert.ok(existsSync(join(assetsDir, asset.file)), `${asset.id} file exists`);
    assert.equal(statSync(join(assetsDir, asset.file)).size, asset.bytes, `${asset.id} recorded bytes`);
  }
  assert.ok(!existsSync(join(root, 'assets', 'light-main.png')), 'the stale hero image is gone');
  assert.deepEqual(readdirSync(join(root, 'assets')), ['showcase']);
});

test('every manifest entry carries the provenance its kind requires', () => {
  for (const asset of manifest.assets) {
    assert.ok(['sourced', 'svg', 'generated'].includes(asset.kind), `${asset.id} kind`);
    assert.ok(Number.isInteger(asset.width) && Number.isInteger(asset.height), `${asset.id} dimensions`);
    assert.ok(Array.isArray(asset.transforms), `${asset.id} transforms`);
    assert.match(asset.audit.verdict, /^pass/u, `${asset.id} audit verdict`);
    assert.match(asset.audit.checkedOn, /^\d{4}-\d{2}-\d{2}$/u, `${asset.id} audit date`);
    assert.ok(asset.audit.notes.trim(), `${asset.id} audit notes`);
    if (asset.kind === 'sourced') {
      if (asset.source?.repo === 'img-gen') {
        assert.match(asset.source.album ?? '', /^[a-z-]+$/u, `${asset.id} source album`);
        assert.ok(asset.source.objectKey?.startsWith(`${asset.source.album}/`), `${asset.id} object key is in its album`);
      } else {
        assert.ok(['web', 'docs'].includes(asset.source?.repo), `${asset.id} source repo`);
        assert.ok(asset.source?.path?.trim(), `${asset.id} source path`);
      }
      assert.ok(asset.transforms.length > 0, `${asset.id} records its transcode`);
    }
    if (asset.kind === 'generated') {
      for (const field of ['tool', 'prompt', 'params', 'generatedAt']) {
        assert.ok(asset.generation?.[field], `${asset.id} generation ${field}`);
      }
      assert.doesNotMatch(JSON.stringify(asset.generation), /api[_-]?key|secret|token|authorization|bearer/iu, `${asset.id} generation record has no credentials`);
    } else {
      assert.equal(asset.generation, undefined, `${asset.id} is not generated`);
    }
    if (asset.kind !== 'sourced') assert.equal(asset.source, undefined, `${asset.id} has no source`);
  }
});

test('shipped showcase source images meet the format, size, and traffic budgets', () => {
  const { totalKiB, rasterKiB, svgKiB } = manifest.budgets;
  assert.deepEqual([totalKiB, rasterKiB, svgKiB], [768, 200, 8]);
  let total = 0;
  for (const asset of manifest.assets) {
    const path = join(assetsDir, asset.file);
    const bytes = readFileSync(path);
    total += bytes.length;
    if (asset.kind === 'svg') {
      assert.ok(asset.file.endsWith('.svg'), `${asset.file} is an SVG`);
      assert.ok(bytes.length <= svgKiB * KIB, `${asset.file} is ${bytes.length} bytes, over the ${svgKiB} KiB SVG budget`);
      const svg = bytes.toString('utf8');
      assert.doesNotMatch(svg, /<text\b|<image\b|<script\b|<foreignObject\b/u, `${asset.file} has no text, raster, or script`);
      continue;
    }
    assert.ok(asset.file.endsWith('.webp'), `${asset.file} is WebP`);
    assert.ok(bytes.length <= rasterKiB * KIB, `${asset.file} is ${bytes.length} bytes, over the ${rasterKiB} KiB raster budget`);
    const { width, height } = webpSize(bytes);
    assert.ok(width >= 1200, `${asset.file} is ${width} px wide, under the 1200 px minimum`);
    assert.deepEqual({ width, height }, { width: asset.width, height: asset.height }, `${asset.file} recorded dimensions`);
  }
  assert.ok(
    total <= totalKiB * KIB,
    `showcase images total ${total} bytes (${(total / KIB).toFixed(1)} KiB), over the ${totalKiB} KiB budget`,
  );
});

test('component registry, copy gallery ids, and manifest ids agree', () => {
  const imported = [...component.matchAll(/from '\.\/assets\/showcase\/([^']+)'/gu)].map(([, file]) => file).filter((file) => !file.endsWith('.json')).sort();
  assert.deepEqual(imported, shippedFiles, 'the component imports every shipped image and nothing else');

  const registry = component.match(/const galleryImages[^{]*\{([\s\S]*?)\n\};/u)?.[1] ?? assert.fail('gallery registry');
  const registryIds = [...registry.matchAll(/^\s*(?:'([^']+)'|(\w+))\s*[:,]/gmu)].map((match) => match[1] ?? match[2]).sort();
  const rasterIds = manifest.assets.filter(({ kind }) => kind !== 'svg').map(({ id }) => id).sort();
  assert.deepEqual(registryIds, rasterIds);

  for (const [locale, copy] of Object.entries(COPY)) {
    assert.deepEqual(copy.gallery.map(({ id }) => id).sort(), registryIds, `${locale} gallery ids`);
  }
  for (const id of COPY['en-US'].features.map((feature) => feature.id)) {
    assert.ok(manifest.assets.some((asset) => asset.id === `pillar-${id}` && asset.kind === 'svg'), `pillar icon for ${id}`);
    assert.ok(component.includes(`${id}: pillar`), `component maps the ${id} pillar icon`);
  }
});

test('generated and vector illustrations are never captioned as product screenshots', () => {
  const illustrations = new Set(manifest.assets.filter(({ kind }) => kind !== 'sourced').map(({ id }) => id));
  for (const copy of Object.values(COPY)) {
    for (const item of copy.gallery) {
      if (illustrations.has(item.id)) {
        assert.doesNotMatch(`${item.caption} ${item.alt}`, /screenshot|screen shot|截图|截圖|スクリーンショット|스크린샷|Bildschirmfoto|capture d.écran|captura de pantalla|captura de tela|скриншот/iu);
      }
    }
  }
});

const footerManifest = JSON.parse(readFileSync(join(root, '..', 'core', 'assets', 'footer', 'manifest.json'), 'utf8'));

test('the cat-head showcase entry records R2 provenance, a bounded pool and a dated audit', () => {
  const entry = manifest.assets.find(({ id }) => id === 'cat-head');
  assert.ok(entry, 'the cat-head entry exists');
  assert.equal(entry.kind, 'sourced');
  assert.equal(entry.file, 'cat-head.webp');
  assert.deepEqual(entry.source, { repo: 'img-gen', album: 'cat-head-gallery', objectKey: 'cat-head-gallery/g067-pixar-style-3d-02.avif', width: 1024, height: 1024, bytes: 31093 });
  assert.match(entry.audit.checkedOn, /^\d{4}-\d{2}-\d{2}$/u);
  assert.equal(entry.audit.verdict, 'pass');
  assert.match(entry.audit.notes, /illustration/iu);
  assert.ok(entry.transforms.some((step) => /upscale 1024/u.test(step)), 'the 1024 px source is recorded as upscaled to the 1200 px minimum');
  assert.equal(entry.pool.album, 'cat-head-gallery');
  assert.equal(entry.pool.maxBytes, 200 * KIB);
  const keys = entry.pool.entries.map(({ key }) => key);
  assert.ok(keys.length >= 12 && keys.length <= 200, 'the pool holds 12 to 200 entries');
  assert.equal(new Set(keys).size, keys.length, 'pool keys are unique');
  assert.ok(!keys.includes('g067-pixar-style-3d-02'), 'the pool excludes this slot\'s default');
  assert.ok(!keys.includes('g001-flat-vector-01'), 'the pool excludes the footer default');
  for (const pooled of entry.pool.entries) assert.ok(pooled.bytes <= entry.pool.maxBytes, `${pooled.key} is within the byte cap`);
  assert.deepEqual(keys, footerManifest.pool.entries.map(({ key }) => key), 'the showcase pool is the audited footer list');
});

test('the cat-head showcase raster is 1200 px wide and inside both budgets', () => {
  const entry = manifest.assets.find(({ id }) => id === 'cat-head');
  const bytes = readFileSync(join(assetsDir, entry.file));
  assert.equal(bytes.length, entry.bytes, 'recorded bytes match the file');
  assert.ok(bytes.length <= 200 * KIB, `cat-head is ${bytes.length} bytes, over the 200 KiB raster budget`);
  assert.deepEqual(webpSize(bytes), { width: 1200, height: 1200 });
  const total = manifest.assets.reduce((sum, asset) => sum + statSync(join(assetsDir, asset.file)).size, 0);
  assert.ok(total <= 768 * KIB, `showcase total ${total} bytes is over the 768 KiB budget`);
});
