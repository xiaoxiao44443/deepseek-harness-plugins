/**
 * 归档会话的核心逻辑（纯 Node 模块，便于单测）。
 *
 * 事实来源约定：
 * - 归档集合：$DSH_HOME/storages/workspace.json 的 global.archivedSessionIds
 * - 会话数据：$DSH_HOME/sessions/<workspace>/session-<uuid>/（持久化层按目录扫描）
 * - 删除 = 删除会话目录，并保留归档 id 作为当前 Host 生命周期内的隐藏墓碑；
 *   否则内存中的旧会话投影会短暂变成无法打开的“幽灵会话”。
 */
import { readFile, readdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

/** dsh 数据根目录（与 dsh CLI 的 DSH_HOME 约定一致）。 */
export function dshHome(): string {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh');
}

/** 会话持久化根目录。 */
export function sessionsRoot(): string {
  return join(dshHome(), 'sessions');
}

/** workspace 注册表文件路径（归档集合的权威来源）。 */
export function workspaceJsonPath(): string {
  return join(dshHome(), 'storages', 'workspace.json');
}

/** 会话列表投影缓存（标题、创建时间和最后一次提问时间）。 */
export function sessionProjectionJsonPath(): string {
  return join(dshHome(), 'storages', 'session_projcache.json');
}

const SESSION_ID_RE =
  /^session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 会话 id 是否形如 session-<uuid>。 */
export function isValidSessionId(id: string): boolean {
  return SESSION_ID_RE.test(id);
}

/** 读取归档会话 id 集合；workspace.json 缺失或损坏时返回空集合。 */
export async function readArchivedIds(): Promise<string[]> {
  try {
    const raw = await readFile(workspaceJsonPath(), 'utf8');
    const data: unknown = JSON.parse(raw);
    const ids = (data as { global?: { archivedSessionIds?: unknown } })?.global?.archivedSessionIds;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export interface ArchivedSession {
  id: string;
  title: string;
  projectTitle: string;
  projectPath: string | null;
  updatedAt: number | null;
}

interface WorkspaceRecord {
  path?: unknown;
  title?: unknown;
  sessionIds?: unknown;
}

interface WorkspaceStore {
  tables?: {
    workspaces?: Record<string, WorkspaceRecord>;
  };
}

interface SessionProjection {
  identity?: {
    createdAt?: unknown;
    cwd?: unknown;
  };
  rows?: {
    title?: { val?: unknown };
    sessionListMetadata?: { val?: { lastPromptAt?: unknown } };
  };
}

interface SessionProjectionStore {
  tables?: {
    sessions?: Record<string, SessionProjection>;
  };
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * 列出所有仍存在于磁盘的归档会话（按最后修改时间倒序）。
 * 只返回「归档集合 ∩ 磁盘目录」中的会话。
 */
export async function listArchivedSessions(): Promise<ArchivedSession[]> {
  const archived = new Set(await readArchivedIds());
  const out: ArchivedSession[] = [];
  const workspaceStore = await readJson<WorkspaceStore>(workspaceJsonPath());
  const projectionStore = await readJson<SessionProjectionStore>(sessionProjectionJsonPath());
  const workspaceBySession = new Map<string, { title: string; path: string | null }>();

  for (const workspace of Object.values(workspaceStore?.tables?.workspaces ?? {})) {
    if (!Array.isArray(workspace.sessionIds)) continue;
    const path = nonEmptyString(workspace.path) ?? null;
    const title = nonEmptyString(workspace.title) ?? (path === null ? '无项目' : basename(path));
    for (const sessionId of workspace.sessionIds) {
      if (typeof sessionId === 'string' && !workspaceBySession.has(sessionId)) {
        workspaceBySession.set(sessionId, { title, path });
      }
    }
  }

  let projects: string[] = [];
  try {
    projects = await readdir(sessionsRoot());
  } catch {
    return out;
  }
  for (const project of projects) {
    let entries: string[] = [];
    try {
      entries = await readdir(join(sessionsRoot(), project));
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!archived.has(entry) || !isValidSessionId(entry)) continue;
      try {
        const st = await stat(join(sessionsRoot(), project, entry));
        const projection = projectionStore?.tables?.sessions?.[entry];
        const cachedCwd = nonEmptyString(projection?.identity?.cwd) ?? null;
        const workspace = workspaceBySession.get(entry);
        const projectPath = workspace?.path ?? cachedCwd;
        const projectTitle = workspace?.title ?? (projectPath === null ? '无项目' : basename(projectPath));
        const title = nonEmptyString(projection?.rows?.title?.val) ?? entry;
        const updatedAt =
          finiteNumber(projection?.rows?.sessionListMetadata?.val?.lastPromptAt) ??
          finiteNumber(st.mtimeMs) ??
          finiteNumber(projection?.identity?.createdAt) ??
          null;
        out.push({ id: entry, title, projectTitle, projectPath, updatedAt });
      } catch {
        // 目录被并发删除等情形：跳过
      }
    }
  }
  out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return out;
}

/**
 * 永久删除一个归档会话的磁盘目录。
 * 安全约束：id 必须形如 session-<uuid> 且必须在归档集合中，
 * 双重校验防止路径注入与误删活跃会话。
 * @returns 删除的目录数量（0 = 未归档或不存在）。
 */
export async function deleteArchivedSession(id: string): Promise<number> {
  if (!isValidSessionId(id)) throw new Error(`invalid session id: ${JSON.stringify(id)}`);
  const archived = new Set(await readArchivedIds());
  if (!archived.has(id)) return 0;
  let projects: string[] = [];
  try {
    projects = await readdir(sessionsRoot());
  } catch {
    return 0;
  }
  let deleted = 0;
  for (const project of projects) {
    const target = join(sessionsRoot(), project, id);
    try {
      await stat(target);
      await rm(target, { recursive: true });
      deleted += 1;
    } catch {
      // 不存在或删除失败：继续其他项目目录
    }
  }
  return deleted;
}
