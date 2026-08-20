const BRIDGE_SOURCE = 'dsh-visualize';

export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_ASSET_BYTES = 24 * 1024 * 1024;
export const MAX_ASSETS = 24;

export interface VisualizationMeta {
  kind: 'dsh-visualization';
  version: 1;
  sessionId: string;
  artifactId: string;
  title: string;
  assetCount: number;
}

export function normalizeTitle(value: string | undefined, fallback: string): string {
  const title = value?.trim() || fallback.trim() || '交互式可视化';
  return title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, 120);
}

export function validateAssetName(value: string): string {
  const name = value.normalize('NFC');
  if (name.length === 0 || name.length > 160 || name === '.' || name === '..') {
    throw new Error(`invalid visualization asset name: ${JSON.stringify(value)}`);
  }
  if (/[\\/\u0000-\u001f\u007f]/.test(name)) {
    throw new Error(`visualization asset name contains an unsafe character: ${JSON.stringify(value)}`);
  }
  return name;
}

export function visualizationUrl(meta: Pick<VisualizationMeta, 'sessionId' | 'artifactId'>): string {
  return `/api/dsh-visualize/artifacts/${encodeURIComponent(meta.sessionId)}/${encodeURIComponent(meta.artifactId)}/index.html`;
}

export function injectVisualizationBridge(html: string, artifactId: string): string {
  const script = `<script data-dsh-visualize-bridge>(()=>{\n`
    + `const source=${JSON.stringify(BRIDGE_SOURCE)};const artifactId=${JSON.stringify(artifactId)};\n`
    + `let frame=0;const measure=()=>{frame=0;const d=document.documentElement,b=document.body;const height=Math.max(d?.offsetHeight||0,b?.scrollHeight||0,b?.offsetHeight||0,Math.ceil(b?.getBoundingClientRect().height||0));parent.postMessage({source,type:'resize',artifactId,height},'*')};\n`
    + `const schedule=()=>{if(frame===0)frame=requestAnimationFrame(measure)};\n`
    + `addEventListener('load',schedule);addEventListener('resize',schedule);\n`
    + `addEventListener('message',(event)=>{if(event.source!==parent||event.data?.source!==source||event.data?.type!=='theme')return;const theme=event.data.theme==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;schedule()});\n`
    + `new ResizeObserver(schedule).observe(document.documentElement);if(document.body)new ResizeObserver(schedule).observe(document.body);schedule();\n`
    + `})()</script>`;
  const closingBody = /<\/body\s*>/i;
  return closingBody.test(html) ? html.replace(closingBody, `${script}</body>`) : `${html}${script}`;
}

export function parseVisualizationMeta(value: unknown): VisualizationMeta | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const meta = value as Partial<VisualizationMeta>;
  if (meta.kind !== 'dsh-visualization' || meta.version !== 1) return undefined;
  if (typeof meta.sessionId !== 'string' || meta.sessionId.length === 0 || meta.sessionId.length > 200) return undefined;
  if (typeof meta.artifactId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(meta.artifactId)) {
    return undefined;
  }
  if (typeof meta.title !== 'string' || meta.title.length === 0 || meta.title.length > 120) return undefined;
  if (!Number.isSafeInteger(meta.assetCount) || (meta.assetCount ?? -1) < 0 || (meta.assetCount ?? 0) > MAX_ASSETS) {
    return undefined;
  }
  return meta as VisualizationMeta;
}
