import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { decodeMediaImageRef, encodeMediaImageRef } from '@dfy-plugins/dsh-media-blocks';

const IMAGE_TYPES: Readonly<Record<string, ImageMediaType>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export interface VisionResultValue {
  path: string;
  provider: string;
  model: string;
  analysis: string;
  finishReason: string;
  image: {
    mediaType: ImageMediaType;
    bytes: number;
    width: number;
    height: number;
  };
}

export function imageMediaTypeForPath(filePath: string): ImageMediaType | undefined {
  const match = /\.[^./\\]+$/.exec(filePath.trim());
  return match === null ? undefined : IMAGE_TYPES[match[0].toLowerCase()];
}

/** Compatibility alias; the media-blocks plugin owns the reference format. */
export function encodeImageRef(ref: ImageAttachmentRef): string {
  return encodeMediaImageRef(ref);
}

/** Compatibility alias with the vision tool's existing validation message. */
export function decodeImageRef(token: string): ImageAttachmentRef {
  // Text models occasionally copy the closing quote from `ref="..."` along
  // with the opaque token. Quotes are outside the base64url vocabulary, so a
  // single wrapper/delimiter can be removed without weakening payload checks.
  const trimmed = token.trim();
  const quoted = /^(?:["']([A-Za-z0-9_-]+)["']|([A-Za-z0-9_-]+)["']|["']([A-Za-z0-9_-]+))$/.exec(trimmed);
  const normalized = quoted?.[1] ?? quoted?.[2] ?? quoted?.[3] ?? trimmed;
  try {
    return decodeMediaImageRef(normalized);
  } catch {
    throw new Error('image_ref is invalid');
  }
}

export function textFromBlocks(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text.trim())
    .filter((text) => text.length > 0)
    .join('\n\n');
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function renderVisionResult(value: VisionResultValue): string {
  return [
    `<vision_analysis path="${escapeAttribute(value.path)}" provider="${escapeAttribute(value.provider)}" model="${escapeAttribute(value.model)}" width="${String(value.image.width)}" height="${String(value.image.height)}">`,
    value.analysis,
    '</vision_analysis>',
  ].join('\n');
}

export const VISION_SYSTEM_PROMPT = `You are a visual analysis component inside an agent harness.
Answer only the user's concrete question about the supplied image.
Be precise, concise, and explicit about uncertainty.
For UI screenshots, report visible text, controls, state, and spatial relationships. When coordinates are requested, use pixel coordinates relative to the supplied image dimensions and identify the intended target unambiguously.
Do not claim to have clicked, changed, or executed anything. Do not call tools.`;

export const VISION_SKILL_CONTENT = `# Visual analysis

Use \`dfy_vision_analyze\` when a task depends on pixels that are not already available as reliable text or DOM data.

- A user prompt can contain a \`<vision_image>\` block with an \`<image_ref>...<\/image_ref>\` value. This means an image is available even though the parent model receives no pixels. Copy only the text inside \`<image_ref>\` unchanged into the tool's \`image_ref\` argument.
- For an image already present in the workspace, pass its path as \`file_path\` instead. Supply exactly one of \`image_ref\` and \`file_path\`.
- Prefer existing text, structured page state, or DOM information when it directly answers the question.
- Pass a focused question. State exactly what must be located, read, compared, or verified.
- For interface screenshots, request visible labels, state, and pixel coordinates only when the next operation needs them.
- Treat the result as a model-generated observation: verify consequential details when another source is available.
- The tool sends the selected image to the vision route configured under Settings → Plugins → Visual analysis. It returns text only, so the parent text-model conversation remains image-free.`;
