import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function build(env = {}) {
  execFileSync(npm, ['run', 'build', '-w', 'hagilight-example'], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    // On Windows `npm` resolves to the `npm.cmd` batch file, which child_process
    // cannot execute directly; route it through the shell like the sibling scripts.
    shell: process.platform === 'win32',
  });
  const outputDir = join(root, 'examples/starlight/dist');
  return (filename) => readFileSync(join(outputDir, filename), 'utf8');
}

function feedItems(xml) {
  assert.match(xml, /^<\?xml/u);
  assert.match(xml, /<rss\b/u);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gu)].map(([, item]) => item);
}

function itemLinks(xml) {
  return feedItems(xml).map((item) => item.match(/<link>([^<]+)<\/link>/u)?.[1]);
}

function verifyDefaultFeeds(read) {
  const english = read('rss.xml');
  const englishAlias = read('rss.en.xml');
  const chinese = read('rss.zh-CN.xml');
  assert.equal(english, englishAlias);
  assert.match(english, /<language>en-US<\/language>/u);
  assert.match(chinese, /<language>zh-CN<\/language>/u);

  const englishLinks = itemLinks(english);
  assert.ok(englishLinks.includes('https://hagilight.hagicode.com/'));
  assert.ok(englishLinks.includes('https://hagilight.hagicode.com/blog/rss-example/'));
  assert.ok(!englishLinks.some((link) => link.includes('/en-us/')));
  assert.ok(!english.includes('Excluded from RSS'));
  assert.ok(!english.includes('RSS draft'));
  assert.ok(!chinese.includes('Excluded from RSS'));
  assert.ok(!chinese.includes('RSS draft'));
  assert.ok(!chinese.includes('English RSS blog example'));
  assert.ok(!english.includes('Chinese RSS blog example'));

  const chineseLinks = itemLinks(chinese);
  assert.ok(chineseLinks.includes('https://hagilight.hagicode.com/zh-cn/'));
  assert.ok(chineseLinks.includes('https://hagilight.hagicode.com/zh-cn/blog/rss-example/'));
  assert.ok(!chineseLinks.some((link) => link.includes('/en-us/')));
  assert.ok(!chineseLinks.some((link) => link.includes('/rss-undated/')));

  const undated = feedItems(english).find((item) => item.includes('/rss-undated/'));
  assert.ok(undated);
  assert.doesNotMatch(undated, /<pubDate>/u);
  const datedLinks = englishLinks.filter((link) => link.includes('blog/rss-example'));
  assert.deepEqual(datedLinks, ['https://hagilight.hagicode.com/blog/rss-example/']);
  assert.match(feedItems(english)[0], /<pubDate>/u);
}

const defaultFeeds = build();
verifyDefaultFeeds(defaultFeeds);
const englishHome = readFileSync(join(root, 'examples/starlight/dist/index.html'), 'utf8');
const chineseHome = readFileSync(join(root, 'examples/starlight/dist/zh-cn/index.html'), 'utf8');
assert.ok(englishHome.includes('https://docs.hagicode.com/en-US/blog/'));
assert.ok(!englishHome.includes('https://docs.hagicode.com/blog/'));
assert.ok(!englishHome.includes('https://hagilight.hagicode.com/rss.zh-CN.xml'));
assert.ok(chineseHome.includes('https://docs.hagicode.com/blog/'));
assert.ok(chineseHome.includes('https://hagilight.hagicode.com/rss.zh-CN.xml'));
assert.ok(!chineseHome.includes('https://hagilight.hagicode.com/rss.en.xml'));
assert.ok(!readFileSync(join(root, 'examples/starlight/dist/index.html'), 'utf8')
  .includes('https://hagilight.hagicode.com/rss.en.xml'));

const blogOnly = build({
  HAGILIGHT_EXAMPLE_BASE: '/rss-blog-only/',
  HAGILIGHT_RSS_INCLUDE_DOCS: 'false',
});
const blogOnlyLinks = itemLinks(blogOnly('rss.xml'));
assert.ok(blogOnlyLinks.length > 0);
assert.ok(blogOnlyLinks.every((link) => /\/rss-blog-only\/blog\//u.test(link)));

const docsOnly = build({
  HAGILIGHT_EXAMPLE_BASE: '/rss-docs-only/',
  HAGILIGHT_RSS_INCLUDE_BLOG: 'false',
});
const docsOnlyLinks = itemLinks(docsOnly('rss.xml'));
assert.ok(docsOnlyLinks.length > 0);
assert.ok(docsOnlyLinks.every((link) => link.includes('/rss-docs-only/')));
assert.ok(docsOnlyLinks.every((link) => !link.includes('/blog/')));

verifyDefaultFeeds(build());