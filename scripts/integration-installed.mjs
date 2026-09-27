import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temp = mkdtempSync(join(tmpdir(), 'hagilight-integration-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  const tarballs = [];
  for (const workspace of ['@hagicode/hagilight', '@hagicode/hagilight-starlight']) {
    const output = execFileSync(npm, ['pack', '--json', '-w', workspace, '--pack-destination', temp], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    tarballs.push(join(temp, JSON.parse(output)[0].filename));
  }
  const example = JSON.parse(readFileSync('examples/starlight/package.json', 'utf8'));
  cpSync('examples/starlight/package.json', join(temp, 'package.json'));
  cpSync('examples/starlight/astro.config.mjs', join(temp, 'astro.config.mjs'));
  cpSync('examples/starlight/src', join(temp, 'src'), { recursive: true });
  execFileSync(npm, ['install', '--prefix', temp, '--no-save', ...tarballs,
    `astro@${example.dependencies.astro}`, `@astrojs/starlight@${example.dependencies['@astrojs/starlight']}`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const astro = join(temp, 'node_modules', 'astro', 'bin', 'astro.mjs');
  execFileSync(process.execPath, [astro, 'build'], { cwd: temp, stdio: 'inherit' });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
