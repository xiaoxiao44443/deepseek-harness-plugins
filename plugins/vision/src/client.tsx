/** @dfy-plugins/dsh-vision Client half: visual-route settings and Tool presentation. */
import React from 'react';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import {
  IconChevronDownOutline14,
  IconSparkle16,
  Menu,
  StateDot,
  type MenuItem,
} from '@deepseek-ai/dsh-client-ui-primitives';

interface VisionSettings {
  enabled?: boolean;
  provider?: string;
  model?: string;
  reasoningEffort?: string;
  maxTokens?: number;
}

interface SettingsSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable';
  value: T | undefined;
  revision: number | undefined;
  writable: boolean;
}

interface SettingsScope<T> {
  getSnapshot(): SettingsSnapshot<T>;
  subscribe(listener: () => void): () => void;
  set(field: string, value: unknown): Promise<void>;
  unset(field: string): Promise<void>;
}

interface SlotEntryOptions {
  name: string;
  key?: string;
  id?: string;
  order?: number;
  priority?: number;
  inject?: () => unknown;
}

interface ClientCtx {
  effect(setup: () => (() => void), label: string): unknown;
  slots: {
    inject(name: string, register: () => unknown): unknown;
    register(options: SlotEntryOptions, component: unknown): unknown;
  };
  settingsScope: {
    bind<T>(spec: { namespace: string }): SettingsScope<T>;
  };
}

interface ModelView {
  id: string;
  name: string;
  reasoning?: {
    efforts: { id: string; name: string; description?: string }[];
    defaultEffort?: string;
  };
}

interface ProviderView {
  id: string;
  name: string;
  models: ModelView[];
}

type Activation =
  | { status: 'disabled' | 'unconfigured' | 'unsupported'; message: string }
  | { status: 'checking' }
  | { status: 'active'; provider: string; model: string }
  | { status: 'error'; message: string };

interface RoutesResponse {
  providers: ProviderView[];
  activation: Activation;
  error?: string;
}

interface Draft {
  enabled: boolean;
  provider: string;
  model: string;
  reasoningEffort: string;
  maxTokens: number;
}

interface ImageBlock {
  type: 'image';
  attachment: ImageAttachmentRef;
}

export const name = 'vision';
export const inject = ['slots', 'settingsScope'];

const API_PATH = '/api/dsh-vision/routes';
const RESOURCE_API_PATH = '/api/dsh-vision/resource';

const STYLES = `
.dsh-vision-card { overflow: hidden; list-style: none; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); border-radius: 12px; background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,.92)); color: var(--dsw-alias-label-primary, inherit); transition: border-color .16s, background .16s; }
.dsh-vision-card:hover { border-color: var(--dsw-alias-label-dimmed, rgba(127,127,127,.42)); }
.dsh-vision-card[data-open] { border-color: var(--dsw-alias-label-dimmed, rgba(127,127,127,.42)); background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.82)); }
.dsh-vision-head { display: flex; width: 100%; appearance: none; align-items: center; gap: 12px; padding: 14px 16px; border: 0; border-radius: 12px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.dsh-vision-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #298df8); outline-offset: -2px; }
.dsh-vision-head-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4px; }
.dsh-vision-title { font-size: 15px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary, inherit); }
.dsh-vision-description { color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.86)); font-size: 13px; line-height: 1.5; }
.dsh-vision-badge { max-width: 220px; overflow: hidden; padding: 3px 9px; border-radius: 999px; background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.1)); color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; line-height: 1.5; text-overflow: ellipsis; white-space: nowrap; }
.dsh-vision-chevron { flex: none; color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.86)); transition: transform .16s; }
.dsh-vision-chevron[data-open] { transform: rotate(180deg); }
.dsh-vision-body { margin: 0 16px; padding-bottom: 8px; border-top: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); }
.dsh-vision-note { margin: 12px 0; color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.9)); font-size: 12px; line-height: 1.5; }
.dsh-vision-note[data-error] { color: var(--dsw-alias-label-error, #e5484d); }
.dsh-vision-field { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; }
.dsh-vision-field + .dsh-vision-field { border-top: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); }
.dsh-vision-field-head { display: flex; align-items: center; gap: 8px; }
.dsh-vision-label { min-width: 0; flex: 1; color: var(--dsw-alias-label-primary, inherit); font-size: 13px; font-weight: 500; line-height: 1.5; }
.dsh-vision-hint { margin: 0; color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.9)); font-size: 12px; line-height: 1.5; }
.dsh-vision-control, .dsh-vision-select-trigger { box-sizing: border-box; width: 100%; height: 34px; padding: 0 12px; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); border-radius: 8px; background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,.92)); color: var(--dsw-alias-label-primary, inherit); font: inherit; font-size: 13px; line-height: 1.5; }
.dsh-vision-control:focus-visible, .dsh-vision-select-trigger:focus-visible { outline: none; border-color: var(--dsw-alias-brand-primary, #298df8); }
.dsh-vision-control:disabled, .dsh-vision-select-trigger:disabled { color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.86)); cursor: default; }
.dsh-vision-control[type='number'] { appearance: textfield; }
.dsh-vision-control[type='number']::-webkit-inner-spin-button { appearance: none; margin: 0; }
.dsh-vision-select-menu { display: flex; width: 100%; }
.dsh-vision-select-trigger { display: flex; height: 36px; appearance: none; align-items: center; justify-content: space-between; gap: 12px; padding: 0 14px; border: 0; border-radius: 18px; outline: none; background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.08)); text-align: left; cursor: pointer; font-size: 14px; line-height: 22px; }
.dsh-vision-select-trigger:hover:not(:disabled), .dsh-vision-select-trigger[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.1)); }
.dsh-vision-select-trigger:focus-visible { border-color: transparent; box-shadow: 0 0 0 2px var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #298df8)); }
.dsh-vision-select-trigger span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-vision-select-trigger svg { flex: none; }
.dsh-vision-switch { position: relative; width: 32px; height: 20px; flex: none; }
.dsh-vision-switch input { position: absolute; opacity: 0; }
.dsh-vision-switch span { position: absolute; inset: 0; border-radius: 999px; background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.18)); cursor: pointer; transition: background 120ms ease; }
.dsh-vision-switch span::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: white; box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: transform 120ms ease; }
.dsh-vision-switch input:checked + span { background: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #298df8)); }
.dsh-vision-switch input:checked + span::after { transform: translateX(12px); }
.dsh-vision-switch input:focus-visible + span { outline: 2px solid var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #298df8)); outline-offset: 2px; }
.dsh-vision-switch input:disabled + span { cursor: default; opacity: .6; }
.dsh-vision-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 0 4px; border-top: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); }
.dsh-vision-button { appearance: none; padding: 5px 14px; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); border-radius: 8px; background: none; color: var(--dsw-alias-label-secondary, inherit); font: inherit; font-size: 13px; line-height: 1.5; cursor: pointer; }
.dsh-vision-button:hover:not(:disabled) { border-color: var(--dsw-alias-label-dimmed, rgba(127,127,127,.42)); color: var(--dsw-alias-label-primary, inherit); }
.dsh-vision-button[data-primary] { border-color: transparent; background: var(--dsw-alias-label-primary, #111); color: var(--dsw-alias-bg-layer-3, #fff); }
.dsh-vision-button[data-primary]:hover:not(:disabled) { color: var(--dsw-alias-bg-layer-3, #fff); }
.dsh-vision-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #298df8); outline-offset: 2px; }
.dsh-vision-button:disabled { cursor: default; opacity: .4; }
.dsh-vision-input-control { display: inline-flex; align-items: center; }
.dsh-vision-input-file { display: none; }
.dsh-vision-input-button { display: inline-flex; width: 28px; height: 28px; appearance: none; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary, inherit); cursor: pointer; transition: color .15s, background .15s; }
.dsh-vision-input-button:hover:not(:disabled) { background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.1)); color: var(--dsw-alias-label-primary, inherit); }
.dsh-vision-input-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #298df8); outline-offset: 1px; }
.dsh-vision-input-button:disabled { cursor: default; opacity: .4; }
.dsh-vision-input-button[data-uploading] svg { animation: dsh-vision-spin 1s linear infinite; }
.dsh-vision-draft-rail { box-sizing: border-box; min-width: 0; padding: 12px; border: 1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(127,127,127,.18)); border-radius: 18px; background: var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-3, rgba(255,255,255,.92))); box-shadow: var(--dsw-shadow-lv1, 0 2px 8px rgba(0,0,0,.06)); }
.dsh-vision-draft-rail[data-uploading] { opacity: .72; }
.dsh-vision-tool-card { display: flex; flex-direction: column; }
.dsh-vision-tool-row { position: relative; display: flex; min-width: 0; height: 24px; align-items: center; overflow: hidden; }
.dsh-vision-tool-inspect-target { display: inline-flex; min-width: 0; height: 24px; appearance: none; align-items: center; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; }
button.dsh-vision-tool-inspect-target { cursor: pointer; }
.dsh-vision-tool-summary-toggle { display: flex; min-width: 0; max-width: 100%; height: 24px; flex: 0 1 auto; appearance: none; align-items: center; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.dsh-vision-tool-summary-toggle:hover .dsh-vision-tool-summary { color: var(--dsw-alias-label-primary); }
.dsh-vision-tool-inspect-target:focus-visible, .dsh-vision-tool-summary-toggle:focus-visible { border-radius: 4px; outline: 2px solid var(--dsw-alias-brand-primary, #298df8); outline-offset: -1px; }
.dsh-vision-tool-card[data-state='running'] .dsh-vision-tool-row::after { position: absolute; inset: 0 auto 0 0; width: 300px; animation: dsh-vision-tool-sweep 2.6s ease-out infinite; background: linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--dsw-alias-bg-base) 60%, transparent) 55%, transparent 100%); content: ''; pointer-events: none; }
.dsh-vision-tool-leading { display: inline-flex; width: 16px; height: 16px; flex: none; align-items: center; justify-content: center; margin-right: 6px; color: var(--dsw-alias-label-tertiary); }
.dsh-vision-tool-title { flex: none; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 24px; }
.dsh-vision-tool-separator { width: 2px; height: 2px; flex: none; margin: 0 8px; border-radius: 1px; background: var(--dsw-alias-label-caption); }
.dsh-vision-tool-summary { min-width: 0; flex: 0 1 auto; overflow: hidden; color: var(--dsw-alias-label-tertiary); font-size: 14px; line-height: 24px; text-overflow: ellipsis; white-space: nowrap; }
.dsh-vision-tool-summary[data-error] { color: var(--dsw-alias-state-error-primary); }
.dsh-vision-tool-chevron { flex: none; margin-left: 4px; color: var(--dsw-alias-label-tertiary); opacity: 0; transform: rotate(-90deg); transition: opacity .12s ease, transform .16s ease; }
.dsh-vision-tool-summary-toggle:hover .dsh-vision-tool-chevron { opacity: 1; }
.dsh-vision-tool-summary-toggle[aria-expanded='true'] .dsh-vision-tool-chevron { opacity: 1; transform: rotate(0); }
.dsh-vision-tool-io-card { display: flex; flex-direction: column; margin: 4px 0 4px 4px; overflow: hidden; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-markdown-code-block); font: var(--dsw-font-markdown-code-block-small); }
.dsh-vision-tool-io-section { display: grid; max-height: 180px; grid-template-columns: max-content minmax(0, 1fr); align-items: baseline; column-gap: 14px; padding: 12px 16px; overflow: auto; }
.dsh-vision-tool-io-label { position: sticky; top: 0; align-self: start; color: var(--dsw-alias-label-caption); }
.dsh-vision-tool-io-text { min-width: 0; margin: 0; color: var(--dsw-alias-label-secondary); white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
.dsh-vision-tool-io-text[data-error] { color: var(--dsw-alias-state-error-primary); }
.dsh-vision-tool-io-divider { height: 1px; flex: none; background: var(--dsw-alias-border-l2); }
.dsh-vision-tool-preview { display: flex; width: min(320px, calc(100% - 22px)); height: 200px; align-items: center; justify-content: center; margin: 8px 0 4px 22px; padding: 0; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(127,127,127,.2)); border-radius: 14px; background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.08)); color: var(--dsw-alias-label-tertiary); cursor: zoom-in; font: inherit; font-size: 12px; }
.dsh-vision-tool-preview:disabled { cursor: default; }
.dsh-vision-tool-preview:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #298df8); outline-offset: 2px; }
.dsh-vision-tool-preview img { display: block; width: 100%; height: 100%; object-fit: contain; }
.dsh-vision-lightbox { position: fixed; z-index: 10000; inset: 0; display: grid; place-items: center; padding: 32px; background: rgba(0,0,0,.78); cursor: zoom-out; }
.dsh-vision-lightbox img { max-width: calc(100vw - 64px); max-height: calc(100vh - 64px); object-fit: contain; cursor: default; }
.dsh-vision-lightbox-close { position: fixed; top: 20px; right: 20px; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 999px; background: rgba(255,255,255,.16); color: #fff; cursor: pointer; font-size: 24px; line-height: 1; }
@keyframes dsh-vision-spin { to { transform: rotate(360deg); } }
@keyframes dsh-vision-tool-sweep { 0% { left: -300px; } 90%, 100% { left: 100%; } }
@media (max-width: 680px) { .dsh-vision-badge { display: none; } }
@media (prefers-reduced-motion: reduce) { .dsh-vision-tool-card[data-state='running'] .dsh-vision-tool-row::after { display: none; animation: none; } .dsh-vision-tool-chevron { transition: none; } }
`;

const STYLE_ID = '@dfy-plugins/dsh-vision';

function installStyles(): () => void {
  const existing = document.querySelector<HTMLStyleElement>(`style[data-plugin=${JSON.stringify(STYLE_ID)}]`);
  const tag = document.createElement('style');
  tag.dataset.plugin = STYLE_ID;
  tag.textContent = STYLES;
  if (existing === null) document.head.appendChild(tag);
  else existing.replaceWith(tag);
  return () => tag.remove();
}

function firstLine(value: string): string {
  const newline = value.indexOf('\n');
  return newline === -1 ? value : value.slice(0, newline);
}

const resourceUrls = new Map<string, Promise<string>>();

function encodeImageRef(ref: ImageAttachmentRef): string {
  const value = JSON.stringify({
    attachmentId: String(ref.attachmentId),
    mediaType: ref.mediaType,
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
    ...(ref.name === undefined ? {} : { name: ref.name }),
  });
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function loadReferencedImage(attachment: ImageAttachmentRef): Promise<string> {
  const ref = encodeImageRef(attachment);
  const cached = resourceUrls.get(ref);
  if (cached !== undefined) return cached;
  const pending = fetch(`${RESOURCE_API_PATH}?ref=${encodeURIComponent(ref)}`, { cache: 'force-cache' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      return URL.createObjectURL(await response.blob());
    });
  resourceUrls.set(ref, pending);
  void pending.catch(() => resourceUrls.delete(ref));
  return pending;
}

function isImageBlock(value: unknown): value is ImageBlock {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const block = value as Partial<ImageBlock>;
  return block.type === 'image' && typeof block.attachment === 'object' && block.attachment !== null;
}

function resultImage(block: ToolCallViewProps['block']): ImageAttachmentRef | undefined {
  if (!('kind' in block) || block.resultView?.card !== 'generic') return undefined;
  return block.resultView.content?.find(isImageBlock)?.attachment;
}

function VisionImagePreview({ attachment }: { attachment: ImageAttachmentRef }): React.ReactElement {
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<{ url?: string; failed?: boolean }>({});
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const alt = attachment.name ?? '视觉分析所查看的图片';
  React.useEffect(() => {
    let active = true;
    setState({});
    void loadReferencedImage(attachment).then(
      (url) => { if (active) setState({ url }); },
      () => { if (active) setState({ failed: true }); },
    );
    return () => { active = false; };
  }, [attachment, attempt]);
  React.useEffect(() => {
    if (!lightboxOpen) return undefined;
    const close = (event: KeyboardEvent): void => { if (event.key === 'Escape') setLightboxOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [lightboxOpen]);

  return (
    <>
      <button
        type="button"
        className="dsh-vision-tool-preview"
        aria-label={state.failed === true ? '图片加载失败，点击重试' : `${alt}，点击查看原图`}
        title={state.failed === true ? '图片加载失败，点击重试' : '查看原图'}
        disabled={state.url === undefined && state.failed !== true}
        onClick={() => {
          if (state.failed === true) setAttempt((value) => value + 1);
          else if (state.url !== undefined) setLightboxOpen(true);
        }}
      >
        {state.failed === true
          ? '图片加载失败，点击重试'
          : state.url === undefined
            ? '正在加载图片…'
            : <img src={state.url} alt={alt} />}
      </button>
      {lightboxOpen && state.url !== undefined ? (
        <div className="dsh-vision-lightbox" role="dialog" aria-modal="true" aria-label="截图预览" onClick={() => setLightboxOpen(false)}>
          <button type="button" className="dsh-vision-lightbox-close" aria-label="关闭预览" onClick={() => setLightboxOpen(false)}>×</button>
          <img src={state.url} alt={alt} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </>
  );
}

function toolOutput(block: ToolCallViewProps['block']): string | null {
  if (!('kind' in block)) return null;
  const parts = block.content.map((item: unknown) => {
    if (typeof item === 'object' && item !== null && (item as { type?: unknown }).type === 'text') {
      const text = (item as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    }
    return JSON.stringify(item, null, 2);
  });
  if (parts.length === 0 && block.error !== undefined) parts.push(`${block.error.name}: ${block.error.code}`);
  return parts.join('\n') || null;
}

function visionQuestion(block: ToolCallViewProps['block']): string {
  const argsRaw = ('kind' in block ? block.call?.argsRaw : block.argsRaw) ?? '';
  try {
    const parsed = JSON.parse(argsRaw) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      const question = (parsed as Record<string, unknown>).question;
      if (typeof question === 'string' && question.trim().length > 0) return firstLine(question.trim());
    }
  } catch {}
  return '分析图片';
}

function toolInput(block: ToolCallViewProps['block']): string | null {
  const raw = (('kind' in block ? block.call?.argsRaw : block.argsRaw) ?? '').trim();
  if (raw.length === 0) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function VisionToolRow({ block }: ToolCallViewProps): React.ReactElement {
  const settled = 'kind' in block;
  const input = toolInput(block);
  const output = toolOutput(block);
  const image = resultImage(block);
  const state = !settled ? 'running' : block.error?.code === 'interrupted' ? 'stopped' : block.isError ? 'error' : 'ok';
  const summary = state === 'error' && output !== null
    ? firstLine(output)
    : image === undefined
      ? visionQuestion(block)
      : `已查看 1 张图片 · ${String(image.width)} × ${String(image.height)}`;
  const imageExpandable = image !== undefined;
  const detailsExpandable = input !== null || output !== null;
  const [imageOpen, setImageOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const initializedImageRef = React.useRef<string | undefined>(undefined);
  const imageKey = image === undefined
    ? undefined
    : `${String(image.attachmentId)}:${String(image.bytes)}:${String(image.width)}x${String(image.height)}`;
  React.useEffect(() => {
    if (imageKey === undefined || initializedImageRef.current === imageKey) return;
    initializedImageRef.current = imageKey;
    setImageOpen(true);
  }, [imageKey]);
  const imageExpanded = imageOpen && imageExpandable;
  const detailsExpanded = detailsOpen && detailsExpandable;
  const header = (
    <>
      <span className="dsh-vision-tool-leading">
        {state === 'error' ? <StateDot state="error" /> : state === 'stopped' ? <StateDot state="warning" /> : <IconSparkle16 size={14} />}
      </span>
      <span className="dsh-vision-tool-title">DFY VISION ANALYZE</span>
    </>
  );

  return (
    <div className="dsh-vision-tool-card" data-state={state} data-tool="dfy_vision_analyze">
      <div className="dsh-vision-tool-row" data-expandable={imageExpandable || undefined}>
        {!detailsExpandable ? (
          <span className="dsh-vision-tool-inspect-target">{header}</span>
        ) : (
          <button
            type="button"
            className="dsh-vision-tool-inspect-target"
            aria-label={`DFY VISION ANALYZE，${detailsExpanded ? '收起参数' : '展开参数'}`}
            aria-expanded={detailsExpanded}
            onClick={() => setDetailsOpen((value) => !value)}
          >
            {header}
          </button>
        )}
        <span className="dsh-vision-tool-separator" aria-hidden />
        {imageExpandable ? (
          <button
            type="button"
            className="dsh-vision-tool-summary-toggle"
            aria-label={`${summary}，${imageExpanded ? '收起图片' : '展开图片'}`}
            aria-expanded={imageExpanded}
            onClick={() => setImageOpen((value) => !value)}
          >
            <span className="dsh-vision-tool-summary" data-error={state === 'error' || undefined}>{summary}</span>
            <IconChevronDownOutline14 className="dsh-vision-tool-chevron" size={14} />
          </button>
        ) : (
          <span className="dsh-vision-tool-summary" data-error={state === 'error' || undefined}>{summary}</span>
        )}
      </div>
      {!imageExpanded || image === undefined ? null : <VisionImagePreview attachment={image} />}
      {!detailsExpanded ? null : (
        <div className="dsh-vision-tool-io-card">
          {input === null ? null : (
            <div className="dsh-vision-tool-io-section">
              <span className="dsh-vision-tool-io-label">IN</span>
              <pre className="dsh-vision-tool-io-text">{input}</pre>
            </div>
          )}
          {input === null || output === null ? null : <span className="dsh-vision-tool-io-divider" aria-hidden />}
          {output === null ? null : (
            <div className="dsh-vision-tool-io-section">
              <span className="dsh-vision-tool-io-label">OUT</span>
              <pre className="dsh-vision-tool-io-text" data-error={state === 'error' || undefined}>{output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function draftOf(value: VisionSettings | undefined): Draft {
  const provider = value?.provider ?? '';
  const model = value?.model ?? '';
  return {
    enabled: (value?.enabled ?? false) && provider.length > 0 && model.length > 0,
    provider,
    model,
    reasoningEffort: value?.reasoningEffort ?? '',
    maxTokens: value?.maxTokens ?? 1024,
  };
}

function activationLabel(activation: Activation | null): string {
  if (activation === null) return '检查中';
  switch (activation.status) {
    case 'active': return '已启用';
    case 'checking': return '正在检查路由';
    case 'disabled': return '已关闭';
    case 'unconfigured': return '尚未配置';
    case 'unsupported': return '不支持';
    case 'error': return '配置异常';
  }
}

interface VisionSelectOption {
  value: string;
  label: string;
}

function VisionSelect({
  ariaLabel,
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  placeholder: string;
  options: readonly VisionSelectOption[];
  disabled: boolean;
  onChange(value: string): void;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder;
  const items = React.useMemo<readonly MenuItem[]>(
    () => options.map((option) => ({ id: option.value, label: option.label })),
    [options],
  );

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <Menu
      className="dsh-vision-select-menu"
      open={open && !disabled}
      portal
      items={items}
      selectedId={value}
      onClose={() => setOpen(false)}
      onSelect={(id) => {
        onChange(String(id));
        setOpen(false);
      }}
      anchor={(
        <button
          type="button"
          className="dsh-vision-select-trigger"
          aria-label={`${ariaLabel}，当前：${selectedLabel}`}
          aria-haspopup="menu"
          aria-expanded={open && !disabled}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selectedLabel}</span>
          <IconChevronDownOutline14 size={16} />
        </button>
      )}
    />
  );
}

function VisionCard({ scope }: { scope: SettingsScope<VisionSettings> }): React.ReactElement {
  const snapshot = React.useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
    () => scope.getSnapshot(),
  );
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(() => draftOf(snapshot.value));
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [providers, setProviders] = React.useState<ProviderView[]>([]);
  const [activation, setActivation] = React.useState<Activation | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const loadRoutes = React.useCallback(() => {
    setLoadError(null);
    return fetch(API_PATH, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as RoutesResponse;
        if (!response.ok) throw new Error(body.error ?? `HTTP ${String(response.status)}`);
        setProviders(body.providers);
        setActivation(body.activation);
      })
      .catch((error: unknown) => setLoadError(String(error)));
  }, []);

  React.useEffect(() => {
    void loadRoutes();
  }, [loadRoutes]);

  React.useEffect(() => {
    if (dirty || saving) return;
    setDraft(draftOf(snapshot.value));
  }, [dirty, saving, snapshot.revision, snapshot.value]);

  const edit = <K extends keyof Draft>(field: K, value: Draft[K]): void => {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setSaveError(null);
  };

  const selectedProvider = providers.find((provider) => provider.id === draft.provider);
  const providerOptions = draft.provider.length > 0 && selectedProvider === undefined
    ? [{ id: draft.provider, name: `${draft.provider}（当前配置）`, models: draft.model.length > 0 ? [{ id: draft.model, name: draft.model }] : [] }, ...providers]
    : providers;
  const modelOptions = selectedProvider?.models
    ?? providerOptions.find((provider) => provider.id === draft.provider)?.models
    ?? [];
  const selectedModel = modelOptions.find((model) => model.id === draft.model);
  const modelReasoning = selectedModel?.reasoning;
  const reasoningOptions: VisionSelectOption[] = [
    { value: '', label: '跟随模型默认' },
    ...(modelReasoning?.efforts.map((effort) => ({ value: effort.id, label: effort.name })) ?? []),
  ];
  if (draft.reasoningEffort.length > 0 && !reasoningOptions.some((option) => option.value === draft.reasoningEffort)) {
    reasoningOptions.push({ value: draft.reasoningEffort, label: `${draft.reasoningEffort}（当前配置）` });
  }
  const validTokens = Number.isSafeInteger(draft.maxTokens) && draft.maxTokens >= 64 && draft.maxTokens <= 8192;
  const validReasoning = draft.reasoningEffort.length === 0
    || modelReasoning?.efforts.some((effort) => effort.id === draft.reasoningEffort) === true;
  const completeRoute = !draft.enabled || (draft.provider.length > 0 && draft.model.length > 0);
  const writable = snapshot.status === 'ready' && snapshot.writable;

  const save = (): void => {
    if (!writable || !dirty || saving || !validTokens || !validReasoning || !completeRoute) return;
    setSaving(true);
    setSaveError(null);
    void (async () => {
      try {
        await scope.set('enabled', draft.enabled);
        if (draft.provider.length === 0) await scope.unset('provider');
        else await scope.set('provider', draft.provider);
        if (draft.model.length === 0) await scope.unset('model');
        else await scope.set('model', draft.model);
        if (draft.reasoningEffort.length === 0) await scope.unset('reasoningEffort');
        else await scope.set('reasoningEffort', draft.reasoningEffort);
        await scope.set('maxTokens', draft.maxTokens);
        setDirty(false);
        await loadRoutes();
        window.dispatchEvent(new Event('dsh-vision:configuration-changed'));
      } catch (error) {
        setSaveError(String(error));
      } finally {
        setSaving(false);
      }
    })();
  };

  const routeConfigured = draft.provider.length > 0 && draft.model.length > 0;

  return (
    <li className="dsh-vision-card" data-open={open || undefined}>
      <button type="button" className="dsh-vision-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="dsh-vision-head-copy">
          <span className="dsh-vision-title">视觉分析</span>
          <span className="dsh-vision-description">让文本模型通过隔离的视觉路由分析图片，主对话只接收文字结果。</span>
        </span>
        <span className="dsh-vision-badge" title={activation !== null && 'message' in activation ? activation.message : undefined}>
          {activationLabel(activation)}
        </span>
        <IconChevronDownOutline14 className="dsh-vision-chevron" data-open={open || undefined} size={16} />
      </button>
      {open ? (
        <div className="dsh-vision-body">
          <p className="dsh-vision-note">
            这里只选择“模型”页面已有的路由，不保存或复制 API Key。图片会发送给所选视觉模型。
          </p>
          {loadError === null ? null : <p className="dsh-vision-note" data-error>{loadError}</p>}
          {activation?.status === 'error' || activation?.status === 'unsupported'
            ? <p className="dsh-vision-note" data-error>{activation.message}</p>
            : null}
          {providers.length === 0 && loadError === null ? (
            <p className="dsh-vision-note">未发现明确声明 image 输入能力的模型，请先在“模型”页面添加视觉路由。</p>
          ) : null}

          <div className="dsh-vision-field">
            <div className="dsh-vision-field-head"><label className="dsh-vision-label">提供方路由</label></div>
            <VisionSelect
              ariaLabel="提供方路由"
              value={draft.provider}
              placeholder="选择视觉提供方"
              options={providerOptions.map((provider) => ({ value: provider.id, label: `${provider.name} · ${provider.id}` }))}
              disabled={!writable || providerOptions.length === 0}
              onChange={(value) => {
                const provider = providers.find((item) => item.id === value);
                setDraft((current) => ({ ...current, provider: value, model: provider?.models[0]?.id ?? '', reasoningEffort: '' }));
                setDirty(true);
                setSaveError(null);
              }}
            />
            <p className="dsh-vision-hint">来自 Harness 的已注册 LLM provider。</p>
          </div>

          <div className="dsh-vision-field">
            <div className="dsh-vision-field-head"><label className="dsh-vision-label">视觉模型</label></div>
            <VisionSelect
              ariaLabel="视觉模型"
              value={draft.model}
              placeholder="选择视觉模型"
              options={modelOptions.map((model) => ({ value: model.id, label: `${model.name} · ${model.id}` }))}
              disabled={!writable || draft.provider.length === 0 || modelOptions.length === 0}
              onChange={(value) => {
                setDraft((current) => ({ ...current, model: value, reasoningEffort: '' }));
                setDirty(true);
                setSaveError(null);
              }}
            />
            <p className="dsh-vision-hint">只列出明确支持图片输入的模型。</p>
          </div>

          {modelReasoning !== undefined || draft.reasoningEffort.length > 0 ? (
            <div className="dsh-vision-field">
              <div className="dsh-vision-field-head"><label className="dsh-vision-label">思考等级</label></div>
              <VisionSelect
                ariaLabel="思考等级"
                value={draft.reasoningEffort}
                placeholder="跟随模型默认"
                options={reasoningOptions}
                disabled={!writable || draft.model.length === 0 || modelReasoning === undefined}
                onChange={(value) => edit('reasoningEffort', value)}
              />
              <p className="dsh-vision-hint">等级和默认值读取自所选模型；跟随默认时不覆盖模型配置。</p>
            </div>
          ) : null}

          <div className="dsh-vision-field">
            <div className="dsh-vision-field-head"><label className="dsh-vision-label" htmlFor="dsh-vision-max-tokens">最大输出 Token</label></div>
            <input id="dsh-vision-max-tokens" className="dsh-vision-control" type="number" min={64} max={8192} step={1} value={draft.maxTokens} disabled={!writable} onChange={(event) => edit('maxTokens', Number(event.target.value))} />
            <p className="dsh-vision-hint">视觉模型返回给文本模型的分析长度，范围 64–8192。</p>
          </div>

          <div className="dsh-vision-field">
            <div className="dsh-vision-field-head">
              <div className="dsh-vision-label">启用视觉工具</div>
              <label className="dsh-vision-switch">
                <input type="checkbox" checked={draft.enabled && routeConfigured} disabled={!writable || !routeConfigured} onChange={(event) => edit('enabled', event.target.checked)} />
                <span />
              </label>
            </div>
            <p className="dsh-vision-hint">选好提供方和模型后才能启用；关闭后保留当前选择。</p>
          </div>

          {!validTokens ? <p className="dsh-vision-note" data-error>最大输出 Token 必须是 64–8192 的整数。</p> : null}
          {!validReasoning ? <p className="dsh-vision-note" data-error>当前视觉模型不支持已保存的思考等级，请改为跟随模型默认。</p> : null}
          {!completeRoute ? <p className="dsh-vision-note" data-error>启用时必须同时选择提供方和视觉模型。</p> : null}
          {saveError === null ? null : <p className="dsh-vision-note" data-error>保存失败：{saveError}</p>}
          {snapshot.status === 'unavailable' ? <p className="dsh-vision-note" data-error>当前部署未开放此插件的设置命名空间。</p> : null}

          <div className="dsh-vision-actions">
            <button type="button" className="dsh-vision-button" onClick={() => void loadRoutes()}>刷新模型</button>
            <button type="button" className="dsh-vision-button" disabled={!dirty || saving} onClick={() => { setDraft(draftOf(snapshot.value)); setDirty(false); setSaveError(null); }}>放弃更改</button>
            <button type="button" className="dsh-vision-button" data-primary disabled={!writable || !dirty || saving || !validTokens || !validReasoning || !completeRoute} onClick={save}>{saving ? '保存中…' : '保存'}</button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function apply(ctx: ClientCtx): void {
  ctx.effect(installStyles, 'dsh-vision: client styles');
  ctx.effect(() => () => {
    for (const pending of resourceUrls.values()) void pending.then((url) => URL.revokeObjectURL(url));
    resourceUrls.clear();
  }, 'dsh-vision: release object URLs');
  const scope = ctx.settingsScope.bind<VisionSettings>({ namespace: 'dsh-vision' });
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'dfy_vision_analyze',
  }, VisionToolRow));
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'dsh-vision',
  }, () => <VisionCard scope={scope} />));
}
