import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pluginRoot = new URL('../', import.meta.url);

test('visualize follows repository naming, lifecycle, storage and sandbox contracts', async () => {
  const [pkgRaw, patch, host, client, build] = await Promise.all([
    readFile(new URL('package.json', pluginRoot), 'utf8'),
    readFile(new URL('cordis.patch.yml', pluginRoot), 'utf8'),
    readFile(new URL('src/index.ts', pluginRoot), 'utf8'),
    readFile(new URL('src/client.tsx', pluginRoot), 'utf8'),
    readFile(new URL('scripts/build-client.mjs', pluginRoot), 'utf8'),
  ]);
  const pkg = JSON.parse(pkgRaw);
  assert.equal(pkg.name, '@dfy-plugins/dsh-visualize');
  assert.match(patch, /id: visualize\r?\n\s+name: '@dfy-plugins\/dsh-visualize'/);
  assert.match(build, /id: "@dfy-plugins\/dsh-visualize"/);
  assert.match(host, /export const name = 'visualize'/);
  assert.match(host, /const TOOL_NAME = 'dfy_visualize_render'/);
  assert.match(host, /const SKILL_NAME = 'dfy-visualize'/);
  assert.match(host, /VISUALIZATION_API_PATH = '\/api\/dsh-visualize\/artifacts'/);
  assert.match(host, /ctx\.sessionPersistence\.locate\(agent\.session\.header\)/);
  assert.match(host, /join\('artifacts', 'visualizations'\)/);
  assert.match(host, /await rename\(temporaryDirectory, finalDirectory\)/);
  assert.match(host, /presentationMeta:/);
  assert.match(host, /kind: 'prefix'/);
  assert.match(host, /content-security-policy/);
  assert.match(client, /key: TOOL_NAME/);
  assert.match(client, /sandbox="allow-scripts"/);
  assert.doesNotMatch(client, /allow-same-origin/);
  assert.match(client, /data-dsh-visualization-output/);
  assert.match(client, /ctx\.effect\(installStyles, 'dsh-visualize: client styles'\)/);
  assert.match(client, /existing\.replaceWith\(tag\)/);
  assert.doesNotMatch(client, /<style>\{STYLES\}<\/style>/);
});

