import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import {
  PACKAGES,
  assertPackageGraph,
  buildPackages,
  npm,
  readManifest,
  root,
} from './packages.mjs';

const COMPARISON_ARTICLE_DATA_DIR = 'data/comparison-articles';

// Every <locale>/<slug>.json in the source data must ship, so the list is read from the source tree.
function comparisonArticleDataFiles() {
  const dir = join(root, 'packages', 'core', COMPARISON_ARTICLE_DATA_DIR);
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((locale) =>
      readdirSync(join(dir, locale.name), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => posix.join(COMPARISON_ARTICLE_DATA_DIR, locale.name, entry.name)),
    );
}

const REQUIRED_FILES = {
  '@hagicode/hagilight-core': [
    'RootTransit.astro',
    'dist/root-transit.js',
    'dist/root-transit.d.ts',
    'dist/root-transit-board.js',
    'dist/root-transit-board.d.ts',
    'dist/splash-images.js',
    'dist/splash-images.d.ts',
    'dist/random-image.js',
    'dist/random-image.d.ts',
    'dist/footer-avatar.js',
    'dist/footer-avatar.d.ts',
    'assets/footer/avatar.avif',
    'assets/footer/avatar.webp',
    'assets/footer/manifest.json',
    'FooterAvatarPicker.astro',
    'Footer.astro',
    'FooterBrand.astro',
    'dist/footer-brand.js',
    'Copyright.astro',
    'PromotoBanner.astro',
    'GoogleAnalytics.astro',
    'PostHog.astro',
    'dist/posthog.js',
    'dist/posthog.d.ts',
    'Analytics51LA.astro',
    'logo.png',
    'favicon.ico',
    'dist/related-sites.json',
    'dist/promoto-banner.js',
    'dist/comparison-articles.js',
    'dist/comparison-articles.d.ts',
    'dist/comparison-articles-source.js',
    'dist/comparison-articles-source.d.ts',
    'dist/site-metadata.js',
    'dist/site-metadata.d.ts',
    'dist/site-metadata-writer.js',
    'dist/site-metadata-writer.d.ts',
    'dist/site-metadata-ownership.js',
    'dist/site-metadata-ownership.d.ts',
    'dist/og-image.js',
    'dist/og-image.d.ts',
    ...comparisonArticleDataFiles(),
  ],
  '@hagicode/hagilight-docusaurus': [
    'styles.css',
    'promoto.css',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/locales.js',
    'dist/locales.d.ts',
    'dist/analytics.js',
    'dist/discovery.js',
    'dist/footer.js',
    'dist/seo.js',
    'dist/client/analytics.js',
    'dist/client/promoto.js',
    'dist/client/promoto-markup.js',
    'dist/theme/Footer/index.js',
    'dist/theme/SiteMetadata/index.js',
    'dist/client/random-image.js',
  ],
  '@hagicode/hagilight': [
    'Footer.astro',
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
    'ThemeSelect.astro',
    'content-width.css',
    'themes.css',
    'Footer.astro',
    'MarkdownContent.astro',
    'ArticlePromotion.astro',
    'assets/showcase/manifest.json',
    'assets/showcase/workbench.webp',
    'assets/showcase/proposal-workflow.webp',
    'assets/showcase/heroes.webp',
    'assets/showcase/cat-head.webp',
    'ArticlePromotionPicker.astro',
    'assets/showcase/pillar-smart.svg',
    'assets/showcase/pillar-efficient.svg',
    'assets/showcase/pillar-fun.svg',
    'PageTitle.astro',
    'PromotoFooter.astro',
    'NotFoundHero.astro',
    'rss.xml.ts',
    'rss.[language].xml.ts',
    'dist/rss-renderer.js',
    'dist/seo-utils.js',
    'dist/showcase.js',
    'dist/windows-download.js',
    'dist/article-promotion-copy/index.js',
  ],
};

const EXPECTED_EXPORTS = {
  '@hagicode/hagilight-docusaurus': ['.', './locales'],
};

const FORBIDDEN_FILES = {
  '@hagicode/hagilight-starlight': ['assets/light-main.png'],
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
  // npm ≥ 12 returns a workspace-keyed object for `pack --json`; older versions return an array.
  const parsedPackOutput = JSON.parse(output);
  const packs = Array.isArray(parsedPackOutput) ? parsedPackOutput : Object.values(parsedPackOutput);
  const [pack] = packs;
  const files = new Set(pack.files.map((file) => file.path));
  if (pack.name !== name || pack.version !== manifest.version) {
    throw new Error(`${name} tarball metadata does not match its manifest`);
  }
  for (const file of ['package.json', 'README.md', ...REQUIRED_FILES[name]]) {
    if (!files.has(file)) throw new Error(`${name} is missing ${file} from its tarball`);
  }
  for (const file of FORBIDDEN_FILES[name] ?? []) {
    if (files.has(file)) throw new Error(`${name} must not ship the retired ${file}`);
  }
  if (EXPECTED_EXPORTS[name] && JSON.stringify(Object.keys(manifest.exports)) !== JSON.stringify(EXPECTED_EXPORTS[name])) {
    throw new Error(`${name} must export exactly ${EXPECTED_EXPORTS[name].join(', ')}`);
  }
  for (const { subpath, runtime, types } of exportTargets(manifest.exports)) {
    for (const target of [runtime, types].filter(Boolean)) {
      // Pattern exports (raw JSON) are covered by the explicit file list above, not by a literal path.
      if (target.includes('*')) continue;
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

  if (name === '@hagicode/hagilight-docusaurus') {
    const peers = manifest.peerDependencies ?? {};
    if (peers['@docusaurus/core'] !== '^3.9.2' || peers['@docusaurus/theme-classic'] !== '^3.9.2') {
      throw new Error(`${name} must declare the tested Docusaurus 3.9 core and theme-classic peer ranges`);
    }
  } else if (manifest.peerDependencies?.astro === undefined) {
    throw new Error(`${name} must declare an Astro peer dependency`);
  }
  if (name === '@hagicode/hagilight-core' || name === '@hagicode/hagilight') {
    if (manifest.peerDependencies.astro !== '>=7') {
      throw new Error(`${name} must declare the Astro >=7 peer range`);
    }
  }
  if (name === '@hagicode/hagilight-core' && manifest.dependencies?.['@astrojs/rss'] !== '^4.0.19') {
    throw new Error('Shared core must own the @astrojs/rss serializer dependency');
  }
  console.log(`${name}@${pack.version}: package contents verified (${files.size} files)`);
}
console.log(`All Hagilight packages share version ${version} and depend only on the shared core.`);
