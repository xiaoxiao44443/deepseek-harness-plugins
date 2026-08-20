export const DEFAULT_CHAT_FONT_SIZE = 16;
export const MIN_CHAT_FONT_SIZE = 13;
export const MAX_CHAT_FONT_SIZE = 20;
export const DEFAULT_CHAT_LINE_HEIGHT_RATIO = 1.65;
export const MIN_CHAT_LINE_HEIGHT_RATIO = 1.35;
export const MAX_CHAT_LINE_HEIGHT_RATIO = 1.9;

export interface AppearanceSettings {
  collapseCompletedProcess: boolean;
  chatFontSize: number;
  chatLineHeightRatio: number;
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  collapseCompletedProcess: true,
  chatFontSize: DEFAULT_CHAT_FONT_SIZE,
  chatLineHeightRatio: DEFAULT_CHAT_LINE_HEIGHT_RATIO,
};

export function normalizeAppearanceSettings(value: Partial<AppearanceSettings> | undefined): AppearanceSettings {
  const requestedSize = value?.chatFontSize;
  const chatFontSize = typeof requestedSize === 'number' && Number.isFinite(requestedSize)
    ? Math.min(MAX_CHAT_FONT_SIZE, Math.max(MIN_CHAT_FONT_SIZE, Math.round(requestedSize)))
    : DEFAULT_CHAT_FONT_SIZE;
  const requestedLineHeight = value?.chatLineHeightRatio;
  const chatLineHeightRatio = typeof requestedLineHeight === 'number' && Number.isFinite(requestedLineHeight)
    ? Math.min(
      MAX_CHAT_LINE_HEIGHT_RATIO,
      Math.max(MIN_CHAT_LINE_HEIGHT_RATIO, Math.round(requestedLineHeight * 100) / 100),
    )
    : DEFAULT_CHAT_LINE_HEIGHT_RATIO;
  return {
    collapseCompletedProcess: value?.collapseCompletedProcess ?? true,
    chatFontSize,
    chatLineHeightRatio,
  };
}

export const PROCESS_NODE_KINDS = new Set([
  'context',
  'tool-call',
  'command',
  'manual-compaction',
  'compaction',
  'model-retry',
]);

export interface ProcessFlowNode {
  kind: string;
  hasOutput?: boolean;
}

export interface ProcessSegmentPlan {
  outputIndex: number;
  collapseIndices: number[];
  toolCount: number;
  contextCount: number;
}

/** Group each process run with the next visible Assistant text, preserving every text output. */
export function planCompletedProcessSegments(nodes: readonly ProcessFlowNode[]): ProcessSegmentPlan[] {
  const segments: ProcessSegmentPlan[] = [];
  let pending: number[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node?.kind === 'assistant-step' && node.hasOutput === true) {
      if (pending.length > 0) {
        segments.push({
          outputIndex: index,
          collapseIndices: pending,
          toolCount: pending.filter((item) => nodes[item]?.kind === 'tool-call' || nodes[item]?.kind === 'command').length,
          contextCount: pending.filter((item) => nodes[item]?.kind === 'context').length,
        });
      }
      pending = [];
      continue;
    }
    if (PROCESS_NODE_KINDS.has(node?.kind ?? '') || (node?.kind === 'assistant-step' && node.hasOutput !== true)) {
      pending.push(index);
    }
  }
  return segments;
}
