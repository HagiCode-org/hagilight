import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

for (const [workspace, required] of [
  ['@hagicode/hagilight', [
    'Copyright.astro',
    'PromotoBanner.astro',
    'GoogleAnalytics.astro',
    'Analytics51LA.astro',
    'site-links.ts',
    'promotions.ts',
    'promoto-banner.ts',
  ]],
  ['@hagicode/hagilight-starlight', ['index.mjs', 'Footer.astro', 'PromotoFooter.astro']],
]) {
  const directory = workspace === '@hagicode/hagilight' ? 'astro' : 'starlight';
  const manifest = JSON.parse(readFileSync(`packages/${directory}/package.json`, 'utf8'));
  const output = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['pack', '--dry-run', '--json', '-w', workspace], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
  const [pack] = JSON.parse(output);
  const files = new Set(pack.files.map((file) => file.path));
  for (const file of ['package.json', ...required]) {
    if (!files.has(file)) throw new Error(`${workspace} is missing ${file} from its tarball`);
  }
  for (const target of Object.values(manifest.exports)) {
    if (!files.has(target.replace(/^\.\//, ''))) throw new Error(`${workspace} export ${target} is missing from its tarball`);
  }
  if (pack.name !== workspace || pack.version !== manifest.version) {
    throw new Error(`${workspace} tarball metadata does not match its manifest`);
  }
  console.log(`${workspace}@${pack.version}: package contents verified`);
}
