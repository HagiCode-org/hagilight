import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { generateRssFeed } from '@hagicode/hagilight/rss';

test('generates RSS from consumer-supplied items with language and base-aware absolute links', async () => {
  const response = await generateRssFeed({
    site: 'https://docs.example.test',
    baseUrl: '/manual/',
    language: 'zh-cn',
    title: 'Consumer feed',
    description: 'Consumer-owned entries',
    items: [
      {
        title: 'Dated item',
        description: 'Supplied description',
        link: '/guide/start/',
        date: new Date('2026-09-25T00:00:00.000Z'),
      },
      {
        title: 'Undated item',
        link: 'zh-CN/intro/',
      },
    ],
  });
  const xml = await response.text();
  assert.match(xml, /<language>zh-CN<\/language>/u);
  assert.match(xml, /<title>Dated item<\/title>/u);
  assert.match(xml, /<description>Supplied description<\/description>/u);
  assert.match(xml, /<link>https:\/\/docs\.example\.test\/manual\/guide\/start\/<\/link>/u);
  assert.match(xml, /<link>https:\/\/docs\.example\.test\/manual\/zh-CN\/intro\/<\/link>/u);
  const itemXml = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map(([, item]) => item);
  const dated = itemXml.find((item) => item.includes('Dated item'));
  const undated = itemXml.find((item) => item.includes('Undated item'));
  assert.match(dated, /<pubDate>/u);
  assert.doesNotMatch(undated, /<pubDate>/u);
});

test('requires an absolute site and actionable feed inputs', () => {
  const input = { title: 'Feed', description: 'Description', items: [] };
  assert.throws(() => generateRssFeed(input), /configure `site` in astro\.config\.mjs/u);
  assert.throws(() => generateRssFeed({ ...input, site: '/relative' }), /absolute Astro site URL/u);
  assert.throws(() => generateRssFeed({ ...input, site: 'ftp://docs.example.test' }), /absolute Astro site URL/u);
  assert.throws(() => generateRssFeed({ ...input, site: 'https://docs.example.test', language: 'not a tag' }),
    /valid language tag/u);
  assert.throws(() => generateRssFeed({
    ...input,
    site: 'https://docs.example.test',
    items: [{ title: 'No URL' }],
  }), /require a non-empty link/u);
  assert.throws(() => generateRssFeed({
    ...input,
    site: 'https://docs.example.test',
    items: [{ title: 'Invalid date', link: '/page/', date: 'not a date' }],
  }), /invalid publication date/u);
});

test('core package exposes feed generation without implicit route or Starlight dependency', async () => {
  const [manifest, starlightManifest] = await Promise.all([
    readFile(new URL('../packages/astro/package.json', import.meta.url), 'utf8'),
    readFile(new URL('../packages/starlight/package.json', import.meta.url), 'utf8'),
  ]);
  const core = JSON.parse(manifest);
  const starlight = JSON.parse(starlightManifest);
  assert.equal(core.exports['./rss'], './rss-renderer.mjs');
  assert.equal(Object.keys(core.exports).some((path) => path.includes('rss.xml')), false);
  assert.equal(core.dependencies?.['@astrojs/starlight'], undefined);
  assert.equal(core.dependencies?.['@astrojs/rss'], '^4.0.19');
  assert.equal(starlight.dependencies?.['@astrojs/rss'], undefined);
});
