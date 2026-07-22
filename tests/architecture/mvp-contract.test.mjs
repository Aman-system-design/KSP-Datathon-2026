import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const contractPath = new URL('../../docs/architecture/mvp-build-contract.md', import.meta.url);
const webPackagePath = new URL('../../web/package.json', import.meta.url);
const packageLockPath = new URL('../../package-lock.json', import.meta.url);
const noticesPath = new URL('../../THIRD_PARTY_NOTICES.md', import.meta.url);
const attributionScriptPath = new URL('../../scripts/licenses/geospatial-attribution.mjs', import.meta.url);
const attributionPath = new URL('../../web/public/third-party-licenses.txt', import.meta.url);

test('the authoritative MVP contract locks challenge, users, routes, and APIs', async () => {
  const contract = await readFile(contractPath, 'utf8');

  for (let id = 1; id <= 11; id += 1) {
    assert.match(contract, new RegExp(`CH02-${String(id).padStart(2, '0')}`));
  }

  for (const route of [
    '/leadership',
    '/district/:unitId',
    '/analyst/alerts/:alertId',
    '/operations',
  ]) {
    assert.ok(contract.includes(route), `missing route ${route}`);
  }

  for (const api of [
    'GET /v1/intelligence/brief',
    'GET /v1/patterns',
    'GET /v1/patterns/{patternId}',
    'GET /v1/hotspots',
    'GET /v1/anomalies',
    'GET /v1/area-risk',
    'GET /v1/networks/{nodeId}',
    'GET /v1/district-context',
    'POST /v1/alerts/{alertId}/acknowledge',
    'POST /v1/alerts/{alertId}/assign',
    'POST /v1/alerts/{alertId}/analyst-conclusion',
    'POST /v1/alerts/{alertId}/outcome',
  ]) {
    assert.ok(contract.includes(api), `missing API ${api}`);
  }

  for (const experience of [
    'State Leadership',
    'District/Division Leadership',
    'Crime Analyst',
    'Station/Investigator Operations',
  ]) {
    assert.ok(contract.includes(experience), `missing experience ${experience}`);
  }

  assert.match(contract, /single source of truth/i);
  assert.match(contract, /CCTV/i);
  assert.match(contract, /social media/i);
  assert.match(contract, /deferred/i);
});

test('the web runtime declares approved geospatial dependencies and licenses', async () => {
  const webPackage = JSON.parse(await readFile(webPackagePath, 'utf8'));
  const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));
  const approved = {
    'maplibre-gl': 'BSD-3-Clause',
    '@deck.gl/core': 'MIT',
    '@deck.gl/layers': 'MIT',
    '@deck.gl/geo-layers': 'MIT',
    '@deck.gl/mapbox': 'MIT',
    'h3-js': 'Apache-2.0',
    pmtiles: 'BSD-3-Clause',
    supercluster: 'ISC',
  };

  for (const name of Object.keys(approved)) {
    const spec = webPackage.dependencies[name];
    const locked = packageLock.packages[`node_modules/${name}`];
    assert.match(spec, /^[~^]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, `${name} must use a registry semver spec`);
    assert.equal(spec.replace(/^[~^]/, ''), locked.version, `${name} spec must match its locked version`);
    assert.match(locked.resolved, /^https:\/\/registry\.npmjs\.org\//, `${name} must resolve from npm registry`);
    assert.match(locked.integrity, /^sha512-/, `${name} must have sha512 integrity`);
  }

  const notices = await readFile(noticesPath, 'utf8');
  const noticeRows = new Map(notices.split('\n')
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    .filter(cells => /^`[^`]+`$/.test(cells[0] ?? ''))
    .map(([packageName, ...cells]) => [packageName.slice(1, -1), cells]));
  for (const [name, license] of Object.entries(approved)) {
    const row = noticeRows.get(name);
    assert.ok(row, `${name} must have a structured notice row`);
    assert.equal(row[1], license, `${name} notice must use its approved license`);
    assert.match(row[2], /^https:\/\/github\.com\//, `${name} notice must link upstream`);
  }

  const output = execFileSync(process.execPath, [fileURLToPath(attributionScriptPath), '--check'], { encoding: 'utf8' });
  assert.match(output, /PASS: geospatial attribution artifact is current/);

  const attribution = await readFile(attributionPath, 'utf8');
  assert.match(attribution, /^Package: @deck\.gl\/extensions$/m);
  assert.match(attribution, /^Package: @deck\.gl\/mesh-layers$/m);
});

test('geospatial attribution includes required peers, excludes optional peers, and rejects missing legal text', async () => {
  const { productionClosure, readPackageLicenseFiles } = await import(attributionScriptPath);
  const packages = {
    'node_modules/root': {
      dependencies: { required: '1.0.0' },
      optionalDependencies: { optional: '1.0.0' },
      peerDependencies: { peer: '1.0.0', peerOptional: '1.0.0' },
      peerDependenciesMeta: { peerOptional: { optional: true } },
    },
    'node_modules/required': { version: '1.0.0' },
    'node_modules/optional': { version: '1.0.0', optional: true },
    'node_modules/peer': { version: '1.0.0', peer: true },
    'node_modules/peerOptional': { version: '1.0.0', optional: true, peer: true },
  };

  const closure = await productionClosure(packages, ['root'], async () => true);
  assert.deepEqual(closure.sort(), ['node_modules/peer', 'node_modules/required', 'node_modules/root']);

  const emptyPackage = await mkdtemp(join(tmpdir(), 'ksp-license-test-'));
  try {
    await assert.rejects(
      readPackageLicenseFiles(emptyPackage, 'unlisted@1.0.0'),
      /Missing LICENSE\/NOTICE text for unlisted@1\.0\.0/,
    );
  } finally {
    await rm(emptyPackage, { recursive: true });
  }
});
