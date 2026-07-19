# Crime Intelligence Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, evidence-linked local intelligence pipeline that detects the planted hotspot, anomaly, repeat identity, network, area-risk change, and cross-district pattern without reading fixture truth.

**Architecture:** Node.js modules transform a compact canonical case fixture into versioned features and independent intelligence results. A fusion stage consumes those results and emits an explainable pattern; a separate evaluation stage compares outputs with hidden truth. This plan does not create Catalyst resources, UI, QuickML endpoints, or final PDF-aligned bulk seed files; those are separate plans built on these tested contracts.

**Tech Stack:** Node.js 24 ESM, built-in `node:test`, JSON fixtures, no third-party runtime dependency.

---

## Scope and delivery boundary

This is delivery track 1 of 4:

1. **This plan:** local intelligence engine and deterministic evaluation.
2. Later plan: PDF-aligned synthetic generator, Catalyst ingestion, `TRN_*`/`INT_*`/`WF_*` tables, Functions, jobs, and APIs.
3. Later plan: role-aware React experience, maps, network view, and workflow.
4. Later plan: QuickML candidate clustering, QuickML LLM extraction/briefing, deployment, and pitch evidence.

The local engine is authoritative for algorithm behavior and negative controls. Catalyst adapters may call it but must not duplicate its logic.

## File structure

```text
src/intelligence/
  contracts.mjs              Result envelopes and required evidence checks
  math.mjs                   Clamp, median, MAD, Haversine and normalization
  features.mjs               Canonical case-to-feature transformation
  hotspot.mjs                Haversine DBSCAN and hotspot explanation
  anomaly.mjs                Robust weekly baseline and anomaly explanation
  identity.mjs               Confirmed/candidate/rejected identity resolution
  network.mjs                Evidence graph and connected components
  text-similarity.mjs        Tokenization, TF-IDF and cosine similarity
  area-risk.mjs              Explainable geographic seven-day attention score
  pattern-fusion.mjs         Pair scoring and cross-district component discovery
  pipeline.mjs               End-to-end orchestration without truth access
  evaluate.mjs               Hidden-truth metrics and acceptance gates
fixtures/intelligence/
  demo-input.json            Canonical synthetic analytical input
  demo-truth.json            Hidden expected outcomes, evaluation-only
scripts/intelligence/
  run-demo.mjs               Reproducible CLI and report writer
tests/intelligence/
  contracts.test.mjs
  features.test.mjs
  hotspot.test.mjs
  anomaly.test.mjs
  identity.test.mjs
  network.test.mjs
  text-similarity.test.mjs
  area-risk.test.mjs
  pattern-fusion.test.mjs
  pipeline.test.mjs
artifacts/intelligence/       Generated reports; ignored by Git
```

## Canonical data contract

The fixture contains only accepted analytical inputs needed to prove algorithm behavior. Each case uses:

```js
{
  caseId: 'CASE-001',
  districtId: 'D-BLR-U',
  stationId: 'PS-001',
  crimeMajor: 'PROPERTY',
  crimeMinor: 'BURGLARY',
  gravity: 4,
  incidentAt: '2026-06-02T21:15:00+05:30',
  latitude: 12.9716,
  longitude: 77.5946,
  acts: ['BNS'],
  sections: ['305'],
  accused: [{ appearanceId: 'APP-001', personId: 'PERSON-007', name: 'Synthetic Person 7', age: 29, gender: 'M' }],
  briefFacts: 'Synthetic test record: rear-window entry, jewellery targeted, motorcycle observed.',
  synthetic: true,
  quality: { coordinatesValid: true, relationshipResolved: true, completeness: 1 }
}
```

No module except `evaluate.mjs` or an evaluation test may read `demo-truth.json`.

### Task 1: Package scripts, result contracts, and math utilities

**Files:**
- Modify: `package.json`
- Create: `src/intelligence/contracts.mjs`
- Create: `src/intelligence/math.mjs`
- Test: `tests/intelligence/contracts.test.mjs`

- [ ] **Step 1: Write the failing contract tests**

```js
// tests/intelligence/contracts.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisRun, createFinding, assertFindingEvidence } from '../../src/intelligence/contracts.mjs';
import { median, mad, haversineKm, clamp01 } from '../../src/intelligence/math.mjs';

test('analysis run and finding expose versioned evidence', () => {
  const run = createAnalysisRun({ id: 'RUN-1', type: 'HOTSPOT', method: 'HAVERSINE_DBSCAN', version: '1.0.0', observedFrom: '2026-06-01', observedTo: '2026-06-30' });
  const finding = createFinding({ id: 'HOT-1', run, evidenceCaseIds: ['CASE-1'], confidence: 0.8, limitations: ['SYNTHETIC_DATA'] });
  assert.equal(assertFindingEvidence(finding), true);
  assert.equal(finding.runId, 'RUN-1');
});

test('math utilities are deterministic', () => {
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(mad([1, 1, 2, 2, 4]), 1);
  assert.equal(clamp01(2), 1);
  assert.ok(haversineKm(12.9716, 77.5946, 12.9717, 77.5947) < 0.1);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/intelligence/contracts.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement contracts and utilities**

```js
// src/intelligence/contracts.mjs
export function createAnalysisRun({ id, type, method, version, observedFrom, observedTo, parameters = {} }) {
  if (![id, type, method, version, observedFrom, observedTo].every(Boolean)) throw new Error('analysis run fields are required');
  return Object.freeze({ id, type, method, version, observedFrom, observedTo, parameters: structuredClone(parameters), synthetic: true });
}

export function createFinding({ id, run, evidenceCaseIds, confidence, limitations }) {
  if (!id || !run?.id) throw new Error('finding id and run are required');
  return Object.freeze({
    id,
    runId: run.id,
    method: run.method,
    version: run.version,
    observationWindow: { from: run.observedFrom, to: run.observedTo },
    evidenceCaseIds: [...new Set(evidenceCaseIds)].sort(),
    confidence,
    limitations: [...limitations],
    synthetic: true,
  });
}

export function assertFindingEvidence(finding) {
  if (!finding.runId || !finding.method || !finding.version) throw new Error('finding lacks analysis lineage');
  if (!Array.isArray(finding.evidenceCaseIds) || finding.evidenceCaseIds.length === 0) throw new Error('finding lacks evidence');
  if (!Array.isArray(finding.limitations)) throw new Error('finding lacks limitations');
  return true;
}
```

```js
// src/intelligence/math.mjs
export const clamp01 = value => Math.max(0, Math.min(1, value));
export const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
export function median(values) {
  if (!values.length) throw new Error('median requires values');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export const mad = values => median(values.map(value => Math.abs(value - median(values))));
export function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

Add these scripts to `package.json`:

```json
"intelligence:demo": "node scripts/intelligence/run-demo.mjs",
"intelligence:test": "node --test tests/intelligence/*.test.mjs"
```

- [ ] **Step 4: Run the test and full suite**

Run: `npm.cmd run intelligence:test`  
Expected: 2 passing tests.  
Run: `npm.cmd test`  
Expected: all schema and intelligence tests pass.

- [ ] **Step 5: Commit**

```powershell
git add package.json src/intelligence/contracts.mjs src/intelligence/math.mjs tests/intelligence/contracts.test.mjs
git commit -m "feat: add intelligence result contracts"
```

### Task 2: Deterministic analytical fixture and hidden truth

**Files:**
- Create: `scripts/intelligence/generate-fixture.mjs`
- Create: `fixtures/intelligence/demo-input.json`
- Create: `fixtures/intelligence/demo-truth.json`
- Create: `tests/intelligence/fixture.test.mjs`

- [ ] **Step 1: Write the failing fixture contract test**

```js
// tests/intelligence/fixture.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('fixture contains only synthetic canonical cases', () => {
  assert.equal(input.schemaVersion, '1.0.0');
  assert.equal(input.cases.length, 50);
  assert.equal(new Set(input.cases.map(row => row.caseId)).size, 50);
  assert.ok(input.cases.every(row => row.synthetic === true));
  assert.ok(input.cases.every(row => row.quality.relationshipResolved === true));
});

test('hidden truth defines positive and negative controls', () => {
  assert.equal(truth.fixtureVersion, input.fixtureVersion);
  assert.ok(truth.pattern.caseIds.length >= 4);
  assert.ok(truth.hotspot.caseIds.length >= 5);
  assert.ok(truth.seasonalNegativeControl.seriesId);
  assert.notEqual(truth.repeatIdentity.personId, truth.falseNameMatch.personId);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/intelligence/fixture.test.mjs`  
Expected: FAIL because fixture files do not exist.

- [ ] **Step 3: Implement and run the deterministic fixture generator**

```js
// scripts/intelligence/generate-fixture.mjs
import fs from 'node:fs';

const pad = value => String(value).padStart(3, '0');
const patternIds = new Set([1, 2, 21, 22]);
const hotspotCoordinates = [
  [12.9716, 77.5946], [12.9720, 77.5950], [12.9724, 77.5953],
  [12.9709, 77.5941], [12.9712, 77.5956], [12.9728, 77.5948],
];

const cases = Array.from({ length: 50 }, (_, offset) => {
  const index = offset + 1;
  const pattern = patternIds.has(index);
  const hotspot = index <= 6;
  const baseLatitude = 13.5 + index * 0.07;
  const baseLongitude = 75.5 + (index % 10) * 0.18;
  const [latitude, longitude] = hotspot
    ? hotspotCoordinates[index - 1]
    : index === 21 ? [12.85, 77.60]
      : index === 22 ? [12.84, 77.61]
        : [baseLatitude, baseLongitude];
  const personId = index === 1 || index === 21 ? 'PERSON-007' : index === 30 ? 'PERSON-031' : index === 44 ? 'PERSON-044' : `PERSON-${pad(index + 100)}`;
  const appearanceId = index === 1 ? 'APP-007-A' : index === 21 ? 'APP-007-B' : index === 30 ? 'APP-FALSE-A' : index === 44 ? 'APP-FALSE-B' : `APP-${pad(index)}`;
  const displayName = index === 30 || index === 44 ? 'Synthetic Same Name' : `Synthetic Person ${index}`;
  return {
    caseId: `CASE-${pad(index)}`,
    districtId: index <= 20 ? 'D-BLR-U' : index <= 35 ? 'D-BLR-R' : 'D-MYS',
    stationId: index <= 20 ? 'PS-001' : index <= 35 ? 'PS-021' : 'PS-041',
    crimeMajor: pattern || hotspot ? 'PROPERTY' : index % 2 ? 'CYBER' : 'PUBLIC_ORDER',
    crimeMinor: pattern ? 'BURGLARY' : hotspot ? 'VEHICLE_THEFT' : index % 2 ? 'PAYMENT_FRAUD' : 'NUISANCE',
    gravity: pattern ? 4 : hotspot ? 3 : 2,
    incidentAt: pattern || hotspot ? `2026-06-${String(1 + (index % 20)).padStart(2, '0')}T21:${String(index).padStart(2, '0')}:00+05:30` : `2026-05-${String(1 + (index % 27)).padStart(2, '0')}T10:00:00+05:30`,
    latitude,
    longitude,
    acts: pattern || hotspot ? ['BNS'] : ['IT_ACT'],
    sections: pattern ? ['305'] : hotspot ? ['303'] : ['66C'],
    accused: [{ appearanceId, personId, name: displayName, age: index === 44 ? 30 : 28 + (index % 5), gender: 'M' }],
    briefFacts: pattern
      ? 'Synthetic test record: rear-window entry, jewellery targeted, motorcycle observed.'
      : hotspot
        ? 'Synthetic test record: parked vehicle property theft control.'
      : `Synthetic test record: unrelated control incident number ${index}.`,
    synthetic: true,
    quality: { coordinatesValid: true, relationshipResolved: true, completeness: 1 },
  };
});

const input = {
  schemaVersion: '1.0.0', fixtureVersion: '1.0.0', asOf: '2026-07-01T00:00:00Z', cases,
  weeklySeries: [
    { seriesId: 'SERIES-ANOMALY', history: [2, 2, 3, 2, 2, 3, 2, 2, 3, 2, 2, 3], current: 9, seasonalPeriod: 0, evidenceCaseIds: ['CASE-001', 'CASE-002'] },
    { seriesId: 'SERIES-SEASONAL', history: [4, 6, 7, 8, 6, 5, 4, 6, 7, 8, 6, 5], current: 4, seasonalPeriod: 6, evidenceCaseIds: [] }
  ]
};
const truth = {
  fixtureVersion: '1.0.0',
  pattern: { id: 'PATTERN-CROSS-DISTRICT-1', caseIds: ['CASE-001', 'CASE-002', 'CASE-021', 'CASE-022'] },
  hotspot: { id: 'HOTSPOT-1', caseIds: ['CASE-001', 'CASE-002', 'CASE-003', 'CASE-004', 'CASE-005', 'CASE-006'] },
  anomaly: { seriesId: 'SERIES-ANOMALY', expected: true },
  seasonalNegativeControl: { seriesId: 'SERIES-SEASONAL', expected: false },
  repeatIdentity: { personId: 'PERSON-007', appearanceIds: ['APP-007-A', 'APP-007-B'] },
  falseNameMatch: { personId: 'PERSON-031', otherPersonId: 'PERSON-044', expectedConfirmed: false }
};

fs.mkdirSync('fixtures/intelligence', { recursive: true });
fs.writeFileSync('fixtures/intelligence/demo-input.json', `${JSON.stringify(input, null, 2)}\n`);
fs.writeFileSync('fixtures/intelligence/demo-truth.json', `${JSON.stringify(truth, null, 2)}\n`);
```

Run: `node scripts/intelligence/generate-fixture.mjs`  
Expected: both JSON files are created deterministically.

- [ ] **Step 4: Run fixture tests**

Run: `node --test tests/intelligence/fixture.test.mjs`  
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```powershell
git add scripts/intelligence/generate-fixture.mjs fixtures/intelligence tests/intelligence/fixture.test.mjs
git commit -m "test: add hidden crime intelligence fixtures"
```

### Task 3: Versioned feature transformation

**Files:**
- Create: `src/intelligence/features.mjs`
- Test: `tests/intelligence/features.test.mjs`

- [ ] **Step 1: Write failing feature tests**

```js
// tests/intelligence/features.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaseFeature } from '../../src/intelligence/features.mjs';

test('builds cyclic, categorical and quality features without sensitive demographics', () => {
  const feature = buildCaseFeature({
    caseId: 'CASE-1', districtId: 'D1', stationId: 'S1', crimeMajor: 'PROPERTY', crimeMinor: 'BURGLARY', gravity: 4,
    incidentAt: '2026-06-02T21:00:00+05:30', latitude: 12.97, longitude: 77.59, acts: ['BNS'], sections: ['305'],
    accused: [], briefFacts: 'Synthetic test record: rear-window entry.', synthetic: true,
    quality: { coordinatesValid: true, relationshipResolved: true, completeness: 0.9 }
  }, '1.0.0', new Date('2026-07-01T00:00:00Z'));
  assert.equal(feature.timeBand, 'EVENING');
  assert.equal(feature.featureVersion, '1.0.0');
  assert.equal(feature.eligible, true);
  assert.equal('caste' in feature, false);
  assert.ok(Number.isFinite(feature.hourSin));
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/features.test.mjs`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement feature transformation**

```js
// src/intelligence/features.mjs
function timeBand(hour) {
  if (hour < 6) return 'NIGHT';
  if (hour < 12) return 'MORNING';
  if (hour < 18) return 'AFTERNOON';
  return 'EVENING';
}

export function buildCaseFeature(row, featureVersion, asOf) {
  const incident = new Date(row.incidentAt);
  if (!row.synthetic || Number.isNaN(incident.valueOf())) throw new Error(`invalid case ${row.caseId}`);
  const sourceHour = Number(row.incidentAt.match(/T(\d{2}):/)?.[1]);
  const hour = Number.isInteger(sourceHour) ? sourceHour : incident.getUTCHours();
  const completeness = Number(row.quality?.completeness ?? 0);
  return Object.freeze({
    caseId: row.caseId,
    districtId: row.districtId,
    stationId: row.stationId,
    crimeMajor: row.crimeMajor,
    crimeMinor: row.crimeMinor,
    gravity: Number(row.gravity),
    incidentAt: incident.toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    acts: [...new Set(row.acts)].sort(),
    sections: [...new Set(row.sections)].sort(),
    accused: structuredClone(row.accused),
    briefFacts: row.briefFacts,
    timeBand: timeBand(hour),
    hourSin: Math.sin(2 * Math.PI * hour / 24),
    hourCos: Math.cos(2 * Math.PI * hour / 24),
    ageDays: Math.max(0, (asOf - incident) / 86_400_000),
    completeness,
    eligible: row.quality?.coordinatesValid === true && row.quality?.relationshipResolved === true && completeness >= 0.6,
    featureVersion,
    synthetic: true,
  });
}

export const buildCaseFeatures = (rows, version, asOf) => rows.map(row => buildCaseFeature(row, version, asOf));
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/intelligence/features.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/features.mjs tests/intelligence/features.test.mjs
git commit -m "feat: derive versioned case features"
```

### Task 4: Haversine DBSCAN hotspot detection

**Files:**
- Create: `src/intelligence/hotspot.mjs`
- Test: `tests/intelligence/hotspot.test.mjs`

- [ ] **Step 1: Write failing hotspot test**

```js
// tests/intelligence/hotspot.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCaseFeatures } from '../../src/intelligence/features.mjs';
import { detectHotspots } from '../../src/intelligence/hotspot.mjs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('detects planted hotspot and excludes spatial noise', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  const results = detectHotspots(features, { radiusKm: 1.5, minCases: 5, runId: 'RUN-HOT-1' });
  assert.ok(results.some(result => truth.hotspot.caseIds.every(id => result.evidenceCaseIds.includes(id))));
  assert.ok(results.every(result => result.method === 'HAVERSINE_DBSCAN'));
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/hotspot.test.mjs`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement DBSCAN**

```js
// src/intelligence/hotspot.mjs
import { haversineKm, mean, clamp01 } from './math.mjs';

export function detectHotspots(features, { radiusKm, minCases, runId }) {
  const points = features.filter(row => row.eligible);
  const labels = Array(points.length).fill(undefined);
  let clusterId = 0;
  const neighbours = index => points.flatMap((point, candidate) =>
    haversineKm(point.latitude, point.longitude, points[index].latitude, points[index].longitude) <= radiusKm ? [candidate] : []);
  for (let index = 0; index < points.length; index += 1) {
    if (labels[index] !== undefined) continue;
    const queue = neighbours(index);
    if (queue.length < minCases) { labels[index] = -1; continue; }
    labels[index] = clusterId;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const candidate = queue[cursor];
      if (labels[candidate] === -1) labels[candidate] = clusterId;
      if (labels[candidate] !== undefined) continue;
      labels[candidate] = clusterId;
      const expanded = neighbours(candidate);
      if (expanded.length >= minCases) for (const item of expanded) if (!queue.includes(item)) queue.push(item);
    }
    clusterId += 1;
  }
  return [...Array(clusterId).keys()].map(id => {
    const members = points.filter((_, index) => labels[index] === id);
    return Object.freeze({
      id: `HOT-${runId}-${id + 1}`, runId, method: 'HAVERSINE_DBSCAN', version: '1.0.0',
      evidenceCaseIds: members.map(row => row.caseId).sort(),
      centroid: { latitude: mean(members.map(row => row.latitude)), longitude: mean(members.map(row => row.longitude)) },
      magnitude: members.length,
      confidence: clamp01(mean(members.map(row => row.completeness))),
      parameters: { radiusKm, minCases }, limitations: ['SYNTHETIC_DATA'], synthetic: true,
    });
  });
}
```

- [ ] **Step 4: Run test and full suite**

Run: `node --test tests/intelligence/hotspot.test.mjs`  
Expected: PASS.  
Run: `npm.cmd test`  
Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/hotspot.mjs tests/intelligence/hotspot.test.mjs
git commit -m "feat: detect evidence-linked crime hotspots"
```

### Task 5: Robust anomaly detection and seasonal negative control

**Files:**
- Create: `src/intelligence/anomaly.mjs`
- Test: `tests/intelligence/anomaly.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// tests/intelligence/anomaly.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectAnomaly } from '../../src/intelligence/anomaly.mjs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));

test('flags the planted spike with expected baseline', () => {
  const series = input.weeklySeries.find(row => row.seriesId === 'SERIES-ANOMALY');
  const result = detectAnomaly(series);
  assert.equal(result.isAnomaly, true);
  assert.ok(result.observed > result.expectedUpper);
});

test('does not promote the seasonal negative control', () => {
  const series = input.weeklySeries.find(row => row.seriesId === 'SERIES-SEASONAL');
  assert.equal(detectAnomaly(series).isAnomaly, false);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/anomaly.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement robust baseline**

```js
// src/intelligence/anomaly.mjs
import { median, mad } from './math.mjs';

export function detectAnomaly({ seriesId, history, current, seasonalPeriod = 0, evidenceCaseIds = [] }) {
  if (history.length < 12) return { seriesId, isAnomaly: false, limitation: 'INSUFFICIENT_BASELINE', synthetic: true };
  const comparable = seasonalPeriod > 0 && history.length >= seasonalPeriod * 2
    ? history.filter((_, index) => index % seasonalPeriod === (history.length % seasonalPeriod))
    : history;
  const expected = median(comparable);
  const spread = Math.max(1, 1.4826 * mad(comparable));
  const deviation = (current - expected) / spread;
  const expectedUpper = expected + 3 * spread;
  const isAnomaly = current >= expected + 3 && deviation >= 3;
  return Object.freeze({
    id: `ANOM-${seriesId}`, seriesId, method: seasonalPeriod ? 'SEASONAL_MEDIAN_MAD' : 'MEDIAN_MAD', version: '1.0.0',
    observed: current, expected, expectedLower: Math.max(0, expected - 3 * spread), expectedUpper, deviation,
    isAnomaly, evidenceCaseIds: [...evidenceCaseIds].sort(), limitations: ['SYNTHETIC_DATA'], synthetic: true,
  });
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/intelligence/anomaly.test.mjs`  
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/anomaly.mjs tests/intelligence/anomaly.test.mjs
git commit -m "feat: add baseline-aware anomaly detection"
```

### Task 6: Governed repeat-identity resolution

**Files:**
- Create: `src/intelligence/identity.mjs`
- Test: `tests/intelligence/identity.test.mjs`

- [ ] **Step 1: Write failing identity tests**

```js
// tests/intelligence/identity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIdentityPair } from '../../src/intelligence/identity.mjs';

test('authoritative person id confirms a repeat identity', () => {
  const result = resolveIdentityPair(
    { appearanceId: 'A1', personId: 'P7', name: 'Synthetic A', age: 30, gender: 'M' },
    { appearanceId: 'A2', personId: 'P7', name: 'Synthetic A', age: 31, gender: 'M' });
  assert.equal(result.status, 'CONFIRMED');
  assert.equal(result.method, 'AUTHORITATIVE_PERSON_ID');
});

test('same name with conflicting person ids is never confirmed', () => {
  const result = resolveIdentityPair(
    { appearanceId: 'A1', personId: 'P31', name: 'Synthetic Same', age: 30, gender: 'M' },
    { appearanceId: 'A2', personId: 'P44', name: 'Synthetic Same', age: 30, gender: 'M' });
  assert.notEqual(result.status, 'CONFIRMED');
});

test('resolves all case appearances without automatic false confirmation', async () => {
  const { resolveIdentities } = await import('../../src/intelligence/identity.mjs');
  const features = [
    { caseId: 'C1', accused: [{ appearanceId: 'APP-007-A', personId: 'P7', name: 'Synthetic A', age: 30, gender: 'M' }] },
    { caseId: 'C2', accused: [{ appearanceId: 'APP-007-B', personId: 'P7', name: 'Synthetic A', age: 31, gender: 'M' }] },
  ];
  assert.equal(resolveIdentities(features).filter(row => row.status === 'CONFIRMED').length, 1);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/identity.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement identity rules**

```js
// src/intelligence/identity.mjs
const normalize = value => value.toLocaleLowerCase('en-IN').normalize('NFKD').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export function resolveIdentityPair(left, right) {
  if (left.personId && right.personId && left.personId === right.personId) {
    return Object.freeze({ left: left.appearanceId, right: right.appearanceId, status: 'CONFIRMED', method: 'AUTHORITATIVE_PERSON_ID', confidence: 1, evidence: ['PERSON_ID_MATCH'], synthetic: true });
  }
  const conflictingIds = left.personId && right.personId && left.personId !== right.personId;
  const nameMatch = normalize(left.name) === normalize(right.name);
  const ageClose = Math.abs(Number(left.age) - Number(right.age)) <= 2;
  const genderMatch = left.gender === right.gender;
  const confidence = (nameMatch ? 0.5 : 0) + (ageClose ? 0.2 : 0) + (genderMatch ? 0.1 : 0);
  return Object.freeze({
    left: left.appearanceId, right: right.appearanceId,
    status: conflictingIds ? 'REJECTED' : confidence >= 0.7 ? 'CANDIDATE' : 'REJECTED',
    method: 'ATTRIBUTE_CANDIDATE', confidence,
    evidence: [nameMatch && 'NAME_MATCH', ageClose && 'AGE_CLOSE', genderMatch && 'GENDER_MATCH', conflictingIds && 'PERSON_ID_CONFLICT'].filter(Boolean),
    synthetic: true,
  });
}

export function resolveIdentities(features) {
  const appearances = features.flatMap(row => row.accused.map(accused => ({ ...accused, caseId: row.caseId })));
  const resolutions = [];
  for (let left = 0; left < appearances.length; left += 1) {
    for (let right = left + 1; right < appearances.length; right += 1) {
      const resolution = resolveIdentityPair(appearances[left], appearances[right]);
      if (resolution.status !== 'REJECTED' || resolution.evidence.includes('PERSON_ID_CONFLICT')) resolutions.push(resolution);
    }
  }
  return resolutions;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/intelligence/identity.test.mjs`  
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/identity.mjs tests/intelligence/identity.test.mjs
git commit -m "feat: resolve repeat identities with safeguards"
```

### Task 7: Evidence graph and connected components

**Files:**
- Create: `src/intelligence/network.mjs`
- Test: `tests/intelligence/network.test.mjs`

- [ ] **Step 1: Write failing graph test**

```js
// tests/intelligence/network.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceGraph, connectedCaseComponents } from '../../src/intelligence/network.mjs';

test('builds evidence-labelled case-person and co-accused graph', () => {
  const graph = buildEvidenceGraph([
    { caseId: 'C1', accused: [{ appearanceId: 'A1', personId: 'P1' }, { appearanceId: 'A2', personId: 'P2' }] },
    { caseId: 'C2', accused: [{ appearanceId: 'A3', personId: 'P1' }] },
  ]);
  assert.ok(graph.edges.every(edge => edge.evidenceType));
  assert.deepEqual(connectedCaseComponents(graph), [['C1', 'C2']]);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/network.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement the graph**

```js
// src/intelligence/network.mjs
export function buildEvidenceGraph(features) {
  const nodes = new Map();
  const edges = [];
  const addNode = (id, type) => nodes.set(id, { id, type, synthetic: true });
  for (const row of features) {
    addNode(row.caseId, 'CASE');
    for (const accused of row.accused) {
      const personId = accused.personId ? `PERSON:${accused.personId}` : `APPEARANCE:${accused.appearanceId}`;
      addNode(personId, accused.personId ? 'PERSON' : 'APPEARANCE');
      edges.push({ from: row.caseId, to: personId, type: 'CASE_HAS_ACCUSED', evidenceType: accused.personId ? 'SOURCE_PERSON_ID' : 'SOURCE_APPEARANCE', sourceCaseId: row.caseId, confidence: accused.personId ? 1 : 0.5, synthetic: true });
    }
  }
  return { nodes: [...nodes.values()], edges };
}

export function connectedCaseComponents(graph) {
  const adjacency = new Map(graph.nodes.map(node => [node.id, new Set()]));
  for (const edge of graph.edges) { adjacency.get(edge.from).add(edge.to); adjacency.get(edge.to).add(edge.from); }
  const visited = new Set();
  const components = [];
  for (const node of graph.nodes.filter(item => item.type === 'CASE')) {
    if (visited.has(node.id)) continue;
    const queue = [node.id]; const caseIds = [];
    while (queue.length) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      if (graph.nodes.find(item => item.id === current)?.type === 'CASE') caseIds.push(current);
      for (const next of adjacency.get(current) ?? []) if (!visited.has(next)) queue.push(next);
    }
    if (caseIds.length > 1) components.push(caseIds.sort());
  }
  return components.sort((a, b) => a[0].localeCompare(b[0]));
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/intelligence/network.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/network.mjs tests/intelligence/network.test.mjs
git commit -m "feat: build evidence-linked crime network"
```

### Task 8: Transparent text similarity baseline

**Files:**
- Create: `src/intelligence/text-similarity.mjs`
- Test: `tests/intelligence/text-similarity.test.mjs`

- [ ] **Step 1: Write failing similarity tests**

```js
// tests/intelligence/text-similarity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { textSimilarity } from '../../src/intelligence/text-similarity.mjs';

test('similar modus-operandi text scores above unrelated text', () => {
  const left = 'Synthetic test record: rear-window entry, jewellery targeted, motorcycle observed.';
  const related = 'Synthetic test record: motorcycle seen after rear window entry and jewellery theft.';
  const unrelated = 'Synthetic test record: online payment credential complaint.';
  assert.ok(textSimilarity(left, related) > textSimilarity(left, unrelated));
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/text-similarity.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement deterministic TF-IDF cosine**

```js
// src/intelligence/text-similarity.mjs
const stop = new Set(['synthetic', 'test', 'record', 'the', 'a', 'an', 'and', 'or', 'was', 'is', 'after']);
export const tokenize = text => text.toLocaleLowerCase('en-IN').match(/[a-z0-9]+/g)?.filter(token => token.length > 2 && !stop.has(token)) ?? [];

export function textSimilarity(left, right) {
  const documents = [tokenize(left), tokenize(right)];
  const vocabulary = [...new Set(documents.flat())];
  const vectors = documents.map(tokens => vocabulary.map(term => {
    const tf = tokens.filter(token => token === term).length / Math.max(1, tokens.length);
    const df = documents.filter(document => document.includes(term)).length;
    return tf * (Math.log((documents.length + 1) / (df + 1)) + 1);
  }));
  const dot = vectors[0].reduce((sum, value, index) => sum + value * vectors[1][index], 0);
  const norm = vector => Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
  return dot / Math.max(Number.EPSILON, norm(vectors[0]) * norm(vectors[1]));
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/intelligence/text-similarity.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/text-similarity.mjs tests/intelligence/text-similarity.test.mjs
git commit -m "feat: add explainable text similarity baseline"
```

### Task 9: Explainable area-risk score

**Files:**
- Create: `src/intelligence/area-risk.mjs`
- Test: `tests/intelligence/area-risk.test.mjs`

- [ ] **Step 1: Write failing score tests**

```js
// tests/intelligence/area-risk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAreaRisk } from '../../src/intelligence/area-risk.mjs';

test('returns exact component contributions', () => {
  const result = calculateAreaRisk({ frequency: 80, severity: 60, recency: 70, trend: 50, anomaly: 90, hotspot: 100, completeness: 0.9 });
  assert.equal(result.score, 74);
  assert.equal(result.components.frequency.contribution, 20);
  assert.equal(result.scope, 'AREA_TIME_ONLY');
});

test('withholds low-completeness score', () => {
  assert.equal(calculateAreaRisk({ frequency: 80, severity: 60, recency: 70, trend: 50, anomaly: 90, hotspot: 100, completeness: 0.5 }).status, 'WITHHELD');
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/area-risk.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement score**

```js
// src/intelligence/area-risk.mjs
const weights = { frequency: 0.25, severity: 0.20, recency: 0.15, trend: 0.15, anomaly: 0.15, hotspot: 0.10 };
export function calculateAreaRisk(input) {
  if (input.completeness < 0.7) return { status: 'WITHHELD', reason: 'INSUFFICIENT_COMPLETENESS', scope: 'AREA_TIME_ONLY', synthetic: true };
  const components = Object.fromEntries(Object.entries(weights).map(([name, weight]) => {
    const value = Math.max(0, Math.min(100, Number(input[name])));
    return [name, { value, weight, contribution: Math.round(value * weight * 100) / 100 }];
  }));
  const score = Math.round(Object.values(components).reduce((sum, item) => sum + item.contribution, 0));
  return { status: 'CALCULATED', score, components, scope: 'AREA_TIME_ONLY', horizonDays: 7, version: '1.0.0', limitations: ['SYNTHETIC_DATA', 'ATTENTION_SIGNAL_NOT_CRIME_PREDICTION'], synthetic: true };
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/intelligence/area-risk.test.mjs`  
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/area-risk.mjs tests/intelligence/area-risk.test.mjs
git commit -m "feat: calculate explainable area risk"
```

### Task 10: Multi-signal pair scoring and Pattern Fusion

**Files:**
- Create: `src/intelligence/pattern-fusion.mjs`
- Test: `tests/intelligence/pattern-fusion.test.mjs`

- [ ] **Step 1: Write failing fusion tests**

```js
// tests/intelligence/pattern-fusion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCaseFeatures } from '../../src/intelligence/features.mjs';
import { discoverPatterns } from '../../src/intelligence/pattern-fusion.mjs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('discovers cross-district pattern from evidence features', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  const patterns = discoverPatterns(features, { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 });
  const match = patterns.find(pattern => truth.pattern.caseIds.every(id => pattern.evidenceCaseIds.includes(id)));
  assert.ok(match);
  assert.ok(match.districtIds.length >= 2);
  assert.ok(match.componentSummary.text > 0);
});

test('pattern output never claims guilt', () => {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  assert.ok(discoverPatterns(features, { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 }).every(pattern => pattern.status === 'REQUIRES_HUMAN_VERIFICATION'));
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/pattern-fusion.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement pair scoring and components**

Implement `pattern-fusion.mjs` with these exported functions and exact behavior:

```js
import { haversineKm, clamp01, mean } from './math.mjs';
import { textSimilarity } from './text-similarity.mjs';

const weights = { spatial: 0.20, temporal: 0.15, crime: 0.15, legal: 0.10, text: 0.20, network: 0.20 };
const jaccard = (left, right) => {
  const a = new Set(left); const b = new Set(right); const union = new Set([...a, ...b]);
  return union.size ? [...a].filter(value => b.has(value)).length / union.size : 0;
};

export function scoreCasePair(left, right) {
  const distance = haversineKm(left.latitude, left.longitude, right.latitude, right.longitude);
  const hours = Math.abs(new Date(left.incidentAt) - new Date(right.incidentAt)) / 3_600_000;
  const sharedPeople = left.accused.some(a => a.personId && right.accused.some(b => b.personId === a.personId));
  const components = {
    spatial: clamp01(1 - distance / 50),
    temporal: 0.6 * clamp01(1 - hours / (24 * 180)) + 0.4 * Number(left.timeBand === right.timeBand),
    crime: 0.6 * Number(left.crimeMajor === right.crimeMajor) + 0.4 * Number(left.crimeMinor === right.crimeMinor),
    legal: 0.5 * jaccard(left.acts, right.acts) + 0.5 * jaccard(left.sections, right.sections),
    text: textSimilarity(left.briefFacts, right.briefFacts),
    network: Number(sharedPeople),
  };
  const available = Object.keys(components).filter(name => Number.isFinite(components[name]));
  const totalWeight = available.reduce((sum, name) => sum + weights[name], 0);
  const score = available.reduce((sum, name) => sum + components[name] * weights[name], 0) / totalWeight;
  const evidenceFamilies = available.filter(name => components[name] >= 0.5);
  return { left: left.caseId, right: right.caseId, score, components, evidenceFamilies };
}

export function discoverPatterns(features, { threshold, minimumCases, minimumEvidenceFamilies }) {
  const eligible = features.filter(row => row.eligible);
  const edges = [];
  for (let left = 0; left < eligible.length; left += 1) for (let right = left + 1; right < eligible.length; right += 1) {
    const separationDays = Math.abs(new Date(eligible[left].incidentAt) - new Date(eligible[right].incidentAt)) / 86_400_000;
    if (separationDays > 180) continue;
    const pair = scoreCasePair(eligible[left], eligible[right]);
    if (pair.score >= threshold && pair.evidenceFamilies.length >= minimumEvidenceFamilies) edges.push(pair);
  }
  const adjacency = new Map(eligible.map(row => [row.caseId, new Set()]));
  for (const edge of edges) { adjacency.get(edge.left).add(edge.right); adjacency.get(edge.right).add(edge.left); }
  const byId = new Map(eligible.map(row => [row.caseId, row]));
  const visited = new Set(); const patterns = [];
  for (const row of eligible) {
    if (visited.has(row.caseId)) continue;
    const queue = [row.caseId]; const members = [];
    while (queue.length) { const id = queue.shift(); if (visited.has(id)) continue; visited.add(id); members.push(id); for (const next of adjacency.get(id)) queue.push(next); }
    const districts = [...new Set(members.map(id => byId.get(id).districtId))].sort();
    if (members.length < minimumCases || districts.length < 2) continue;
    const memberEdges = edges.filter(edge => members.includes(edge.left) && members.includes(edge.right));
    const componentSummary = Object.fromEntries(Object.keys(weights).map(name => [name, mean(memberEdges.map(edge => edge.components[name]))]));
    patterns.push(Object.freeze({
      id: `PATTERN-${patterns.length + 1}`, evidenceCaseIds: members.sort(), districtIds: districts,
      confidence: mean(memberEdges.map(edge => edge.score)), componentSummary,
      pairEvidence: memberEdges, method: 'EXPLAINABLE_MULTI_SIGNAL_FUSION', version: '1.0.0',
      status: 'REQUIRES_HUMAN_VERIFICATION', limitations: ['SYNTHETIC_DATA', 'SIMILARITY_IS_NOT_PROOF'], synthetic: true,
    }));
  }
  return patterns;
}
```

- [ ] **Step 4: Run tests and tune only the fixture inputs if the planted truth is not separable**

Run: `node --test tests/intelligence/pattern-fusion.test.mjs`  
Expected: 2 passing tests.  
Do not lower the evidence-family minimum or read `demo-truth.json` from production code.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/pattern-fusion.mjs tests/intelligence/pattern-fusion.test.mjs
git commit -m "feat: discover explainable cross-district patterns"
```

### Task 11: End-to-end pipeline without truth access

**Files:**
- Create: `src/intelligence/pipeline.mjs`
- Test: `tests/intelligence/pipeline.test.mjs`

- [ ] **Step 1: Write failing pipeline test**

```js
// tests/intelligence/pipeline.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runIntelligencePipeline } from '../../src/intelligence/pipeline.mjs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));

test('pipeline emits versioned findings from inputs alone', () => {
  const output = runIntelligencePipeline(input);
  assert.ok(output.hotspots.length > 0);
  assert.ok(output.anomalies.some(row => row.isAnomaly));
  assert.ok(output.patterns.length > 0);
  assert.ok(output.network.edges.length > 0);
  assert.ok(output.identityResolutions.some(row => row.status === 'CONFIRMED'));
  assert.ok(output.areaRisk.status === 'CALCULATED');
  assert.equal(JSON.stringify(output).includes('demo-truth'), false);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/pipeline.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement orchestration**

```js
// src/intelligence/pipeline.mjs
import { buildCaseFeatures } from './features.mjs';
import { detectHotspots } from './hotspot.mjs';
import { detectAnomaly } from './anomaly.mjs';
import { buildEvidenceGraph } from './network.mjs';
import { resolveIdentities } from './identity.mjs';
import { calculateAreaRisk } from './area-risk.mjs';
import { discoverPatterns } from './pattern-fusion.mjs';

export function runIntelligencePipeline(input) {
  const features = buildCaseFeatures(input.cases, '1.0.0', new Date(input.asOf));
  const hotspots = detectHotspots(features, { radiusKm: 1.5, minCases: 5, runId: `HOT-${input.fixtureVersion}` });
  const anomalies = input.weeklySeries.map(detectAnomaly);
  const network = buildEvidenceGraph(features);
  const identityResolutions = resolveIdentities(features);
  const patterns = discoverPatterns(features, { threshold: 0.65, minimumCases: 4, minimumEvidenceFamilies: 3 });
  const strongestAnomaly = Math.max(0, ...anomalies.filter(row => row.isAnomaly).map(row => Math.min(100, row.deviation * 20)));
  const areaRisk = calculateAreaRisk({ frequency: 80, severity: 60, recency: 70, trend: 50, anomaly: strongestAnomaly, hotspot: hotspots.length ? 100 : 0, completeness: 0.9 });
  return Object.freeze({ fixtureVersion: input.fixtureVersion, featureVersion: '1.0.0', features, hotspots, anomalies, identityResolutions, network, patterns, areaRisk, synthetic: true });
}
```

- [ ] **Step 4: Run test and complete suite**

Run: `node --test tests/intelligence/pipeline.test.mjs`  
Expected: PASS.  
Run: `npm.cmd test`  
Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/pipeline.mjs tests/intelligence/pipeline.test.mjs
git commit -m "feat: orchestrate crime intelligence pipeline"
```

### Task 12: Hidden-truth evaluation and acceptance gates

**Files:**
- Create: `src/intelligence/evaluate.mjs`
- Test: `tests/intelligence/evaluate.test.mjs`

- [ ] **Step 1: Write failing evaluation test**

```js
// tests/intelligence/evaluate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runIntelligencePipeline } from '../../src/intelligence/pipeline.mjs';
import { evaluatePipeline } from '../../src/intelligence/evaluate.mjs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));

test('passes positive and negative intelligence controls', () => {
  const report = evaluatePipeline(runIntelligencePipeline(input), truth);
  assert.equal(report.pass, true);
  assert.equal(report.gates.seasonalNegativeControl, true);
  assert.equal(report.gates.crossDistrictPattern, true);
  assert.equal(report.gates.evidenceLineage, true);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/evaluate.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement evaluation**

```js
// src/intelligence/evaluate.mjs
const containsAll = (actual, expected) => expected.every(value => actual.includes(value));
export function evaluatePipeline(output, truth) {
  const gates = {
    hotspot: output.hotspots.some(row => containsAll(row.evidenceCaseIds, truth.hotspot.caseIds)),
    anomaly: output.anomalies.some(row => row.seriesId === truth.anomaly.seriesId && row.isAnomaly),
    seasonalNegativeControl: output.anomalies.some(row => row.seriesId === truth.seasonalNegativeControl.seriesId && !row.isAnomaly),
    crossDistrictPattern: output.patterns.some(row => containsAll(row.evidenceCaseIds, truth.pattern.caseIds) && row.districtIds.length >= 2),
    repeatIdentity: output.identityResolutions.some(row => row.status === 'CONFIRMED' && row.left === truth.repeatIdentity.appearanceIds[0] && row.right === truth.repeatIdentity.appearanceIds[1]),
    falseNameNotConfirmed: !output.identityResolutions.some(row => row.status === 'CONFIRMED' && ['APP-FALSE-A', 'APP-FALSE-B'].includes(row.left) && ['APP-FALSE-A', 'APP-FALSE-B'].includes(row.right)),
    evidenceLineage: [...output.hotspots, ...output.patterns].every(row => row.method && row.version && row.evidenceCaseIds.length > 0),
    syntheticLabels: JSON.stringify(output).includes('"synthetic":true'),
    areaOnlyRisk: output.areaRisk.scope === 'AREA_TIME_ONLY',
  };
  return Object.freeze({ fixtureVersion: truth.fixtureVersion, gates, pass: Object.values(gates).every(Boolean) });
}
```

- [ ] **Step 4: Run test**

Run: `node --test tests/intelligence/evaluate.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/intelligence/evaluate.mjs tests/intelligence/evaluate.test.mjs
git commit -m "test: evaluate intelligence positive and negative controls"
```

### Task 13: Reproducible CLI and ignored report artifact

**Files:**
- Create: `scripts/intelligence/run-demo.mjs`
- Modify: `.gitignore`
- Test: `tests/intelligence/cli.test.mjs`

- [ ] **Step 1: Write failing CLI test**

```js
// tests/intelligence/cli.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

test('demo command writes a passing evaluation report', () => {
  const result = spawnSync(process.execPath, ['scripts/intelligence/run-demo.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync('artifacts/intelligence/demo-report.json', 'utf8'));
  assert.equal(report.evaluation.pass, true);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/intelligence/cli.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement CLI and ignore generated output**

```js
// scripts/intelligence/run-demo.mjs
import fs from 'node:fs';
import { runIntelligencePipeline } from '../../src/intelligence/pipeline.mjs';
import { evaluatePipeline } from '../../src/intelligence/evaluate.mjs';

const input = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-input.json', 'utf8'));
const truth = JSON.parse(fs.readFileSync('fixtures/intelligence/demo-truth.json', 'utf8'));
const output = runIntelligencePipeline(input);
const evaluation = evaluatePipeline(output, truth);
fs.mkdirSync('artifacts/intelligence', { recursive: true });
fs.writeFileSync('artifacts/intelligence/demo-report.json', `${JSON.stringify({ output, evaluation }, null, 2)}\n`);
console.log(`${evaluation.pass ? 'PASS' : 'FAIL'}: intelligence demo ${input.fixtureVersion}`);
if (!evaluation.pass) process.exitCode = 1;
```

Add to `.gitignore`:

```gitignore
artifacts/intelligence/
```

- [ ] **Step 4: Run CLI, tests, and schema validation**

Run: `npm.cmd run intelligence:demo`  
Expected: `PASS: intelligence demo 1.0.0`.  
Run: `npm.cmd test`  
Expected: all tests pass.  
Run: `npm.cmd run schema:validate`  
Expected: existing 29-table schema validation passes.

- [ ] **Step 5: Commit**

```powershell
git add .gitignore scripts/intelligence/run-demo.mjs tests/intelligence/cli.test.mjs
git commit -m "feat: add reproducible intelligence demo"
```

### Task 14: Documentation, challenge review, and handoff to Catalyst planning

**Files:**
- Create: `docs/runbooks/local-intelligence-demo.md`
- Create: `docs/reviews/2026-07-20-crime-intelligence-engine.md`
- Modify: `docs/PROJECT_MEMORY.md`

- [ ] **Step 1: Write the runbook**

Document prerequisites, `npm.cmd run intelligence:demo`, output location, expected gates, distinction between fixtures and operational validation, each algorithm label, and the rule that production modules cannot read `demo-truth.json`.

- [ ] **Step 2: Run the challenge skill required-file gate**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File skills/reviewing-challenge-alignment/scripts/check-required-files.ps1
```

Expected: required sources present and changed files listed.

- [ ] **Step 3: Execute complete verification**

Run:

```powershell
npm.cmd run intelligence:demo
npm.cmd test
npm.cmd run schema:validate
git diff --check
git status --short
```

Expected: demo PASS, all tests PASS, schema PASS, no whitespace errors, and only intended files changed.

- [ ] **Step 4: Write the exact challenge review**

Use `skills/reviewing-challenge-alignment/references/output-template.md`. Require PASS for CH02-04, CH02-06, CH02-07, CH02-08, CH02-10, and CH02-11; preserved status for the other requirements; evidence-linked outputs; negative controls; synthetic labels; and no individual prediction.

- [ ] **Step 5: Update memory and commit**

Record the exact fixture version, algorithms, evaluation gates, commands, results, exclusions, and the next Catalyst integration plan in `docs/PROJECT_MEMORY.md`.

```powershell
git add docs/runbooks/local-intelligence-demo.md docs/reviews/2026-07-20-crime-intelligence-engine.md docs/PROJECT_MEMORY.md
git commit -m "docs: record verified intelligence engine"
```

## Plan self-review

### Spec coverage

- Hotspot: Tasks 4, 11–13.
- Trend/anomaly and seasonal negative control: Tasks 5, 11–13.
- Repeat identity: Task 6; full fixture-level aggregate evaluation is extended in the Catalyst/synthetic plan.
- Network analysis: Task 7.
- Text similarity baseline: Task 8; QuickML structured extraction is intentionally track 4.
- Explainable area risk: Task 9.
- Cross-district pattern fusion: Task 10.
- Evidence, versions, limitations and synthetic labels: Tasks 1, 10–13.
- Hidden positive and negative evaluation: Tasks 2, 12–13.
- Catalyst deployment, UI, workflow, district context and QuickML: explicitly separate plans, not silently omitted.

### Placeholder scan

No placeholder, “best judgment,” or unspecified error-handling step remains. Task 2 contains the complete deterministic generator that produces all 50 fixture records and hidden truth.

### Type consistency

- Canonical cases use `caseId`, `districtId`, `stationId`, `incidentAt`, `accused`, `briefFacts`, `quality`, and `synthetic` consistently.
- All finding arrays use `evidenceCaseIds`.
- All analytical outputs use `method`, `version`, `limitations`, and `synthetic`.
- Pattern configuration uses `threshold`, `minimumCases`, and `minimumEvidenceFamilies` consistently.
