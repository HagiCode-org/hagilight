import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const variants = join(root, 'node_modules/.hagilight-variants/plain-astro-build-info');
const astroCli = join(root, 'node_modules/astro/bin/astro.mjs');

const PAGE = `---
import Footer from '@hagicode/hagilight-core/Footer';
---
<html lang="en-US">
  <head><meta charset="utf-8" /><title>Build info</title></head>
  <body><Footer locale="en-US" /></body>
</html>
`;

const CONFIGS = {
  integrationDisabled: `import { defineConfig } from 'astro/config';
import { hagilight } from '@hagicode/hagilight/integration';

export default defineConfig({ site: 'https://build-info.example.com', integrations: [hagilight({ enabled: false })] });
`,
  noIntegration: `import { defineConfig } from 'astro/config';

export default defineConfig({ site: 'https://build-info.example.com' });
`,
};

function buildFixture(name) {
  const dir = join(variants, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'src/pages'), { recursive: true });
  writeFileSync(join(dir, 'astro.config.mjs'), CONFIGS[name]);
  writeFileSync(join(dir, 'src/pages/index.astro'), PAGE);
  execFileSync(process.execPath, [astroCli, 'build', '--root', dir], {
    cwd: root,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    stdio: 'pipe',
  });
  return readFileSync(join(dir, 'dist/index.html'), 'utf8');
}

function footerOf(html) {
  return html.match(/<footer\b[\s\S]*?<\/footer>/u)?.[0];
}

test('the footer keeps the build line when the hagilight integration is disabled', () => {
  const footer = footerOf(buildFixture('integrationDisabled'));
  assert.ok(footer, 'the page renders a footer');
  for (const field of ['branch', 'commit', 'builtAt']) {
    assert.equal(footer.split(`data-build-field="${field}"`).length - 1, 1, `the footer has one ${field} span`);
  }
  assert.match(footer, /Built: <time\b[^>]*datetime="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/u);
});

test('a footer mounted without the hagilight integration renders the copyright and no build text', () => {
  const footer = footerOf(buildFixture('noIntegration'));
  assert.ok(footer, 'the page renders a footer');
  assert.ok(footer.includes('hagilight-footer__copyright'), 'the copyright is still rendered');
  assert.doesNotMatch(footer, /hagilight-footer__build|data-build-field|Branch:|Commit:|Built:/u);
});
