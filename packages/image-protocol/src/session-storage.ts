/** Immutable, content-addressed image artifacts owned by one DSH session. */
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

import {
  detectImageMediaType,
  encodeSessionImageRef,
  inspectImageDimensions,
  type SessionImageRef,
} from './index.js';

const ARTIFACT_SUBDIR = join('artifacts', 'images');

export interface SessionImageInput {
  data: Uint8Array;
  mediaType: ImageMediaType;
  name?: string;
}

export interface SessionImageOwner {
  sessionId: string;
  directory: string;
}

export interface StoredSessionImage {
  ref: SessionImageRef;
  token: string;
  data: Uint8Array;
}

export type ResolveSessionDirectory = (
  sessionId: string,
  signal: AbortSignal,
) => Promise<string | undefined>;

function inside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function fileName(mediaType: ImageMediaType): string {
  switch (mediaType) {
    case 'image/png': return 'image.png';
    case 'image/jpeg': return 'image.jpg';
    case 'image/webp': return 'image.webp';
    case 'image/gif': return 'image.gif';
  }
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function manifestFor(ref: SessionImageRef): Record<string, unknown> {
  return {
    kind: ref.kind,
    version: ref.version,
    sessionId: ref.sessionId,
    imageId: ref.imageId,
    mediaType: ref.mediaType,
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
    file: fileName(ref.mediaType),
  };
}

function sameManifest(value: unknown, ref: SessionImageRef): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const expected = manifestFor(ref);
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, item]) => record[key] === item);
}

async function verifyExisting(directory: string, ref: SessionImageRef, data?: Uint8Array): Promise<void> {
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')) as unknown;
  if (!sameManifest(manifest, ref)) throw new Error(`session image manifest mismatch: ${ref.imageId}`);
  if (data !== undefined) {
    const existing = await readFile(join(directory, fileName(ref.mediaType)));
    if (existing.byteLength !== data.byteLength || sha256(existing) !== ref.imageId) {
      throw new Error(`session image content mismatch: ${ref.imageId}`);
    }
  }
}

async function publishOne(root: string, ref: SessionImageRef, data: Uint8Array): Promise<boolean> {
  const finalDirectory = resolve(root, ref.imageId);
  const temporaryDirectory = resolve(root, `.tmp-${ref.imageId}-${randomUUID()}`);
  if (!inside(root, finalDirectory) || !inside(root, temporaryDirectory)) throw new Error('invalid session image path');
  try {
    await mkdir(temporaryDirectory, { recursive: false });
    await writeFile(join(temporaryDirectory, fileName(ref.mediaType)), data, { flag: 'wx' });
    await writeFile(
      join(temporaryDirectory, 'manifest.json'),
      `${JSON.stringify(manifestFor(ref), null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    try {
      await rename(temporaryDirectory, finalDirectory);
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'ENOTEMPTY') throw error;
      await rm(temporaryDirectory, { recursive: true, force: true });
      await verifyExisting(finalDirectory, ref, data);
      return false;
    }
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/** Publish a validated image batch beneath `session-<id>/artifacts/images/<sha256>`. */
export async function publishSessionImages(
  owner: SessionImageOwner,
  inputs: readonly SessionImageInput[],
  signal: AbortSignal,
): Promise<Array<{ ref: SessionImageRef; token: string }>> {
  signal.throwIfAborted();
  if (!isAbsolute(owner.directory)) throw new Error('session image owner directory must be absolute');
  const root = resolve(owner.directory, ARTIFACT_SUBDIR);
  if (!inside(owner.directory, root)) throw new Error('invalid session image artifact root');
  await mkdir(root, { recursive: true });
  const prepared = inputs.map((input) => {
    const detected = detectImageMediaType(input.data);
    if (detected === undefined || detected !== input.mediaType) {
      throw new Error('session image media type does not match its bytes');
    }
    const dimensions = inspectImageDimensions(input.data);
    const ref: SessionImageRef = {
      kind: 'dsh-session-image',
      version: 1,
      sessionId: owner.sessionId,
      imageId: sha256(input.data),
      mediaType: input.mediaType,
      bytes: input.data.byteLength,
      ...dimensions,
      ...(input.name === undefined ? {} : { name: input.name }),
    };
    return { ref, data: input.data };
  });
  const created: string[] = [];
  try {
    for (const item of prepared) {
      signal.throwIfAborted();
      if (await publishOne(root, item.ref, item.data)) created.push(resolve(root, item.ref.imageId));
    }
  } catch (error) {
    await Promise.all(created.map((directory) => rm(directory, { recursive: true, force: true }).catch(() => {})));
    throw error;
  }
  return prepared.map(({ ref }) => ({ ref, token: encodeSessionImageRef(ref) }));
}

/** Resolve and verify one session image without trusting token-controlled paths. */
export async function readSessionImage(
  ref: SessionImageRef,
  resolveSessionDirectory: ResolveSessionDirectory,
  signal: AbortSignal,
  maxBytes: number,
): Promise<StoredSessionImage> {
  signal.throwIfAborted();
  if (ref.bytes > maxBytes) throw new Error(`session image exceeds the ${String(maxBytes)} byte limit`);
  const sessionDirectory = await resolveSessionDirectory(ref.sessionId, signal);
  if (sessionDirectory === undefined || !isAbsolute(sessionDirectory)) throw new Error('session image owner was not found');
  const root = resolve(sessionDirectory, ARTIFACT_SUBDIR, ref.imageId);
  const candidate = resolve(root, fileName(ref.mediaType));
  if (!inside(sessionDirectory, root) || !inside(root, candidate)) throw new Error('invalid session image path');
  const info = await stat(candidate);
  if (!info.isFile() || info.size !== ref.bytes || info.size > maxBytes) throw new Error('session image metadata mismatch');
  const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
  if (!inside(realRoot, realCandidate)) throw new Error('invalid session image path');
  await verifyExisting(realRoot, ref);
  signal.throwIfAborted();
  const data = new Uint8Array(await readFile(realCandidate));
  signal.throwIfAborted();
  if (data.byteLength !== ref.bytes || sha256(data) !== ref.imageId) throw new Error('session image digest mismatch');
  if (detectImageMediaType(data) !== ref.mediaType) throw new Error('session image media type mismatch');
  const dimensions = inspectImageDimensions(data);
  if (dimensions.width !== ref.width || dimensions.height !== ref.height) {
    throw new Error('session image dimensions mismatch');
  }
  return { ref, token: encodeSessionImageRef(ref), data };
}
