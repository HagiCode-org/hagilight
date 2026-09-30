import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { generateRssFeed } from '@hagicode/hagilight-core/rss';

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

test('shared core owns feed generation without routes or feature-package dependencies', async () => {
  const manifests = await Promise.all(['core', 'astro', 'starlight'].map(async (directory) =>
    JSON.parse(await readFile(new URL(`../packages/${directory}/package.json`, import.meta.url), 'utf8'))));
  const [core, astro, starlight] = manifests;
  assert.deepEqual(core.exports['./rss'], {
    types: './dist/rss.d.ts',
    default: './dist/rss.js',
  });
  assert.equal(Object.keys(core.exports).some((path) => path.includes('rss.xml')), false);
  assert.deepEqual(Object.keys(core.dependencies), ['@astrojs/rss']);
  assert.equal(core.dependencies['@astrojs/rss'], '^4.0.19');
  for (const manifest of [astro, starlight]) {
    assert.equal(manifest.dependencies?.['@astrojs/rss'], undefined);
    assert.equal(manifest.dependencies['@hagicode/hagilight-core'], core.version);
  }
  assert.equal(astro.dependencies['@hagicode/hagilight-starlight'], undefined);
  assert.equal(starlight.dependencies['@hagicode/hagilight'], undefined);
  assert.equal(starlight.peerDependencies['@hagicode/hagilight'], undefined);
});
