import type { Agent } from '@deepseek-ai/dsh-agent';

interface ToolSchemaLike {
  name: string;
  description?: string;
  parameters?: unknown;
}

export const MAX_REQUEST_BYTES = 1_000_000;
export const MCP_RECENT_MS = 30_000;

export interface BridgeConfig {
  enabled: boolean;
}

export function normalizeConfig(value: { enabled?: boolean }): BridgeConfig {
  return { enabled: value.enabled ?? true };
}

export function bearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined || !value.startsWith('Bearer ')) return undefined;
  const token = value.slice('Bearer '.length).trim();
  return token.length === 0 ? undefined : token;
}

export function selectAgent(
  agents: readonly Agent[],
  activity: ReadonlyMap<string, number>,
  requestedId?: string,
): Agent | undefined {
  if (requestedId !== undefined) return agents.find((agent) => String(agent.id) === requestedId);
  return [...agents].sort((left, right) => {
    if (left.status !== right.status) return left.status === 'running' ? -1 : 1;
    const active = (activity.get(String(right.id)) ?? 0) - (activity.get(String(left.id)) ?? 0);
    if (active !== 0) return active;
    return agents.indexOf(right) - agents.indexOf(left);
  })[0];
}

export function isRecent(timestamp: number | undefined, now = Date.now()): boolean {
  return timestamp !== undefined && now - timestamp <= MCP_RECENT_MS;
}

export function publicToolSchemas<T extends ToolSchemaLike>(schemas: readonly T[]): T[] {
  return schemas.filter((schema) => schema.name !== 'run_code');
}

export function codeModeToolArguments(
  toolName: string,
  toolArguments: unknown,
  runCodeSchema: ToolSchemaLike,
): { code: string; description: string } {
  const language = /python/i.test(runCodeSchema.description ?? '') ? 'python' : 'typescript';
  const name = JSON.stringify(toolName);
  const serialized = JSON.stringify(toolArguments ?? {});
  if (serialized === undefined) throw new Error(`工具参数无法序列化：${toolName}`);
  const literal = language === 'python'
    ? `__import__("json").loads(${JSON.stringify(serialized)})`
    : serialized;
  return {
    code: `return await tools[${name}](${literal});`,
    description: `Run ${toolName} for Codex`,
  };
}
