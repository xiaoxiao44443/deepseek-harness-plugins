import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeImageBase64,
  IMAGE_GENERATION_SKILL_CONTENT,
  imageApiEndpoint,
  parseImageApiResponse,
  renderImageGenerationResult,
  validateImageSize,
} from '../lib/logic.js';

test('OpenAI-compatible image endpoints preserve the configured v1 root', () => {
  assert.equal(imageApiEndpoint('https://api.teamorouter.com/v1', 'generate'), 'https://api.teamorouter.com/v1/images/generations');
  assert.equal(imageApiEndpoint('https://api.teamorouter.com/v1/', 'edit'), 'https://api.teamorouter.com/v1/images/edits');
  assert.throws(() => imageApiEndpoint('file:///tmp/api', 'generate'), /http or https/);
});

test('gpt-image-2 flexible sizes enforce documented limits', () => {
  for (const size of ['auto', '1024x1024', '1536x1024', '2048x1152', '3840x2160', '2160x3840']) {
    assert.equal(validateImageSize(size), size);
  }
  assert.throws(() => validateImageSize('1000x1000'), /multiples of 16/);
  assert.throws(() => validateImageSize('4096x2160'), /maximum edge/);
  assert.throws(() => validateImageSize('1024x256'), /aspect ratio/);
});

test('image API responses accept either base64 payloads or result URLs', () => {
  assert.deepEqual(parseImageApiResponse({ data: [{ b64_json: 'aGVsbG8=' }, { url: 'https://example.com/image.png' }] }), [
    { b64Json: 'aGVsbG8=' },
    { url: 'https://example.com/image.png' },
  ]);
  assert.equal(Buffer.from(decodeImageBase64('aGVsbG8=')).toString('utf8'), 'hello');
  assert.throws(() => decodeImageBase64('not base64!'), /invalid base64/);
  assert.throws(() => parseImageApiResponse({ data: [{}] }), /neither/);
});

test('Skill requires loading before the stable custom tool and results retain image refs', () => {
  assert.match(IMAGE_GENERATION_SKILL_CONTENT, /before every call to `dfy_image_generate`/);
  const rendered = renderImageGenerationResult({
    operation: 'generate',
    model: 'gpt-image-2',
    quality: 'auto',
    size: '1024x1024',
    images: [{
      ref: 'opaque-ref',
      attachment: {
        attachmentId: 'sha256:test',
        mediaType: 'image/png',
        bytes: 42,
        width: 1024,
        height: 1024,
        name: 'result.png',
      },
    }],
  });
  assert.match(rendered, /<image_generation_result/);
  assert.match(rendered, /image_ref="opaque-ref"/);
  assert.doesNotMatch(rendered, /b64_json/);
});
