/** Provider-neutral transient resource references shared by DFY DSH plugins. */

export const RESOURCE_PROTOCOL_VERSION = 1 as const;
export const RESOURCE_REFERENCE_PREFIX = 'dfyr1_';
export const PROCESS_RESOURCE_REGISTRY_SYMBOL_KEY = '@dfy-plugins/resource-core/process-registry/v1';

const MAX_REFERENCE_LENGTH = 2048;
const PROVIDER_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const KIND_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{8,256}$/;

export interface ResourceReferenceV1 {
  version: typeof RESOURCE_PROTOCOL_VERSION;
  provider: string;
  kind: string;
  id: string;
}

export interface ResolvedResource {
  kind: string;
  data?: Uint8Array;
  mediaType?: string;
  bytes?: number;
  name?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ResourceProvider {
  readonly id: string;
  resolve(reference: ResourceReferenceV1, signal?: AbortSignal): Promise<ResolvedResource | undefined>;
}

export interface ResourceTextFallback {
  kind: string;
  name?: string;
  path?: string;
  url?: string;
  mediaType?: string;
  bytes?: number;
}

function validReferencePart(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

export function encodeResourceReference(reference: ResourceReferenceV1): string {
  if (reference.version !== RESOURCE_PROTOCOL_VERSION
    || !validReferencePart(reference.provider, PROVIDER_PATTERN)
    || !validReferencePart(reference.kind, KIND_PATTERN)
    || !validReferencePart(reference.id, RESOURCE_ID_PATTERN)) {
    throw new Error('resource reference is invalid');
  }
  const encoded = Buffer.from(JSON.stringify({
    v: reference.version,
    p: reference.provider,
    k: reference.kind,
    i: reference.id,
  }), 'utf8').toString('base64url');
  return `${RESOURCE_REFERENCE_PREFIX}${encoded}`;
}

export function decodeResourceReference(token: string): ResourceReferenceV1 {
  const value = token.trim();
  if (value.length <= RESOURCE_REFERENCE_PREFIX.length
    || value.length > MAX_REFERENCE_LENGTH
    || !value.startsWith(RESOURCE_REFERENCE_PREFIX)) {
    throw new Error('resource reference is invalid');
  }
  const encoded = value.slice(RESOURCE_REFERENCE_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('resource reference is invalid');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new Error('resource reference is invalid');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('resource reference is invalid');
  }
  const record = parsed as Record<string, unknown>;
  if (record.v !== RESOURCE_PROTOCOL_VERSION
    || !validReferencePart(record.p, PROVIDER_PATTERN)
    || !validReferencePart(record.k, KIND_PATTERN)
    || !validReferencePart(record.i, RESOURCE_ID_PATTERN)
    || Object.keys(record).some((key) => !['v', 'p', 'k', 'i'].includes(key))) {
    throw new Error('resource reference is invalid');
  }
  return {
    version: RESOURCE_PROTOCOL_VERSION,
    provider: record.p,
    kind: record.k,
    id: record.i,
  };
}

function providerId(provider: ResourceProvider): string {
  if (!PROVIDER_PATTERN.test(provider.id)) throw new Error('resource provider id is invalid');
  return provider.id;
}

/** In-process broker. Providers retain ownership and authorization of their resources. */
export class ResourceRegistry {
  readonly version = RESOURCE_PROTOCOL_VERSION;
  readonly #providers = new Map<string, ResourceProvider>();

  registerProvider(provider: ResourceProvider): () => void {
    const id = providerId(provider);
    if (this.#providers.has(id)) throw new Error(`resource provider already registered: ${id}`);
    this.#providers.set(id, provider);
    return () => {
      if (this.#providers.get(id) === provider) this.#providers.delete(id);
    };
  }

  hasProvider(id: string): boolean {
    return this.#providers.has(id);
  }

  listProviders(): string[] {
    return [...this.#providers.keys()].sort();
  }

  async resolve(token: string, expectedKind?: string, signal?: AbortSignal): Promise<ResolvedResource> {
    signal?.throwIfAborted();
    const reference = decodeResourceReference(token);
    if (expectedKind !== undefined && reference.kind !== expectedKind) {
      throw new Error(`resource kind mismatch: expected ${expectedKind}, received ${reference.kind}`);
    }
    const provider = this.#providers.get(reference.provider);
    if (provider === undefined) throw new Error(`resource provider is unavailable: ${reference.provider}`);
    const resource = await provider.resolve(reference, signal);
    signal?.throwIfAborted();
    if (resource === undefined) throw new Error('resource is unavailable or expired');
    if (resource.kind !== reference.kind) throw new Error('resource provider returned a mismatched kind');
    if (resource.data !== undefined && resource.bytes !== undefined && resource.data.byteLength !== resource.bytes) {
      throw new Error('resource provider returned inconsistent byte metadata');
    }
    return resource;
  }
}

function isCompatibleRegistry(value: unknown): value is ResourceRegistry {
  if (typeof value !== 'object' || value === null) return false;
  const registry = value as Partial<ResourceRegistry>;
  return registry.version === RESOURCE_PROTOCOL_VERSION
    && typeof registry.registerProvider === 'function'
    && typeof registry.hasProvider === 'function'
    && typeof registry.listProviders === 'function'
    && typeof registry.resolve === 'function';
}

/**
 * Process-local singleton shared even when independently bundled plugins load
 * different physical copies of this package. No resource data crosses JSON.
 */
export function getProcessResourceRegistry(): ResourceRegistry {
  const key = Symbol.for(PROCESS_RESOURCE_REGISTRY_SYMBOL_KEY);
  const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };
  const existing = globals[key];
  if (existing !== undefined) {
    if (!isCompatibleRegistry(existing)) throw new Error('process resource registry version conflict');
    return existing;
  }
  const registry = new ResourceRegistry();
  globals[key] = registry;
  return registry;
}

function displayValue(value: string, limit: number): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

/** Safe readable fallback for a consumer that cannot project the resource itself. */
export function renderResourceTextFallback(resource: ResourceTextFallback): string {
  const kind = displayValue(resource.kind, 64) || 'resource';
  const lines = [`Resource available (${kind}).`];
  if (resource.name !== undefined) lines.push(`Name: ${displayValue(resource.name, 255)}`);
  if (resource.mediaType !== undefined) lines.push(`Media type: ${displayValue(resource.mediaType, 127)}`);
  if (resource.bytes !== undefined) lines.push(`Bytes: ${String(resource.bytes)}`);
  if (resource.path !== undefined) lines.push(`Local path: ${displayValue(resource.path, 2048)}`);
  if (resource.url !== undefined) lines.push(`Source URL: ${displayValue(resource.url, 2048)}`);
  return lines.join('\n');
}
