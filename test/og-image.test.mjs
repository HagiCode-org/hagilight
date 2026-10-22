import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OG_IMAGE_FORMAT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_QUALITY,
  OG_IMAGE_WIDTH,
  classifyOgImage,
} from '@hagicode/hagilight-core/og-image';

test('JPEG, PNG and GIF are crawler-compatible', () => {
  for (const name of ['photo.jpg', 'photo.jpeg', 'photo.png', 'photo.gif']) {
    assert.equal(classifyOgImage(`/images/${name}`), 'compatible', name);
  }
});

test('AVIF and WebP are convertible', () => {
  for (const name of ['photo.avif', 'photo.webp']) {
    assert.equal(classifyOgImage(`/images/${name}`), 'convertible', name);
  }
});

test('SVG, a missing extension and a trailing dot are unrecognised', () => {
  for (const name of ['logo.svg', 'photo', 'photo.']) {
    assert.equal(classifyOgImage(`/images/${name}`), 'unrecognised', name);
  }
});

test('a dot in a directory name does not count as an extension', () => {
  assert.equal(classifyOgImage('/v1.2/photo'), 'unrecognised');
  assert.equal(classifyOgImage('https://cdn.example.test/v2.png/photo'), 'unrecognised');
});

test('the extension is compared in lower case', () => {
  assert.equal(classifyOgImage('/images/PHOTO.JPG'), 'compatible');
  assert.equal(classifyOgImage('https://cdn.example.test/Card.AVIF'), 'convertible');
  assert.equal(classifyOgImage('/images/Photo.WebP'), 'convertible');
});

test('a query string or fragment after the extension does not hide the format', () => {
  assert.equal(classifyOgImage('https://example.com/a/photo.avif?v=3'), 'convertible');
  assert.equal(classifyOgImage('https://example.com/a/photo.png#share'), 'compatible');
  assert.equal(classifyOgImage('/a/photo.jpg?w=1200#top'), 'compatible');
  assert.equal(classifyOgImage('/a/logo.svg?v=2'), 'unrecognised');
});

test('a query string that contains a dot does not change the result', () => {
  assert.equal(classifyOgImage('https://example.com/a/photo?name=x.avif'), 'unrecognised');
});

test('a site-root path and an absolute URL classify the same way', () => {
  assert.equal(classifyOgImage('/social/card.png'), 'compatible');
  assert.equal(classifyOgImage('https://cdn.example.test/social/card.png'), 'compatible');
  assert.equal(classifyOgImage('/social/card.avif'), 'convertible');
  assert.equal(classifyOgImage('https://cdn.example.test/social/card.avif'), 'convertible');
});

test('a host name is not read as a file name', () => {
  assert.equal(classifyOgImage('https://example.avif'), 'unrecognised');
  assert.equal(classifyOgImage('https://example.com'), 'unrecognised');
});

test('the target is a 1200 by 630 JPEG at quality 80', () => {
  assert.equal(OG_IMAGE_WIDTH, 1200);
  assert.equal(OG_IMAGE_HEIGHT, 630);
  assert.equal(OG_IMAGE_FORMAT, 'jpeg');
  assert.equal(OG_IMAGE_QUALITY, 80);
});
