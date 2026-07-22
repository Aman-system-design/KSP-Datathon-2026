import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contractPath = new URL('../../docs/architecture/mvp-build-contract.md', import.meta.url);
const webPackagePath = new URL('../../web/package.json', import.meta.url);
const noticesPath = new URL('../../THIRD_PARTY_NOTICES.md', import.meta.url);

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
    assert.equal(typeof webPackage.dependencies[name], 'string', `${name} must be a direct dependency`);
  }

  const notices = await readFile(noticesPath, 'utf8');
  for (const [name, license] of Object.entries(approved)) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(notices, new RegExp(`${escapedName}.*${license}`, 'i'));
  }
});
