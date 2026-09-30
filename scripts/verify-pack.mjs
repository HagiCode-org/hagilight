import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import {
  PACKAGES,
  assertPackageGraph,
  buildPackages,
  npm,
  readManifest,
  root,
} from './packages.mjs';

const REQUIRED_FILES = {
  '@hagicode/hagilight-core': [
    'Footer.astro',
    'Copyright.astro',
    'PromotoBanner.astro',
    'GoogleAnalytics.astro',
    'Analytics51LA.astro',
    'logo.png',
    'favicon.ico',
    'dist/related-sites.json',
    'dist/promoto-banner.js',
  ],
  '@hagicode/hagilight': [
    'SEOHead.astro',
    'robots.txt.ts',
    'rss.xml.ts',
    'rss.[language].xml.ts',
    'dist/integration.js',
    'dist/integration.d.ts',
    'dist/rss-middleware.js',
    'dist/rss-runtime.js',
  ],
  '@hagicode/hagilight-starlight': [
    'SEOHead.astro',
    'Header.astro',
    'LanguageChooser.astro',
    'AIDisclosureNotice.astro',
    'ContentLayoutToggle.astro',
    'content-width.css',
    'Footer.astro',
    'MarkdownContent.astro',
    'ArticlePromotion.astro',
    'assets/light-main.png',
    'PageTitle.astro',
    'PromotoFooter.astro',
    'NotFoundHero.astro',
    'rss.xml.ts',
    'rss.[language].xml.ts',
    'dist/rss-renderer.js',
    'dist/seo-utils.js',
  ],
};

function exportTargets(exports) {
  return Object.entries(exports).map(([subpath, value]) => {
    if (typeof value === 'string') return { subpath, runtime: value };
    if (!value || typeof value !== 'object' || typeof value.default !== 'string') {
      throw new Error(`Export ${subpath} must be a string or a { types, default } condition object`);
    }
    return { subpath, runtime: value.default, types: value.types };
  });
}

const relativeImportPattern = /(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|import\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|import\s+['"](\.{1,2}\/[^'"]+)['"]/gu;

function assertRelativeImportsShipped(name, files, readShipped) {
  for (const file of files) {
    if (!/\.(?:astro|js|ts)$/u.test(file) || file.endsWith('.d.ts')) continue;
    for (const match of readShipped(file).matchAll(relativeImportPattern)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      const target = posix.normalize(posix.join(posix.dirname(file), specifier));
      if (!files.has(target)) {
        throw new Error(`${name} ${file} imports ${specifier}, but ${target} is missing from its tarball`);
      }
    }
  }
}

buildPackages();
const manifests = PACKAGES.map(({ directory }) => readManifest(directory));
const version = assertPackageGraph(manifests);

for (const [index, { name, directory }] of PACKAGES.entries()) {
  const manifest = manifests[index];
  const output = execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts', '-w', name], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const [pack] = JSON.parse(output);
  const files = new Set(pack.files.map((file) => file.path));
  if (pack.name !== name || pack.version !== manifest.version) {
    throw new Error(`${name} tarball metadata does not match its manifest`);
  }
  for (const file of ['package.json', 'README.md', ...REQUIRED_FILES[name]]) {
    if (!files.has(file)) throw new Error(`${name} is missing ${file} from its tarball`);
  }
  for (const { subpath, runtime, types } of exportTargets(manifest.exports)) {
    for (const target of [runtime, types].filter(Boolean)) {
      if (!files.has(target.replace(/^\.\//u, ''))) {
        throw new Error(`${name} export ${subpath} target ${target} is missing from its tarball`);
      }
    }
    if (runtime.endsWith('.js') && !types) {
      throw new Error(`${name} export ${subpath} must declare generated types for ${runtime}`);
    }
    if (types && runtime.replace(/\.js$/u, '.d.ts') !== types) {
      throw new Error(`${name} export ${subpath} types ${types} do not match runtime ${runtime}`);
    }
  }
  for (const file of files) {
    if (file.endsWith('.mjs') || /(?:^|\/)src\//u.test(file) || file.endsWith('.tsbuildinfo')) {
      throw new Error(`${name} must not publish source or build metadata: ${file}`);
    }
  }
  assertRelativeImportsShipped(name, files, (file) => readFileSync(posix.join(root, directory, file), 'utf8'));

  if (manifest.peerDependencies?.astro === undefined) {
    throw new Error(`${name} must declare an Astro peer dependency`);
  }
  if (name === '@hagicode/hagilight-core' || name === '@hagicode/hagilight') {
    if (manifest.peerDependencies.astro !== '^6.0.7 || ^7.3.5') {
      throw new Error(`${name} must declare the tested Astro 6 and 7 peer ranges`);
    }
  }
  if (name === '@hagicode/hagilight-core' && manifest.dependencies?.['@astrojs/rss'] !== '^4.0.19') {
    throw new Error('Shared core must own the @astrojs/rss serializer dependency');
  }
  console.log(`${name}@${pack.version}: package contents verified (${files.size} files)`);
}
console.log(`All Hagilight packages share version ${version} and depend only on the shared core.`);
