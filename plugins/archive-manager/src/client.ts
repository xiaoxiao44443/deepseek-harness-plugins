/**
 * dsh-archive-manager Client 半区：在设置里注册「归档管理」页。
 * 由 esbuild 打包成 __ModuleLoader__ 模块（见 scripts/build-client.mjs）。
 */
import React from 'react';

/** settings.section 列表槽位的注册项（与 Slots 契约对齐）。 */
interface SlotEntryOptions {
  name: string;
  id?: string;
  order?: number;
  label?: string | (() => string);
  locale?: string;
  children?: unknown;
}

/** Client 端 ctx：本插件只用 slots 注册面。 */
interface ClientCtx {
  slots: {
    inject(name: string, register: () => unknown): unknown;
    register(options: SlotEntryOptions, component: unknown): unknown;
  };
}

export const name = 'archive-manager';
export const inject = ['slots'];

interface SessionRow {
  id: string;
  title: string;
  projectTitle: string;
  projectPath: string | null;
  updatedAt: number | null;
}

interface ListResponse {
  sessions: SessionRow[];
}

interface SessionGroup {
  key: string;
  title: string;
  path: string | null;
  sessions: SessionRow[];
}

const STYLES = `
.dsh-archive-root { padding: 0 4px; color: inherit; }
.dsh-archive-root h3 { margin: 0 0 14px; font-size: 17px; }
.dsh-archive-intro, .dsh-archive-empty { margin: 0; color: inherit; font-size: 12px; opacity: .58; }
.dsh-archive-intro { margin-bottom: 24px; }
.dsh-archive-error { margin: 12px 0; color: #e5484d; font-size: 13px; }
.dsh-archive-group + .dsh-archive-group { margin-top: 24px; }
.dsh-archive-group-header { display: flex; align-items: center; gap: 8px; margin: 0 2px 10px; min-width: 0; }
.dsh-archive-group-title { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.dsh-archive-group-count { margin-left: auto; flex: none; font-size: 12px; opacity: .58; }
.dsh-archive-card { display: flex; align-items: center; gap: 14px; min-height: 54px; padding: 8px 10px 8px 16px; border: 1px solid rgba(127,127,127,.22); border-radius: 14px; background: rgba(127,127,127,.07); }
.dsh-archive-card + .dsh-archive-card { margin-top: 8px; }
.dsh-archive-copy { min-width: 0; flex: 1; }
.dsh-archive-title { overflow: hidden; font-size: 14px; font-weight: 600; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.dsh-archive-time { font-size: 12px; line-height: 18px; opacity: .58; }
.dsh-archive-actions { display: flex; align-items: center; gap: 8px; flex: none; }
.dsh-archive-actions button { appearance: none; border: 0; color: inherit; font: inherit; cursor: pointer; transition: background-color .15s ease, color .15s ease, opacity .15s ease; }
.dsh-archive-actions button:disabled { cursor: wait; opacity: .48; }
.dsh-archive-trash { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; border-radius: 10px; background: transparent; opacity: .62; }
.dsh-archive-trash:hover:not(:disabled) { color: #e5484d; background: rgba(229,72,77,.1); opacity: 1; }
.dsh-archive-restore { min-height: 34px; padding: 0 12px; border-radius: 10px; background: rgba(127,127,127,.13); font-size: 13px; font-weight: 600; white-space: nowrap; }
.dsh-archive-restore:hover:not(:disabled) { background: rgba(127,127,127,.22); }
.dsh-archive-modal-backdrop { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(0,0,0,.46); backdrop-filter: blur(2px); }
.dsh-archive-modal { width: min(400px, 100%); padding: 20px; border: 1px solid rgba(127,127,127,.28); border-radius: 16px; background: Canvas; color: CanvasText; box-shadow: 0 18px 60px rgba(0,0,0,.28); }
.dsh-archive-modal-heading { display: flex; align-items: flex-start; gap: 12px; }
.dsh-archive-modal-icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex: none; border-radius: 11px; color: #e5484d; background: rgba(229,72,77,.11); }
.dsh-archive-modal-title { margin: 1px 0 3px; font-size: 16px; font-weight: 650; line-height: 22px; }
.dsh-archive-modal-description { margin: 0; font-size: 13px; line-height: 19px; opacity: .62; }
.dsh-archive-modal-session { margin: 18px 0 20px; padding: 11px 12px; border: 1px solid rgba(127,127,127,.18); border-radius: 11px; background: rgba(127,127,127,.07); }
.dsh-archive-modal-session-title { overflow: hidden; font-size: 13px; font-weight: 600; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.dsh-archive-modal-session-project { overflow: hidden; font-size: 12px; line-height: 18px; opacity: .58; text-overflow: ellipsis; white-space: nowrap; }
.dsh-archive-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
.dsh-archive-modal-actions button { min-height: 36px; padding: 0 14px; border: 0; border-radius: 10px; color: inherit; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background-color .15s ease, opacity .15s ease; }
.dsh-archive-modal-cancel { background: rgba(127,127,127,.13); }
.dsh-archive-modal-cancel:hover { background: rgba(127,127,127,.21); }
.dsh-archive-modal-delete { color: #fff !important; background: #d83b40; }
.dsh-archive-modal-delete:hover { background: #c93237; }
@media (max-width: 560px) {
  .dsh-archive-card { align-items: flex-start; flex-wrap: wrap; padding: 12px; }
  .dsh-archive-actions { width: 100%; justify-content: flex-end; }
  .dsh-archive-modal-backdrop { padding: 16px; }
}
`;

function formatTime(ms: number | null): string {
  if (ms === null) return '未知时间';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function groupSessions(sessions: SessionRow[]): SessionGroup[] {
  const groups = new Map<string, SessionGroup>();
  for (const session of sessions) {
    const key = session.projectPath ?? `title:${session.projectTitle}`;
    let group = groups.get(key);
    if (group === undefined) {
      group = { key, title: session.projectTitle, path: session.projectPath, sessions: [] };
      groups.set(key, group);
    }
    group.sessions.push(session);
  }
  return [...groups.values()];
}

function FolderIcon(): React.ReactElement {
  return React.createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
    React.createElement('path', {
      d: 'M3.75 7.75A2.75 2.75 0 0 1 6.5 5h3.1l1.8 2h6.1a2.75 2.75 0 0 1 2.75 2.75v6.5A2.75 2.75 0 0 1 17.5 19h-11a2.75 2.75 0 0 1-2.75-2.75v-8.5Z',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  );
}

function TrashIcon(): React.ReactElement {
  return React.createElement(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
    React.createElement('path', {
      d: 'M8.5 5.5h7M9.5 5.5l.5-1.5h4l.5 1.5M6.5 7.5h11l-.65 10.1A1.5 1.5 0 0 1 15.35 19h-6.7a1.5 1.5 0 0 1-1.5-1.4L6.5 7.5Zm3.5 3v5m4-5v5',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  );
}

function ArchivesSection({ close: _close }: { close: () => void }): React.ReactElement {
  const [sessions, setSessions] = React.useState<SessionRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<{ id: string; action: 'restore' | 'delete' } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SessionRow | null>(null);
  const cancelDeleteRef = React.useRef<HTMLButtonElement>(null);

  const refresh = React.useCallback(() => {
    setError(null);
    fetch('/api/dsh-archive-manager/list')
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json() as Promise<ListResponse>;
      })
      .then((d) => setSessions(d.sessions))
      .catch((e: unknown) => {
        setSessions([]);
        setError(String(e));
      });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (deleteTarget === null) return;
    const frame = window.requestAnimationFrame(() => cancelDeleteRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setDeleteTarget(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [deleteTarget]);

  const performAction = (row: SessionRow, action: 'restore' | 'delete'): void => {
    if (busy !== null) return;
    setBusy({ id: row.id, action });
    setError(null);
    fetch(`/api/dsh-archive-manager/${action === 'restore' ? 'unarchive' : 'delete'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id }),
    })
      .then(async (r) => {
        const data = (await r.json()) as { ok: boolean; error?: string };
        if (!r.ok || !data.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        return data;
      })
      .then(() => {
        setSessions((current) => current?.filter((session) => session.id !== row.id) ?? []);
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setBusy(null));
  };

  const runAction = (row: SessionRow, action: 'restore' | 'delete'): void => {
    if (busy !== null) return;
    if (action === 'delete') {
      setDeleteTarget(row);
      return;
    }
    performAction(row, action);
  };

  const confirmDelete = (): void => {
    const row = deleteTarget;
    if (row === null) return;
    setDeleteTarget(null);
    performAction(row, 'delete');
  };

  const rows =
    sessions === null
      ? null
      : sessions.length === 0
        ? React.createElement('p', { className: 'dsh-archive-empty' }, '没有归档的对话。')
        : React.createElement(
            React.Fragment,
            null,
            groupSessions(sessions).map((group) =>
              React.createElement(
                'section',
                { key: group.key, className: 'dsh-archive-group' },
                React.createElement(
                  'div',
                  { className: 'dsh-archive-group-header', title: group.path ?? group.title },
                  React.createElement(FolderIcon),
                  React.createElement('span', { className: 'dsh-archive-group-title' }, group.title),
                  React.createElement(
                    'span',
                    { className: 'dsh-archive-group-count' },
                    `${group.sessions.length} 个聊天`,
                  ),
                ),
                group.sessions.map((row) => {
                  const restoring = busy?.id === row.id && busy.action === 'restore';
                  return React.createElement(
                    'div',
                    { key: row.id, className: 'dsh-archive-card' },
                    React.createElement(
                      'div',
                      { className: 'dsh-archive-copy', title: row.id },
                      React.createElement('div', { className: 'dsh-archive-title' }, row.title),
                      React.createElement('div', { className: 'dsh-archive-time' }, formatTime(row.updatedAt)),
                    ),
                    React.createElement(
                      'div',
                      { className: 'dsh-archive-actions' },
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-archive-trash',
                          onClick: () => runAction(row, 'delete'),
                          disabled: busy !== null,
                          title: '永久删除',
                          'aria-label': `永久删除「${row.title}」`,
                        },
                        React.createElement(TrashIcon),
                      ),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-archive-restore',
                          onClick: () => runAction(row, 'restore'),
                          disabled: busy !== null,
                        },
                        restoring ? '恢复中…' : '取消归档',
                      ),
                    ),
                  );
                }),
              ),
            ),
          );

  return React.createElement(
    'div',
    { className: 'dsh-archive-root' },
    React.createElement('style', null, STYLES),
    React.createElement('h3', null, '归档管理'),
    React.createElement(
      'p',
      { className: 'dsh-archive-intro' },
      '已归档的对话不会出现在会话列表中，可随时取消归档或永久删除。',
    ),
    error === null ? null : React.createElement('p', { className: 'dsh-archive-error' }, error),
    rows,
    deleteTarget === null
      ? null
      : React.createElement(
          'div',
          {
            className: 'dsh-archive-modal-backdrop',
            onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
              if (event.target === event.currentTarget) setDeleteTarget(null);
            },
          },
          React.createElement(
            'div',
            {
              className: 'dsh-archive-modal',
              role: 'alertdialog',
              'aria-modal': true,
              'aria-labelledby': 'dsh-archive-delete-title',
              'aria-describedby': 'dsh-archive-delete-description',
            },
            React.createElement(
              'div',
              { className: 'dsh-archive-modal-heading' },
              React.createElement('span', { className: 'dsh-archive-modal-icon' }, React.createElement(TrashIcon)),
              React.createElement(
                'div',
                null,
                React.createElement(
                  'div',
                  { id: 'dsh-archive-delete-title', className: 'dsh-archive-modal-title' },
                  '永久删除这条对话？',
                ),
                React.createElement(
                  'p',
                  { id: 'dsh-archive-delete-description', className: 'dsh-archive-modal-description' },
                  '删除后无法恢复，对话记录将从本机彻底移除。',
                ),
              ),
            ),
            React.createElement(
              'div',
              { className: 'dsh-archive-modal-session' },
              React.createElement('div', { className: 'dsh-archive-modal-session-title' }, deleteTarget.title),
              React.createElement(
                'div',
                { className: 'dsh-archive-modal-session-project', title: deleteTarget.projectPath ?? undefined },
                `项目：${deleteTarget.projectTitle}`,
              ),
            ),
            React.createElement(
              'div',
              { className: 'dsh-archive-modal-actions' },
              React.createElement(
                'button',
                {
                  ref: cancelDeleteRef,
                  type: 'button',
                  className: 'dsh-archive-modal-cancel',
                  onClick: () => setDeleteTarget(null),
                },
                '取消',
              ),
              React.createElement(
                'button',
                { type: 'button', className: 'dsh-archive-modal-delete', onClick: confirmDelete },
                '永久删除',
              ),
            ),
          ),
        ),
  );
}

export function apply(ctx: ClientCtx): void {
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'archives',
        order: 30,
        label: '归档管理',
      },
      ArchivesSection,
    ),
  );
}
