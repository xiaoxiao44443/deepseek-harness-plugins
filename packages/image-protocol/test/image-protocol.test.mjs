import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createOfficialImageBlock,
  decodeSessionImageRef,
  decodeImageAttachmentRef,
  detectImageMediaType,
  encodeImageAttachmentRef,
  encodeSessionImageRef,
  imageMediaTypeForPath,
  inspectImageDimensions,
  renderImageTextFallback,
  serializeImageAttachmentRef,
} from '../lib/index.js';

const attachment = {
  attachmentId: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  mediaType: 'image/png',
  bytes: 42,
  width: 100,
  height: 80,
  name: '截图.png',
};

test('attachment references round-trip strict official metadata', () => {
  const token = encodeImageAttachmentRef(attachment);
  assert.deepEqual(decodeImageAttachmentRef(token), attachment);
  assert.deepEqual(serializeImageAttachmentRef(decodeImageAttachmentRef(token)), attachment);
  assert.throws(() => decodeImageAttachmentRef('not-a-reference'), /reference is invalid/);
});

test('image formats are detected from bytes and paths', () => {
  assert.equal(detectImageMediaType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(detectImageMediaType(Uint8Array.from([0xff, 0xd8, 0xff])), 'image/jpeg');
  assert.equal(imageMediaTypeForPath('/tmp/a.PNG'), 'image/png');
  assert.equal(imageMediaTypeForPath('/tmp/a.svg'), undefined);
});

test('session image references retain ownership and intrinsic metadata', () => {
  const ref = {
    kind: 'dsh-session-image',
    version: 1,
    sessionId: 'session-11111111-1111-4111-8111-111111111111',
    imageId: 'b'.repeat(64),
    mediaType: 'image/png',
    bytes: 68,
    width: 1,
    height: 1,
    name: '生成结果.png',
  };
  assert.deepEqual(decodeSessionImageRef(encodeSessionImageRef(ref)), ref);
  assert.throws(() => decodeSessionImageRef(encodeImageAttachmentRef(attachment)), /session image reference is invalid/);
});

test('intrinsic dimensions are read without publishing an attachment', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  assert.deepEqual(inspectImageDimensions(png), { width: 1, height: 1 });
});

test('official blocks and text fallback share normalized attachment metadata', () => {
  assert.deepEqual(createOfficialImageBlock(attachment), { type: 'image', attachment });
  const text = renderImageTextFallback({
    mimeType: 'image/png',
    bytes: 42,
    width: 100,
    height: 80,
    name: '截图.png',
    path: '/tmp/screen.png',
    sourceUrl: 'https://example.com/',
    capturedAt: '2026-08-20T00:00:00.000Z',
  });
  assert.match(text, /Resource available \(image\)/);
  assert.match(text, /Dimensions: 100x80/);
  assert.match(text, /Local path: \/tmp\/screen\.png/);
});
