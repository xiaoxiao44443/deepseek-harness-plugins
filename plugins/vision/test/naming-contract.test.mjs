import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pluginRoot = new URL('../', import.meta.url);

test('vision separates runtime names from globally registered tool names', async () => {
  const [pkg, patch, host, client] = await Promise.all([
    readFile(new URL('package.json', pluginRoot), 'utf8'),
    readFile(new URL('cordis.patch.yml', pluginRoot), 'utf8'),
    readFile(new URL('src/index.ts', pluginRoot), 'utf8'),
    readFile(new URL('src/client.tsx', pluginRoot), 'utf8'),
  ]);

  assert.equal(JSON.parse(pkg).name, '@dfy-plugins/dsh-vision');
  assert.match(patch, /id: vision\n\s+name: '@dfy-plugins\/dsh-vision'/);
  assert.match(host, /export const name = 'vision'/);
  assert.match(host, /settingsNamespace\('dsh-vision'\)/);
  assert.match(host, /const API_PATH = '\/api\/dsh-vision\/routes'/);
  assert.match(host, /const TOOL_NAME = 'dfy_vision_analyze'/);
  assert.match(host, /const SKILL_NAME = 'dfy-vision'/);
  assert.match(host, /title: 'DFY VISION ANALYZE'/);
  assert.match(host, /invocation: \{ modelInvocable: true, userInvocable: true \}/);
  assert.match(host, /Before analyzing this image, load the \$\{SKILL_NAME\} Skill/);
  assert.match(host, /ctx\.inject\(\['mediaBlocks'\]/);
  assert.match(client, /namespace: 'dsh-vision'/);
  assert.match(client, /key: 'dfy_vision_analyze'/);
  assert.match(client, />DFY VISION ANALYZE</);
  assert.match(client, /ctx\.effect\(installStyles, 'dsh-vision: client styles'\)/);
  assert.match(client, /\.dsh-vision-card/);
});
