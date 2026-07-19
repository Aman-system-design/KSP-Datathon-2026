# Local Crime Intelligence Demo Runbook

## Purpose

This runbook executes the first verified analytical vertical slice for Challenge 02. It proves that deterministic code—not a hard-coded UI alert—can detect a planted hotspot, anomaly, repeat identity, co-accused network, area-risk change, and cross-district pattern while rejecting negative controls.

The data is fictional and synthetic. This is not an operational KSP accuracy claim, a Catalyst deployment, or the final PDF-aligned bulk seed.

## Prerequisites

- Node.js 24 or later
- Repository branch containing intelligence engine version `1.0.0`
- No external npm package is required

On Windows, use `npm.cmd` because local PowerShell execution policy may block the `npm.ps1` wrapper.

## Source and truth separation

- `fixtures/intelligence/demo-input.json` is the only fixture read by the production pipeline.
- `fixtures/intelligence/demo-truth.json` is read only by the evaluation layer.
- `src/intelligence/pipeline.mjs` does not import or read the truth file.
- `scripts/intelligence/generate-fixture.mjs` deterministically regenerates both files.

The application cannot discover the planted answer by reading the expected-output fixture.

## Regenerate the deterministic fixture

```powershell
node scripts/intelligence/generate-fixture.mjs
```

Expected result: the two JSON fixture files are recreated with fixture version `1.0.0`, exactly 50 canonical analytical cases, and visibly synthetic content.

## Run the intelligence pipeline and evaluation

```powershell
npm.cmd run intelligence:demo
```

Expected output:

```text
PASS: intelligence demo 1.0.0
```

The ignored report is written to:

```text
artifacts/intelligence/demo-report.json
```

## Run automated verification

```powershell
npm.cmd test
npm.cmd run schema:validate
```

The first command runs schema and intelligence tests together. The second independently verifies the existing 29-table Catalyst manifest and all configured relationships.

## Analytical methods

| Capability | Executed method | Output safeguard |
|---|---|---|
| Hotspot | Haversine DBSCAN | Evidence-case IDs, parameters, version, synthetic limitation |
| Anomaly | Median/MAD with seasonal comparison | Observed value, expected interval, deviation and negative control |
| Repeat identity | Authoritative `PersonID` plus blocked candidate comparison | Same-name/different-ID records are rejected |
| Network | Evidence-labelled case/person and co-accused graph | Every edge carries source case and evidence type |
| Text similarity | TF-IDF cosine baseline | Transparent baseline for later QuickML comparison |
| Area risk | Versioned weighted area/time score | No person score; low-completeness result is withheld |
| Pattern fusion | Weighted spatial, temporal, crime, legal, text and network evidence | At least three evidence families and human verification required |

## Fixture controls

Positive controls:

- one six-case spatial hotspot;
- one temporal anomaly;
- one confirmed repeat identity;
- one four-case co-accused community;
- one four-case, two-district pattern;
- one explainable area-risk result.

Negative controls:

- a seasonal series that must not become an anomaly;
- a same-name/different-person pair that must not become a confirmed identity;
- unrelated spatial and textual noise that must not join the planted pattern.

## Observed version 1.0.0 result

| Evidence | Observed result |
|---|---:|
| Evaluation | PASS |
| Analysis runs | 4 |
| Hotspots | 1 |
| Cross-district patterns | 1 |
| Pattern confidence | 0.96085 |
| Pattern precision on hidden fixture | 1.00 |
| Pattern recall on hidden fixture | 1.00 |
| Identity resolutions | 8 |
| Network nodes | 100 |
| Network edges | 58 |
| Co-accused edges | 4 |
| Area-risk score | 86/100 |

These values describe the controlled synthetic fixture only.

## Evaluation gates

The demo fails with a non-zero exit code unless every gate is true:

- planted hotspot detected;
- anomaly spike detected;
- seasonal negative control not promoted;
- planted cross-district pattern detected;
- pattern precision and recall at least 0.80;
- repeat identity confirmed by authoritative ID;
- false-name match not confirmed;
- co-accused network present;
- evidence lineage complete;
- synthetic labels present;
- risk remains area/time scoped.

## Current exclusions

This delivery track does not yet provide:

- PDF-aligned synthetic rows for all 26 source tables;
- Catalyst `TRN_*`, `INT_*`, or `WF_*` persistence;
- Catalyst Functions, API Gateway, Authentication, Cron, Signals, or QuickML endpoints;
- socio-economic district correlation;
- dashboards, maps, role experiences, assignments, outcomes, or audit UI;
- operational validation on real KSP data.

Those are separately gated delivery tracks. Do not present this local engine as the completed platform.
