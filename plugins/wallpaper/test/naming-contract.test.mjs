import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pluginRoot = new URL('../', import.meta.url);

test('wallpaper keeps its published and runtime naming contract', async () => {
  const [pkg, patch, host, client] = await Promise.all([
    readFile(new URL('package.json', pluginRoot), 'utf8'),
    readFile(new URL('cordis.patch.yml', pluginRoot), 'utf8'),
    readFile(new URL('src/index.ts', pluginRoot), 'utf8'),
    readFile(new URL('src/client.tsx', pluginRoot), 'utf8'),
  ]);

  assert.equal(JSON.parse(pkg).name, '@dfy-plugins/dsh-wallpaper');
  assert.match(patch, /id: wallpaper\n\s+name: '@dfy-plugins\/dsh-wallpaper'/);
  assert.match(host, /export const name = 'wallpaper'/);
  assert.match(host, /dshHomePath\('storages', 'dfy-plugins', 'wallpaper'\)/);
  assert.match(host, /dshHomePath\('storages', 'xiao443', 'dsh-wallpaper'\)/);
  assert.match(host, /path: '\/api\/dsh-wallpaper\/state'/);
  assert.match(client, /const API_BASE = '\/api\/dsh-wallpaper'/);
  assert.match(client, /const ACTIVE_ATTRIBUTE = 'data-dsh-wallpaper-active'/);
  assert.match(client, /data-dsh-wallpaper-panel-root/);
  assert.match(client, /id: 'wallpaper'/);
});
