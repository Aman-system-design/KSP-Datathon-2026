# Geospatial Intelligence Studio — Approved Design

**Product:** Public Safety Intelligence Platform

**Initial tenant:** Karnataka State Police

**Challenge:** Datathon 2026 — Challenge 02

**Status:** Approved design; implementation requires a reviewed execution plan

**Deployment target:** Catalyst by Zoho, India data centre

**Decision date:** 2026-07-22

## 1. Purpose

This document defines the production-shaped geospatial capability for the platform. It replaces the idea of building separate, fixed maps for hotspots, alerts, reports, and dashboards with one governed Geospatial Intelligence Studio and one reusable rendering contract.

The Studio must support:

- interactive operational maps and district/station drilldowns;
- model-generated hotspot, anomaly, network, pattern, and area-risk layers;
- saved maps reusable in reports, dashboards, Command Centre, and role workspaces;
- incremental FIR and related-source updates without recreating saved maps;
- governed onboarding of additional spatial datasets;
- organization, role, jurisdiction, sensitivity, and record-level controls;
- large geographic layers through PMTiles without sending raw statewide FIR data to browsers.

Karnataka State Police is the first configured organization. The product behavior must not hardcode KSP-specific branding, hierarchy, fields, or policy into the renderer.

## 2. Challenge alignment

| Challenge requirement | Geospatial proof |
|---|---|
| Interactive dashboards and geospatial maps | A saved map definition renders consistently in Studio, reports, dashboards, and Command Centre. |
| Crime hotspot detection | DBSCAN and H3 outputs publish versioned, explainable map layers linked to contributing authorized FIR records. |
| District-level drilldowns | State → district/commissionerate → station → alert/case navigation is scope checked at every request. |
| Trend alerts and anomaly detection | Anomaly outputs appear as time-aware layers and evidence drawers, not hard-coded markers. |
| Network and link analysis | Authorized case/person connections render as paths or arcs backed by evidence-linked graph results. |
| Repeat-offender tracking | Governed identity-resolution results can be mapped by case occurrence without exposing unauthorized person data. |
| Socio-economic correlation | Aggregate district context can be rendered as a choropleth with source, period, missingness, and non-causality warnings. |
| Predictive risk scoring | Area/time risk is rendered as H3 or administrative-area cells with components, model version, and limitations. |
| AI/ML pattern detection | Each model run publishes a versioned intelligence dataset that can drive one or more governed views. |

A map, marker, label, or screenshot is not implementation proof. Proof requires executed analytics, traceable source records, deterministic layer compilation, permission enforcement, positive and negative fixtures, and an end-to-end refresh test.

## 3. Design principles

1. **Map definitions are durable; data is replaceable.** A saved view stores source references, field mappings, rendering, filters, and interactions—not copied result rows.
2. **One contract, multiple surfaces.** Studio, report widgets, dashboards, Command Centre, and evidence views use the same layer compiler and renderer.
3. **Intelligence is evidence, not decoration.** Every generated feature exposes provenance, observation period, method/model version, freshness, evidence, and limitations.
4. **The server is the authorization boundary.** Browser filters never substitute for organization, jurisdiction, role, sensitivity, or case-assignment enforcement.
5. **The browser receives the minimum useful representation.** Sensitive records use scoped APIs; large approved aggregates use tiles.
6. **No fabricated geography.** Missing coordinates, invalid geometries, or failed model runs produce explicit states; the UI never invents locations.
7. **Incremental by default.** New, corrected, or deleted FIR records update affected features and analytical layers without replacing users' saved views.
8. **Human-governed AI.** Language models may draft map configurations and explanations; deterministic analytics produce numerical intelligence, and deterministic validators approve execution.

## 4. Technology decisions

| Concern | Decision | Reason |
|---|---|---|
| Basemap rendering | MapLibre GL JS | Open, GPU-accelerated, style-driven map renderer. |
| Analytical overlays | deck.gl | Scalable point, path, arc, polygon, heatmap, and H3 rendering. |
| Spatial indexing | H3 | Stable aggregation cells for area/time analysis and risk comparison. |
| Point clustering | Supercluster | Fast viewport clustering for interactive point layers. |
| Large static/aggregate layers | PMTiles | Single-file, range-requested tiles with versionable distribution. |
| Emergency/public basemap | OpenFreeMap | No-key fallback; not the operational SLA boundary. |
| Operational storage | Catalyst Data Store | Dataset/view/run metadata, permissions, workflow, and audit. |
| Object storage | Catalyst Stratus | PMTiles, approved imports, rejection reports, and immutable artifacts. |
| APIs and validation | Catalyst Serverless Functions | Authentication-aware queries, imports, compilation, and drilldowns. |
| Range fallback | Catalyst AppSail | Used only if Stratus cannot meet the browser PMTiles range/CORS contract. |
| Events and schedules | Catalyst Signals/Event Functions plus Job Scheduling/Cron | Incremental reactions and reconciliation/refresh jobs. |
| Frontend hosting | Catalyst Slate/Web Client Hosting | Existing React SPA deployment target. |
| Generative assistance | Catalyst QuickML LLM serving | Natural-language-to-draft-view and grounded explanation, after validation. |

The implementation must use these libraries through their documented APIs and retain license notices. World Monitor is architectural inspiration only. Its AGPL source code must not be copied.

## 5. Canonical contracts

### 5.1 Dataset Definition

A dataset is an authorized, typed source that the platform can query or tile. Minimum fields:

```text
DatasetID
OrganizationID
Name
Description
SourceType                 SEMANTIC_API | DATASTORE_VIEW | CSV | GEOJSON | PMTILES
SourceReference            opaque server-managed identifier
SchemaVersion
FieldSchema                names, types, nullability, allowed use
GeometryType               POINT | LINE | POLYGON | MULTI_* | H3 | ADMIN_BOUNDARY
GeometryMapping            coordinate, geometry, H3, or boundary-join fields
TimeField
SeverityField
WeightField
LabelFields
SensitivityClass
RequiredPermissions
JurisdictionPolicy
RefreshPolicy
FreshnessObjective
RetentionPolicy
Owner
Provenance
Status                     DRAFT | VALIDATING | PUBLISHED | REJECTED | RETIRED
CreatedAt / UpdatedAt
```

`SourceReference` never exposes credentials, private Stratus paths, or unrestricted queries to the client. Field schemas distinguish displayable, filterable, aggregatable, sensitive, and prohibited fields.

### 5.2 Map View Definition

A saved view is a versioned composition of authorized datasets:

```text
MapViewID
OrganizationID
Name
Description
Version
Owner
Visibility                 PRIVATE | SHARED | ROLE_DEFAULT | ORGANIZATION_GLOBAL
RequiredPermissions
Viewport                    centre, zoom, bounds
TimeWindow
GlobalFilters
BasemapDefinition
LayerDefinitions[]
InteractionDefinition
DashboardCompatibility
CreatedAt / UpdatedAt / PublishedAt
```

Each layer definition contains:

```text
LayerID
DatasetID
DatasetVersionConstraint
Renderer                    POINT | CLUSTER | HEATMAP | H3 | CHOROPLETH | PATH | ARC
Visible
Order
MinZoom / MaxZoom
FilterExpression
Aggregation
ColorMapping
SizeMapping
WeightMapping
LabelMapping
TooltipFields
ClickDrilldown
Legend
RefreshBehavior
```

The server validates the definition before storage and again before execution. Unsupported fields, operators, renderers, scopes, or excessive workloads are rejected.

### 5.3 Intelligence Layer Run

Analytics and ML publish datasets through a governed run record:

```text
LayerRunID
OrganizationID
DatasetID
ModelOrMethod
ModelVersion
ParameterSet
InputDatasetVersions
InputWatermarks
ObservationWindow
StartedAt / CompletedAt
Status                     QUEUED | RUNNING | VERIFIED | FAILED | STALE | RETIRED
SourceRecordCount
OutputFeatureCount
QualityMetrics
Limitations
ArtifactReference
PreviousVerifiedRunID
```

Only a verified run can become the dataset's active version. Publication updates an active-version pointer atomically. A failed run preserves the last verified version and marks its freshness honestly.

## 6. Execution paths

### 6.1 Sensitive and changing operational data

FIR, accused, victim, case-link, alert, and other sensitive/changing records are queried through authenticated Functions. The server derives organization and effective access from the authenticated identity, intersects it with role, unit hierarchy, explicit permissions, and assignment, then applies bounded time, viewport, and feature limits.

The response contains only fields authorized for that renderer and interaction. Detail drilldowns are separate authorized requests; a map response does not preload hidden person or case data.

### 6.2 Approved large geography and aggregates

Boundaries, basemap data, historical aggregate cells, and other approved non-sensitive layers may be compiled to versioned PMTiles objects in Stratus. The Dataset Definition references the immutable artifact version. Publication changes the active pointer; previous artifacts remain available for rollback until retention removes them.

### 6.3 Size-based delivery policy

- Small bounded results: GeoJSON from Functions.
- Medium changing point sets: viewport/server aggregation with Supercluster-compatible properties.
- Area/time analysis: server-generated H3 aggregates rendered by deck.gl.
- Large static or historical aggregates: PMTiles.
- Raw statewide FIR/person corpus: never delivered to the browser.

Thresholds are configuration with measured defaults, not scattered constants in UI components.

## 7. Incremental FIR processing

Saved maps continue working as source data changes because they reference datasets and fields, not snapshots.

```text
FIR insert/update/delete
  → source validation and reconciliation
  → idempotent change event
  → affected feature/aggregate calculation
  → affected model run or micro-batch
  → verified intelligence-layer publication
  → map cache invalidation / refresh notification
```

Each change event includes source entity, source ID, source version, operation, event ID, organization, and observed timestamp. Consumers store an idempotency receipt and a committed watermark. Duplicate delivery has no additional effect.

Event processing provides low-latency updates; scheduled reconciliation compares source versions and watermarks to recover missed events. Corrections and deletions remove or recompute derived contributions. Model runs record the exact input watermarks.

An open map may poll or receive a refresh signal. It does not silently replace the current view while an officer is inspecting evidence; it announces that newer intelligence is available and refreshes according to the view's policy.

## 8. AI/ML-generated mapping

AI/ML is a first-class producer of governed spatial datasets:

- DBSCAN publishes geographic hotspot clusters and contributing-case references.
- H3 aggregation publishes area/time cells for counts, trends, anomaly measures, and risk components.
- Median/MAD publishes baseline deviations linked to station/category/time evidence.
- Pattern Fusion publishes multi-signal clusters and cross-district relations.
- TF-IDF or later validated text models publish similarity evidence without claiming proof.
- Graph analytics publishes connected cases/co-accused structures for authorized rendering.
- Identity resolution publishes repeat-appearance evidence while rejecting name-only matches.
- Area-risk scoring publishes area/time signals, never person-level future offending predictions.

Every output is versioned under the Intelligence Layer Run contract. Clicking a generated feature shows its method, version, parameter set, observation window, source count, evidence, quality/confidence measures, limitations, freshness, and authorized contributing records.

### 8.1 Generative map assistant

An authorized user may enter intent such as:

> Show emerging night-time vehicle-theft hotspots for the last 30 days and compare them with the previous baseline.

The QuickML-served language model produces only a draft Map View Definition or draft analytical request. A deterministic compiler then:

1. resolves named concepts to registered datasets and fields;
2. validates organization, role, jurisdiction, and sensitivity;
3. validates operators, types, dates, geometry, and renderer compatibility;
4. estimates query cost and output size;
5. rejects ambiguity or prohibited requests;
6. shows the interpreted definition for confirmation where publication or expensive execution is involved;
7. executes through normal authorized APIs.

The language model cannot invent crimes, coordinates, identities, links, model results, or risk values. It assists configuration and explanation; deterministic statistical/ML pipelines produce numerical intelligence.

User feedback such as useful, false positive, or needs investigation is retained as evaluation evidence. It does not automatically retrain a model or become ground truth.

## 9. User experience

### 9.1 Studio layout

`/geospatial` opens a map-first workspace inside the existing Catalyst-like application shell:

- collapsible organizational navigation remains on the far left;
- a resizable Studio panel provides saved views, dataset search, layer visibility, and layer order;
- the centre map consumes the remaining workspace;
- selecting a layer opens a right inspector;
- selecting a feature opens an evidence drawer;
- an accessible results table provides a non-map representation of visible authorized features.

The top toolbar contains jurisdiction, time range, search, saved view, share, add to dashboard, and full-screen controls. Advanced styling and drawing do not clutter the default toolbar.

### 9.2 Layer inspector

The inspector uses progressive sections:

1. **Data:** source, provenance, freshness, owner, record count, sensitivity.
2. **Geometry:** point, line, polygon, boundary join, or H3 mapping.
3. **Visual:** marker, cluster, heatmap, H3, choropleth, path, or arc plus semantic mappings.
4. **Interaction:** tooltip, click drilldown, filters, time window, legend, and refresh.

Operational users consume published views and may adjust allowed runtime filters. Analysts and authorized administrators can create, edit, test, and publish according to permissions.

### 9.3 Evidence drawer

A feature click opens evidence rather than a decorative popup. It displays:

- computed measure and units;
- source dataset and provenance;
- observation period and freshness;
- model/method version and parameters;
- evidence/confidence/quality and limitations;
- authorized contributing records and drilldown actions;
- alert/action status when the feature is operational intelligence.

### 9.4 Reuse

Report Builder gains a Map visualization family backed by the same view contract. A saved view can be embedded in a dashboard, assigned as a role default, shared according to organization policy, opened in Studio, or used in Command Centre. Rendering logic is not duplicated by surface.

### 9.5 Responsive and accessible behavior

- Desktop: resizable layer panel and inspector.
- Tablet: map with sheets/bottom drawer and touch targets of at least 44px.
- Keyboard: all controls, layer ordering alternatives, focus visibility, and close/return behavior.
- Semantics: accessible names, titles for dialogs/sheets, status text not conveyed only by colour, and tabular alternatives.
- Motion: restrained 150–300ms feedback with reduced-motion support; no decorative map animation that obscures state.
- Typography: Roboto and existing platform tokens; dense enterprise spacing; no marketing-page visual effects.

Shadcn components may supply accessible controls such as Sheet, Drawer, Tabs, Select, Command, Alert, Empty, Skeleton, Tooltip, and Resizable. They must use project semantic tokens and existing platform primitives. Shadcn is not the map renderer and is not permission to replace the established shell.

## 10. Dataset onboarding

### 10.1 Registered internal sources

Existing semantic APIs and approved Data Store views are registered server-side. Registration declares fields, geometry, sensitivity, permissions, owner, provenance, refresh, and retention.

### 10.2 Governed CSV/GeoJSON import

Authorized analysts/administrators can submit bounded CSV or GeoJSON files. The workflow:

1. uploads to a quarantined Stratus location;
2. records content hash, uploader, organization, declared purpose, and sensitivity;
3. validates media type, size, encoding, schema, row/feature limits, coordinates, geometry validity, and permitted fields;
4. rejects unsafe, malformed, out-of-bound, ambiguous, or unauthorized content;
5. produces a downloadable rejection report with row/feature identifiers and reasons;
6. previews accepted schema and sample geography without publishing;
7. requires an owner and policy metadata;
8. publishes an immutable dataset version only after successful validation;
9. converts sufficiently large approved geography/aggregates to PMTiles asynchronously.

Invalid rows are not silently dropped or plotted. Original imports are not executable content and are never served directly as trusted map assets.

## 11. Authorization and tenancy

Every Dataset Definition, Map View, layer run, dashboard reference, share, and audit event carries `OrganizationID`. The server derives effective organization from authenticated access and rejects cross-organization references even if identifiers are guessed.

Effective access is the intersection of:

- organization membership;
- persona/role permissions;
- assigned jurisdiction hierarchy;
- dataset and field sensitivity;
- explicit platform permission;
- case assignment where required;
- sharing policy and view visibility.

Client-supplied organization, role, or scope values are requests, never authority. Public basemaps do not imply public operational overlays. Signed artifact access is short-lived and scoped; secrets and durable object credentials never enter frontend code.

Organization configuration supplies branding, jurisdiction hierarchy, default views, allowed datasets, retention, and policy. A role default can be set by an administrator, while users may own and share views within permitted organizational boundaries.

## 12. PMTiles distribution contract

Direct Stratus delivery is accepted only if a deployed-origin compatibility test proves:

- CORS preflight from the Slate/Web Client origin succeeds;
- `HEAD` returns stable length and validator headers;
- `GET` with `Range` returns `206 Partial Content` and correct `Content-Range`;
- `ETag` or equivalent validators are exposed and stable for an immutable object;
- required response headers are readable by browser code;
- caching does not combine versions or return incorrect byte ranges;
- signed URL lifetime supports a session without granting broader bucket access.

The test uses a small known PMTiles fixture and validates an actual tile lookup, not only an HTTP status. If any required behavior fails, AppSail provides a narrow authenticated range gateway over the same immutable Stratus object. The frontend PMTiles protocol and view definition remain unchanged.

OpenFreeMap is an emergency/public basemap fallback. It is not assumed to provide an enterprise availability, privacy, or support SLA. Operational deployment should use a controlled PMTiles basemap hierarchy for required global, India, and Karnataka coverage.

## 13. Performance and reliability

- Every operational query has bounded organization, jurisdiction, time, viewport, pagination, and feature limits.
- Expensive aggregation is server-side and asynchronous when it cannot meet the interactive budget.
- Requests support abort/cancellation; viewport requests are debounced and stale responses ignored.
- Layer data and derived artifacts use version-aware caching.
- Heavy rendering modules are route/layer lazy-loaded so non-map routes do not pay the GIS bundle cost.
- Map objects and workers have explicit lifecycle cleanup.
- Layer failures are isolated; one unavailable source does not blank the basemap or unrelated layers.
- Each layer supports loading, empty, unauthorized, invalid-source, stale, failed-run, and retry states with diagnostic request/run identifiers.
- Last verified output may remain visible when a refresh fails, but it is visibly stale and never described as current.
- Published view versions and immutable artifacts allow rollback.

Initial acceptance targets, subject to benchmark refinement:

- useful initial map state within three seconds on the demo dataset and target network;
- interactive pan/zoom without main-thread blocking from unbounded feature transformation;
- no unauthorized or out-of-scope record in responses, tooltips, tables, exports, or caches;
- deterministic refresh after inserted, corrected, and deleted FIR fixtures;
- saved view renders equivalently in Studio, report, and dashboard contexts;
- recoverable layer and model failures with visible freshness and diagnostics.

## 14. Audit and operational ownership

Audit events are required for dataset registration/import, validation result, publication, retirement, model execution, parameter change, active-version change, view creation/edit/publish/share, export, sensitive drilldown, permission denial, and administrative default assignment.

Every published dataset and intelligence layer has an owner, freshness objective, retention policy, sensitivity class, provenance, and rollback version. Unowned or expired assets cannot remain silently operational.

## 15. Testing and CI contract

### 15.1 Unit tests

- Dataset and Map View schema validation.
- Geometry/coordinate/H3 validation and boundary cases.
- Layer compiler compatibility and prohibited combinations.
- organization/role/jurisdiction/field permission intersection.
- change-event idempotency, watermarks, corrections, and deletions.
- active-run publication and failed-run preservation.
- model metadata and evidence requirements.
- AI draft validation and prohibited request rejection.

### 15.2 Integration tests

- new FIR → validated change → affected analytical result → verified layer → refreshed map response;
- corrected and deleted FIR contributions;
- cross-organization and cross-jurisdiction denial;
- import quarantine, rejection report, preview, publication, and retirement;
- PMTiles publication and version rollback;
- saved view reuse across Studio/report/dashboard APIs.

### 15.3 Browser tests

- map and layer loading;
- cluster/heatmap/H3/choropleth switching;
- time and jurisdiction filters;
- evidence drilldown and persona restrictions;
- saved view creation, sharing, and embedding;
- keyboard operation and accessible table;
- stale, unauthorized, empty, invalid, and failed-run states;
- refresh notification without disrupting active evidence review.

### 15.4 CI gates

The repository currently has no CircleCI configuration. If CircleCI is adopted, start with one small deterministic workflow using the committed lockfile:

1. clean dependency installation;
2. static/lint checks where configured;
3. backend unit/integration tests;
4. frontend tests and production build;
5. Catalyst function build and bundle inspection;
6. source/intelligence schema validation;
7. PMTiles compatibility tests that do not require production secrets for pull requests;
8. dependency/security checks;
9. optional authorized deployment job separated from verification.

CI must not silently deploy Catalyst Production. Deployment requires protected credentials, an approved environment, and an explicit release action. Network-dependent compatibility tests run against a controlled Development fixture and report a clear skipped/not-configured state outside that environment.

## 16. Delivery stages

These stages use the final architecture; none is a throwaway map:

1. **Shared contracts and renderer:** Dataset/Map View validation, MapLibre/deck.gl integration, layer compiler, evidence drawer, accessible table.
2. **KSP operational sources:** existing hotspot, H3 area-risk, district/station, and alert APIs plus incremental refresh metadata.
3. **Persistence and reuse:** saved/versioned views, sharing, role defaults, report/dashboard rendering.
4. **Governed imports:** bounded CSV/GeoJSON validation, preview, rejection, publication, and ownership.
5. **PMTiles:** Stratus compatibility gate, versioned artifacts, direct delivery or AppSail range fallback.
6. **AI/ML layers:** versioned model-run publication and evidence presentation for existing analytical methods.
7. **Generative assistant:** natural-language draft views with deterministic validation and confirmation.
8. **Hardening:** performance benchmarks, failure recovery, accessibility, CI, audit verification, and deployed smoke tests.

The execution plan must split these into independently verifiable tasks and preserve working software at each checkpoint.

## 17. Explicit non-goals for this implementation

- Copying World Monitor source code or reproducing its external-feed catalogue.
- Ingesting social media, CCTV, weather, conflict, or news feeds before an approved source and policy design.
- Predicting whether an individual will offend.
- Displaying sensitive FIR/person records through public tiles.
- Letting an LLM execute unrestricted queries or publish operational intelligence autonomously.
- Downloading the statewide raw FIR corpus into a browser.
- Building separate map implementations for each persona or dashboard.
- Claiming Stratus PMTiles compatibility before the deployed range/CORS test passes.

## 18. Source and license references

- MapLibre GL JS license: <https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt>
- deck.gl license: <https://github.com/visgl/deck.gl/blob/master/LICENSE>
- H3 JavaScript license: <https://github.com/uber/h3-js/blob/master/LICENSE>
- PMTiles license: <https://github.com/protomaps/PMTiles/blob/main/LICENSE>
- PMTiles cloud-storage requirements: <https://docs.protomaps.com/pmtiles/cloud-storage>
- OpenFreeMap terms: <https://openfreemap.org/tos/>
- Catalyst Stratus object download/range documentation: <https://docs.catalyst.zoho.com/en/sdk/web/v4/cloud-scale/stratus/download-object/>
- World Monitor map-engine documentation (design inspiration only): <https://www.worldmonitor.app/docs/map-engine>

## 19. Review gate

Implementation may begin only after this written specification is reviewed and the implementation plan derived from it is approved. Any later change that weakens authorization, evidence traceability, incremental correctness, model governance, or PMTiles validation requires an explicit architecture review.
