/** dsh-wallpaper Host 半区：持久化设置、图片并提供同源 HTTP 接口。 */
import type { Context } from '@deepseek-ai/cordis';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { DEFAULT_SETTINGS, normalizeSettings, type WallpaperSettings } from './logic.js';

export const name = 'wallpaper';
export const inject = ['webServer'];

const DATA_DIR = dshHomePath('storages', 'dsh-wallpaper');
const CONFIG_FILE = join(DATA_DIR, 'config.json');
const IMAGE_FILE = join(DATA_DIR, 'assets', 'current');
const MAX_JSON_BYTES = 64 * 1024;
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;

interface StoredConfig {
  settings: WallpaperSettings;
  imageMime: string | null;
  imageVersion: number;
}

interface ClientState {
  settings: WallpaperSettings;
  hasImage: boolean;
  imageUrl: string | null;
}

const DEFAULT_CONFIG: StoredConfig = {
  settings: { ...DEFAULT_SETTINGS },
  imageMime: null,
  imageVersion: 0,
};

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

async function readConfig(): Promise<StoredConfig> {
  try {
    const parsed = JSON.parse(await readFile(CONFIG_FILE, 'utf8')) as Partial<StoredConfig>;
    return {
      settings: normalizeSettings(parsed.settings),
      imageMime:
        typeof parsed.imageMime === 'string' && /^image\/[a-z0-9.+-]+$/i.test(parsed.imageMime)
          ? parsed.imageMime
          : null,
      imageVersion:
        typeof parsed.imageVersion === 'number' && Number.isFinite(parsed.imageVersion)
          ? Math.max(0, Math.floor(parsed.imageVersion))
          : 0,
    };
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return { ...DEFAULT_CONFIG, settings: { ...DEFAULT_SETTINGS } };
    throw error;
  }
}

async function writeConfig(config: StoredConfig): Promise<void> {
  await writeFileAtomic(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
    dirMode: 0o700,
  });
}

async function imageExists(): Promise<boolean> {
  try {
    return (await stat(IMAGE_FILE)).isFile();
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }
}

async function toClientState(config: StoredConfig): Promise<ClientState> {
  const hasImage = config.settings.imageName !== null && config.imageMime !== null && (await imageExists());
  const settings = hasImage
    ? config.settings
    : normalizeSettings({ ...config.settings, enabled: false, imageName: null });
  return {
    settings,
    hasImage,
    imageUrl: hasImage ? `/api/dsh-wallpaper/image?v=${config.imageVersion}` : null,
  };
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

function readBody(req: Parameters<WebRoute['handler']>[0], limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk: Buffer | string) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > limit) {
        settled = true;
        chunks.length = 0;
        reject(new Error('payload too large'));
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks));
    });
    req.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

function decodeFileName(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return 'wallpaper';
  try {
    const decoded = decodeURIComponent(raw).trim();
    return decoded.length > 0 ? decoded.slice(0, 260) : 'wallpaper';
  } catch {
    return 'wallpaper';
  }
}

async function writeImageAtomic(content: Buffer): Promise<void> {
  await mkdir(dirname(IMAGE_FILE), { recursive: true, mode: 0o700 });
  const temporary = `${IMAGE_FILE}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    await rename(temporary, IMAGE_FILE);
  } finally {
    await rm(temporary, { force: true });
  }
}

export function apply(ctx: Context): void {
  let mutationTail: Promise<void> = Promise.resolve();
  const mutate = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const stateRoute: WebRoute = {
    kind: 'exact',
    path: '/api/dsh-wallpaper/state',
    async handler(req, res) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
      try {
        sendJson(res, 200, await toClientState(await readConfig()));
      } catch (error) {
        sendJson(res, 500, { error: String(error) });
      }
    },
  };

  const settingsRoute: WebRoute = {
    kind: 'exact',
    path: '/api/dsh-wallpaper/settings',
    async handler(req, res) {
      if (req.method !== 'PUT') return sendJson(res, 405, { error: 'method not allowed' });
      try {
        const body = JSON.parse((await readBody(req, MAX_JSON_BYTES)).toString('utf8')) as unknown;
        const state = await mutate(async () => {
          const current = await readConfig();
          const requested = normalizeSettings(body);
          const next: StoredConfig = {
            ...current,
            settings: { ...requested, imageName: current.settings.imageName },
          };
          await writeConfig(next);
          return toClientState(next);
        });
        sendJson(res, 200, await state);
      } catch (error) {
        sendJson(res, 400, { error: String(error) });
      }
    },
  };

  const imageRoute: WebRoute = {
    kind: 'exact',
    path: '/api/dsh-wallpaper/image',
    async handler(req, res) {
      if (req.method === 'GET') {
        try {
          const config = await readConfig();
          if (config.imageMime === null || !(await imageExists())) {
            sendJson(res, 404, { error: 'wallpaper not found' });
            return;
          }
          const info = await stat(IMAGE_FILE);
          res.writeHead(200, {
            'content-type': config.imageMime,
            'content-length': info.size,
            'cache-control': 'private, max-age=31536000, immutable',
          });
          const stream = createReadStream(IMAGE_FILE);
          stream.on('error', (error) => res.destroy(error));
          stream.pipe(res);
        } catch (error) {
          if (!res.headersSent) sendJson(res, 500, { error: String(error) });
        }
        return;
      }

      if (req.method === 'PUT') {
        try {
          const mime = String(req.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
          if (!/^image\/[a-z0-9.+-]+$/.test(mime)) {
            sendJson(res, 415, { error: 'content-type must be image/*' });
            return;
          }
          const content = await readBody(req, MAX_IMAGE_BYTES);
          if (content.length === 0) {
            sendJson(res, 400, { error: 'empty image' });
            return;
          }
          const state = await mutate(async () => {
            await writeImageAtomic(content);
            const current = await readConfig();
            const next: StoredConfig = {
              settings: normalizeSettings({
                ...current.settings,
                enabled: true,
                imageName: decodeFileName(req.headers['x-dsh-wallpaper-filename']),
              }),
              imageMime: mime,
              imageVersion: Math.max(Date.now(), current.imageVersion + 1),
            };
            await writeConfig(next);
            return toClientState(next);
          });
          sendJson(res, 200, await state);
        } catch (error) {
          sendJson(res, error instanceof Error && error.message === 'payload too large' ? 413 : 500, {
            error: String(error),
          });
        }
        return;
      }

      if (req.method === 'DELETE') {
        try {
          const state = await mutate(async () => {
            await rm(IMAGE_FILE, { force: true });
            const current = await readConfig();
            const next: StoredConfig = {
              settings: normalizeSettings({ ...current.settings, enabled: false, imageName: null }),
              imageMime: null,
              imageVersion: Math.max(Date.now(), current.imageVersion + 1),
            };
            await writeConfig(next);
            return toClientState(next);
          });
          sendJson(res, 200, await state);
        } catch (error) {
          sendJson(res, 500, { error: String(error) });
        }
        return;
      }

      sendJson(res, 405, { error: 'method not allowed' });
    },
  };

  ctx.webServer.register(stateRoute);
  ctx.webServer.register(settingsRoute);
  ctx.webServer.register(imageRoute);
}
