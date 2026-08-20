import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { publishSessionImages, readSessionImage } from '../lib/session-storage.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('session images are content-addressed under the owning session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-session-image-'));
  const sessionId = 'session-11111111-1111-4111-8111-111111111111';
  const sessionDirectory = join(root, sessionId);
  try {
    const [published] = await publishSessionImages({ sessionId, directory: sessionDirectory }, [{
      data: PNG,
      mediaType: 'image/png',
      name: 'result.png',
    }], new AbortController().signal);
    assert.ok(published);
    const imagePath = join(sessionDirectory, 'artifacts', 'images', published.ref.imageId, 'image.png');
    assert.equal(dirname(dirname(imagePath)), join(sessionDirectory, 'artifacts', 'images'));
    assert.deepEqual(await readFile(imagePath), PNG);
    const stored = await readSessionImage(
      published.ref,
      async (requested) => requested === sessionId ? sessionDirectory : undefined,
      new AbortController().signal,
      1_000_000,
    );
    assert.deepEqual(stored.data, new Uint8Array(PNG));
    assert.equal(stored.token, published.token);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
