/** 把壁纸 Client 半区打包成 DSH __ModuleLoader__ 模块。 */
import { build } from 'esbuild';
import { readFile, rm, writeFile } from 'node:fs/promises';

const TEMP = 'lib/.client.bundle.js';
const OUT = 'lib/client.js';

await build({
  entryPoints: ['src/client.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom/client',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  outfile: TEMP,
  logLevel: 'info',
});

const raw = await readFile(TEMP, 'utf8');
const wrapped = `window.__ModuleLoader__.load({\n  id: "dsh-wallpaper",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${raw}\n    return module.exports;\n  }\n});\n`;
await writeFile(OUT, wrapped);
await rm(TEMP);
console.log(`wrote ${OUT} (${wrapped.length} bytes)`);
