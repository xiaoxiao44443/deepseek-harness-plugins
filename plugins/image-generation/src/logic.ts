import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';

export const IMAGE_QUALITIES = ['auto', 'low', 'medium', 'high'] as const;
export type ImageQuality = typeof IMAGE_QUALITIES[number];

export type ImageOperation = 'generate' | 'edit';

export interface ImageApiItem {
  b64Json?: string;
  url?: string;
  revisedPrompt?: string;
}

export interface GeneratedImageValue {
  ref: string;
  attachment: {
    attachmentId: string;
    mediaType: ImageMediaType;
    bytes: number;
    width: number;
    height: number;
    name?: string;
  };
}

export interface ImageGenerationValue {
  operation: ImageOperation;
  model: string;
  quality: ImageQuality;
  size: string;
  images: GeneratedImageValue[];
}

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error('image API base URL is required');
  let url: URL;
  try {
    url = new URL(trimmed.endsWith('/') ? trimmed : `${trimmed}/`);
  } catch {
    throw new Error('image API base URL is invalid');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('image API base URL must use http or https');
  }
  return url.toString().replace(/\/$/, '');
}

export function imageApiEndpoint(baseUrl: string, operation: ImageOperation): string {
  const root = `${normalizeBaseUrl(baseUrl)}/`;
  return new URL(operation === 'generate' ? 'images/generations' : 'images/edits', root).toString();
}

export function parseImageQuality(value: string): ImageQuality {
  const normalized = value.trim().toLowerCase();
  if ((IMAGE_QUALITIES as readonly string[]).includes(normalized)) return normalized as ImageQuality;
  throw new Error(`unsupported image quality: ${value}`);
}

export function validateImageSize(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'auto') return normalized;
  const match = /^(\d+)x(\d+)$/.exec(normalized);
  if (match === null) throw new Error('image size must be auto or WIDTHxHEIGHT');
  const width = Number(match[1]);
  const height = Number(match[2]);
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const pixels = width * height;
  if (width % 16 !== 0 || height % 16 !== 0) throw new Error('image size edges must be multiples of 16');
  if (long > 3840) throw new Error('image size maximum edge is 3840px');
  if (long / short > 3) throw new Error('image aspect ratio must not exceed 3:1');
  if (pixels < 655_360 || pixels > 8_294_400) {
    throw new Error('image size must contain 655360 to 8294400 pixels');
  }
  return `${String(width)}x${String(height)}`;
}

export function parseImageApiResponse(value: unknown): ImageApiItem[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('image API returned an invalid response');
  }
  const data = (value as Record<string, unknown>).data;
  if (!Array.isArray(data) || data.length === 0) throw new Error('image API returned no images');
  return data.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error(`image API item ${String(index + 1)} is invalid`);
    }
    const record = item as Record<string, unknown>;
    const b64Json = typeof record.b64_json === 'string' && record.b64_json.length > 0
      ? record.b64_json
      : undefined;
    const url = typeof record.url === 'string' && record.url.length > 0 ? record.url : undefined;
    if (b64Json === undefined && url === undefined) {
      throw new Error(`image API item ${String(index + 1)} contains neither b64_json nor url`);
    }
    return {
      ...(b64Json === undefined ? {} : { b64Json }),
      ...(url === undefined ? {} : { url }),
      ...(typeof record.revised_prompt === 'string' ? { revisedPrompt: record.revised_prompt } : {}),
    };
  });
}

export function decodeImageBase64(value: string): Uint8Array {
  const normalized = value.trim();
  if (normalized.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error('image API returned invalid base64 data');
  }
  const bytes = Buffer.from(normalized, 'base64');
  const canonical = bytes.toString('base64').replace(/=+$/, '');
  if (bytes.length === 0 || canonical !== normalized.replace(/=+$/, '')) {
    throw new Error('image API returned invalid base64 data');
  }
  return new Uint8Array(bytes);
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function renderImageGenerationResult(value: ImageGenerationValue): string {
  const lines = [
    `<image_generation_result operation="${value.operation}" model="${escapeAttribute(value.model)}" quality="${value.quality}" size="${escapeAttribute(value.size)}">`,
  ];
  for (const image of value.images) {
    lines.push(
      `  <generated_image image_ref="${escapeAttribute(image.ref)}" media_type="${image.attachment.mediaType}" width="${String(image.attachment.width)}" height="${String(image.attachment.height)}"${image.attachment.name === undefined ? '' : ` name="${escapeAttribute(image.attachment.name)}"`} />`,
    );
  }
  lines.push('</image_generation_result>');
  return lines.join('\n');
}

export const IMAGE_GENERATION_SKILL_CONTENT = `# Image generation and editing

Use this Skill before every call to \`dfy_image_generate\`. The tool uses a dedicated image route; it does not change the parent conversation model.

## Choose the operation

- With no input images, generate a new image.
- With one or more \`input_image_refs\` or \`input_file_paths\`, edit, compose, restyle, or continue from those images.
- Treat an image as a reference rather than an edit target unless the user explicitly asks to preserve and change it.
- If unseen pixels must be understood before an edit, load the \`dfy-vision\` Skill and inspect the image first.

## Build the prompt

Normalize the request in this order when useful: intended use, primary request, input image roles, scene, subject, style or medium, composition, lighting, palette, materials, exact text, constraints, and avoid list.

- Preserve every user-provided requirement. Add only practical composition or polish details that materially help a generic request.
- Do not invent extra characters, props, brands, slogans, story beats, or arbitrary left/right placement.
- Put literal in-image text in quotes and require verbatim rendering with no extra characters.
- For edits, state \`change only X; keep Y unchanged\` and repeat identity, layout, lighting, or background invariants on every iteration.
- Label multiple inputs by index and role. For compositing, state what moves where and require matching perspective, scale, lighting, and shadows.
- Prefer one targeted follow-up change at a time instead of rewriting a successful image from scratch.

## Tool arguments

- \`prompt\` is required and should be a clean image brief, not conversational filler.
- Omit \`quality\` and \`size\` to use the plugin defaults. Use \`low\` for drafts; use \`medium\`, \`high\`, or \`auto\` for final assets.
- \`size\` may be \`auto\` or a valid \`WIDTHxHEIGHT\`. Useful values include \`1024x1024\`, \`1536x1024\`, \`1024x1536\`, \`2048x2048\`, \`2048x1152\`, \`3840x2160\`, and \`2160x3840\`.
- Copy opaque attachment tokens unchanged into \`input_image_refs\`. Use \`input_file_paths\` only for images already in the session workspace.
- Keep \`count\` at 1 unless the user asks for alternatives.

The result contains durable \`image_ref\` values and the Harness UI displays the images. Report what was generated or changed; do not claim success before the tool returns.`;
