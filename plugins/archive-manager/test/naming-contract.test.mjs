import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pluginRoot = new URL('../', import.meta.url);

test('archive manager keeps its published and runtime naming contract', async () => {
  const [pkg, patch, host, client] = await Promise.all([
    readFile(new URL('package.json', pluginRoot), 'utf8'),
    readFile(new URL('cordis.patch.yml', pluginRoot), 'utf8'),
    readFile(new URL('src/index.ts', pluginRoot), 'utf8'),
    readFile(new URL('src/client.ts', pluginRoot), 'utf8'),
  ]);

  assert.equal(JSON.parse(pkg).name, '@dfy-plugins/dsh-archive-manager');
  assert.match(patch, /id: archive-manager\r?\n\s+name: '@dfy-plugins\/dsh-archive-manager'/);
  assert.match(host, /export const name = 'archive-manager'/);
  assert.match(host, /path: '\/api\/dsh-archive-manager\/list'/);
  assert.match(client, /fetch\('\/api\/dsh-archive-manager\/list'\)/);
  assert.match(client, /\.dsh-archive-root/);
  assert.match(client, /id: 'archives'/);
});
