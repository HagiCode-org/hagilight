import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = join(root, 'test/fixtures/og-image');
const remote = join(fixture, 'remote');
const variants = join(root, 'node_modules/.hagilight-variants');
const astroCli = join(root, 'node_modules/astro/bin/astro.mjs');
const SITE = 'https://og-image.example.test';

let imageServer;
let imageOrigin;
const builds = new Map();

before(async () => {
  // A loopback server stands in for a remote image host; a missing file answers 404.
  imageServer = createServer((request, response) => {
    const file = join(remote, basename(new URL(request.url, 'http://localhost').pathname));
    if (!existsSync(file)) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': file.endsWith('.avif') ? 'image/avif' : 'image/png' });
    response.end(readFileSync(file));
  });
  await new Promise((resolve) => imageServer.listen(0, '127.0.0.1', resolve));
  imageOrigin = `http://127.0.0.1:${imageServer.address().port}`;
});

after(() => new Promise((resolve) => imageServer.close(resolve)));

// Async on purpose: the image server runs in this process, so a blocking child would stall it.
function runAstro(dir, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [astroCli, 'build', '--root', dir], { cwd: root, env });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (status) => resolve({ status, output }));
  });
}

async function buildSite(name, { base = '/', domains = ['127.0.0.1'], extraPages = [] } = {}) {
  const dir = join(variants, `og-image-${name}`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(fixture, dir, {
    recursive: true,
    filter: (source) => !source.startsWith(remote) && !source.startsWith(join(fixture, 'failure')),
  });
  for (const page of extraPages) {
    copyFileSync(join(fixture, 'failure', `${page}.astro`), join(dir, 'src/pages', `${page}.astro`));
  }
  const { status, output } = await runAstro(dir, {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
    OG_IMAGE_ORIGIN: imageOrigin,
    OG_BASE: base,
    OG_IMAGE_DOMAINS: domains.join(','),
  });
  return { dir, base, status, output };
}

function build(name, options) {
  if (!builds.has(name)) builds.set(name, buildSite(name, options));
  return builds.get(name);
}

function pageHtml(site, page) {
  return readFileSync(join(site.dir, 'dist', page, 'index.html'), 'utf8');
}

function metaContent(html, attribute) {
  const tag = html.match(/<meta[^>]*>/gu)?.find((candidate) => candidate.includes(attribute));
  return tag?.match(/content="([^"]*)"/u)?.[1];
}

function imageTagCount(html, attribute) {
  return html.split(attribute).length - 1;
}

// The converted file lives under the build output; the declared address carries the base once.
function outputFile(site, address) {
  const relative = new URL(address).pathname.slice(site.base.length);
  return join(site.dir, 'dist', relative);
}

function convertedJpegs(site) {
  return readdirSync(join(site.dir, 'dist/_astro')).filter((file) => file.endsWith('.jpeg'));
}

// Read the size from the JPEG frame header (SOF0-SOF15, excluding DHT, JPG and DAC markers).
function jpegSize(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8, 'the file starts with a JPEG start-of-image marker');
  let offset = 2;
  while (offset < buffer.length) {
    assert.equal(buffer[offset], 0xff, 'a JPEG segment starts with 0xFF');
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  throw new Error('the JPEG has no frame header');
}

// Astro never enlarges: a 640 by 400 source keeps its size, so the JPEG is smaller than the 1200 by 630 frame.
test('an AVIF preview becomes one JPEG at its source size, and og:image and twitter:image carry the same URL', async () => {
  const site = await build('main');
  assert.equal(site.status, 0, site.output);
  const html = pageHtml(site, 'avif');
  const og = metaContent(html, 'property="og:image"');
  const twitter = metaContent(html, 'name="twitter:image"');
  assert.equal(imageTagCount(html, 'property="og:image"'), 1);
  assert.equal(imageTagCount(html, 'name="twitter:image"'), 1);
  assert.equal(og, twitter);
  assert.match(og, new RegExp(`^${SITE}/_astro/photo_[\\w-]+\\.jpeg$`, 'u'));
  const file = outputFile(site, og);
  assert.ok(existsSync(file), `the converted file ${file} exists`);
  assert.deepEqual(jpegSize(readFileSync(file)), { width: 640, height: 400 });
});

test('a wide AVIF preview is cropped to a 1200 by 630 JPEG', async () => {
  const site = await build('main');
  const og = metaContent(pageHtml(site, 'wide'), 'property="og:image"');
  assert.match(og, new RegExp(`^${SITE}/_astro/wide_[\\w-]+\\.jpeg$`, 'u'));
  assert.deepEqual(jpegSize(readFileSync(outputFile(site, og))), { width: 1200, height: 630 });
});

test('a PNG preview keeps its own address and gets no converted file', async () => {
  const site = await build('main');
  const html = pageHtml(site, 'png');
  assert.equal(metaContent(html, 'property="og:image"'), `${imageOrigin}/photo.png`);
  assert.equal(metaContent(html, 'name="twitter:image"'), `${imageOrigin}/photo.png`);
  assert.equal(convertedJpegs(site).length, 2, 'only the AVIF and wide AVIF pages produced converted files');
});

test('a page with no preview image has no image tags', async () => {
  const html = pageHtml(await build('main'), 'none');
  assert.equal(imageTagCount(html, 'og:image'), 0);
  assert.equal(imageTagCount(html, 'twitter:image'), 0);
});

test('pages that declare the same AVIF share one file, and a site-wide AVIF is converted for a page with none', async () => {
  const site = await build('main');
  const avif = metaContent(pageHtml(site, 'avif'), 'property="og:image"');
  assert.equal(metaContent(pageHtml(site, 'avif-again'), 'property="og:image"'), avif);
  const siteDefault = pageHtml(site, 'site-default');
  assert.equal(metaContent(siteDefault, 'property="og:image"'), avif);
  assert.equal(metaContent(siteDefault, 'name="twitter:image"'), avif);
  assert.equal(convertedJpegs(site).length, 2, 'the shared AVIF and the wide AVIF produced one file each');
});

test('an SVG preview and a site-root AVIF are kept as declared, with a warning that names each image', async () => {
  const site = await build('main');
  assert.equal(metaContent(pageHtml(site, 'svg'), 'property="og:image"'), `${SITE}/logo.svg`);
  assert.equal(metaContent(pageHtml(site, 'site-root-avif'), 'property="og:image"'), `${SITE}/photo.avif`);
  assert.match(site.output, /Hagilight SEO image \/logo\.svg was kept as declared: its format was not checked/u);
  assert.match(site.output, /Hagilight SEO image \/photo\.avif was kept as declared: site-root images are not converted/u);
});

test('a non-root base appears once in the declared address and the file is still written under the base', async () => {
  const site = await build('base', { base: '/docs/' });
  assert.equal(site.status, 0, site.output);
  const html = pageHtml(site, 'avif');
  const og = metaContent(html, 'property="og:image"');
  assert.equal(metaContent(html, 'name="twitter:image"'), og);
  assert.match(og, new RegExp(`^${SITE}/docs/_astro/photo_[\\w-]+\\.jpeg$`, 'u'));
  assert.equal(og.split('/docs/').length - 1, 1, 'the base appears once');
  assert.deepEqual(jpegSize(readFileSync(outputFile(site, og))), { width: 640, height: 400 });
});

test('a host that is not permitted fails the build and the message names the image and the host', async () => {
  const site = await build('no-domains', { domains: [] });
  assert.notEqual(site.status, 0, 'the build fails');
  assert.match(site.output, new RegExp(`could not convert the SEO image ${imageOrigin}/photo\\.avif`, 'u'));
  assert.match(site.output, /its host 127\.0\.0\.1 is not permitted/u);
  assert.match(site.output, /image\.domains/u);
});

test('a server error status fails the build and the message names the image address', async () => {
  const site = await build('missing', { extraPages: ['missing'] });
  assert.notEqual(site.status, 0, 'the build fails');
  assert.match(site.output, new RegExp(`${imageOrigin}/missing\\.avif`, 'u'));
  assert.match(site.output, /received 404/u);
});

test('an image that cannot be decoded fails the build and the message names the image address', async () => {
  const site = await build('broken', { extraPages: ['broken'] });
  assert.notEqual(site.status, 0, 'the build fails');
  assert.match(site.output, new RegExp(`${imageOrigin}/broken\\.avif`, 'u'));
});
