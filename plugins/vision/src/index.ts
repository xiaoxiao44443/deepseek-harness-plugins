/** @dfy-plugins/dsh-vision Host half: isolated visual inference, tool, Skill, settings, and route discovery. */
import type { Context } from '@deepseek-ai/cordis';
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment';
import { BlockAssembler, createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import type { LlmModelInfo, LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-fs';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import type {} from '@deepseek-ai/dsh-skill';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { GenericCallView, ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { IncomingMessage } from 'node:http';
import z from '@deepseek-ai/schemastery';
import type MediaBlocks from '@dfy-plugins/dsh-media-blocks';

import {
  decodeImageRef,
  encodeImageRef,
  imageMediaTypeForPath,
  renderVisionResult,
  textFromBlocks,
  visionConfigurationUnavailable,
  visionModelUnsupported,
  VISION_SKILL_CONTENT,
  VISION_SYSTEM_PROMPT,
  VISION_TOOL_DESCRIPTION,
  type VisionUnavailableState,
  type VisionResultValue,
} from './logic.js';

export const name = 'vision';
export const inject = ['llm', 'tools', 'fs', 'attachments', 'skills'];

export interface Config {
  enabled?: boolean;
  provider?: string;
  model?: string;
  reasoningEffort?: string;
  maxTokens?: number;
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(false),
  provider: z.string().default(''),
  model: z.string().default(''),
  reasoningEffort: z.string().default(''),
  maxTokens: z.number().step(1).min(64).max(8192).default(1024),
});

const SETTINGS_NS = settingsNamespace('dsh-vision');
const API_PATH = '/api/dsh-vision/routes';
const TOOL_NAME = 'dfy_vision_analyze';
const SKILL_NAME = 'dfy-vision';
const DEFAULT_MAX_TOKENS = 1024;

interface ResolvedConfig {
  enabled: boolean;
  provider: string;
  model: string;
  reasoningEffort: string;
  maxTokens: number;
}

type Activation =
  | VisionUnavailableState
  | { status: 'checking' }
  | { status: 'active'; provider: string; model: string }
  | { status: 'error'; message: string };

interface VisionModelView {
  id: string;
  name: string;
  reasoning?: {
    efforts: { id: string; name: string; description?: string }[];
    defaultEffort?: string;
  };
}

interface VisionProviderView {
  id: string;
  name: string;
  models: VisionModelView[];
}

interface ResolvedToolImage {
  label: string;
  ref: ImageAttachmentRef;
}

class UploadTooLargeError extends Error {}

function requestImageMediaType(req: IncomingMessage): ImageMediaType | undefined {
  const header = req.headers['content-type'];
  const value = (Array.isArray(header) ? header[0] : header)?.split(';', 1)[0]?.trim().toLowerCase();
  if (value === 'image/png' || value === 'image/jpeg' || value === 'image/webp' || value === 'image/gif') return value;
  return undefined;
}

function requestImageName(req: IncomingMessage): string | undefined {
  const header = req.headers['x-dsh-vision-name'];
  const encoded = Array.isArray(header) ? header[0] : header;
  if (encoded === undefined || encoded.length === 0) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

async function readRequestBytes(req: IncomingMessage, limit: number): Promise<Uint8Array> {
  const declared = req.headers['content-length'];
  if (typeof declared === 'string' && /^\d+$/.test(declared) && Number(declared) > limit) {
    req.resume();
    throw new UploadTooLargeError();
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    bytes += buffer.byteLength;
    if (bytes > limit) throw new UploadTooLargeError();
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks, bytes));
}

function resolvedConfig(config: Config): ResolvedConfig {
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  return {
    enabled: config.enabled ?? false,
    provider: config.provider?.trim() ?? '',
    model: config.model?.trim() ?? '',
    reasoningEffort: config.reasoningEffort?.trim() ?? '',
    maxTokens: Number.isSafeInteger(maxTokens) && maxTokens >= 64 && maxTokens <= 8192
      ? maxTokens
      : DEFAULT_MAX_TOKENS,
  };
}

function fileName(displayPath: string): string {
  return displayPath.split(/[\\/]/).filter(Boolean).at(-1) ?? 'image';
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function saveToolImage(
  ctx: Context,
  exec: ToolRunContext,
  requestedPath: string,
): Promise<ResolvedToolImage> {
  const mediaType = imageMediaTypeForPath(requestedPath);
  if (mediaType === undefined) {
    throw new Error(`cannot analyze "${requestedPath}": expected a PNG, JPEG, WebP, or GIF image path`);
  }
  if (!ctx.attachments.imageLimits.mediaTypes.includes(mediaType)) {
    throw new Error(`cannot analyze "${requestedPath}": ${mediaType} is disabled by this deployment`);
  }
  const cwd = exec.agent?.session.header.cwd;
  const target = await ctx.fs.resolve(requestedPath, {
    ...(cwd === undefined ? {} : { cwd }),
    signal: exec.signal,
  });
  const info = await ctx.fs.stat(target, exec.signal);
  if (info === undefined) {
    ctx.emit('fs/observed', target, { kind: 'absent' }, exec);
    throw new Error(`cannot analyze "${target.displayPath}": file not found`);
  }
  if (info.type !== 'file') throw new Error(`cannot analyze "${target.displayPath}": not a regular file`);

  const byteCap = Math.min(
    ctx.attachments.imageLimits.maxImageBytes,
    ctx.attachments.imageLimits.maxMessageImageBytes,
  );
  if (info.size !== undefined && info.size > byteCap) {
    throw new Error(`cannot analyze "${target.displayPath}": image exceeds the ${String(byteCap)} byte limit`);
  }
  const data = await ctx.fs.readBytes(target, exec.signal, byteCap);
  const ref = await ctx.attachments.saveImage({ data, mediaType, name: fileName(target.displayPath) });
  ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec);
  return { label: target.displayPath, ref };
}

async function readReferencedImage(
  ctx: Context,
  exec: ToolRunContext,
  imageRef: string,
): Promise<ResolvedToolImage> {
  const ref = decodeImageRef(imageRef);
  const stored = await ctx.attachments.readImage(ref, exec.signal);
  return {
    label: stored.ref.name === undefined ? String(stored.ref.attachmentId) : `attachment:${stored.ref.name}`,
    ref: stored.ref,
  };
}

async function analyzeImage(
  ctx: Context,
  exec: ToolRunContext,
  config: ResolvedConfig,
  source: { filePath?: string; imageRef?: string },
  question: string,
): Promise<VisionResultValue> {
  const modelInfo = await ctx.llm.resolveModelInfo(config.provider, config.model, exec.signal);
  const unsupported = visionModelUnsupported(config.provider, config.model, modelInfo.inputModalities);
  if (unsupported !== undefined) throw new Error(unsupported.message);
  const filePath = source.filePath?.trim() ?? '';
  const imageRef = source.imageRef?.trim() ?? '';
  if ((filePath.length === 0) === (imageRef.length === 0)) {
    throw new Error('provide exactly one of file_path or image_ref');
  }
  const image = filePath.length > 0
    ? await saveToolImage(ctx, exec, filePath)
    : await readReferencedImage(ctx, exec, imageRef);
  const prompt = question.trim();
  if (prompt.length === 0) throw new Error('question must be a non-empty string');

  const message = createUserMessage({
    source: { kind: 'plugin', plugin: '@dfy-plugins/dsh-vision' },
    content: [
      { type: 'text', text: prompt },
      { type: 'image', attachment: image.ref },
    ],
  });
  const assembler = new BlockAssembler();
  for await (const chunk of ctx.llm.stream({
    provider: config.provider,
    model: config.model,
    ...(config.reasoningEffort.length === 0 ? {} : { reasoningEffort: ReasoningEffortId(config.reasoningEffort) }),
    messages: [message],
    system: VISION_SYSTEM_PROMPT,
    maxTokens: config.maxTokens,
    signal: exec.signal,
  })) {
    assembler.push(chunk);
  }
  const finish = assembler.finish;
  if (finish.kind === 'error' || finish.kind === 'aborted') {
    throw new Error(`visual model call failed (${finish.failure.code}): ${finish.failure.message}`);
  }
  const analysis = textFromBlocks(assembler.blocks());
  if (analysis.length === 0) throw new Error('visual model returned no text analysis');
  return {
    path: image.label,
    provider: config.provider,
    model: config.model,
    analysis,
    finishReason: finish.kind,
    image: {
      mediaType: image.ref.mediaType,
      bytes: image.ref.bytes,
      width: image.ref.width,
      height: image.ref.height,
    },
  };
}

function createVisionTool(ctx: Context, current: () => Config) {
  return defineTool({
    name: TOOL_NAME,
    description: VISION_TOOL_DESCRIPTION,
    parameters: {
      file_path: {
        type: 'string',
        description: 'Image path, resolved relative to the current session workspace. Use either file_path or image_ref.',
      },
      image_ref: {
        type: 'string',
        description: 'Opaque token copied from inside <image_ref>...</image_ref>, without XML quotes or tags. Use either image_ref or file_path.',
      },
      question: {
        type: 'string',
        required: true,
        description: 'Focused question for the visual model, including desired UI details or coordinates.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          provider: { type: 'string', required: true },
          model: { type: 'string', required: true },
          analysis: { type: 'string', required: true },
          finishReason: { type: 'string', required: true },
          image: {
            type: 'object',
            required: true,
            additionalProperties: false,
            properties: {
              mediaType: { type: 'string', required: true },
              bytes: { type: 'integer', required: true },
              width: { type: 'integer', required: true },
              height: { type: 'integer', required: true },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderVisionResult(value as VisionResultValue) }],
    },
    isConcurrencySafe: () => true,
    execute: async (args, exec) => analyzeImage(ctx, exec, resolvedConfig(current()), {
      ...(args.file_path === undefined ? {} : { filePath: args.file_path }),
      ...(args.image_ref === undefined ? {} : { imageRef: args.image_ref }),
    }, args.question),
    presentCall(args): GenericCallView {
      const label = args.file_path ?? 'attached image';
      return {
        card: 'generic',
        title: 'DFY VISION ANALYZE',
        kind: 'read',
        ...(args.file_path === undefined ? {} : { locations: [{ path: args.file_path }] }),
      };
    },
  });
}

function sendJson(res: Parameters<WebRoute['handler']>[1], status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function listVisionProviders(ctx: Context, current: ResolvedConfig): Promise<VisionProviderView[]> {
  const providers: VisionProviderView[] = [];
  for (const provider of ctx.llm.listProviders()) {
    let catalog: LlmModelInfo[];
    try {
      catalog = await ctx.llm.listModels(provider.id);
    } catch {
      catalog = [];
    }
    const models: VisionModelView[] = [];
    for (const model of catalog) {
      try {
        const exact = await ctx.llm.resolveModelInfo(provider.id, model.id);
        if (exact.inputModalities?.includes('image')) models.push(visionModelView(exact));
      } catch {
        if (model.inputModalities?.includes('image')) models.push({ id: model.id, name: model.name });
      }
    }
    if (provider.id === current.provider && current.model.length > 0 && !models.some((model) => model.id === current.model)) {
      try {
        const exact = await ctx.llm.resolveModelInfo(provider.id, current.model);
        if (exact.inputModalities?.includes('image')) models.push(visionModelView(exact));
      } catch {
        // A stale configured route is represented by activation, not as a selectable model.
      }
    }
    if (models.length > 0) providers.push({ id: provider.id, name: provider.name, models });
  }
  return providers;
}

function visionModelView(model: LlmResolvedModelInfo): VisionModelView {
  return {
    id: model.id,
    name: model.name,
    ...(model.reasoning === undefined ? {} : {
      reasoning: {
        efforts: model.reasoning.efforts.map((effort) => ({
          id: effort.id,
          name: effort.name,
          ...(effort.description === undefined ? {} : { description: effort.description }),
        })),
        ...(model.reasoning.defaultEffort === undefined ? {} : { defaultEffort: model.reasoning.defaultEffort }),
      },
    }),
  };
}

export function apply(ctx: Context, entryConfig: Config): void {
  let source = () => entryConfig;
  let activation: Activation = { status: 'unconfigured', message: '尚未配置视觉提供方和模型，视觉分析不可用' };
  let generation = 0;
  let disposeTool: (() => void) | undefined;
  let disposeSkill: (() => void) | undefined;
  let disposeReferenceAdapter: (() => void) | undefined;
  let mediaBlocks: MediaBlocks | undefined;
  let mediaBinding: symbol | undefined;

  const clearRuntimeFeatures = (): void => {
    disposeSkill?.();
    disposeTool?.();
    disposeSkill = undefined;
    disposeTool = undefined;
  };

  const ensureFeatures = (): void => {
    if (disposeSkill !== undefined && disposeTool !== undefined) return;
    clearRuntimeFeatures();
    try {
      disposeTool = ctx.tools.register(createVisionTool(ctx, source));
      disposeSkill = ctx.skills.register({
        name: SKILL_NAME,
        description: '使用独立视觉模型分析图片或界面截图，并把文本观察返回给当前文本模型。',
        source: 'runtime',
        content: VISION_SKILL_CONTENT,
        invocation: { modelInvocable: true, userInvocable: true },
      });
    } catch (error) {
      clearRuntimeFeatures();
      throw error;
    }
  };

  const refresh = async (): Promise<void> => {
    const ticket = ++generation;
    const config = resolvedConfig(source());
    const unavailable = visionConfigurationUnavailable(config);
    if (unavailable !== undefined) {
      clearRuntimeFeatures();
      activation = unavailable;
      return;
    }
    activation = { status: 'checking' };
    try {
      const modelInfo = await ctx.llm.resolveModelInfo(config.provider, config.model);
      if (ticket !== generation) return;
      const unsupported = visionModelUnsupported(config.provider, config.model, modelInfo.inputModalities);
      if (unsupported !== undefined) {
        clearRuntimeFeatures();
        activation = unsupported;
        return;
      }
      if (config.reasoningEffort.length > 0
        && !modelInfo.reasoning?.efforts.some((effort) => effort.id === config.reasoningEffort)) {
        clearRuntimeFeatures();
        activation = { status: 'error', message: `${config.provider}/${config.model} 不支持推理等级 ${config.reasoningEffort}` };
        return;
      }
      try {
        // Model and settings refreshes are asynchronous. Retain the current
        // working registrations while validation is in flight so switching a
        // chat model cannot create a transient VISION_ROUTE_UNAVAILABLE gap.
        ensureFeatures();
        activation = { status: 'active', provider: config.provider, model: config.model };
      } catch (error) {
        activation = { status: 'error', message: String(error) };
      }
    } catch (error) {
      if (ticket !== generation) return;
      activation = { status: 'error', message: String(error) };
    }
  };

  // Keep bundle order irrelevant: vision may be listed before media-blocks in
  // an existing Profile. Cordis reruns this scoped callback when the service
  // appears and disposes the adapter if it disappears.
  ctx.inject(['mediaBlocks'], (mediaCtx) => {
    const target = mediaCtx.mediaBlocks;
    const binding = Symbol('dsh-vision:media-blocks');
    mediaBinding = binding;
    disposeReferenceAdapter?.();
    mediaBlocks = target;
    disposeReferenceAdapter = target.registerReferenceAdapter('image', ({ block, options, supportsImages }) => {
      if (supportsImages) return undefined;
      if (options.purpose !== undefined) return undefined;
      if (!options.tools?.some((tool) => tool.name === TOOL_NAME)) return undefined;
      if (block.resource.kind !== 'image') return undefined;
      const name = block.presentation?.name ?? block.resource.attachment.name ?? 'image';
      return [{
        type: 'text',
        text: `<vision_image name="${escapeXmlAttribute(name)}"><image_ref>${block.resource.ref}</image_ref>The image pixels are stored outside this text context. Before analyzing this image, load the ${SKILL_NAME} Skill and follow its instructions for this image reference, then answer the user's request from the tool result.</vision_image>`,
      }];
    }, {
      prepare: async () => {
        const config = resolvedConfig(source());
        if (!config.enabled || config.provider.length === 0 || config.model.length === 0) return false;
        if (disposeTool === undefined || disposeSkill === undefined) await refresh();
        return disposeTool !== undefined && disposeSkill !== undefined;
      },
    });
    void refresh();
    mediaCtx.effect(() => () => {
      if (mediaBinding !== binding) return;
      mediaBinding = undefined;
      mediaBlocks = undefined;
      generation += 1;
      disposeReferenceAdapter?.();
      disposeReferenceAdapter = undefined;
      clearRuntimeFeatures();
      activation = { status: 'error', message: '媒体块服务已停止' };
    }, 'dsh-vision: media blocks dependency');
  });

  void refresh();
  // Keep the last resolved user settings while the settings provider itself is
  // rebound. The canonical optional-settings helper falls back to entryConfig
  // during that gap; for this plugin an empty entry temporarily means
  // `enabled: false`, which used to unregister the visual route whenever a
  // model/provider switch rebuilt the settings service.
  ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(SETTINGS_NS, Config, { base: entryConfig });
    let latest = scope.get();
    source = () => latest;
    void refresh();
    scope.watch((next) => {
      latest = next;
      void refresh();
    });
  });

  ctx.inject(['webServer'], (webCtx) => {
    const routesRoute: WebRoute = {
      kind: 'exact',
      path: API_PATH,
      async handler(req, res) {
        if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
        try {
          if (activation.status === 'checking' || activation.status === 'error') await refresh();
          const config = resolvedConfig(source());
          sendJson(res, 200, {
            providers: await listVisionProviders(ctx, config),
            activation,
            mediaBlocks: mediaBlocks?.status(),
          });
        } catch (error) {
          sendJson(res, 500, { error: String(error) });
        }
      },
    };
    webCtx.webServer.register(routesRoute);
  });

  ctx.effect(() => () => {
    generation += 1;
    mediaBinding = undefined;
    disposeReferenceAdapter?.();
    disposeReferenceAdapter = undefined;
    clearRuntimeFeatures();
  }, 'dsh-vision: dynamic tool and skill');
}
