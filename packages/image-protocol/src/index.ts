/** Image-specific protocol layered on the provider-neutral resource core. */
import type {
  AttachmentIdType,
  ImageAttachmentRef,
  ImageMediaType,
} from '@deepseek-ai/dsh-attachment';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { renderResourceTextFallback } from '@dfy-plugins/resource-core';

export const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

const ATTACHMENT_ID_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MAX_REFERENCE_LENGTH = 2048;
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;
const IMAGE_ID_PATTERN = /^[a-f0-9]{64}$/;
const SESSION_IMAGE_KIND = 'dsh-session-image';

export interface SerializableImageAttachmentRef {
  attachmentId: string;
  mediaType: ImageMediaType;
  bytes: number;
  width: number;
  height: number;
  name?: string;
}

/** Durable metadata for one immutable image owned by a DSH session directory. */
export interface SessionImageRef {
  kind: typeof SESSION_IMAGE_KIND;
  version: 1;
  sessionId: string;
  imageId: string;
  mediaType: ImageMediaType;
  bytes: number;
  width: number;
  height: number;
  name?: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageResultDescriptor {
  mimeType: ImageMediaType;
  bytes: number;
  width: number;
  height: number;
  name?: string;
  path?: string;
  sourceUrl?: string;
  capturedAt?: string;
  resourceRef?: string;
  attachment?: SerializableImageAttachmentRef;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validDisplayName(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 255
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function isImageMediaType(value: unknown): value is ImageMediaType {
  return typeof value === 'string' && (IMAGE_MEDIA_TYPES as readonly string[]).includes(value);
}

export function detectImageMediaType(data: Uint8Array): ImageMediaType | undefined {
  if (data.length >= 8
    && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
    && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return 'image/png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 6
    && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38
    && (data[4] === 0x37 || data[4] === 0x39) && data[5] === 0x61) return 'image/gif';
  if (data.length >= 12
    && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return 'image/webp';
  return undefined;
}

function uint16BigEndian(data: Uint8Array, offset: number): number {
  return data[offset]! * 0x100 + data[offset + 1]!;
}

function uint16LittleEndian(data: Uint8Array, offset: number): number {
  return data[offset]! + data[offset + 1]! * 0x100;
}

function uint24LittleEndian(data: Uint8Array, offset: number): number {
  return data[offset]! + data[offset + 1]! * 0x100 + data[offset + 2]! * 0x10000;
}

function uint32BigEndian(data: Uint8Array, offset: number): number {
  return data[offset]! * 0x1000000
    + data[offset + 1]! * 0x10000
    + data[offset + 2]! * 0x100
    + data[offset + 3]!;
}

/** Read intrinsic dimensions from an already validated PNG, JPEG, WebP, or GIF. */
export function inspectImageDimensions(data: Uint8Array): ImageDimensions {
  const mediaType = detectImageMediaType(data);
  if (mediaType === 'image/png') {
    if (data.length < 24 || Buffer.from(data.subarray(12, 16)).toString('ascii') !== 'IHDR') {
      throw new Error('PNG dimensions are invalid');
    }
    const width = uint32BigEndian(data, 16);
    const height = uint32BigEndian(data, 20);
    if (!positiveInteger(width) || !positiveInteger(height)) throw new Error('PNG dimensions are invalid');
    return { width, height };
  }
  if (mediaType === 'image/gif') {
    if (data.length < 10) throw new Error('GIF dimensions are invalid');
    const width = uint16LittleEndian(data, 6);
    const height = uint16LittleEndian(data, 8);
    if (!positiveInteger(width) || !positiveInteger(height)) throw new Error('GIF dimensions are invalid');
    return { width, height };
  }
  if (mediaType === 'image/jpeg') {
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 3 < data.length) {
      while (offset < data.length && data[offset] !== 0xff) offset += 1;
      while (offset < data.length && data[offset] === 0xff) offset += 1;
      if (offset >= data.length) break;
      const marker = data[offset++]!;
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= data.length) break;
      const segmentLength = uint16BigEndian(data, offset);
      if (segmentLength < 2 || offset + segmentLength > data.length) break;
      if (startOfFrame.has(marker)) {
        if (segmentLength < 7) break;
        const height = uint16BigEndian(data, offset + 3);
        const width = uint16BigEndian(data, offset + 5);
        if (!positiveInteger(width) || !positiveInteger(height)) break;
        return { width, height };
      }
      offset += segmentLength;
    }
    throw new Error('JPEG dimensions are invalid');
  }
  if (mediaType === 'image/webp') {
    if (data.length < 30) throw new Error('WebP dimensions are invalid');
    const chunk = Buffer.from(data.subarray(12, 16)).toString('ascii');
    let width: number;
    let height: number;
    if (chunk === 'VP8X') {
      width = uint24LittleEndian(data, 24) + 1;
      height = uint24LittleEndian(data, 27) + 1;
    } else if (chunk === 'VP8L') {
      if (data[20] !== 0x2f) throw new Error('WebP dimensions are invalid');
      width = 1 + (((data[22]! & 0x3f) << 8) | data[21]!);
      height = 1 + (((data[24]! & 0x0f) << 10) | (data[23]! << 2) | ((data[22]! & 0xc0) >> 6));
    } else if (chunk === 'VP8 ') {
      if (data[23] !== 0x9d || data[24] !== 0x01 || data[25] !== 0x2a) {
        throw new Error('WebP dimensions are invalid');
      }
      width = uint16LittleEndian(data, 26) & 0x3fff;
      height = uint16LittleEndian(data, 28) & 0x3fff;
    } else {
      throw new Error('WebP dimensions are invalid');
    }
    if (!positiveInteger(width) || !positiveInteger(height)) throw new Error('WebP dimensions are invalid');
    return { width, height };
  }
  throw new Error('unsupported image format');
}

export function imageMediaTypeForPath(filePath: string): ImageMediaType | undefined {
  const match = /\.[^./\\]+$/.exec(filePath.trim());
  if (match === null) return undefined;
  if (match[0].toLowerCase() === '.png') return 'image/png';
  if (['.jpg', '.jpeg'].includes(match[0].toLowerCase())) return 'image/jpeg';
  if (match[0].toLowerCase() === '.webp') return 'image/webp';
  if (match[0].toLowerCase() === '.gif') return 'image/gif';
  return undefined;
}

export function serializeImageAttachmentRef(ref: ImageAttachmentRef | SerializableImageAttachmentRef): SerializableImageAttachmentRef {
  return {
    attachmentId: String(ref.attachmentId),
    mediaType: ref.mediaType,
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
    ...(ref.name === undefined ? {} : { name: ref.name }),
  };
}

export function encodeImageAttachmentRef(ref: ImageAttachmentRef | SerializableImageAttachmentRef): string {
  return Buffer.from(JSON.stringify(serializeImageAttachmentRef(ref)), 'utf8').toString('base64url');
}

export function decodeImageAttachmentRef(token: string): ImageAttachmentRef {
  const value = token.trim();
  if (value.length === 0 || value.length > MAX_REFERENCE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('image reference is invalid');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new Error('image reference is invalid');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('image reference is invalid');
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.attachmentId !== 'string'
    || !ATTACHMENT_ID_PATTERN.test(record.attachmentId)
    || !isImageMediaType(record.mediaType)
    || !positiveInteger(record.bytes)
    || !positiveInteger(record.width)
    || !positiveInteger(record.height)
    || (record.name !== undefined && (typeof record.name !== 'string' || record.name.length > 255))
    || Object.keys(record).some((key) => !['attachmentId', 'mediaType', 'bytes', 'width', 'height', 'name'].includes(key))) {
    throw new Error('image reference is invalid');
  }
  return {
    attachmentId: record.attachmentId as AttachmentIdType,
    mediaType: record.mediaType,
    bytes: record.bytes,
    width: record.width,
    height: record.height,
    ...(typeof record.name === 'string' ? { name: record.name } : {}),
  };
}

export function encodeSessionImageRef(ref: SessionImageRef): string {
  return Buffer.from(JSON.stringify(ref), 'utf8').toString('base64url');
}

export function decodeSessionImageRef(token: string): SessionImageRef {
  const value = token.trim();
  if (value.length === 0 || value.length > MAX_REFERENCE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('session image reference is invalid');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new Error('session image reference is invalid');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('session image reference is invalid');
  }
  const record = parsed as Record<string, unknown>;
  if (record.kind !== SESSION_IMAGE_KIND
    || record.version !== 1
    || typeof record.sessionId !== 'string'
    || !SESSION_ID_PATTERN.test(record.sessionId)
    || typeof record.imageId !== 'string'
    || !IMAGE_ID_PATTERN.test(record.imageId)
    || !isImageMediaType(record.mediaType)
    || !positiveInteger(record.bytes)
    || !positiveInteger(record.width)
    || !positiveInteger(record.height)
    || (record.name !== undefined && !validDisplayName(record.name))
    || Object.keys(record).some((key) => ![
      'kind', 'version', 'sessionId', 'imageId', 'mediaType', 'bytes', 'width', 'height', 'name',
    ].includes(key))) {
    throw new Error('session image reference is invalid');
  }
  return {
    kind: SESSION_IMAGE_KIND,
    version: 1,
    sessionId: record.sessionId,
    imageId: record.imageId,
    mediaType: record.mediaType,
    bytes: record.bytes,
    width: record.width,
    height: record.height,
    ...(typeof record.name === 'string' ? { name: record.name } : {}),
  };
}

export function createOfficialImageBlock(ref: ImageAttachmentRef): ContentBlock {
  return { type: 'image', attachment: ref };
}

export function renderImageTextFallback(image: ImageResultDescriptor): string {
  const base = renderResourceTextFallback({
    kind: 'image',
    ...(image.name === undefined ? {} : { name: image.name }),
    mediaType: image.mimeType,
    bytes: image.bytes,
    ...(image.path === undefined ? {} : { path: image.path }),
    ...(image.sourceUrl === undefined ? {} : { url: image.sourceUrl }),
  });
  const details = [
    `Dimensions: ${String(image.width)}x${String(image.height)}`,
    ...(image.capturedAt === undefined ? [] : [`Captured at: ${image.capturedAt}`]),
    ...(image.resourceRef === undefined ? [] : [`Resource reference: ${image.resourceRef}`]),
  ];
  return `${base}\n${details.join('\n')}`;
}
