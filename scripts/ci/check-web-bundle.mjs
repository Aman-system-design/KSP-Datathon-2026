import { gzipSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const KIB = 1024;
export const BUDGETS = Object.freeze({ mainGzip: 100 * KIB, studioGzip: 100 * KIB, chunkGzip: 300 * KIB });

function invariant(condition, message) { if (!condition) throw new Error(message); }

export async function checkWebBundle(distDirectory = resolve('web/dist')) {
  const manifest = JSON.parse(await readFile(resolve(distDirectory, '.vite/manifest.json'), 'utf8'));
  const main = manifest['index.html'];
  const studio = manifest['src/features/geospatial/GeospatialStudio.jsx'];
  invariant(main?.isEntry === true, 'main web entry is missing from the Vite manifest');
  invariant(studio?.isDynamicEntry === true, 'Geospatial Studio must remain a dynamic entry');
  invariant(main.dynamicImports?.includes('src/features/geospatial/GeospatialStudio.jsx'), 'main entry must lazy-load Geospatial Studio');
  invariant(!(main.imports ?? []).some(key => manifest[key]?.name === 'maplibre-vendor'), 'main entry must not statically import MapLibre');
  invariant((studio.dynamicImports ?? []).some(key => key.includes('@deck.gl/aggregation-layers')), 'heatmap renderer must remain optional');
  invariant((studio.dynamicImports ?? []).some(key => key.includes('@deck.gl/geo-layers')), 'H3 renderer must remain optional');

  const gzipSize = async file => gzipSync(await readFile(resolve(distDirectory, file)), { level: 9 }).length;
  const mainSize = await gzipSize(main.file);
  const studioSize = await gzipSize(studio.file);
  invariant(mainSize <= BUDGETS.mainGzip, `main entry gzip ${mainSize} exceeds ${BUDGETS.mainGzip}`);
  invariant(studioSize <= BUDGETS.studioGzip, `Studio entry gzip ${studioSize} exceeds ${BUDGETS.studioGzip}`);

  const javascript = (await readdir(resolve(distDirectory, 'assets'))).filter(file => file.endsWith('.js'));
  const measured = [];
  for (const file of javascript) {
    const gzip = await gzipSize(`assets/${file}`);
    invariant(gzip <= BUDGETS.chunkGzip, `${file} gzip ${gzip} exceeds ${BUDGETS.chunkGzip}`);
    measured.push({ file, gzip });
  }
  invariant(measured.some(item => item.file.startsWith('maplibre-vendor-')), 'MapLibre vendor chunk is missing');
  return Object.freeze({ mainGzip: mainSize, studioGzip: studioSize, chunks: Object.freeze(measured) });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkWebBundle();
  console.log(`PASS: web bundle budgets (main ${result.mainGzip} B gzip; Studio ${result.studioGzip} B gzip; ${result.chunks.length} JS chunks).`);
}
