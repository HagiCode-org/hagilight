import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const workflows = [
  {
    file: 'demo-starlight-web.yml',
    build: 'pnpm run build:starlight-example',
    output: './examples/demo-starlight-web/dist',
    branch: 'demo-starlight-web',
    environment: 'demo-starlight-web',
    url: 'https://hagistar.hagicode.com/',
    domain: 'hagistar.hagicode.com',
    concurrency: 'deploy-demo-starlight-web',
  },
  {
    file: 'demo-web.yml',
    build: 'pnpm run build:core-footer-example',
    output: './examples/demo-web/dist',
    branch: 'demo-web',
    environment: 'demo-web',
    url: 'https://hagilight.hagicode.com/',
    domain: 'hagilight.hagicode.com',
    concurrency: 'deploy-demo-web',
  },
  {
    file: 'demo-docusaurus-web.yml',
    build: 'pnpm run build:docusaurus-example',
    output: './examples/demo-docusaurus-web/build',
    branch: 'demo-docusaurus-web',
    environment: 'demo-docusaurus-web',
    url: 'https://docusaurus.hagicode.com/',
    domain: 'docusaurus.hagicode.com',
    concurrency: 'deploy-demo-docusaurus-web',
  },
].map((configuration) => ({
  ...configuration,
  source: readFileSync(new URL(`../.github/workflows/${configuration.file}`, import.meta.url), 'utf8'),
}));

for (const { file, build, output, branch, environment, url, domain, concurrency, source } of workflows) {
  test(`${file} publishes only its main-branch build to the assigned site`, () => {
    const trigger = source.match(/^on:\n([\s\S]*?)(?=^permissions:)/mu)?.[1]?.trimEnd();
    assert.equal(trigger, '  push:\n    branches: [main]');
    assert.ok(source.includes(`    environment:\n      name: ${environment}\n      url: ${url}`));
    assert.ok(source.includes(`- run: ${build}`));
    assert.ok(build.replace('pnpm run ', '') in scripts, `${build} is a root package script`);
    assert.ok(source.includes(`publish_dir: ${output}`));
    assert.ok(source.includes(`publish_branch: ${branch}`));
    assert.ok(source.includes('force_orphan: true'));
    assert.ok(source.includes('enable_jekyll: false'));
    assert.ok(source.includes(`cname: ${domain}`));
    assert.ok(source.includes(`group: ${concurrency}`));
    assert.doesNotMatch(source, /publish_branch:\s*gh-pages\b/u);
    const buildPosition = source.indexOf(`- run: ${build}`);
    const publishPosition = source.indexOf('uses: peaceiris/actions-gh-pages@v4');
    assert.ok(buildPosition >= 0 && publishPosition > buildPosition);
  });
}

test('demo workflows use independent concurrency groups and target branches', () => {
  for (const key of ['concurrency', 'branch', 'environment']) {
    const values = workflows.map((workflow) => workflow[key]);
    assert.equal(new Set(values).size, values.length, `${key} values are distinct`);
  }
  assert.equal(existsSync(new URL('../.github/workflows/demo-gh-pages.yml', import.meta.url)), false);
});
