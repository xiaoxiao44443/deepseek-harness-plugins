import assert from 'node:assert/strict';
import test from 'node:test';

import {
  injectVisualizationBridge,
  normalizeTitle,
  parseVisualizationMeta,
  validateAssetName,
  visualizationUrl,
} from '../lib/logic.js';

test('visualization metadata is replay-safe and produces an encoded resource URL', () => {
  const meta = {
    kind: 'dsh-visualization',
    version: 1,
    sessionId: 'session-a b',
    artifactId: '9a38bda2-6900-4c2a-82db-bbc064f797b0',
    title: '销售趋势',
    assetCount: 2,
  };
  assert.deepEqual(parseVisualizationMeta(meta), meta);
  assert.equal(
    visualizationUrl(meta),
    '/api/dsh-visualize/artifacts/session-a%20b/9a38bda2-6900-4c2a-82db-bbc064f797b0/index.html',
  );
  assert.equal(parseVisualizationMeta({ ...meta, artifactId: '../escape' }), undefined);
});

test('visualization bridge is inserted before body close and reports only its artifact id', () => {
  const id = '9a38bda2-6900-4c2a-82db-bbc064f797b0';
  const rendered = injectVisualizationBridge('<!doctype html><body><main>ok</main></body>', id);
  assert.match(rendered, /data-dsh-visualize-bridge/);
  assert.match(rendered, new RegExp(`${id}.*<\\/script><\\/body>`, 's'));
  assert.match(rendered, /ResizeObserver/);
  assert.match(rendered, /parent\.postMessage/);
  assert.doesNotMatch(rendered, /d\?\.scrollHeight/);
  assert.match(rendered, /b\?\.scrollHeight/);
  assert.match(rendered, /getBoundingClientRect/);
});

test('titles and asset basenames are bounded without permitting traversal', () => {
  assert.equal(normalizeTitle('  A\n B  ', 'fallback'), 'A B');
  assert.equal(normalizeTitle('', '示例'), '示例');
  assert.equal(validateAssetName('图表.png'), '图表.png');
  assert.throws(() => validateAssetName('../x.png'));
  assert.throws(() => validateAssetName('..'));
});
