import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temp = mkdtempSync(join(tmpdir(), 'hagilight-integration-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function verifyBannerBuild(expected) {
  const html = readFileSync(join(temp, 'dist', 'index.html'), 'utf8');
  const bundles = listFiles(join(temp, 'dist', '_astro'))
    .filter((path) => path.endsWith('.js'))
    .map((path) => readFileSync(path, 'utf8'));
  const hasBannerMarkup = html.includes('<hagilight-promoto-banner');
  const hasBannerScript = bundles.some((bundle) => bundle.includes('hagilight-promoto-banner'));
  if (hasBannerMarkup !== expected || hasBannerScript !== expected) {
    throw new Error(`Installed example banner output mismatch (expected ${expected ? 'enabled' : 'disabled'})`);
  }
}

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
  const configPath = join(temp, 'astro.config.mjs');
  const enabledConfig = readFileSync('examples/starlight/astro.config.mjs', 'utf8');
  cpSync('examples/starlight/package.json', join(temp, 'package.json'));
  writeFileSync(configPath, enabledConfig);
  cpSync('examples/starlight/src', join(temp, 'src'), { recursive: true });
  execFileSync(npm, ['install', '--prefix', temp, '--no-save', ...tarballs,
    `astro@${example.dependencies.astro}`, `@astrojs/starlight@${example.dependencies['@astrojs/starlight']}`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const astro = join(temp, 'node_modules', 'astro', 'bin', 'astro.mjs');
  execFileSync(process.execPath, [astro, 'build'], { cwd: temp, stdio: 'inherit' });
  verifyBannerBuild(true);

  const disabledConfig = enabledConfig.replace('promoto: { enabled: true }', 'promoto: { enabled: false }');
  if (disabledConfig === enabledConfig) throw new Error('Example config does not explicitly enable the promotion banner');
  writeFileSync(configPath, disabledConfig);
  execFileSync(process.execPath, [astro, 'build'], { cwd: temp, stdio: 'inherit' });
  verifyBannerBuild(false);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
