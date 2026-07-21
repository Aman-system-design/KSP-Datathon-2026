# Scalable Signal-to-Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Catalyst-inspired KSP Active Signals workspace backed by scale-bounded analytics and a Kannada/English Evidence Copilot using the models provisioned to this Datathon project.

**Architecture:** Preserve the current Functions-based explainable engine as the only alert authority. Replace global pair scans with indexed candidate generation, add a server-side QuickML boundary that receives only authorized alert evidence, and present the resulting workflow in the existing React SPA. Keep the accepted 50-FIR Catalyst batch unchanged; performance testing uses generated local feature records only.

**Tech Stack:** Node.js ES modules, Node test runner, Catalyst Job/API Functions and Data Store, QuickML authenticated endpoints, React 19, React Router, Vitest, Testing Library, Leaflet, native CSS.

---

## Task 0: Production-Hardening Boundary

**Files:**

- Modify `tests/catalyst/api-bootstrap.test.mjs`
- Modify `tests/backend/workflow.test.mjs`
- Modify `tests/catalyst/bundle.test.mjs`
- Modify `src/backend/catalyst/api-bootstrap.mjs`
- Modify `src/backend/workflow/command-service.mjs`
- Modify `functions/crime_intelligence_api/index.cjs`
- Modify `web/vite.config.js`

- [x] **Step 1: Write failing tests** for server-generated request correlation, redacted structured completion/failure logs, safe-integer versions, bounded assignment identifiers, liveness/readiness source contract and absent production source maps.
- [x] **Step 2: Run the focused tests and observe expected failures.**
- [x] **Step 3: Implement the smallest native Node/Catalyst solution.** Do not add logging, validation, health or rate-limit dependencies; API Gateway owns throttling.
- [x] **Step 4: Re-run focused tests, the production web build and bundle inspection.** Confirm no `.map` artifacts.
- [x] **Step 5: Run the complete verification gate before committing.**

## File Structure

**Scale analytics**

- Create `packages/intelligence-core/src/candidates.mjs` — spatial, identity and pattern candidate indexes plus counters.
- Modify `packages/intelligence-core/src/hotspot.mjs` — consume spatial candidates instead of scanning all points.
- Modify `packages/intelligence-core/src/identity.mjs` — compare only authoritative-ID or normalized-name buckets.
- Modify `packages/intelligence-core/src/pattern-fusion.mjs` — compare bounded candidate pairs and expose diagnostics.
- Modify `packages/intelligence-core/index.mjs` — export candidate utilities.
- Create `tests/intelligence/candidates.test.mjs` — equivalence, negative-control and comparison-bound tests.
- Create `scripts/intelligence/benchmark-scale.mjs` — deterministic 1K/10K/50K feature benchmark.

**Evidence Copilot**

- Create `src/backend/copilot/quickml-client.mjs` — authenticated GLM/ASR/translation/TTS transport with strict timeouts.
- Create `src/backend/copilot/evidence-copilot.mjs` — authorization-safe evidence prompt and output validation.
- Modify `src/backend/http/api-contract.mjs` — declare one bounded copilot operation.
- Modify `src/backend/reporting/workspace-services.mjs` — expose copilot resource service using existing scoped alert detail.
- Modify `src/backend/catalyst/api-bootstrap.mjs` — construct the QuickML client from runtime configuration.
- Modify `src/backend/catalyst/runtime-config.mjs` — validate non-secret QuickML configuration; obtain OAuth at runtime through the approved connection boundary.
- Create `tests/backend/copilot.test.mjs` and modify API/bootstrap tests — grounding, redaction, failure and route tests.

**Platform UI**

- Modify `web/src/app/AppShell.jsx` — global product rail, contextual Crime Intelligence sidebar and KSP organization header.
- Modify `web/src/app/router.jsx` — make Active Signals the principal intelligence route.
- Create `web/src/features/alerts/SignalWorkspace.jsx` — two-pane list/detail investigation workspace.
- Create `web/src/features/alerts/EvidenceCopilot.jsx` — Kannada/English text/voice controls and grounded response rendering.
- Modify `web/src/features/alerts/AlertDetail.jsx` and `AlertInbox.jsx` — reusable evidence and list projections.
- Modify `web/src/styles/tokens.css` and `app.css` — measured Catalyst-inspired tokens and responsive layout.
- Create/modify alert, shell and router tests — platform identity, navigation, evidence consistency and copilot states.

## Task 1: Indexed Candidate Generation

**Files:**
- Create: `packages/intelligence-core/src/candidates.mjs`
- Create: `tests/intelligence/candidates.test.mjs`
- Modify: `packages/intelligence-core/index.mjs`

- [x] **Step 1: Write the failing candidate-index tests**

```js
test('spatial candidates exclude distant points without losing neighbours', () => {
  const result = spatialCandidatePairs(features, { radiusKm: 1.5 });
  assert.deepEqual(result.pairs.map(pair => pair.map(row => row.caseId)), [['A', 'B']]);
  assert.equal(result.diagnostics.fullPairCount, 3);
  assert.equal(result.diagnostics.candidatePairCount, 1);
});

test('identity candidates compare only matching authoritative or normalized keys', () => {
  const result = identityCandidatePairs(appearances);
  assert.ok(result.pairs.every(([left, right]) => left.personId === right.personId || left.name === right.name));
});
```

- [x] **Step 2: Run tests and verify RED**

Run: `node --test tests/intelligence/candidates.test.mjs`
Expected: FAIL because `@ksp/intelligence-core/candidates` does not exist.

- [x] **Step 3: Implement the minimum indexes**

Use spherical Cartesian grid buckets sized from `radiusKm`, inspecting the current and 26 neighboring cells. Use `Map` buckets keyed by authoritative person ID and normalized name. De-duplicate candidate pairs with a stable ordered case/appearance key. Return `{ pairs, diagnostics }` where diagnostics contains eligible count, full-pair count and candidate-pair count.

- [x] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/intelligence/candidates.test.mjs`
Expected: all candidate tests pass.

- [x] **Step 5: Commit**

```bash
git add packages/intelligence-core/src/candidates.mjs packages/intelligence-core/index.mjs tests/intelligence/candidates.test.mjs
git commit -m "perf: index intelligence candidates"
```

## Task 2: Scale-Bounded Hotspot and Identity Analysis

**Files:**
- Modify: `packages/intelligence-core/src/hotspot.mjs`
- Modify: `packages/intelligence-core/src/identity.mjs`
- Modify: `tests/intelligence/hotspot.test.mjs`
- Modify: `tests/intelligence/identity.test.mjs`

- [x] **Step 1: Add failing equivalence and bound tests**

```js
test('hotspot search keeps the planted cluster while reducing comparisons', () => {
  const { findings, diagnostics } = detectHotspots(features, options);
  assert.ok(findings.some(item => truth.hotspot.caseIds.every(id => item.evidenceCaseIds.includes(id))));
  assert.ok(diagnostics.candidatePairCount < diagnostics.fullPairCount);
});

test('identity search remains linear in unrelated appearances', () => {
  const result = resolveIdentities(unrelatedFeatures);
  assert.equal(result.resolutions.length, 0);
  assert.equal(result.diagnostics.candidatePairCount, 0);
});
```

- [x] **Step 2: Run targeted tests and verify RED**

Run: `node --test tests/intelligence/hotspot.test.mjs tests/intelligence/identity.test.mjs`
Expected: FAIL because current functions return arrays without diagnostics and scan broadly.

- [x] **Step 3: Integrate the candidate indexes**

Preserve existing finding objects and algorithm labels. Return `{ findings, diagnostics }`, then update the pipeline and direct callers once. Candidate generation may exclude comparisons only when the spatial distance lower bound or identity blocking key proves they cannot qualify.

- [x] **Step 4: Run intelligence tests and verify GREEN**

Run: `npm run intelligence:test`
Expected: all intelligence tests pass, including planted and negative controls.

- [x] **Step 5: Commit**

```bash
git add packages/intelligence-core/src/hotspot.mjs packages/intelligence-core/src/identity.mjs packages/intelligence-core/src/pipeline.mjs tests/intelligence
git commit -m "perf: bound hotspot and identity scans"
```

## Task 3: Bounded Pattern Fusion

**Files:**
- Modify: `packages/intelligence-core/src/candidates.mjs`
- Modify: `packages/intelligence-core/src/pattern-fusion.mjs`
- Modify: `packages/intelligence-core/src/pipeline.mjs`
- Modify: `tests/intelligence/pattern-fusion.test.mjs`

- [x] **Step 1: Write failing Pattern Fusion equivalence tests**

```js
test('candidate blocking preserves the planted cross-district pattern', () => {
  const result = discoverPatterns(features, options);
  assert.ok(result.patterns.some(pattern => truth.pattern.caseIds.every(id => pattern.evidenceCaseIds.includes(id))));
  assert.ok(result.diagnostics.candidatePairCount < result.diagnostics.fullPairCount);
});

test('network evidence can nominate a pair outside the spatial block', () => {
  const result = patternCandidatePairs(sharedPersonFeatures, { maximumDays: 180 });
  assert.equal(result.pairs.length, 1);
});
```

- [x] **Step 2: Run and verify RED**

Run: `node --test tests/intelligence/pattern-fusion.test.mjs tests/intelligence/candidates.test.mjs`
Expected: FAIL because Pattern Fusion currently compares every eligible pair.

- [x] **Step 3: Implement multi-block union candidates**

Create candidates from the union of time-partitioned neighboring spatial cells, shared authoritative person ID, and shared act/section. At the locked threshold of 0.65 with three evidence families, a pair without spatial, legal or network nomination cannot reach the score; common crime labels alone must never create a quadratic bucket. Keep the existing 180-day hard boundary and exact `scoreCasePair` qualification.

- [x] **Step 4: Run the full backend suite**

Run: `npm test`
Expected: all tests pass and evaluation retains its positive/negative gates.

- [x] **Step 5: Commit**

```bash
git add packages/intelligence-core/src tests/intelligence
git commit -m "perf: bound pattern fusion candidates"
```

## Task 4: Local Scale Benchmark

**Files:**
- Create: `scripts/intelligence/benchmark-scale.mjs`
- Create: `tests/intelligence/scale-benchmark.test.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing deterministic benchmark-contract test**

```js
test('benchmark generator is deterministic and plants one known pattern', () => {
  const left = generateBenchmarkFeatures({ count: 1000, seed: 20260721 });
  const right = generateBenchmarkFeatures({ count: 1000, seed: 20260721 });
  assert.deepEqual(left, right);
  assert.equal(left.length, 1000);
});
```

- [x] **Step 2: Verify RED**

Run: `node --test tests/intelligence/scale-benchmark.test.mjs`
Expected: FAIL because the generator does not exist.

- [x] **Step 3: Implement benchmark generation and reporting**

Generate feature-level synthetic records without writing Catalyst rows. For 1K, 10K and 50K runs, report elapsed milliseconds, full-pair count, candidate-pair count, reduction ratio, findings and `process.memoryUsage().heapUsed`. Fail if the planted pattern is lost or the candidate count reaches the full-pair count.

- [x] **Step 4: Run the benchmark**

Run: `npm run intelligence:benchmark`
Expected: JSON output for 1K/10K/50K; exit 0; no Catalyst network call.

- [x] **Step 5: Commit**

```bash
git add scripts/intelligence/benchmark-scale.mjs tests/intelligence/scale-benchmark.test.mjs package.json
git commit -m "test: benchmark 50k intelligence features"
```

## Task 5: Governed QuickML Client

**Files:**
- Create: `src/backend/copilot/quickml-client.mjs`
- Create: `tests/backend/quickml-client.test.mjs`

- [ ] **Step 1: Write failing transport tests**

Test exact allowlisted India endpoints, OAuth/organization headers, timeout abort, non-2xx rejection, malformed response rejection and absence of tokens in thrown errors. Inject `fetch` and `tokenProvider`; never contact Zoho from unit tests.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/backend/quickml-client.test.mjs`
Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement the minimal client**

Expose `chat`, `transcribe`, `translate` and `synthesize`. Hard-code only the reviewed Catalyst endpoint paths and organization ID in server configuration; accept no caller-provided URL or model name. Use `AbortSignal.timeout`, OAuth from the injected token provider and safe stable error codes.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/backend/quickml-client.test.mjs`
Expected: all client tests pass with no real network call.

- [ ] **Step 5: Commit**

```bash
git add src/backend/copilot/quickml-client.mjs tests/backend/quickml-client.test.mjs
git commit -m "feat: add governed QuickML client"
```

## Task 6: Evidence-Grounded Copilot API

**Files:**
- Create: `src/backend/copilot/evidence-copilot.mjs`
- Create: `tests/backend/copilot.test.mjs`
- Modify: `src/backend/http/api-contract.mjs`
- Modify: `src/backend/reporting/workspace-services.mjs`
- Modify: `src/backend/catalyst/api-bootstrap.mjs`
- Modify: `src/backend/catalyst/runtime-config.mjs`
- Modify: relevant Catalyst bundle tests

- [ ] **Step 1: Write failing service and route tests**

Test that the service uses `getAlertDetail(access, alertId)`, includes only returned evidence, rejects unknown returned case IDs, supports `en`/`kn`, returns `MODEL_UNAVAILABLE` safely and never changes alert/workflow state.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/backend/copilot.test.mjs tests/backend/api-contract.test.mjs`
Expected: FAIL because the service and route are absent.

- [ ] **Step 3: Implement one bounded operation**

Declare `POST /v1/alerts/{alertId}/copilot/query`. Accept exactly `{ language, questionText, audioBase64, speak }` with either text or audio. ASR/translation are optional preprocessing; GLM receives a compact evidence JSON object and an instruction to return strict JSON `{ answer, evidenceCaseIds, limitations }`. Validate every evidence ID against the authorized alert projection. Optional translation/TTS occurs only after validation.

- [ ] **Step 4: Build and inspect both Functions**

Run: `npm test && npm run catalyst:build && npm run catalyst:inspect`
Expected: all tests pass; bundle inspection reports zero forbidden files or unresolved imports.

- [ ] **Step 5: Commit**

```bash
git add src/backend/copilot src/backend/http src/backend/reporting src/backend/catalyst tests/backend tests/catalyst functions
git commit -m "feat: add grounded evidence copilot API"
```

## Task 7: Catalyst-Inspired Platform Shell

**Files:**
- Modify: `web/src/app/AppShell.jsx`
- Modify: `web/src/app/AppShell.test.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/app/router.test.jsx`
- Modify: `web/src/styles/tokens.css`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing shell tests**

Assert visible `Karnataka State Police` organization identity, global application rail, contextual Crime Intelligence navigation, authorized scope, alert count and synthetic notice. Assert no theatrical greeting and no disabled application links.

- [ ] **Step 2: Verify RED**

Run: `npm run web:test -- --run web/src/app/AppShell.test.jsx web/src/app/router.test.jsx`
Expected: FAIL because the current Command Navy shell lacks the new hierarchy.

- [ ] **Step 3: Implement the minimum shell**

Use existing React Router and native CSS. Do not add Tailwind, Radix, global state or an icon framework. Use small inline SVG icons with accessible labels. Apply the measured light Catalyst-inspired density, spacing, borders and `#2A65F0` action color while retaining KSP identity.

- [ ] **Step 4: Verify GREEN and build**

Run: `npm run web:test && npm run web:build`
Expected: all frontend tests pass and Vite build exits 0.

- [ ] **Step 5: Commit**

```bash
git add web/src/app web/src/styles
git commit -m "feat: add public safety platform shell"
```

## Task 8: Active Signals and Evidence Copilot UI

**Files:**
- Create: `web/src/features/alerts/SignalWorkspace.jsx`
- Create: `web/src/features/alerts/EvidenceCopilot.jsx`
- Create: `web/src/features/alerts/SignalWorkspace.test.jsx`
- Create: `web/src/features/alerts/EvidenceCopilot.test.jsx`
- Modify: `web/src/features/alerts/AlertInbox.jsx`
- Modify: `web/src/features/alerts/AlertDetail.jsx`
- Modify: `web/src/app/router.jsx`
- Modify: `web/src/styles/app.css`

- [ ] **Step 1: Write failing journey tests**

Test two-pane selection, consistent evidence IDs, Overview/Map/Cases/Network/Activity tabs, note lifecycle and Copilot loading/success/unavailable/unsupported-evidence states. Stub only the API boundary.

- [ ] **Step 2: Verify RED**

Run: `npm run web:test -- --run web/src/features/alerts/SignalWorkspace.test.jsx web/src/features/alerts/EvidenceCopilot.test.jsx`
Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the workspace**

The list and detail remain visible together. Copilot answers render evidence case links and an explicit `AI explanation — verify against evidence` label. Audio recording uses the native `MediaRecorder` API and sends base64 only after the user presses Ask; no continuous microphone capture exists. Hide voice controls when the API is unavailable, while preserving text investigation.

- [ ] **Step 4: Verify frontend suite and build**

Run: `npm run web:test && npm run web:build`
Expected: all tests and production build pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/alerts web/src/app/router.jsx web/src/styles/app.css
git commit -m "feat: add active signals evidence workspace"
```

## Task 9: Full Verification, Alignment and Development Deployment Gate

**Files:**
- Modify: `Architecture.md`, `PRD.md`, `Design.md`, `Phases.md`, `docs/PROJECT_MEMORY.md`
- Create: `docs/reviews/2026-07-*-scalable-signal-to-action-implementation.md`
- Modify: `docs/deployment/catalyst-development-ledger.md` only after authorized remote action

- [ ] **Step 1: Run full local verification**

Run: `npm run verify && npm run intelligence:benchmark`
Expected: backend/frontend/build/bundle/schema gates pass; 50K benchmark exits 0.

- [ ] **Step 2: Run challenge-alignment review**

Use `skills/reviewing-challenge-alignment/SKILL.md`, record the exact output template and stop on WARN/FAIL before remote mutation.

- [ ] **Step 3: Configure QuickML OAuth without exposing credentials**

Use Catalyst Connections or the reviewed Catalyst-native OAuth boundary. Confirm only connection name/scope, never print or commit access/refresh tokens. Test the five provisioned endpoints with non-sensitive synthetic evidence.

- [ ] **Step 4: Request explicit deployment authorization**

Deployment scope is only the reviewed API Function and Slate Development app. Do not redeploy `intelligence_refresh`, alter the accepted batch, create a recurring schedule, load 50K remote rows or touch Production.

- [ ] **Step 5: Perform authenticated browser smoke after authorization**

Verify Active Signals loads persisted evidence, Copilot answers cite only authorized synthetic case IDs, Kannada transcription/translation succeeds, model failure is safe, and one note/action remains audited.

- [ ] **Step 6: Record evidence and commit**

```bash
git add Architecture.md PRD.md Design.md Phases.md docs/PROJECT_MEMORY.md docs/reviews docs/deployment/catalyst-development-ledger.md
git commit -m "docs: verify scalable signal-to-action slice"
```

## Plan Self-Review

- Spec coverage: scale, provisioned AI, authorized grounding, platform shell, Active Signals, audit and challenge continuity map to Tasks 1-9.
- Placeholders: no TBD/TODO steps; remote actions are explicitly gated by authorization and prerequisites.
- Type consistency: candidate functions return `{ pairs/findings/resolutions, diagnostics }`; Copilot returns `{ answer, evidenceCaseIds, limitations, language, audioBase64? }`; route is consistently `POST /v1/alerts/{alertId}/copilot/query`.
- Scope control: no live CCTV, Production deployment, 50K Catalyst load, arbitrary chatbot, RAG upload or custom QuickML pipeline is included.
