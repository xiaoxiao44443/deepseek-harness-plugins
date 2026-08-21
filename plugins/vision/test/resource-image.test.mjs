import assert from 'node:assert/strict';
import test from 'node:test';

import { AttachmentId } from '@deepseek-ai/dsh-attachment';
import {
  encodeResourceReference,
  getProcessResourceRegistry,
} from '@dfy-plugins/resource-core';
import { readReferencedImage, readResourceImage } from '../lib/index.js';
import { encodeImageRef } from '../lib/logic.js';

test('vision consumes registered browser PNG bytes without reading a local path', async () => {
  const data = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const id = 'b'.repeat(43);
  const registry = getProcessResourceRegistry();
  const dispose = registry.registerProvider({
    id: 'desktop-browser',
    async resolve(reference) {
      if (reference.id !== id) return undefined;
      return { kind: 'image', data, bytes: data.byteLength, mediaType: 'image/png' };
    },
  });
  const saved = {
    attachmentId: AttachmentId(`sha256:${'1'.repeat(64)}`),
    mediaType: 'image/png',
    bytes: data.byteLength,
    width: 2,
    height: 2,
    name: 'browser.png',
  };
  let saveInput;
  const ctx = {
    attachments: {
      imageLimits: {
        maxImageBytes: 1024,
        maxMessageImageBytes: 2048,
        mediaTypes: ['image/png'],
      },
      async saveImage(input) {
        saveInput = input;
        return saved;
      },
    },
  };
  try {
    const token = encodeResourceReference({ version: 1, provider: 'desktop-browser', kind: 'image', id });
    const resolved = await readResourceImage(ctx, { signal: new AbortController().signal }, token);
    assert.equal(resolved.ref, saved);
    assert.equal(resolved.label, `resource:desktop-browser/${id}`);
    assert.equal(saveInput.data, data);
    assert.equal(saveInput.mediaType, 'image/png');
  } finally {
    dispose();
  }
});

test('vision re-admits durable attachment references through the rc.2 normalization boundary', async () => {
  const data = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
  const legacy = {
    attachmentId: AttachmentId(`sha256:${'2'.repeat(64)}`),
    mediaType: 'image/png',
    bytes: data.byteLength,
    width: 4096,
    height: 2048,
    name: 'legacy.png',
  };
  const admitted = {
    attachmentId: AttachmentId(`sha256:${'3'.repeat(64)}`),
    mediaType: 'image/webp',
    bytes: 1024,
    width: 2048,
    height: 1024,
    name: 'legacy.png',
    originalDimensions: { width: 4096, height: 2048 },
  };
  let saveInput;
  const signal = new AbortController().signal;
  const ctx = {
    attachments: {
      async readImage(ref, receivedSignal) {
        assert.deepEqual(ref, legacy);
        assert.equal(receivedSignal, signal);
        return { ref: legacy, data };
      },
      async saveImage(input) {
        saveInput = input;
        return admitted;
      },
    },
  };

  const resolved = await readReferencedImage(
    ctx,
    { signal },
    encodeImageRef(legacy),
    new Map(),
  );

  assert.deepEqual(saveInput, { data, mediaType: 'image/png', name: 'legacy.png' });
  assert.equal(resolved.ref, admitted);
  assert.equal(resolved.label, 'attachment:legacy.png');
});
