import assert from 'node:assert/strict';
import test from 'node:test';

import { AttachmentId } from '@deepseek-ai/dsh-attachment';
import {
  encodeResourceReference,
  getProcessResourceRegistry,
} from '@dfy-plugins/resource-core';
import { readResourceImage } from '../lib/index.js';

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
