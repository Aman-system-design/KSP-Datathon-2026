# Role-First Catalyst Recovery Design

**Status:** Founder approved on July 23, 2026

**Supersedes:** The same-origin Function-routing decision in `2026-07-22-embedded-auth-live-map-release-design.md`

## Outcome

`https://aiksp.onslate.in` becomes a readable, role-specific crime-intelligence platform backed by real Catalyst identity, governed Catalyst APIs, and executable analytics. The product must never replace failed identity, data, model, or map calls with invented success states.

## Release Sequence

The recovery ships as four independently testable releases:

1. Catalyst Embedded Authentication and cross-domain Function connectivity.
2. A simplified enterprise shell with readable typography and role-specific workspaces.
3. A WorldMonitor-inspired operational map that renders governed intelligence layers over Karnataka.
4. One genuine QuickML capability after its Catalyst Connection and endpoint exist; transparent local analytics remain the operational baseline.

## Catalyst Authentication and API Contract

- Slate loads Catalyst Web SDK `4.6.2` and `/__catalyst/sdk/init.js`.
- Unauthenticated visitors receive `catalyst.auth.signIn("loginDivElementId", { service_url: "/" })`.
- Authorized Domains must include `https://aiksp.onslate.in` with CORS enabled.
- Slate and Advanced I/O Functions are different origins. The client calls the complete Development Function URL:
  `https://kspdatathon2026-60077844198.development.catalystserverless.in/server/crime_intelligence_api`.
- Before cross-origin API calls, the client obtains `catalyst.auth.generateAuthToken()` and sends the raw token in `Authorization`; it does not add a `Bearer` prefix.
- The backend remains the authority for the Catalyst user, access profile, role, unit scope, and Development-only persona-switch permission.
- Missing identity, access profile, workspace, or API connectivity produces a specific recoverable error state. It never produces `LOADING`, an empty authorized workspace, or demonstration metrics.

## Enterprise Shell and Typography

- Keep the approved white Catalyst-like layout and KSP branding.
- Use a system-first sans-serif stack compatible with Kannada: `Inter`, `Noto Sans Kannada`, `Segoe UI`, `Arial`, sans-serif. No runtime font CDN is required.
- Body text is at least 14px, supporting text at least 12px, controls at least 14px, and primary page headings 24–28px.
- Remove environment, freshness, and data-mode blocks from the global header. Operational freshness belongs beside the affected report, alert, model run, or map layer.
- The global header contains organization identity, search, notifications, help, and the profile menu.
- The left navigation is collapsible, keyboard accessible, and preserves the selected module.
- The profile menu is the only Development persona-switch surface and is rendered only when the backend authorizes it.

## Role Workspaces

The homepage is selected from the authorized role, not a universal dashboard:

- **State leadership / IG / senior officers:** case movement, district comparison, case ageing, state priorities, and high-confidence alerts. Maps remain accessible but do not dominate the home.
- **District and command centre:** operational map, hotspot movement, anomaly queue, district drilldown, and response status.
- **SHO / station leadership:** active cases, ageing buckets, station trends, assignments, and local alerts.
- **Crime analyst:** evidence workbench with anomaly, hotspot, pattern-link, repeat-offender, map, timeline, and network outputs.
- **Investigation officer:** assigned cases, related entities, evidence-backed links, actions, and notes.
- **Platform administrator:** access, global reports, dashboards, model/run health, and the all-persona preview screen.

Every metric and alert links to its governed evidence. No role card contains a number unless the current API response produced it.

## Operational Intelligence Map

- MapLibre renders the map; deck.gl renders analytical layers; H3 supports aggregation; PMTiles is supported for governed offline/vector archives; Supercluster handles point clustering.
- OpenFreeMap provides the no-key basemap. Basemap attribution remains visible.
- The initial camera fits Karnataka. Available `hotspots`, `anomalies`, and `areaRisk` datasets are executed through the geospatial API and become the initial composition.
- Layer controls support visibility, order, opacity, time window, filters, legend, freshness, and evidence selection.
- The map is dataset-driven: any future authorized geospatial dataset conforming to the layer contract can be mapped without a new page.
- A failed layer remains visible as failed with its request/run context while successful layers and the basemap remain usable.

## AI and ML Contract

Existing deterministic analytics remain real and explainable:

- DBSCAN: geographic hotspot discovery.
- Median/MAD: robust trend anomaly detection.
- Pattern Fusion: multi-signal case linkage.
- TF-IDF: modus-operandi text similarity.
- Graph analytics: co-accused and connected-case structures.
- Identity resolution: repeat appearances with name-only rejection.
- Area-risk scoring: six evidence-based area/time signals.

Each published result exposes method, version, run time, data window, evidence, confidence or score, limitations, and run status.

QuickML is added only through a real Catalyst deployment:

1. create and authorize a Catalyst Connection for QuickML with the minimum required deployment-read scope;
2. build and publish one dataset/pipeline/model endpoint in the current supported data centre;
3. store endpoint and project/organization identifiers as Function environment variables, never in source;
4. invoke the endpoint from the Function, validate its response, and persist model/run metadata;
5. show model failure or unavailability honestly and retain the deterministic baseline.

GLM 4.7 Flash may generate grounded explanations or executive briefs from retrieved evidence. It must not invent hotspots, anomaly counts, risk scores, or case links.

## Security and Failure Behaviour

- Authentication and authorization fail closed.
- The browser never decides geographic authority.
- Tokens, secrets, stack traces, and raw personal records are not rendered in errors or logs.
- Production CORS is owned by Catalyst configuration rather than duplicated permissive Express headers.
- Search stays unavailable until governed indexing exists.
- Synthetic records are acceptable for the competition dataset, but UI wording describes the dataset and run provenance neutrally; it does not present a theatrical warning banner or claim operational readiness.

## Acceptance Gates

1. Authentication tests prove embedded sign-in, token generation, full Function URL use, and fail-closed workspace resolution.
2. Role tests prove each authorized role receives the correct information hierarchy and no invented fallback values.
3. Map tests prove Karnataka startup, API-backed default layers, evidence selection, and isolated layer failure.
4. QuickML is not labelled integrated until a real endpoint invocation and persisted run are demonstrated.
5. Frontend and backend suites pass; the production frontend build emits no source maps.
6. Fresh-browser verification at `https://aiksp.onslate.in` succeeds with no relevant console errors.
7. Authenticated live verification proves a real workspace and at least one real analytics response; failed capabilities remain visibly failed.

