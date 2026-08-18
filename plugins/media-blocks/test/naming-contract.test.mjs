import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pluginRoot = new URL('../', import.meta.url);

test('media blocks keeps package, Cordis, API and content ids intentionally separate', async () => {
  const [pkg, patch, host, client] = await Promise.all([
    readFile(new URL('package.json', pluginRoot), 'utf8'),
    readFile(new URL('cordis.patch.yml', pluginRoot), 'utf8'),
    readFile(new URL('src/index.ts', pluginRoot), 'utf8'),
    readFile(new URL('src/client.tsx', pluginRoot), 'utf8'),
  ]);

  assert.equal(JSON.parse(pkg).name, '@dfy-plugins/dsh-media-blocks');
  assert.match(patch, /id: media-blocks\n\s+name: '@dfy-plugins\/dsh-media-blocks'/);
  assert.match(host, /MEDIA_BLOCK_TYPE = 'xiao443-media'/);
  assert.match(host, /MEDIA_PROMPT_API = '\/api\/dsh-media-blocks\/prompt'/);
  assert.match(client, /export const name = 'media-blocks'/);
  assert.match(client, /\.dsh-media-input/);
  assert.match(client, /locale: 'conversation'/);
});
