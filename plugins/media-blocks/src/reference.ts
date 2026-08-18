import { AttachmentId } from '@deepseek-ai/dsh-attachment';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';

const ATTACHMENT_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MAX_REFERENCE_LENGTH = 2048;

/** Opaque, portable reference to an image stored by Harness. */
export function encodeMediaImageRef(ref: ImageAttachmentRef): string {
  return Buffer.from(JSON.stringify({
    attachmentId: String(ref.attachmentId),
    mediaType: ref.mediaType,
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
    ...(ref.name === undefined ? {} : { name: ref.name }),
  }), 'utf8').toString('base64url');
}

/** Validate and decode a reference created by {@link encodeMediaImageRef}. */
export function decodeMediaImageRef(token: string): ImageAttachmentRef {
  const value = token.trim();
  if (value.length === 0 || value.length > MAX_REFERENCE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('media image reference is invalid');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new Error('media image reference is invalid');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('media image reference is invalid');
  }
  const record = parsed as Record<string, unknown>;
  const mediaType = record.mediaType;
  const validType = mediaType === 'image/png' || mediaType === 'image/jpeg'
    || mediaType === 'image/webp' || mediaType === 'image/gif';
  const positive = (candidate: unknown): candidate is number =>
    typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate > 0;
  if (
    typeof record.attachmentId !== 'string'
    || !ATTACHMENT_ID_PATTERN.test(record.attachmentId)
    || !validType
    || !positive(record.bytes)
    || !positive(record.width)
    || !positive(record.height)
    || (record.name !== undefined && (typeof record.name !== 'string' || record.name.length > 255))
  ) {
    throw new Error('media image reference is invalid');
  }
  return {
    attachmentId: AttachmentId(record.attachmentId),
    mediaType,
    bytes: record.bytes,
    width: record.width,
    height: record.height,
    ...(typeof record.name === 'string' ? { name: record.name } : {}),
  };
}
