/** @dfy-plugins/dsh-vision Client half: visual-route settings only. */
import React from 'react';
import {
  IconChevronDownOutline14,
  Menu,
  type MenuItem,
} from '@deepseek-ai/dsh-client-ui-primitives';

interface VisionSettings {
  enabled?: boolean;
  provider?: string;
  model?: string;
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
}

interface ProviderView {
  id: string;
  name: string;
  models: ModelView[];
}

type Activation =
  | { status: 'disabled' | 'unconfigured' | 'checking' }
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
  maxTokens: number;
}

export const name = 'vision';
export const inject = ['slots', 'settingsScope'];

const API_PATH = '/api/dsh-vision/routes';

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
.dsh-vision-select-trigger { display: flex; appearance: none; align-items: center; justify-content: space-between; gap: 12px; text-align: left; cursor: pointer; }
.dsh-vision-select-trigger:hover:not(:disabled), .dsh-vision-select-trigger[aria-expanded='true'] { border-color: var(--dsw-alias-label-dimmed, rgba(127,127,127,.42)); }
.dsh-vision-select-trigger span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-vision-select-trigger svg { flex: none; color: var(--dsw-alias-label-tertiary, rgba(127,127,127,.86)); }
.dsh-vision-switch { position: relative; width: 36px; height: 20px; flex: none; }
.dsh-vision-switch input { position: absolute; opacity: 0; }
.dsh-vision-switch span { position: absolute; inset: 0; border-radius: 999px; background: var(--dsw-alias-label-dimmed, rgba(127,127,127,.34)); cursor: pointer; transition: background .15s; }
.dsh-vision-switch span::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .15s; }
.dsh-vision-switch input:checked + span { background: var(--dsw-alias-brand-primary, #298df8); }
.dsh-vision-switch input:checked + span::after { transform: translateX(16px); }
.dsh-vision-switch input:focus-visible + span { outline: 2px solid var(--dsw-alias-brand-primary, #298df8); outline-offset: 2px; }
.dsh-vision-switch input:disabled + span { cursor: default; opacity: .4; }
.dsh-vision-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 0 4px; border-top: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); }
.dsh-vision-button { appearance: none; padding: 5px 14px; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); border-radius: 8px; background: none; color: var(--dsw-alias-label-secondary, inherit); font: inherit; font-size: 13px; line-height: 1.5; cursor: pointer; }
.dsh-vision-button:hover:not(:disabled) { border-color: var(--dsw-alias-label-dimmed, rgba(127,127,127,.42)); color: var(--dsw-alias-label-primary, inherit); }
.dsh-vision-button[data-primary] { border-color: transparent; background: var(--dsw-alias-label-primary, #111); color: var(--dsw-alias-bg-layer-3, #fff); }
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
@keyframes dsh-vision-spin { to { transform: rotate(360deg); } }
@media (max-width: 680px) { .dsh-vision-badge { display: none; } }
`;

function draftOf(value: VisionSettings | undefined): Draft {
  const provider = value?.provider ?? '';
  const model = value?.model ?? '';
  return {
    enabled: (value?.enabled ?? false) && provider.length > 0 && model.length > 0,
    provider,
    model,
    maxTokens: value?.maxTokens ?? 1024,
  };
}

function activationLabel(activation: Activation | null): string {
  if (activation === null) return '检查中';
  switch (activation.status) {
    case 'active': return `已启用 · ${activation.model}`;
    case 'checking': return '正在检查路由';
    case 'disabled': return '已关闭';
    case 'unconfigured': return '尚未配置';
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
  const validTokens = Number.isSafeInteger(draft.maxTokens) && draft.maxTokens >= 64 && draft.maxTokens <= 8192;
  const completeRoute = !draft.enabled || (draft.provider.length > 0 && draft.model.length > 0);
  const writable = snapshot.status === 'ready' && snapshot.writable;

  const save = (): void => {
    if (!writable || !dirty || saving || !validTokens || !completeRoute) return;
    setSaving(true);
    setSaveError(null);
    void (async () => {
      try {
        await scope.set('enabled', draft.enabled);
        if (draft.provider.length === 0) await scope.unset('provider');
        else await scope.set('provider', draft.provider);
        if (draft.model.length === 0) await scope.unset('model');
        else await scope.set('model', draft.model);
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
      <style>{STYLES}</style>
      <button type="button" className="dsh-vision-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="dsh-vision-head-copy">
          <span className="dsh-vision-title">视觉分析</span>
          <span className="dsh-vision-description">让文本模型通过隔离的视觉路由分析图片，主对话只接收文字结果。</span>
        </span>
        <span className="dsh-vision-badge" title={activation?.status === 'error' ? activation.message : undefined}>
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
          {activation?.status === 'error' ? <p className="dsh-vision-note" data-error>{activation.message}</p> : null}
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
                setDraft((current) => ({ ...current, provider: value, model: provider?.models[0]?.id ?? '' }));
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
              onChange={(value) => edit('model', value)}
            />
            <p className="dsh-vision-hint">只列出明确支持图片输入的模型。</p>
          </div>

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
          {!completeRoute ? <p className="dsh-vision-note" data-error>启用时必须同时选择提供方和视觉模型。</p> : null}
          {saveError === null ? null : <p className="dsh-vision-note" data-error>保存失败：{saveError}</p>}
          {snapshot.status === 'unavailable' ? <p className="dsh-vision-note" data-error>当前部署未开放此插件的设置命名空间。</p> : null}

          <div className="dsh-vision-actions">
            <button type="button" className="dsh-vision-button" onClick={() => void loadRoutes()}>刷新模型</button>
            <button type="button" className="dsh-vision-button" disabled={!dirty || saving} onClick={() => { setDraft(draftOf(snapshot.value)); setDirty(false); setSaveError(null); }}>放弃更改</button>
            <button type="button" className="dsh-vision-button" data-primary disabled={!writable || !dirty || saving || !validTokens || !completeRoute} onClick={save}>{saving ? '保存中…' : '保存'}</button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function apply(ctx: ClientCtx): void {
  const scope = ctx.settingsScope.bind<VisionSettings>({ namespace: 'dsh-vision' });
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'dsh-vision',
  }, () => <VisionCard scope={scope} />));
}
