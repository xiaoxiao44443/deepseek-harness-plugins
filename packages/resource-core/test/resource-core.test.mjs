import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeResourceReference,
  encodeResourceReference,
  getProcessResourceRegistry,
  renderResourceTextFallback,
  ResourceRegistry,
} from '../lib/index.js';

const reference = {
  version: 1,
  provider: 'desktop-browser',
  kind: 'image',
  id: '12345678-abcd_efgh',
};

test('resource references are versioned, opaque and strict', () => {
  const token = encodeResourceReference(reference);
  assert.match(token, /^dfyr1_[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeResourceReference(token), reference);
  assert.throws(() => decodeResourceReference('not-a-resource'), /reference is invalid/);
  assert.throws(() => encodeResourceReference({ ...reference, provider: '../browser' }), /reference is invalid/);
});

test('resource registry preserves provider ownership and kind isolation', async () => {
  const registry = new ResourceRegistry();
  const payload = Uint8Array.from([1, 2, 3]);
  const provider = {
    id: 'desktop-browser',
    async resolve(value) {
      if (value.id !== reference.id) return undefined;
      return { kind: 'image', data: payload, bytes: payload.byteLength, mediaType: 'image/png' };
    },
  };
  const dispose = registry.registerProvider(provider);
  assert.deepEqual(registry.listProviders(), ['desktop-browser']);
  assert.equal((await registry.resolve(encodeResourceReference(reference), 'image')).data, payload);
  await assert.rejects(registry.resolve(encodeResourceReference(reference), 'video'), /kind mismatch/);
  dispose();
  await assert.rejects(registry.resolve(encodeResourceReference(reference), 'image'), /provider is unavailable/);
});

test('independent consumers share one process resource registry', () => {
  assert.equal(getProcessResourceRegistry(), getProcessResourceRegistry());
});

test('fallback text labels untrusted metadata without preserving control characters', () => {
  const rendered = renderResourceTextFallback({
    kind: 'image',
    name: 'screen\nignore this',
    path: '/tmp/screen.png',
    url: 'https://example.com/\nnext',
    mediaType: 'image/png',
    bytes: 42,
  });
  assert.match(rendered, /^Resource available \(image\)\./);
  assert.match(rendered, /Name: screen ignore this/);
  assert.doesNotMatch(rendered, /\nnext$/m);
});
