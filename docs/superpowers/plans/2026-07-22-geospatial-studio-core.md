# Geospatial Studio Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed Leaflet hotspot page with a reusable, governed MapLibre/deck.gl Geospatial Studio that renders current KSP intelligence, persists scoped map views, reuses them in reports/dashboards, and refreshes safely when a new analytical run is published.

**Architecture:** A small pure-JavaScript `@ksp/geospatial-core` package owns dataset/view validation and renderer-neutral layer compilation. Catalyst Functions expose authorized dataset, layer-execution, and saved-view resources; the React SPA uses one lazy-loaded MapLibre/deck.gl renderer in Studio and embedded widgets. Existing analytical APIs remain the source of truth, so the first release displays executed hotspots and other spatially complete results without fabricated coordinates.

**Tech Stack:** React 19, Vite, Catalyst Functions/Data Store/Authentication/API Gateway, MapLibre GL JS, deck.gl, H3, PMTiles protocol, Supercluster, Vitest, Node test runner, CircleCI.

**Authoritative design:** `docs/superpowers/specs/2026-07-22-geospatial-studio-design.md`

---

## Delivery boundary

This plan delivers the first independently deployable subsystem:

- shared geospatial contracts and layer compiler;
- authorized catalog for existing hotspot, anomaly, area-risk, and alert datasets;
- MapLibre/deck.gl Studio with point, cluster, heatmap, H3, and choropleth capability;
- explicit unavailable states where current sources lack usable geometry;
- evidence drawer and accessible visible-feature table;
- persisted versioned map views with owner/visibility/scope enforcement;
- map reuse in report/dashboard surfaces;
- freshness polling and non-disruptive refresh after atomic analytical publication;
- deterministic CI and full repository verification.

Governed CSV/GeoJSON imports, Stratus PMTiles publication/range validation, and the QuickML map assistant receive separate plans after this subsystem is working. The PMTiles client dependency and protocol boundary are installed now so later storage work does not replace the renderer.

## File structure

### New shared package

- `packages/geospatial-core/package.json` — workspace package metadata and exports.
- `packages/geospatial-core/src/contracts.mjs` — validation/normalization of dataset, layer, and map-view definitions.
- `packages/geospatial-core/src/compile-layer.mjs` — deterministic renderer-neutral execution request compilation.
- `packages/geospatial-core/src/index.mjs` — public package surface.
- `tests/geospatial/contracts.test.mjs` — contract and security-negative tests.
- `tests/geospatial/compile-layer.test.mjs` — supported/unsupported layer compilation tests.

### Backend

- `functions/crime_intelligence_api/app/src/backend/geospatial/dataset-catalog.mjs` — immutable registered semantic datasets.
- `functions/crime_intelligence_api/app/src/backend/geospatial/layer-service.mjs` — authorized dataset listing and execution.
- `functions/crime_intelligence_api/app/src/backend/geospatial/map-view-service.mjs` — versioned view CRUD and sharing policy.
- `functions/crime_intelligence_api/app/src/backend/http/api-contract.mjs` — declared geospatial routes.
- `functions/crime_intelligence_api/app/src/backend/catalyst/api-bootstrap.mjs` — service composition.
- `functions/crime_intelligence_api/app/src/backend/repository/catalyst/catalyst-repository.mjs` — Data Store view persistence.
- `schema/catalyst/intelligence-schema.json` — `CFG_MapView` and `CFG_MapViewVersion` tables.
- `scripts/schema/validate-intelligence-schema.mjs` — updated table contract.
- `tests/backend/geospatial-layer-service.test.mjs` — access, geometry, limits, and envelope behavior.
- `tests/backend/map-view-service.test.mjs` — ownership, versioning, visibility, and cross-scope rejection.
- `tests/catalyst/geospatial-repository.test.mjs` — row mapping and compare-and-swap persistence.
- `tests/schema/intelligence-schema.test.mjs` — new table assertions.

### Frontend

- `web/src/features/geospatial/GeospatialStudio.jsx` — map-first workspace orchestration.
- `web/src/features/geospatial/MapCanvas.jsx` — MapLibre lifecycle and deck.gl overlay adapter.
- `web/src/features/geospatial/layer-adapters.js` — compiled layer result to deck.gl layer objects.
- `web/src/features/geospatial/LayerPanel.jsx` — datasets, layers, visibility, and order.
- `web/src/features/geospatial/LayerInspector.jsx` — progressive data/geometry/visual/interaction settings.
- `web/src/features/geospatial/EvidenceDrawer.jsx` — evidence, provenance, run metadata, and authorized drilldown.
- `web/src/features/geospatial/VisibleFeatureTable.jsx` — keyboard/screen-reader alternative.
- `web/src/features/geospatial/useGeospatialWorkspace.js` — load, abort, freshness, and refresh state.
- `web/src/features/geospatial/map-style.js` — controlled OpenFreeMap fallback style and attribution.
- `web/src/features/geospatial/*.test.jsx` and `*.test.js` — component and adapter tests.
- `web/src/app/router.jsx` — lazy `/geospatial` route and old `/maps` redirect.
- `web/src/app/workspace-navigation.js` — geospatial navigation item.
- `web/src/features/reports/ReportBuilder.jsx` — map-view selection for map reports.
- `web/src/features/dashboards/DashboardWorkspace.jsx` — lazy embedded map widget.
- `web/src/styles/app.css` — Studio layout only; existing tokens remain authoritative.

### CI and documentation

- `.circleci/config.yml` — locked install, tests, builds, schema checks, and bundle inspection.
- `docs/Memory.md` — completed task/verification/deployment facts after implementation.
- `docs/architecture/challenge-traceability.md` — concrete Geospatial Studio proof references.

---

### Task 1: Install the approved geospatial runtime without changing UI behavior

**Files:**
- Modify: `web/package.json`
- Modify: `package-lock.json`
- Modify: `THIRD_PARTY_NOTICES.md`
- Test: `tests/architecture/mvp-contract.test.mjs`

- [ ] **Step 1: Extend the architecture test with the approved dependency and license contract**

Add assertions that `web/package.json` declares these direct dependencies and that `THIRD_PARTY_NOTICES.md` names their licenses:

```js
const approved = {
  'maplibre-gl': 'BSD-3-Clause',
  '@deck.gl/core': 'MIT',
  '@deck.gl/layers': 'MIT',
  '@deck.gl/geo-layers': 'MIT',
  '@deck.gl/mapbox': 'MIT',
  'h3-js': 'Apache-2.0',
  'pmtiles': 'BSD-3-Clause',
  'supercluster': 'ISC',
};
for (const [name, license] of Object.entries(approved)) {
  assert.equal(typeof webPackage.dependencies[name], 'string', `${name} must be a direct dependency`);
  assert.match(notices, new RegExp(`${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}.*${license}`, 'i'));
}
```

- [ ] **Step 2: Run the test and confirm the dependency contract fails**

Run: `node --test tests/architecture/mvp-contract.test.mjs`

Expected: FAIL because the approved packages and notices are absent.

- [ ] **Step 3: Install exact approved libraries through the workspace package manager**

Run:

```powershell
npm install --workspace web maplibre-gl @deck.gl/core @deck.gl/layers @deck.gl/geo-layers @deck.gl/mapbox h3-js pmtiles supercluster
```

Remove `leaflet` and `react-leaflet` only after Task 7 proves feature parity.

- [ ] **Step 4: Add third-party notices**

Append a table to `THIRD_PARTY_NOTICES.md` containing package, purpose, license, and upstream URL. Use the license values in the test and include OpenFreeMap as an external basemap service rather than an npm dependency.

- [ ] **Step 5: Run the dependency contract and clean-install check**

Run: `node --test tests/architecture/mvp-contract.test.mjs`

Expected: PASS.

Run: `npm ci --ignore-scripts`

Expected: exit 0 with the committed lockfile.

- [ ] **Step 6: Commit**

```powershell
git add web/package.json package-lock.json THIRD_PARTY_NOTICES.md tests/architecture/mvp-contract.test.mjs
git commit -m "build: add governed geospatial runtime"
```

### Task 2: Create strict shared geospatial contracts

**Files:**
- Create: `packages/geospatial-core/package.json`
- Create: `packages/geospatial-core/src/contracts.mjs`
- Create: `packages/geospatial-core/src/compile-layer.mjs`
- Create: `packages/geospatial-core/src/index.mjs`
- Create: `tests/geospatial/contracts.test.mjs`
- Create: `tests/geospatial/compile-layer.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing contract tests**

Test a valid hotspot dataset/view and reject cross-dataset fields, raw source URLs, unknown renderers, invalid coordinate mappings, excessive limits, and organization IDs supplied inside execution filters:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDatasetDefinition, normalizeMapViewDefinition } from '@ksp/geospatial-core';

const dataset = {
  id: 'hotspots', name: 'Crime hotspots', sourceType: 'SEMANTIC_API',
  sourceReference: 'listHotspots', geometryType: 'POINT',
  fields: {
    longitude: { type: 'number', uses: ['geometry'] },
    latitude: { type: 'number', uses: ['geometry'] },
    caseCount: { type: 'number', uses: ['weight', 'display'] },
    severity: { type: 'number', uses: ['color', 'display'] },
  },
  geometry: { longitudeField: 'longitude', latitudeField: 'latitude' },
  sensitivity: 'RESTRICTED', requiredAction: 'READ_HOTSPOT',
};

test('normalizes an authorized semantic point dataset', () => {
  assert.equal(normalizeDatasetDefinition(dataset).geometryType, 'POINT');
});

test('rejects client-visible source URLs and authority fields in filters', () => {
  assert.throws(() => normalizeDatasetDefinition({ ...dataset, sourceReference: 'https://private.invalid/data' }), /sourceReference/);
  assert.throws(() => normalizeMapViewDefinition({
    id: 'view-1', name: 'Unsafe', version: 1, visibility: 'PRIVATE',
    layers: [{ id: 'layer-1', datasetId: 'hotspots', renderer: 'POINT', filter: { organizationId: 'other' } }],
  }, new Map([['hotspots', dataset]])), /organizationId/);
});
```

- [ ] **Step 2: Run tests and confirm the package is unresolved**

Run: `node --test tests/geospatial/*.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `@ksp/geospatial-core`.

- [ ] **Step 3: Implement the package and validators**

`package.json` must export `src/index.mjs`. Implement allowlists:

```js
export const RENDERERS = Object.freeze(['POINT', 'CLUSTER', 'HEATMAP', 'H3', 'CHOROPLETH', 'PATH', 'ARC']);
export const SOURCE_TYPES = Object.freeze(['SEMANTIC_API', 'DATASTORE_VIEW', 'CSV', 'GEOJSON', 'PMTILES']);
export const VISIBILITIES = Object.freeze(['PRIVATE', 'SHARED', 'ROLE_DEFAULT', 'ORGANIZATION_GLOBAL']);
export const MAX_FEATURES = 5000;
```

Validators must return deeply frozen normalized copies, accept only plain objects, reject unknown top-level keys, validate IDs with `^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$`, require declared fields for all mappings, reject authority keys (`organizationId`, `role`, `authorizedUnitIds`, `permissions`) in filters, and enforce renderer/geometry compatibility.

- [ ] **Step 4: Implement deterministic layer compilation**

Expose:

```js
export function compileLayerExecution({ dataset, layer, runtime }) {
  const normalizedDataset = normalizeDatasetDefinition(dataset);
  const normalizedLayer = normalizeLayerDefinition(layer, new Map([[dataset.id, normalizedDataset]]));
  return Object.freeze({
    datasetId: normalizedDataset.id,
    sourceReference: normalizedDataset.sourceReference,
    renderer: normalizedLayer.renderer,
    fields: requiredFields(normalizedDataset, normalizedLayer),
    filter: normalizedLayer.filter,
    viewport: normalizeViewport(runtime.viewport),
    timeWindow: normalizeTimeWindow(runtime.timeWindow),
    limit: Math.min(runtime.limit ?? 1000, MAX_FEATURES),
  });
}
```

The compiler must be deterministic: equivalent normalized input produces deeply equal output and never adds authenticated scope fields from client input.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/geospatial/*.test.mjs`

Expected: all geospatial contract tests PASS.

- [ ] **Step 6: Run Node 18 compatibility**

Run: `npm run compat:node18`

Expected: PASS; the new package contains no Node 24-only API.

- [ ] **Step 7: Commit**

```powershell
git add package.json packages/geospatial-core tests/geospatial
git commit -m "feat: define governed geospatial contracts"
```

### Task 3: Add Catalyst map-view schema and repository persistence

**Files:**
- Modify: `schema/catalyst/intelligence-schema.json`
- Modify: `scripts/schema/validate-intelligence-schema.mjs`
- Modify: `tests/schema/intelligence-schema.test.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/repository/catalyst/catalyst-repository.mjs`
- Create: `tests/catalyst/geospatial-repository.test.mjs`

- [ ] **Step 1: Write failing schema assertions**

Require two configuration tables:

```js
assertTable('CFG_MapView', [
  'MapViewID', 'OrganizationID', 'Name', 'OwnerEmployeeID', 'Visibility',
  'CurrentVersion', 'Status', 'CreatedAt', 'UpdatedAt',
]);
assertTable('CFG_MapViewVersion', [
  'MapViewVersionKey', 'MapViewRef', 'MapViewID', 'OrganizationID', 'Version',
  'DefinitionJSON', 'DefinitionHash', 'PublishedAt', 'CreatedByEmployeeID', 'CreatedAt',
]);
```

Assert unique `MapViewID`, unique `MapViewVersionKey`, and a Catalyst lookup `MapViewRef` from version to view. Keep `OrganizationID` as an explicit indexed business boundary even when the first tenant has one organization.

- [ ] **Step 2: Run schema tests and confirm failure**

Run: `node --test tests/schema/intelligence-schema.test.mjs`

Expected: FAIL because the tables are absent and the expected table count is unchanged.

- [ ] **Step 3: Add schema tables and update validators**

Use the existing JSON table/column format. `DefinitionJSON` is a large text field; `DefinitionHash` is a 64-character SHA-256 hex string; `Visibility` is bounded text; `CurrentVersion` and `Version` are non-negative integers. Update required table sets and counts without weakening existing table checks.

- [ ] **Step 4: Write failing repository tests**

Use the existing fake Catalyst table API and assert:

```js
const created = await repository.createMapView({
  mapView: { MapViewID: 'MAP-1', OrganizationID: 'ORG-KSP', Name: 'Hotspots', OwnerEmployeeID: 9001, Visibility: 'PRIVATE', CurrentVersion: 1, Status: 'ACTIVE' },
  version: { MapViewVersionKey: 'MAP-1:1', MapViewID: 'MAP-1', OrganizationID: 'ORG-KSP', Version: 1, DefinitionJSON: '{"version":1}', DefinitionHash: 'a'.repeat(64), CreatedByEmployeeID: 9001 },
});
assert.equal(created.CurrentVersion, 1);
await assert.rejects(repository.updateMapView({ mapViewId: 'MAP-1', expectedVersion: 0, nextVersion: {} }), { code: 'VERSION_CONFLICT' });
```

- [ ] **Step 5: Implement repository methods**

Add `listMapViews`, `getMapView`, `getMapViewVersion`, `createMapView`, and `updateMapView`. Use the existing ZCQL escaping and compare-and-swap helpers. Create the version row before advancing `CurrentVersion`; if pointer advancement fails, the orphan version remains non-current and can be reconciled safely.

- [ ] **Step 6: Run schema and repository tests**

Run: `node --test tests/schema/intelligence-schema.test.mjs tests/catalyst/geospatial-repository.test.mjs`

Expected: PASS.

- [ ] **Step 7: Generate and inspect the Catalyst table runbook**

Run: `npm run intelligence-schema:validate`

Expected: PASS with the updated exact table count.

Run: `npm run intelligence-schema:runbook`

Expected: exit 0 and generated instructions include both map-view tables.

- [ ] **Step 8: Commit**

```powershell
git add schema/catalyst/intelligence-schema.json scripts/schema/validate-intelligence-schema.mjs tests/schema/intelligence-schema.test.mjs functions/crime_intelligence_api/app/src/backend/repository/catalyst/catalyst-repository.mjs tests/catalyst/geospatial-repository.test.mjs
git commit -m "feat: persist versioned map views"
```

### Task 4: Expose authorized datasets and layer execution

**Files:**
- Create: `functions/crime_intelligence_api/app/src/backend/geospatial/dataset-catalog.mjs`
- Create: `functions/crime_intelligence_api/app/src/backend/geospatial/layer-service.mjs`
- Create: `tests/backend/geospatial-layer-service.test.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/http/api-contract.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/catalyst/api-bootstrap.mjs`
- Modify: `tests/backend/api-contract.test.mjs`

- [ ] **Step 1: Write failing catalog and execution tests**

Create fixtures with one access profile allowed `READ_HOTSPOT` and one without it. Assert:

```js
const allowed = await service.listDatasets({ access: hotspotAccess });
assert.deepEqual(allowed.data.items.map(item => item.id), ['hotspots']);
assert.equal('sourceReference' in allowed.data.items[0], false);

await assert.rejects(
  service.executeLayer({ access: deniedAccess, body: hotspotRequest }),
  { code: 'FORBIDDEN_ACTION' },
);

const result = await service.executeLayer({ access: hotspotAccess, body: hotspotRequest });
assert.equal(result.data.type, 'FeatureCollection');
assert.equal(result.data.features[0].geometry.type, 'Point');
assert.deepEqual(result.data.features[0].geometry.coordinates, [77.5949, 12.9718]);
assert.equal(result.meta.runGroupId, 'RUN-1');
```

Also assert that rows without finite coordinates are returned in `meta.omittedFeatureCount`, never mapped to zero or a default centre.

- [ ] **Step 2: Run focused tests and confirm missing modules**

Run: `node --test tests/backend/geospatial-layer-service.test.mjs`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Build the immutable server catalog**

Register existing semantic sources only:

```js
export const DATASET_CATALOG = Object.freeze([
  hotspotDataset,
  anomalyDataset,
  areaRiskDataset,
  alertDataset,
]);
```

Hotspots are spatially executable when finite centroid coordinates exist. Anomalies, area risk, and alerts declare their real geometry mappings only if their current API records contain them; otherwise catalog responses set `spatialStatus: 'GEOMETRY_NOT_AVAILABLE'` and explain the missing required fields. Do not synthesize coordinates.

- [ ] **Step 4: Implement authorized layer execution**

`createGeospatialLayerService({ readServices, clock, idFactory })` must:

1. list only datasets whose required action appears in `access.actions`;
2. strip `sourceReference`, internal service names, and prohibited fields from catalog responses;
3. normalize the request with `@ksp/geospatial-core`;
4. call the existing read service with bounded limit/time/unit query;
5. project authorized rows into GeoJSON features;
6. include run group, generated time, observation period, source count, omitted count, and limitations;
7. reject execution if the dataset lacks usable geometry.

- [ ] **Step 5: Declare and compose routes**

Add:

```js
{ method: 'GET', path: '/v1/geospatial/datasets', kind: 'resource', service: 'listGeospatialDatasets' },
{ method: 'POST', path: '/v1/geospatial/layers/execute', kind: 'resource', service: 'executeGeospatialLayer' },
```

Compose these resource functions in `api-bootstrap.mjs`. Mark layer execution as a sensitive analytical read in the operation metadata and update dispatch audit selection so this POST is not mislabeled as a configuration change.

- [ ] **Step 6: Run backend route/service tests**

Run: `node --test tests/backend/geospatial-layer-service.test.mjs tests/backend/api-contract.test.mjs tests/catalyst/api-bootstrap.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add packages/geospatial-core functions/crime_intelligence_api/app/src/backend/geospatial functions/crime_intelligence_api/app/src/backend/http/api-contract.mjs functions/crime_intelligence_api/app/src/backend/http/dispatch.mjs functions/crime_intelligence_api/app/src/backend/catalyst/api-bootstrap.mjs tests/backend/geospatial-layer-service.test.mjs tests/backend/api-contract.test.mjs tests/catalyst/api-bootstrap.test.mjs
git commit -m "feat: expose authorized geospatial layers"
```

### Task 5: Implement governed map-view resources

**Files:**
- Create: `functions/crime_intelligence_api/app/src/backend/geospatial/map-view-service.mjs`
- Create: `tests/backend/map-view-service.test.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/http/api-contract.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/catalyst/api-bootstrap.mjs`
- Modify: `config/access-policy.json`

- [ ] **Step 1: Write failing authorization/version tests**

Cover:

- owner creates a private view in their derived organization;
- the request cannot supply another organization;
- an owner updates with `expectedVersion` and creates version 2;
- stale updates return `VERSION_CONFLICT`;
- private views are invisible to other employees;
- shared views require viewer permissions for every referenced dataset;
- role-default/global publishing requires `MANAGE_MAP_VIEWS`;
- a previously authorized saved view still fails execution when the viewer loses dataset access.

Use this create shape:

```js
await service.createMapView({
  access,
  body: { name: 'Verified hotspots', visibility: 'PRIVATE', definition: validView },
  requestId: 'REQ-1',
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `node --test tests/backend/map-view-service.test.mjs`

Expected: FAIL because the service is absent.

- [ ] **Step 3: Implement map-view service**

Expose `listMapViews`, `getMapView`, `createMapView`, and `updateMapView`. Derive `OrganizationID` and actor employee ID from `access`; hash canonical normalized definitions with SHA-256; validate all referenced datasets and required actions on create, read, update, and execute. Return definitions without repository row metadata.

- [ ] **Step 4: Declare routes and permissions**

Add:

```text
GET   /v1/geospatial/views
POST  /v1/geospatial/views
GET   /v1/geospatial/views/{mapViewId}
PATCH /v1/geospatial/views/{mapViewId}
```

Add `CREATE_MAP_VIEW`, `EDIT_OWN_MAP_VIEW`, and `MANAGE_MAP_VIEWS` to relevant policy personas. Keep read access dependent on referenced dataset actions, not only a generic map permission.

- [ ] **Step 5: Run security and resource tests**

Run: `node --test tests/backend/map-view-service.test.mjs tests/backend/security.test.mjs tests/backend/api-contract.test.mjs`

Expected: PASS, including cross-organization/scope negative cases.

- [ ] **Step 6: Commit**

```powershell
git add config/access-policy.json functions/crime_intelligence_api/app/src/backend/geospatial/map-view-service.mjs functions/crime_intelligence_api/app/src/backend/http/api-contract.mjs functions/crime_intelligence_api/app/src/backend/catalyst/api-bootstrap.mjs tests/backend/map-view-service.test.mjs tests/backend/security.test.mjs tests/backend/api-contract.test.mjs
git commit -m "feat: govern saved geospatial views"
```

### Task 6: Build the reusable MapLibre/deck.gl canvas

**Files:**
- Create: `web/src/features/geospatial/map-style.js`
- Create: `web/src/features/geospatial/layer-adapters.js`
- Create: `web/src/features/geospatial/layer-adapters.test.js`
- Create: `web/src/features/geospatial/MapCanvas.jsx`
- Create: `web/src/features/geospatial/MapCanvas.test.jsx`

- [ ] **Step 1: Write failing adapter tests**

Test pure adapter inputs before rendering:

```js
const compiled = buildDeckLayerSpecs({
  layer: { id: 'hotspots', renderer: 'HEATMAP', weightField: 'caseCount' },
  featureCollection,
  onFeatureSelect,
});
expect(compiled).toHaveLength(1);
expect(compiled[0].kind).toBe('HeatmapLayer');
expect(compiled[0].getWeight(featureCollection.features[0])).toBe(6);
```

Cover `POINT`, `CLUSTER`, `HEATMAP`, `H3`, and `CHOROPLETH`. H3 rejects invalid cells; choropleth rejects missing polygon geometry; all adapters use `[longitude, latitude]` and finite values.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm run test --workspace web -- layer-adapters.test.js`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement pure layer specifications and deck constructors**

Keep data transformation in `layer-adapters.js`. Export `buildDeckLayerSpecs` for testing and `createDeckLayers` for runtime construction. Use `ScatterplotLayer`, `HeatmapLayer`, `GeoJsonLayer`, `H3HexagonLayer`, and Supercluster-derived cluster features. Provide click objects containing only feature ID and display-safe properties.

- [ ] **Step 4: Write failing map lifecycle tests**

Mock `maplibre-gl`, `@deck.gl/mapbox`, and `pmtiles`. Assert one map is created, PMTiles protocol registration happens once, overlays update without recreating the map, `remove()` runs on unmount, attribution is present, and a layer failure does not remove the basemap.

- [ ] **Step 5: Implement `MapCanvas`**

Use refs and effects:

```jsx
export function MapCanvas({ layers, viewport, onViewportChange, onFeatureSelect, onLayerError }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  // create once; update overlay props; remove overlay and map on unmount
  return <div className="geospatial-map" ref={containerRef} aria-label="Geospatial intelligence map" />;
}
```

Register `pmtiles://` through MapLibre's protocol API at module-safe singleton scope. Use a controlled OpenFreeMap style URL with visible attribution. Do not put access tokens, Stratus paths, or dataset URLs in this file.

- [ ] **Step 6: Run renderer tests and production build**

Run: `npm run test --workspace web -- layer-adapters.test.js MapCanvas.test.jsx`

Expected: PASS.

Run: `npm run web:build`

Expected: PASS; the map code is emitted as a lazy chunk after Task 9 wires routing.

- [ ] **Step 7: Commit**

```powershell
git add web/src/features/geospatial/map-style.js web/src/features/geospatial/layer-adapters.js web/src/features/geospatial/layer-adapters.test.js web/src/features/geospatial/MapCanvas.jsx web/src/features/geospatial/MapCanvas.test.jsx
git commit -m "feat: add reusable geospatial canvas"
```

### Task 7: Build the functional Studio workflow and evidence UX

**Files:**
- Create: `web/src/features/geospatial/useGeospatialWorkspace.js`
- Create: `web/src/features/geospatial/useGeospatialWorkspace.test.jsx`
- Create: `web/src/features/geospatial/LayerPanel.jsx`
- Create: `web/src/features/geospatial/LayerInspector.jsx`
- Create: `web/src/features/geospatial/EvidenceDrawer.jsx`
- Create: `web/src/features/geospatial/VisibleFeatureTable.jsx`
- Create: `web/src/features/geospatial/GeospatialStudio.jsx`
- Create: `web/src/features/geospatial/GeospatialStudio.test.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing workspace hook tests**

Mock the API and fake timers. Assert the hook:

- loads datasets and saved views;
- executes only visible spatially available layers;
- aborts/ignores an old viewport response;
- keeps the last verified layer when refresh fails and marks it stale;
- detects a changed `runGroupId` without replacing data while evidence is open;
- refreshes after the user accepts the update.

Use a generation counter even if the current API client cannot pass an `AbortSignal`; only the latest generation may commit state.

- [ ] **Step 2: Run the hook test and confirm failure**

Run: `npm run test --workspace web -- useGeospatialWorkspace.test.jsx`

Expected: FAIL because the hook is absent.

- [ ] **Step 3: Implement the workspace state machine**

Use explicit states per layer:

```js
export const LAYER_STATES = Object.freeze([
  'IDLE', 'LOADING', 'READY', 'EMPTY', 'STALE',
  'UNAUTHORIZED', 'GEOMETRY_NOT_AVAILABLE', 'FAILED',
]);
```

Poll a lightweight execution/freshness endpoint no faster than once per minute while visible; pause when `document.visibilityState !== 'visible'`; expose manual retry. Never discard ready features on transient failure.

- [ ] **Step 4: Write failing component workflow tests**

Render the Studio with a fake `MapCanvas` and assert:

- dataset search and add-layer work;
- unavailable geometry is explained rather than plotted;
- visibility and ordering change renderer input;
- inspector changes renderer only after valid configuration;
- feature selection opens evidence with run/method/freshness/limitations;
- table contains the same visible authorized features;
- save sends a normalized definition without organization/role fields;
- keyboard buttons have accessible names and drawer has a title.

- [ ] **Step 5: Build Studio components using existing platform primitives**

Use the current white/navy shell, Roboto, semantic tokens, and 44px interactive targets. Layout:

```text
Studio toolbar
├── left: saved views / datasets / ordered layers
├── centre: MapCanvas
└── right: selected-layer inspector or selected-feature evidence
bottom: collapsible accessible feature table
```

Use native/current primitives first. Add Shadcn source components only when an accessible equivalent is missing, after running `npx shadcn@latest info`, `search`, and `docs`; do not initialize a second design system or overwrite existing CSS.

- [ ] **Step 6: Add isolated responsive styling**

Prefix new selectors with `.geospatial-`. Desktop uses resizable-width CSS variables with bounded min/max; tablet panels become overlays/bottom drawers; reduced-motion disables transitions. Do not change unrelated persona screens.

- [ ] **Step 7: Run Studio tests**

Run: `npm run test --workspace web -- useGeospatialWorkspace.test.jsx GeospatialStudio.test.jsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add web/src/features/geospatial web/src/styles/app.css
git commit -m "feat: build geospatial studio workflow"
```

### Task 8: Route the Studio and retire the fixed Leaflet page

**Files:**
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`
- Modify: `web/src/app/workspace-navigation.js`
- Modify: `web/src/app/workspace-navigation.test.js`
- Delete: `web/src/features/intelligence/HotspotMap.jsx`
- Delete: `web/src/features/intelligence/HotspotMap.test.jsx`
- Modify: `web/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write failing route/navigation tests**

Assert `/geospatial` lazy-loads the Studio after workspace authorization, navigation labels it `Geospatial`, `/maps` redirects to `/geospatial`, and an access profile without any spatial dataset action receives a safe empty/unauthorized Studio rather than leaked catalog content.

- [ ] **Step 2: Run route tests and confirm failure**

Run: `npm run test --workspace web -- router.test.jsx workspace-navigation.test.js`

Expected: FAIL because `/geospatial` is not declared.

- [ ] **Step 3: Wire the lazy route**

Use:

```jsx
const GeospatialStudio = lazy(() => import('../features/geospatial/GeospatialStudio.jsx'));
```

Wrap only the route element in `Suspense` with the existing loading state. Preserve application-level authentication and persona resolution.

- [ ] **Step 4: Remove Leaflet after parity tests pass**

Run:

```powershell
npm uninstall --workspace web leaflet react-leaflet
```

Delete the old HotspotMap files and all Leaflet CSS imports. Confirm no `leaflet` or `/maps` implementation reference remains except the intentional redirect test.

- [ ] **Step 5: Run all frontend tests and build**

Run: `npm run web:test`

Expected: all frontend tests PASS.

Run: `npm run web:build`

Expected: PASS; main application chunk does not statically contain the full map renderer.

- [ ] **Step 6: Commit**

```powershell
git add web/src/app web/src/features/intelligence web/package.json package-lock.json
git commit -m "feat: make geospatial studio the map workspace"
```

### Task 9: Reuse saved maps in reports and dashboards

**Files:**
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/semantic-sources.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/report-definition.mjs`
- Modify: `functions/crime_intelligence_api/app/src/backend/reporting/report-execution.mjs`
- Modify: `tests/reporting/report-definition.test.mjs`
- Modify: `tests/reporting/report-execution.test.mjs`
- Modify: `web/src/features/reports/ReportBuilder.jsx`
- Modify: `web/src/features/reports/ReportBuilder.test.jsx`
- Create: `web/src/features/geospatial/EmbeddedMapView.jsx`
- Create: `web/src/features/geospatial/EmbeddedMapView.test.jsx`
- Modify: `web/src/features/dashboards/DashboardWorkspace.jsx`
- Modify: `web/src/features/dashboards/DashboardWorkspace.test.jsx`

- [ ] **Step 1: Write failing report-definition tests**

Allow a map report only when it references a governed view:

```js
const definition = validateReportDefinition({
  name: 'Current hotspot posture', sourceKey: 'hotspots',
  dimensions: [], measures: [],
  visualization: { type: 'map', mapViewId: 'MAP-1' }, limit: 100,
});
assert.equal(definition.visualization.mapViewId, 'MAP-1');
assert.throws(() => validateReportDefinition({
  ...definition, visualization: { type: 'map', inlineStyleUrl: 'https://private.invalid' },
}), /visualization/);
```

- [ ] **Step 2: Run reporting tests and confirm failure**

Run: `node --test tests/reporting/report-definition.test.mjs tests/reporting/report-execution.test.mjs`

Expected: FAIL because map views are not resolved.

- [ ] **Step 3: Resolve viewer-authorized map views during report execution**

For `visualization.type === 'map'`, report execution loads the saved view through `map-view-service`, revalidates its dataset permissions for the current viewer, and returns the normalized view definition plus layer execution descriptors. It must not return stored organization, owner, or private source references.

- [ ] **Step 4: Write failing frontend embedding tests**

Assert Report Builder selects an authorized saved view for a map visualization and dashboard widgets lazy-render `EmbeddedMapView`. A failed map widget displays its own error while sibling widgets remain available.

- [ ] **Step 5: Implement the embedded renderer**

`EmbeddedMapView` reuses `MapCanvas`, `layer-adapters`, and the workspace execution logic in read-only mode. It must not fork a separate map implementation or expose layer editing controls.

- [ ] **Step 6: Run report/dashboard tests**

Run: `node --test tests/reporting/report-definition.test.mjs tests/reporting/report-execution.test.mjs`

Expected: PASS.

Run: `npm run test --workspace web -- ReportBuilder.test.jsx EmbeddedMapView.test.jsx DashboardWorkspace.test.jsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add functions/crime_intelligence_api/app/src/backend/reporting tests/reporting web/src/features/reports web/src/features/dashboards web/src/features/geospatial/EmbeddedMapView.jsx web/src/features/geospatial/EmbeddedMapView.test.jsx
git commit -m "feat: reuse map views in reports and dashboards"
```

### Task 10: Prove freshness and incremental publication behavior

**Files:**
- Modify: `functions/crime_intelligence_api/app/src/backend/geospatial/layer-service.mjs`
- Modify: `tests/backend/geospatial-layer-service.test.mjs`
- Modify: `tests/backend/refresh.test.mjs`
- Create: `tests/backend/geospatial-refresh-integration.test.mjs`
- Modify: `web/src/features/geospatial/useGeospatialWorkspace.test.jsx`

- [ ] **Step 1: Write the end-to-end failing refresh test**

Start with a repository containing published run group A and execute a hotspot layer. Persist an accepted source batch with one additional geolocated FIR, run the real intelligence refresh, then execute the same saved layer definition again. Assert:

```js
assert.equal(before.meta.runGroupId, 'RUN-GROUP-A');
assert.notEqual(after.meta.runGroupId, before.meta.runGroupId);
assert.equal(after.data.features.some(feature => feature.properties.evidenceCaseIds.includes(newCaseId)), true);
assert.deepEqual(savedViewDefinitionAfter, savedViewDefinitionBefore);
```

Add correction and deletion fixtures when the ingestion adapter represents them; otherwise assert the current full-batch reconciliation replaces removed contributions and document the source connector's operation semantics in the test name.

- [ ] **Step 2: Run the integration test and confirm failure**

Run: `node --test tests/backend/geospatial-refresh-integration.test.mjs`

Expected: FAIL until layer execution exposes coherent run metadata and refresh uses the new published group.

- [ ] **Step 3: Complete run metadata and freshness endpoint**

Every layer result includes:

```js
meta: {
  runGroupId,
  publishedAt,
  generatedAt,
  observationStart,
  observationEnd,
  engineVersion,
  sourceRecordCount,
  outputFeatureCount,
  omittedFeatureCount,
  limitations,
}
```

Add `GET /v1/geospatial/freshness` returning only authorized dataset IDs and their current version/run/freshness, so polling does not re-download features.

- [ ] **Step 4: Prove atomic failure behavior**

Extend the refresh integration test with the existing publication failure injector. Assert the freshness endpoint and layer execution continue to expose run group A, marked stale/refresh-failed as appropriate, until a complete verified group is atomically published.

- [ ] **Step 5: Run backend and hook refresh tests**

Run: `node --test tests/backend/refresh.test.mjs tests/backend/geospatial-layer-service.test.mjs tests/backend/geospatial-refresh-integration.test.mjs`

Expected: PASS.

Run: `npm run test --workspace web -- useGeospatialWorkspace.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add functions/crime_intelligence_api/app/src/backend/geospatial tests/backend web/src/features/geospatial/useGeospatialWorkspace.test.jsx
git commit -m "feat: refresh maps from verified intelligence runs"
```

### Task 11: Add deterministic CircleCI verification

**Files:**
- Create: `.circleci/config.yml`
- Modify: `package.json`
- Create: `scripts/ci/verify-geospatial.mjs`
- Create: `tests/architecture/ci-contract.test.mjs`

- [ ] **Step 1: Write a failing CI contract test**

Assert the config uses a pinned Node image compatible with the repository engine, restores/saves a checksum-keyed npm cache, runs `npm ci`, and invokes the repository `verify` script plus a geospatial architecture check. Assert no deploy command or Catalyst production credential appears.

- [ ] **Step 2: Run and confirm failure**

Run: `node --test tests/architecture/ci-contract.test.mjs`

Expected: FAIL because `.circleci/config.yml` is absent.

- [ ] **Step 3: Add the smallest CircleCI workflow**

Use one job initially:

```yaml
version: 2.1
jobs:
  verify:
    docker:
      - image: cimg/node:24.4
    steps:
      - checkout
      - restore_cache:
          keys:
            - npm-v1-{{ checksum "package-lock.json" }}
            - npm-v1-
      - run: npm ci
      - save_cache:
          key: npm-v1-{{ checksum "package-lock.json" }}
          paths:
            - ~/.npm
      - run: npm run verify
      - run: npm run geospatial:verify
workflows:
  pull-request-verification:
    jobs:
      - verify
```

Do not add parallel jobs until measured CI duration justifies them.

- [ ] **Step 4: Add local geospatial verification**

`scripts/ci/verify-geospatial.mjs` checks that the old Leaflet dependencies/imports are absent, required geospatial tests exist, `/geospatial` is declared, PMTiles protocol registration exists, and the design/plan documents are present. Add `geospatial:verify` to root scripts.

- [ ] **Step 5: Run CI contract and full verification locally**

Run: `node --test tests/architecture/ci-contract.test.mjs`

Expected: PASS.

Run: `npm run verify`

Expected: all backend/frontend tests, builds, Catalyst bundle checks, and schema validation PASS.

Run: `npm run geospatial:verify`

Expected: `PASS: governed geospatial core is structurally complete.`

- [ ] **Step 6: Commit**

```powershell
git add .circleci/config.yml package.json scripts/ci/verify-geospatial.mjs tests/architecture/ci-contract.test.mjs
git commit -m "ci: verify geospatial platform changes"
```

### Task 12: Review, deploy to Catalyst Development, and record evidence

**Files:**
- Modify: `docs/Memory.md`
- Modify: `docs/architecture/challenge-traceability.md`
- Create: `docs/evidence/geospatial-studio-development-verification.md`

- [ ] **Step 1: Run the complete local release gate**

Run:

```powershell
npm run verify
npm run geospatial:verify
npm run compat:node18
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Perform focused security and challenge reviews**

Review the final diff for cross-organization references, client-trusted scope, sensitive fields in GeoJSON/tooltips, unrestricted URLs, XSS-capable labels, unbounded requests, map cache leakage, and missing audit events. Run the repository challenge-alignment skill against the diff and fix any blocking mismatch before deployment.

- [ ] **Step 3: Build and inspect the Catalyst bundle**

Run:

```powershell
npm run catalyst:preflight
npm run catalyst:build
npm run catalyst:inspect
npm run web:build
```

Expected: all commands PASS and no source maps, secrets, private object paths, or unrestricted URLs appear in production artifacts.

- [ ] **Step 4: Apply Development schema additions**

Use the generated Catalyst runbook to create `CFG_MapView` and `CFG_MapViewVersion` in Development. Export the live schema and run:

```powershell
npm run schema:compare -- --input <development-schema-export.json>
```

Expected: exact match for all required tables, columns, types, indexes, and lookups. Do not deploy Functions that require these tables before this comparison passes.

- [ ] **Step 5: Deploy Functions and Slate to Development**

Deploy only the verified build to project `43492000000013049`. Keep Production untouched. Smoke test authenticated dataset catalog, hotspot layer execution, private view create/update, Studio loading, evidence drawer, report/dashboard embedding, persona denial, and refresh/freshness behavior on the `akspci.onslate.in` Development deployment.

- [ ] **Step 6: Record reproducible evidence**

In `docs/evidence/geospatial-studio-development-verification.md`, record commit SHA, build time, Catalyst project/environment, schema comparison result, tested persona/scope, API request IDs, run group IDs before/after refresh, browser/device, failures encountered, and final outcomes. Do not record credentials, cookies, audit keys, or private signed URLs.

- [ ] **Step 7: Update memory and traceability**

Update `docs/Memory.md` with completed capabilities, exact deployment state, known limitations, and next plan. Update Challenge 02 traceability so geospatial, hotspot, district drilldown, anomaly, risk, and pattern rows point to concrete tests and demo steps.

- [ ] **Step 8: Final commit**

```powershell
git add docs/Memory.md docs/architecture/challenge-traceability.md docs/evidence/geospatial-studio-development-verification.md
git commit -m "docs: record geospatial development verification"
```

## Completion criteria

This plan is complete only when:

- `/geospatial` renders a real MapLibre/deck.gl map from authorized executed APIs;
- missing geometry is explicit and no position is fabricated;
- hotspot point, cluster, and heatmap modes work on the same dataset;
- H3/choropleth adapters are tested and render when valid geometry exists;
- evidence and accessible table match displayed authorized features;
- map views are versioned in Catalyst Data Store and rechecked per viewer;
- the same saved map renders in Studio, report, and dashboard contexts;
- a newly published analytical run updates the existing saved view without changing its definition;
- a failed refresh preserves and labels the last verified layer;
- Leaflet has been removed after parity;
- all local verification, security/alignment review, Development schema comparison, deployment, and smoke tests pass.

## Follow-on plans

After this plan passes:

1. `geospatial-imports-pmtiles` — quarantine/validate CSV and GeoJSON, produce rejection reports, convert approved large datasets, verify Stratus range/CORS, and add AppSail fallback.
2. `geospatial-ai-layer-publishing` — publish versioned outputs from hotspot/anomaly/pattern/network/risk methods as datasets.
3. `geospatial-generative-assistant` — QuickML natural-language draft views with deterministic validation, cost controls, confirmation, and evaluation feedback.
