import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const variants = join(root, 'node_modules/.hagilight-variants/core-footer-consent-entries');
const astroCli = join(root, 'node_modules/astro/bin/astro.mjs');

const PAGES = {
  regional: '<Footer locale="en-US" consent regional replayEntry />',
  global: '<Footer locale="en-US" consent />',
  none: '<Footer locale="en-US" />',
};

function buildFixture(name) {
  const dir = join(variants, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'src/pages'), { recursive: true });
  writeFileSync(join(dir, 'astro.config.mjs'), 'import { defineConfig } from \'astro/config\';\n\nexport default defineConfig({});\n');
  writeFileSync(join(dir, 'src/pages/index.astro'), `---\nimport Footer from '@hagicode/hagilight-core/Footer';\n---\n<html lang="en-US">\n  <head><meta charset="utf-8" /><title>Footer</title></head>\n  <body>${PAGES[name]}</body>\n</html>\n`);
  execFileSync(process.execPath, [astroCli, 'build', '--root', dir], {
    cwd: root,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    stdio: 'pipe',
  });
  return readFileSync(join(dir, 'dist/index.html'), 'utf8');
}

/** The consent entries' opening tags, in document order. */
const entryTags = (html) => html.match(/<button[^>]*hagilight-footer__consent[^>]*>/gu) ?? [];

test('a regional site renders both entries hidden until the decision reveals them', () => {
  const tags = entryTags(buildFixture('regional'));
  assert.equal(tags.length, 2, 'the settings and replay entries render');
  const settings = tags.find((tag) => tag.includes('data-consent-entry="settings"'));
  const replay = tags.find((tag) => tag.includes('data-consent-entry="replay"'));
  assert.ok(settings && /\shidden[\s>]/u.test(settings), 'the settings entry starts hidden');
  assert.ok(!settings.includes('data-consent-mode'), 'the settings entry opens the main panel');
  assert.ok(replay && /\shidden[\s>]/u.test(replay), 'the replay entry starts hidden');
  assert.ok(replay.includes('data-consent-mode="replay"'), 'the replay entry opens the replay section');
  for (const tag of tags) assert.ok(tag.includes('data-consent-preferences'), 'both entries open the preferences');
});

test('a global site keeps the settings entry visible with no regional markers', () => {
  const tags = entryTags(buildFixture('global'));
  assert.equal(tags.length, 1);
  assert.ok(!tags[0].includes('data-consent-entry'), 'no regional marker');
  assert.ok(!/\shidden[\s>]/u.test(tags[0]), 'the entry is visible as before');
});

test('a site without consent renders no consent entry', () => {
  assert.equal(entryTags(buildFixture('none')).length, 0);
});
