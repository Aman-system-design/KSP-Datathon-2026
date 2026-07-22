import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { checkWebBundle } from '../../scripts/ci/check-web-bundle.mjs';

async function fixture({ main = 'application', map = 'maplibre', optional = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ksp-bundle-'));
  await mkdir(join(directory, '.vite')); await mkdir(join(directory, 'assets'));
  const manifest = {
    'index.html': { file: 'assets/index.js', isEntry: true, imports: [], dynamicImports: ['src/features/geospatial/GeospatialStudio.jsx'] },
    'src/features/geospatial/GeospatialStudio.jsx': {
      file: 'assets/studio.js', isDynamicEntry: true,
      dynamicImports: optional ? ['../node_modules/@deck.gl/aggregation-layers/dist/index.js', '../node_modules/@deck.gl/geo-layers/dist/index.js'] : [],
    },
  };
  await writeFile(join(directory, '.vite/manifest.json'), JSON.stringify(manifest));
  await writeFile(join(directory, 'assets/index.js'), main);
  await writeFile(join(directory, 'assets/studio.js'), 'studio');
  await writeFile(join(directory, 'assets/maplibre-vendor-test.js'), map);
  return directory;
}

test('accepts isolated, optional geospatial chunks within gzip budgets', async () => {
  const result = await checkWebBundle(await fixture());
  assert.equal(result.chunks.length, 3);
});

test('rejects a Studio build that eagerly includes optional renderers', async () => {
  await assert.rejects(checkWebBundle(await fixture({ optional: false })), /heatmap renderer must remain optional/);
});
