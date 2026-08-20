import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import {
  decodeImageAttachmentRef,
  encodeImageAttachmentRef,
} from '@dfy-plugins/image-protocol';

/** Opaque, portable reference to an image stored by Harness. */
export function encodeMediaImageRef(ref: ImageAttachmentRef): string {
  return encodeImageAttachmentRef(ref);
}

/** Validate and decode a reference created by {@link encodeMediaImageRef}. */
export function decodeMediaImageRef(token: string): ImageAttachmentRef {
  try {
    return decodeImageAttachmentRef(token);
  } catch {
    throw new Error('media image reference is invalid');
  }
}
