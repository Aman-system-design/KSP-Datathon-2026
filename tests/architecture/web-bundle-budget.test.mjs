import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

test('accepts optional renderers dynamically imported by a shared Studio dependency', async () => {
  const directory = await fixture();
  const manifestPath = join(directory, '.vite/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest['src/features/geospatial/GeospatialStudio.jsx'].dynamicImports = [];
  manifest['src/features/geospatial/GeospatialStudio.jsx'].imports = ['_geospatial-shared.js'];
  manifest['_geospatial-shared.js'] = {
    file: 'assets/geospatial-shared.js', name: 'geospatial-shared',
    dynamicImports: ['../node_modules/@deck.gl/aggregation-layers/dist/index.js', '../node_modules/@deck.gl/geo-layers/dist/index.js'],
  };
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(join(directory, 'assets/geospatial-shared.js'), 'shared');

  const result = await checkWebBundle(directory);
  assert.equal(result.chunks.length, 4);
});
