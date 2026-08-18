import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeImageRef,
  encodeImageRef,
  imageMediaTypeForPath,
  renderVisionResult,
  textFromBlocks,
} from '../lib/logic.js';

test('image reference tokens round-trip official attachment metadata', () => {
  const ref = {
    attachmentId: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    mediaType: 'image/png',
    bytes: 42,
    width: 100,
    height: 80,
    name: '截图.png',
  };
  const token = encodeImageRef(ref);
  assert.deepEqual(decodeImageRef(token), ref);
  assert.deepEqual(decodeImageRef(`${token}\"`), ref);
  assert.deepEqual(decodeImageRef(`\"${token}\"`), ref);
  assert.throws(() => decodeImageRef('not-a-reference'), /image_ref is invalid/);
});

test('imageMediaTypeForPath recognizes supported image extensions case-insensitively', () => {
  assert.equal(imageMediaTypeForPath('/tmp/a.PNG'), 'image/png');
  assert.equal(imageMediaTypeForPath('screen.jpeg'), 'image/jpeg');
  assert.equal(imageMediaTypeForPath('screen.webp'), 'image/webp');
  assert.equal(imageMediaTypeForPath('screen.gif'), 'image/gif');
  assert.equal(imageMediaTypeForPath('screen.svg'), undefined);
});

test('textFromBlocks returns visible model text without reasoning', () => {
  assert.equal(textFromBlocks([
    { type: 'reasoning', text: 'private reasoning' },
    { type: 'text', text: ' first ' },
    { type: 'text', text: 'second' },
  ]), 'first\n\nsecond');
});

test('renderVisionResult escapes metadata while preserving analysis text', () => {
  const rendered = renderVisionResult({
    path: 'a<&".png',
    provider: 'provider&one',
    model: 'vision<1>',
    analysis: '按钮位于右下角。',
    finishReason: 'stop',
    image: { mediaType: 'image/png', bytes: 42, width: 100, height: 80 },
  });
  assert.match(rendered, /path="a&lt;&amp;&quot;\.png"/);
  assert.match(rendered, /provider="provider&amp;one"/);
  assert.match(rendered, /model="vision&lt;1&gt;"/);
  assert.match(rendered, /按钮位于右下角。/);
});
