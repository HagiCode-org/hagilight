import assert from 'node:assert/strict';

const FIELDS = ['branch', 'commit', 'builtAt'];
const COPYRIGHT = /<p\b[^>]*class="[^"]*\bhagilight-(?:footer__)?copyright\b[^"]*"[^>]*>[\s\S]*?<\/p>/gu;
const UTC_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

function textOf(markup) {
  return markup.replace(/<!--[\s\S]*?-->/gu, '').replace(/<[^>]+>/gu, '').trim();
}

function attributeOf(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'u'))?.[1];
}

function readFields(html, label) {
  const paragraphs = html.match(COPYRIGHT) ?? [];
  assert.equal(paragraphs.length, 1, `${label} renders exactly one copyright paragraph`);
  const [copyright] = paragraphs;
  const fields = {};
  for (const field of FIELDS) {
    assert.equal(copyright.split(`data-build-field="${field}"`).length - 1, 1, `${label} renders one ${field} span`);
    const [, tag, inner] = copyright.match(new RegExp(`(<span\\b[^>]*data-build-field="${field}"[^>]*>)([\\s\\S]*?)</span>`, 'u'));
    fields[field] = {
      text: textOf(inner),
      title: attributeOf(tag, 'title'),
      datetime: inner.match(/<time\b[^>]*datetime="([^"]+)"/iu)?.[1],
    };
  }
  return fields;
}

export function verifyBuildInfo(html, label) {
  const info = readFields(html, label);
  assert.match(info.branch.text, /^Branch: .+$/u, `${label} shows a branch`);
  if (info.commit.text === 'Commit: unknown') {
    assert.equal(info.commit.title, undefined, `${label} omits the full commit when it is unknown`);
  } else {
    assert.match(info.commit.title ?? '', /^[0-9a-f]{40,64}$/u, `${label} carries the full commit in title`);
    assert.equal(info.commit.text, `Commit: ${info.commit.title.slice(0, 7)}`, `${label} shortens the commit to 7 characters`);
  }
  const { datetime } = info.builtAt;
  assert.match(datetime ?? '', UTC_SECONDS, `${label} build time is UTC to the second`);
  assert.equal(new Date(datetime).toISOString(), `${datetime.slice(0, -1)}.000Z`, `${label} build time is a real date`);
  assert.equal(info.builtAt.text, `Built: ${datetime}`, `${label} shows the build time`);
  return info;
}
