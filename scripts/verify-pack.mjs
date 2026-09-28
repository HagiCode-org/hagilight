import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

for (const [workspace, required] of [
  ['@hagicode/hagilight', [
    'Copyright.astro',
    'PromotoBanner.astro',
    'logo.png',
    'GoogleAnalytics.astro',
    'Analytics51LA.astro',
    'site-links.ts',
    'related-sites.json',
    'promotions.ts',
    'promoto-banner.ts',
  ]],
  ['@hagicode/hagilight-starlight', [
    'index.mjs',
    'rss.xml.ts',
    'ai-disclosure-schema.mjs',
    'ai-disclosures.mjs',
    'AIDisclosureNotice.astro',
    'content-width.mjs',
    'content-width-i18n.mjs',
    'content-width.css',
    'ContentLayoutToggle.astro',
    'Footer.astro',
    'MarkdownContent.astro',
    'ArticlePromotion.astro',
    'article-promotion-schema.mjs',
    'assets/light-main.png',
    'PageTitle.astro',
    'PromotoFooter.astro',
  ]],
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
  if (workspace === '@hagicode/hagilight') {
    if (manifest.peerDependencies.astro !== '^6.0.7 || ^7.3.5') {
      throw new Error('Core package must declare the tested Astro 6 and 7 peer ranges');
    }
    for (const entry of ['./site-links', './PromotoBanner']) {
      if (!manifest.exports[entry] || !files.has(manifest.exports[entry].replace(/^\.\//, ''))) {
        throw new Error(`Core package must publish ${entry}`);
      }
    }
  }
  console.log(`${workspace}@${pack.version}: package contents verified`);
}
