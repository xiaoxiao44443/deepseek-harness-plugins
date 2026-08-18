/**
 * 把 src/client.ts 打包成浏览器端 __ModuleLoader__ 模块。
 *
 * 官方 client 插件的加载格式：
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ...; return module.exports; } })
 * esbuild 以 CJS 打包（react 保持 external），再套上该包装。
 */
import { build } from 'esbuild';
import { readFile, rm, writeFile } from 'node:fs/promises';

const TEMP = 'lib/.client.bundle.js';
const OUT = 'lib/client.js';

await build({
  entryPoints: ['src/client.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react/jsx-runtime'],
  outfile: TEMP,
  logLevel: 'info',
});

const raw = await readFile(TEMP, 'utf8');
const wrapped = `window.__ModuleLoader__.load({\n  id: "@dfy-plugins/dsh-archive-manager",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${raw}\n    return module.exports;\n  }\n});\n`;
await writeFile(OUT, wrapped);
await rm(TEMP);
console.log(`wrote ${OUT} (${wrapped.length} bytes)`);
