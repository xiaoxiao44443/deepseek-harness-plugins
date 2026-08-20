import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pluginRoot = new URL('../', import.meta.url);

test('appearance registers durable settings, a sidebar page, and a turn-tail disclosure', async () => {
  const [pkg, patch, host, client] = await Promise.all([
    readFile(new URL('package.json', pluginRoot), 'utf8'),
    readFile(new URL('cordis.patch.yml', pluginRoot), 'utf8'),
    readFile(new URL('src/index.ts', pluginRoot), 'utf8'),
    readFile(new URL('src/client.tsx', pluginRoot), 'utf8'),
  ]);
  assert.equal(JSON.parse(pkg).name, '@dfy-plugins/dsh-appearance');
  assert.match(patch, /id: appearance\r?\n\s+name: '@dfy-plugins\/dsh-appearance'/);
  assert.match(host, /settingsNamespace\('dsh-appearance'\)/);
  assert.match(client, /name: 'settings\.section'/);
  assert.match(client, /id: 'appearance'/);
  assert.match(client, /label: '外观'/);
  assert.match(client, /conversation\.chat\.turnTail/);
  assert.match(client, /data-chat-flow-kind/);
  assert.match(client, /data-dsh-appearance-process/);
  assert.match(client, /planCompletedProcessSegments/);
  assert.match(client, /processRows\[0\] \?\? outputRow/);
  assert.match(client, /dsh-appearance-process-chevron/);
  assert.match(client, /Exact vector used by DSH's Think disclosure/);
  assert.match(client, /M11\.8486 5\.5L11\.4238 5\.92383/);
  assert.doesNotMatch(client, /dsh-appearance-process-icon/);
  assert.match(client, /每段回复前收起过程/);
  assert.match(client, /对话字号/);
  assert.match(client, /对话行距/);
  assert.match(client, /assistant-step'\] > div > div > :not\(\[data-variant='think'\]\)/);
  assert.match(client, /:is\(p, li, blockquote, pre, code, table, td, th\):not\(\[data-variant='think'\] \*\)/);
  assert.match(client, /data-chat-flow-kind='user'/);
  assert.match(client, /dsh-media-user-bubble/);
  assert.match(client, /data-time-hover-root/);
  assert.match(client, /Math\.max\(13, fontSize - 2\)/);
  assert.match(client, /Math\.round\(fontSize \* lineHeightRatio\)/);
  assert.match(client, /\[data-tool="dfy_vision_analyze"\]/);
});
