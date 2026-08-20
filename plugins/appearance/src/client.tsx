/** @dfy-plugins/dsh-appearance Client half: settings page and completed-turn folding. */
import React from 'react';
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client';

import {
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_CHAT_LINE_HEIGHT_RATIO,
  MAX_CHAT_FONT_SIZE,
  MAX_CHAT_LINE_HEIGHT_RATIO,
  MIN_CHAT_FONT_SIZE,
  MIN_CHAT_LINE_HEIGHT_RATIO,
  normalizeAppearanceSettings,
  planCompletedProcessSegments,
  type AppearanceSettings,
} from './logic.js';

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
}

interface SlotEntryOptions {
  name: string;
  id?: string;
  order?: number;
  label?: string;
  priority?: number;
  select?: (owner: TurnTailOwnerProps) => unknown | null;
}

interface ClientCtx {
  effect(setup: () => (() => void), label: string): unknown;
  slots: {
    inject(name: string, register: () => (() => void) | Iterable<() => void>): () => void;
    register(options: SlotEntryOptions, component: unknown): () => void;
  };
  settingsScope: {
    bind<T>(spec: { namespace: string }): SettingsScope<T>;
  };
}

interface ProcessDisclosureProps extends TurnTailOwnerProps {
  matched: { turnId: number };
}

export const name = 'appearance';
export const inject = ['slots', 'settingsScope'];

const STYLE_ID = '@dfy-plugins/dsh-appearance';
const BODY_ATTRIBUTE = 'data-dsh-appearance';
const SETTINGS_NAMESPACE = 'dsh-appearance';
const MEDIA_CONTENT = 'img, video, audio';
const IMAGE_PROCESS_CONTENT = 'img, [data-tool="dfy_vision_analyze"]';

const STYLES = `
body[${BODY_ATTRIBUTE}] {
  --dsh-appearance-chat-font-size: 16px;
  --dsh-appearance-chat-line-height: 28px;
  --dsh-appearance-process-font-size: 14px;
  --dsh-appearance-process-line-height: 24px;
}
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='assistant-step'] > div,
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='assistant-step'] > div > div > :not([data-variant='think']) {
  font-size: var(--dsh-appearance-chat-font-size) !important;
  line-height: var(--dsh-appearance-chat-line-height) !important;
}
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='assistant-step']
  :is(p, li, blockquote, pre, code, table, td, th):not([data-variant='think'] *) {
  font-size: var(--dsh-appearance-chat-font-size) !important;
  line-height: var(--dsh-appearance-chat-line-height) !important;
}
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='user'] .dsh-media-user-bubble,
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='user'] [data-time-hover-root]
  > div:first-child > div:has(> [class*='_text_'], > [data-ref-chip]) {
  font-size: var(--dsh-appearance-chat-font-size) !important;
  line-height: var(--dsh-appearance-chat-line-height) !important;
}
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='assistant-step'] h1 { font-size: calc(var(--dsh-appearance-chat-font-size) + 12px) !important; line-height: calc(var(--dsh-appearance-chat-line-height) + 8px) !important; }
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='assistant-step'] h2 { font-size: calc(var(--dsh-appearance-chat-font-size) + 8px) !important; line-height: calc(var(--dsh-appearance-chat-line-height) + 6px) !important; }
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='assistant-step'] h3 { font-size: calc(var(--dsh-appearance-chat-font-size) + 4px) !important; line-height: calc(var(--dsh-appearance-chat-line-height) + 4px) !important; }
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='assistant-step'] h4 { font-size: calc(var(--dsh-appearance-chat-font-size) + 2px) !important; line-height: calc(var(--dsh-appearance-chat-line-height) + 2px) !important; }
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='assistant-step'] :is(h5, h6, td, th) { font-size: var(--dsh-appearance-chat-font-size) !important; line-height: var(--dsh-appearance-chat-line-height) !important; }
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='context'] :is(button, span),
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='assistant-step'] [data-variant='think'] :is(button, span, div),
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='tool-call'] [data-variant] :is(button, span),
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='tool-call'] [data-tool] :is(button, span),
body[${BODY_ATTRIBUTE}] [data-chat-flow-kind='command'] :is(button, span) {
  font-size: var(--dsh-appearance-process-font-size) !important;
  line-height: var(--dsh-appearance-process-line-height) !important;
}
[data-dsh-appearance-process][data-dsh-appearance-collapsed='true'] {
  display: none !important;
}
[data-dsh-appearance-segment-think][data-dsh-appearance-collapsed='true'] {
  display: none !important;
}
.dsh-appearance-process-anchor { display: none; }
.dsh-appearance-process-segment { min-width: 0; }
.dsh-appearance-process-toggle {
  display: flex;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  height: 26px;
  appearance: none;
  align-items: center;
  gap: 6px;
  padding: 0 7px 0 3px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  font: inherit;
  font-size: var(--dsh-appearance-process-font-size, 14px);
  line-height: var(--dsh-appearance-process-line-height, 24px);
  text-align: left;
}
.dsh-appearance-process-toggle:hover { color: var(--dsw-alias-label-primary); }
.dsh-appearance-process-toggle:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.dsh-appearance-process-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-appearance-process-chevron { width: 14px; height: 14px; flex: none; margin-left: 1px; opacity: 0; transform: rotate(-90deg); transition: opacity .12s ease, transform .14s ease; }
.dsh-appearance-process-toggle:hover .dsh-appearance-process-chevron { opacity: 1; }
.dsh-appearance-process-toggle[aria-expanded='true'] .dsh-appearance-process-chevron { opacity: 1; transform: rotate(0); }
.dsh-appearance-root { padding: 0 4px 24px; color: inherit; }
.dsh-appearance-heading { margin: 0 0 6px; font-size: 17px; font-weight: 650; line-height: 24px; }
.dsh-appearance-intro { margin: 0 0 20px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dsh-appearance-section + .dsh-appearance-section { margin-top: 20px; }
.dsh-appearance-section-title { margin: 0 2px 9px; font-size: 13px; font-weight: 650; line-height: 20px; }
.dsh-appearance-card { overflow: hidden; border: 1px solid var(--dsw-alias-border-l2); border-radius: 14px; background: var(--dsw-alias-bg-layer-3); }
.dsh-appearance-row { display: flex; min-height: 58px; align-items: center; gap: 18px; padding: 12px 16px; }
.dsh-appearance-row + .dsh-appearance-row { border-top: 1px solid var(--dsw-alias-border-l1); }
.dsh-appearance-copy { min-width: 0; flex: 1; }
.dsh-appearance-title { color: var(--dsw-alias-label-primary); font-size: 14px; font-weight: 500; line-height: 22px; }
.dsh-appearance-description { margin-top: 2px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.dsh-appearance-switch { position: relative; width: 32px; height: 20px; flex: none; }
.dsh-appearance-switch input { position: absolute; opacity: 0; }
.dsh-appearance-switch span { position: absolute; inset: 0; border-radius: 999px; background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.18)); cursor: pointer; transition: background 120ms ease; }
.dsh-appearance-switch span::after { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: white; box-shadow: 0 1px 2px rgba(0,0,0,.3); content: ''; transition: transform 120ms ease; }
.dsh-appearance-switch input:checked + span { background: var(--dsw-alias-state-business-primary); }
.dsh-appearance-switch input:checked + span::after { transform: translateX(12px); }
.dsh-appearance-switch input:focus-visible + span { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.dsh-appearance-switch input:disabled + span { cursor: default; opacity: .5; }
.dsh-appearance-size-control { display: grid; width: min(260px, 42%); flex: none; grid-template-columns: minmax(120px, 1fr) 42px; align-items: center; gap: 12px; }
.dsh-appearance-range { width: 100%; accent-color: var(--dsw-alias-state-business-primary); }
.dsh-appearance-size-value { color: var(--dsw-alias-label-secondary); font-size: 13px; font-variant-numeric: tabular-nums; text-align: right; }
.dsh-appearance-preview { padding: 16px; color: var(--dsw-alias-label-primary); line-height: 1.75; }
.dsh-appearance-preview-label { margin-bottom: 6px; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 17px; }
.dsh-appearance-error { margin: 12px 2px 0; color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 18px; }
@media (max-width: 620px) {
  .dsh-appearance-row { align-items: flex-start; flex-direction: column; gap: 10px; }
  .dsh-appearance-switch { align-self: flex-end; margin-top: -42px; }
  .dsh-appearance-size-control { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-appearance-process-chevron, .dsh-appearance-switch span, .dsh-appearance-switch span::after { transition: none; }
}
`;

function installStyles(): () => void {
  const existing = document.querySelector<HTMLStyleElement>(`style[data-plugin=${JSON.stringify(STYLE_ID)}]`);
  const tag = document.createElement('style');
  tag.dataset.plugin = STYLE_ID;
  tag.textContent = STYLES;
  if (existing === null) document.head.appendChild(tag);
  else existing.replaceWith(tag);
  return () => tag.remove();
}

function readSettings(scope: SettingsScope<Partial<AppearanceSettings>>): AppearanceSettings {
  return normalizeAppearanceSettings(scope.getSnapshot().value);
}

function applyTypography(fontSize: number, lineHeightRatio: number): void {
  const processSize = Math.max(13, fontSize - 2);
  const chatLineHeight = Math.round(fontSize * lineHeightRatio);
  const processLineHeight = Math.round(processSize * lineHeightRatio);
  document.body.style.setProperty('--dsh-appearance-chat-font-size', `${String(fontSize)}px`);
  document.body.style.setProperty('--dsh-appearance-chat-line-height', `${String(chatLineHeight)}px`);
  document.body.style.setProperty('--dsh-appearance-process-font-size', `${String(processSize)}px`);
  document.body.style.setProperty('--dsh-appearance-process-line-height', `${String(processLineHeight)}px`);
}

function installPreferences(scope: SettingsScope<Partial<AppearanceSettings>>): () => void {
  const update = (): void => {
    document.body.setAttribute(BODY_ATTRIBUTE, '');
    const settings = readSettings(scope);
    applyTypography(settings.chatFontSize, settings.chatLineHeightRatio);
  };
  update();
  const unsubscribe = scope.subscribe(update);
  return () => {
    unsubscribe();
    document.body.removeAttribute(BODY_ATTRIBUTE);
    document.body.style.removeProperty('--dsh-appearance-chat-font-size');
    document.body.style.removeProperty('--dsh-appearance-chat-line-height');
    document.body.style.removeProperty('--dsh-appearance-process-font-size');
    document.body.style.removeProperty('--dsh-appearance-process-line-height');
  };
}

function flowRowsBefore(anchor: HTMLElement): HTMLElement[] {
  const tail = anchor.closest<HTMLElement>('[data-chat-flow-kind="turn-tail"]');
  if (tail === null) return [];
  const rows: HTMLElement[] = [];
  let current = tail.previousElementSibling;
  while (current instanceof HTMLElement) {
    const kind = current.dataset.chatFlowKind;
    if (kind === 'user' || kind === 'turn-tail') break;
    if (kind !== undefined) rows.unshift(current);
    current = current.previousElementSibling;
  }
  return rows;
}

function removeFlowMarkers(rows: readonly HTMLElement[]): void {
  for (const row of rows) {
    row.removeAttribute('data-dsh-appearance-process');
    row.removeAttribute('data-dsh-appearance-segment-think');
    row.removeAttribute('data-dsh-appearance-collapsed');
  }
}

function assistantHasOutput(row: HTMLElement): boolean {
  if (row.dataset.chatFlowKind !== 'assistant-step') return false;
  const copy = row.cloneNode(true) as HTMLElement;
  for (const reasoning of copy.querySelectorAll('[data-variant="think"]')) reasoning.remove();
  return (copy.textContent ?? '').trim().length > 0 || copy.querySelector(MEDIA_CONTENT) !== null;
}

function segmentSummary(
  processRows: readonly HTMLElement[],
  outputReasoning: readonly HTMLElement[],
  toolCount: number,
  contextCount: number,
): string {
  const reasoning = outputReasoning.length + processRows.reduce(
    (total, row) => total + row.querySelectorAll('[data-variant="think"]').length,
    0,
  );
  const media = processRows.filter((row) => row.querySelector(IMAGE_PROCESS_CONTENT) !== null).length;
  const details = [
    ...(reasoning === 0 ? [] : [`思考了 ${String(reasoning)} 次`]),
    ...(contextCount === 0 ? [] : [`读取了 ${String(contextCount)} 项上下文`]),
    ...(toolCount === 0 ? [] : [`运行了 ${String(toolCount)} 个工具`]),
    ...(media === 0 ? [] : [`查看了 ${String(media)} 张图片`]),
  ];
  return details.length === 0 ? '查看过程' : details.join('、');
}

/** Exact vector used by DSH's Think disclosure (`IconChevronDownOutline14`). */
function createDisclosureChevron(): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('fill', 'none');
  svg.classList.add('dsh-appearance-process-chevron');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z');
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

function installSegmentDisclosure(
  turnId: number,
  segmentId: number,
  outputRow: HTMLElement,
  processRows: readonly HTMLElement[],
  toolCount: number,
  contextCount: number,
): () => void {
  const outputReasoning = [...outputRow.querySelectorAll<HTMLElement>('[data-variant="think"]')];
  if (processRows.length === 0 && outputReasoning.length === 0) return () => {};
  const marker = `${String(turnId)}:${String(segmentId)}`;
  const host = document.createElement('div');
  host.className = 'dsh-appearance-process-segment';
  host.dataset.dshAppearanceSegment = marker;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dsh-appearance-process-toggle';
  const label = document.createElement('span');
  label.className = 'dsh-appearance-process-label';
  const chevron = createDisclosureChevron();
  button.append(label, chevron);
  host.append(button);
  (processRows[0] ?? outputRow).before(host);
  let expanded = false;
  const update = (): void => {
    const collapsed = String(!expanded);
    for (const row of processRows) {
      row.dataset.dshAppearanceProcess = marker;
      row.dataset.dshAppearanceCollapsed = collapsed;
    }
    for (const reasoning of outputReasoning) {
      reasoning.dataset.dshAppearanceSegmentThink = marker;
      reasoning.dataset.dshAppearanceCollapsed = collapsed;
    }
    button.setAttribute('aria-expanded', String(expanded));
    label.textContent = segmentSummary(processRows, outputReasoning, toolCount, contextCount);
  };
  const toggle = (): void => { expanded = !expanded; update(); };
  button.addEventListener('click', toggle);
  update();
  return () => {
    button.removeEventListener('click', toggle);
    host.remove();
    removeFlowMarkers([...processRows, ...outputReasoning]);
  };
}

function ProcessDisclosure({ matched }: ProcessDisclosureProps): React.ReactElement {
  const anchorRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (anchor === null) return undefined;
    const rows = flowRowsBefore(anchor);
    const nodes = rows.map((row) => ({
      kind: row.dataset.chatFlowKind ?? '',
      hasOutput: assistantHasOutput(row),
    }));
    const disposers = planCompletedProcessSegments(nodes).map((segment, segmentId) => {
      const outputRow = rows[segment.outputIndex];
      if (outputRow === undefined) return () => {};
      const processRows = segment.collapseIndices.flatMap((index) => rows[index] === undefined ? [] : [rows[index]!]);
      return installSegmentDisclosure(
        matched.turnId,
        segmentId,
        outputRow,
        processRows,
        segment.toolCount,
        segment.contextCount,
      );
    });
    return () => { for (const dispose of disposers.reverse()) dispose(); };
  }, [matched.turnId]);

  return <div ref={anchorRef} className="dsh-appearance-process-anchor" aria-hidden />;
}

function AppearancePage({ scope }: { scope: SettingsScope<Partial<AppearanceSettings>> }): React.ReactElement {
  const snapshot = React.useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
    () => scope.getSnapshot(),
  );
  const settings = normalizeAppearanceSettings(snapshot.value);
  const [fontSize, setFontSize] = React.useState(settings.chatFontSize);
  const [lineHeightRatio, setLineHeightRatio] = React.useState(settings.chatLineHeightRatio);
  const [error, setError] = React.useState<string | null>(null);
  const writable = snapshot.status === 'ready' && snapshot.writable;

  React.useEffect(() => {
    setFontSize(settings.chatFontSize);
    setLineHeightRatio(settings.chatLineHeightRatio);
  }, [settings.chatFontSize, settings.chatLineHeightRatio]);

  const save = (field: keyof AppearanceSettings, value: boolean | number): void => {
    setError(null);
    void scope.set(field, value).catch((cause: unknown) => setError(String(cause)));
  };

  return (
    <div className="dsh-appearance-root">
      <h3 className="dsh-appearance-heading">外观</h3>
      <p className="dsh-appearance-intro">只改变聊天的显示方式，不删除轨迹、工具结果或上下文数据。</p>

      <section className="dsh-appearance-section">
        <h4 className="dsh-appearance-section-title">对话</h4>
        <div className="dsh-appearance-card">
          <div className="dsh-appearance-row">
            <div className="dsh-appearance-copy">
              <div className="dsh-appearance-title">每段回复前收起过程</div>
              <div className="dsh-appearance-description">保留每次可见文本；分别收起它前面的上下文、思考、Skill、工具调用和图片分析，可随时展开。</div>
            </div>
            <label className="dsh-appearance-switch">
              <input
                type="checkbox"
                checked={settings.collapseCompletedProcess}
                disabled={!writable}
                aria-label="每段回复前收起过程"
                onChange={(event) => save('collapseCompletedProcess', event.currentTarget.checked)}
              />
              <span />
            </label>
          </div>

          <div className="dsh-appearance-row">
            <div className="dsh-appearance-copy">
              <div className="dsh-appearance-title">对话字号</div>
              <div className="dsh-appearance-description">调整助手回复和过程行；过程文字通常比正文小 2px，最小保持 13px。</div>
            </div>
            <div className="dsh-appearance-size-control">
              <input
                className="dsh-appearance-range"
                type="range"
                min={MIN_CHAT_FONT_SIZE}
                max={MAX_CHAT_FONT_SIZE}
                step={1}
                value={fontSize}
                disabled={!writable}
                aria-label="对话字号"
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  setFontSize(value);
                  applyTypography(value, lineHeightRatio);
                  save('chatFontSize', value);
                }}
              />
              <output className="dsh-appearance-size-value">{fontSize}px</output>
            </div>
          </div>

          <div className="dsh-appearance-row">
            <div className="dsh-appearance-copy">
              <div className="dsh-appearance-title">对话行距</div>
              <div className="dsh-appearance-description">按字号比例调整正文和过程行的垂直间距。</div>
            </div>
            <div className="dsh-appearance-size-control">
              <input
                className="dsh-appearance-range"
                type="range"
                min={MIN_CHAT_LINE_HEIGHT_RATIO}
                max={MAX_CHAT_LINE_HEIGHT_RATIO}
                step={0.05}
                value={lineHeightRatio}
                disabled={!writable}
                aria-label="对话行距"
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  setLineHeightRatio(value);
                  applyTypography(fontSize, value);
                  save('chatLineHeightRatio', value);
                }}
              />
              <output className="dsh-appearance-size-value">{lineHeightRatio.toFixed(2)}×</output>
            </div>
          </div>

          <div className="dsh-appearance-preview" style={{ fontSize: `${String(fontSize)}px`, lineHeight: lineHeightRatio }}>
            <div className="dsh-appearance-preview-label">预览</div>
            这是对话正文的显示大小。思考与工具过程会保持更轻、更紧凑的层级。
          </div>
        </div>
      </section>

      {fontSize === DEFAULT_CHAT_FONT_SIZE && lineHeightRatio === DEFAULT_CHAT_LINE_HEIGHT_RATIO ? null : (
        <button
          type="button"
          className="dsh-appearance-process-toggle"
          disabled={!writable}
          onClick={() => {
            setFontSize(DEFAULT_CHAT_FONT_SIZE);
            setLineHeightRatio(DEFAULT_CHAT_LINE_HEIGHT_RATIO);
            applyTypography(DEFAULT_CHAT_FONT_SIZE, DEFAULT_CHAT_LINE_HEIGHT_RATIO);
            save('chatFontSize', DEFAULT_CHAT_FONT_SIZE);
            save('chatLineHeightRatio', DEFAULT_CHAT_LINE_HEIGHT_RATIO);
          }}
        >
          恢复默认排版
        </button>
      )}
      {error === null ? null : <p className="dsh-appearance-error">保存失败：{error}</p>}
      {snapshot.status === 'unavailable' ? <p className="dsh-appearance-error">当前部署未开放外观设置命名空间。</p> : null}
    </div>
  );
}

export function apply(ctx: ClientCtx): void {
  const scope = ctx.settingsScope.bind<Partial<AppearanceSettings>>({ namespace: SETTINGS_NAMESPACE });
  ctx.effect(installStyles, 'dsh-appearance: client styles');
  ctx.effect(() => installPreferences(scope), 'dsh-appearance: apply preferences');

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'appearance',
    order: 34,
    label: '外观',
  }, () => <AppearancePage scope={scope} />));

  ctx.slots.inject('conversation.chat.turnTail', () => {
    let disposeEntry: (() => void) | undefined;
    const sync = (): void => {
      const enabled = readSettings(scope).collapseCompletedProcess;
      if (enabled && disposeEntry === undefined) {
        disposeEntry = ctx.slots.register({
          name: 'conversation.chat.turnTail',
          id: 'dsh-appearance-process',
          priority: 100,
          select: (owner) => owner.turn.status === 'closed' ? { turnId: owner.turn.turn } : null,
        }, ProcessDisclosure);
      } else if (!enabled && disposeEntry !== undefined) {
        disposeEntry();
        disposeEntry = undefined;
      }
    };
    sync();
    const unsubscribe = scope.subscribe(sync);
    return () => {
      unsubscribe();
      disposeEntry?.();
      disposeEntry = undefined;
    };
  });
}
