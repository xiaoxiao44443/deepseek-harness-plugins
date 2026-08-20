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
  assert.match(patch, /id: vision\r?\n\s+name: '@dfy-plugins\/dsh-vision'/);
  assert.match(host, /export const name = 'vision'/);
  assert.match(host, /settingsNamespace\('dsh-vision'\)/);
  assert.match(host, /const API_PATH = '\/api\/dsh-vision\/routes'/);
  assert.match(host, /const RESOURCE_API_PATH = '\/api\/dsh-vision\/resource'/);
  assert.match(host, /req\.method === 'POST'/);
  assert.match(host, /await readRequestBytes\(req, byteCap\)/);
  assert.match(host, /imageRef: encodeImageRef\(ref\)/);
  assert.match(host, /presentationMeta:/);
  assert.match(host, /presentResult:/);
  assert.match(host, /createOfficialImageBlock\(attachment\)/);
  assert.match(host, /ctx\.attachments\.readImage\(decodeImageRef\(token\)\)/);
  assert.match(host, /resource_ref/);
  assert.match(host, /getProcessResourceRegistry\(\)\.resolve/);
  assert.match(host, /const TOOL_NAME = 'dfy_vision_analyze'/);
  assert.match(host, /const SKILL_NAME = 'dfy-vision'/);
  assert.match(host, /description: VISION_TOOL_DESCRIPTION/);
  assert.match(host, /reasoningEffort: ReasoningEffortId\(config\.reasoningEffort\)/);
  assert.match(host, /reasoning: \{/);
  assert.match(host, /title: 'DFY VISION ANALYZE'/);
  assert.match(host, /invocation: \{ modelInvocable: true, userInvocable: true \}/);
  assert.match(host, /Before analyzing this image, load the \$\{SKILL_NAME\} Skill/);
  assert.match(host, /ctx\.inject\(\['mediaBlocks'\]/);
  const refresh = host.slice(host.indexOf('const refresh = async'), host.indexOf('// Keep bundle order irrelevant'));
  assert.match(refresh, /ensureFeatures\(\);[\s\S]*await ctx\.llm\.resolveModelInfo/);
  assert.match(client, /namespace: 'dsh-vision'/);
  assert.match(client, /key: 'dfy_vision_analyze'/);
  assert.match(client, />思考等级</);
  assert.match(client, /跟随模型默认/);
  assert.match(client, />DFY VISION ANALYZE</);
  assert.match(client, /已查看 1 张图片/);
  assert.match(client, /VisionImagePreview/);
  assert.match(client, /function toolInput\(/);
  assert.match(client, /!imageExpanded \|\| image === undefined \? null : <VisionImagePreview/);
  assert.match(client, /setImageOpen\(true\)/);
  assert.match(client, /dsh-vision-tool-chevron/);
  assert.match(client, /IconChevronDownOutline14 className="dsh-vision-tool-chevron"/);
  assert.match(client, /DFY VISION ANALYZE，\$\{detailsExpanded \? '收起参数' : '展开参数'\}/);
  assert.match(client, /setDetailsOpen\(\(value\) => !value\)/);
  assert.match(client, /className="dsh-vision-tool-summary-toggle"/);
  assert.match(client, /flex: 0 1 auto/);
  assert.match(client, /text-align: left/);
  assert.match(client, /aria-expanded=\{imageExpanded\}/);
  assert.match(client, /dsh-vision-tool-io-card/);
  assert.match(client, />IN</);
  assert.match(client, />OUT</);
  assert.doesNotMatch(client, /IconInspectOutline12/);
  assert.doesNotMatch(client, />查看参数</);
  assert.doesNotMatch(client, /inspect-target:hover/);
  assert.match(client, /\/api\/dsh-vision\/resource/);
  assert.match(client, /ctx\.effect\(installStyles, 'dsh-vision: client styles'\)/);
  assert.match(client, /existing\.replaceWith\(tag\)/);
  assert.doesNotMatch(client, /<style>\{STYLES\}<\/style>/);
  assert.match(client, /\.dsh-vision-card/);
});
