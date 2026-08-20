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

export interface SerializableImageAttachmentRef {
  attachmentId: string;
  mediaType: ImageMediaType;
  bytes: number;
  width: number;
  height: number;
  name?: string;
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
