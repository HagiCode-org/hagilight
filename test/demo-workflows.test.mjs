import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflows = [
  {
    file: 'demo-starlight-web.yml',
    build: 'npm run build:example',
    output: './examples/demo-starlight-web/dist',
    branch: 'demo-starlight-web',
    environment: 'demo-starlight-web',
    url: 'https://hagistar.hagicode.com/',
    domain: 'hagistar.hagicode.com',
    concurrency: 'deploy-demo-starlight-web',
  },
  {
    file: 'demo-web.yml',
    build: 'npm run build:core-footer-example',
    output: './examples/demo-web/dist',
    branch: 'demo-web',
    environment: 'demo-web',
    url: 'https://hagilight.hagicode.com/',
    domain: 'hagilight.hagicode.com',
    concurrency: 'deploy-demo-web',
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
    assert.ok(source.includes(`publish_dir: ${output}`));
    assert.ok(source.includes(`publish_branch: ${branch}`));
    assert.ok(source.includes(`cname: ${domain}`));
    assert.ok(source.includes(`group: ${concurrency}`));
    assert.doesNotMatch(source, /publish_branch:\s*gh-pages\b/u);
    const buildPosition = source.indexOf(`- run: ${build}`);
    const publishPosition = source.indexOf('uses: peaceiris/actions-gh-pages@v4');
    assert.ok(buildPosition >= 0 && publishPosition > buildPosition);
  });
}

test('demo workflows use independent concurrency groups and target branches', () => {
  assert.notEqual(workflows[0].concurrency, workflows[1].concurrency);
  assert.notEqual(workflows[0].branch, workflows[1].branch);
  assert.notEqual(workflows[0].environment, workflows[1].environment);
  assert.equal(existsSync(new URL('../.github/workflows/demo-gh-pages.yml', import.meta.url)), false);
});
