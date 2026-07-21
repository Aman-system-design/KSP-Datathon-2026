# Intelligence Workspaces and Reporting Platform Design

**Date:** 2026-07-21

**Status:** Approved direction; written review required before implementation

**Product:** KSP Crime Decision Intelligence Platform

## 1. Outcome

Build the first jury-visible React experience around the already functional intelligence backend. The product remains an AI-driven crime analytics platform; reporting and dashboards are the configurable delivery layer through which different police roles consume intelligence and operational data.

The completed slice must prove this flow with real persisted synthetic outputs:

```text
accepted fragmented FIR records
→ versioned analytics
→ scoped AI alert
→ evidence drilldown
→ acknowledgement / assignment / notes / escalation / conclusion / outcome
```

It must also let authorized users create a practical report, save it, add it to a dashboard, rearrange the dashboard, and share it without gaining access to data outside their authorization.

## 2. Product Rules

- There is no single universal homepage.
- Each role opens in a role workspace with an administrator-defined default dashboard.
- Users can create personal reports and dashboards and choose a personal landing dashboard.
- Owners can share their reports and dashboards with authorized users, roles, or organizational units.
- Administrators can publish global content and assign a dashboard as the default for a role.
- A dashboard or report never grants data access; every execution reapplies server-side permissions and unit/evidence scope.
- AI alerts are governed workflow objects, not ordinary dashboard widgets.
- A persistent Alert Centre is available from every workspace and application, showing only alerts and evidence authorized for the caller.
- The contextual Copilot is a later QuickML integration. No fake chat box or hard-coded AI response will be shipped in this slice.

## 3. Scope

### 3.1 Build now

1. React SPA foundation and Catalyst hosting configuration.
2. Role-aware application shell and navigation.
3. Administrator-defined role-default dashboard resolution.
4. Personal, shared, role-default, and global dashboards.
5. Practical report builder:
   - select a governed data source;
   - select dimensions and measures;
   - apply date, category, unit, status, and severity filters where supported;
   - choose table, number, bar, line, or map visualization;
   - preview, save, share, and add the report to dashboards.
6. Dashboard editing: add/remove reports, resize/reorder using a bounded grid, save layout, duplicate, share, and choose personal default.
7. Persistent Alert Centre with drilldown into explanation, evidence, map/timeline/network/cases, notes, ownership, and workflow history.
8. Existing acknowledge, assign, analyst-conclusion, and outcome operations in the UI.
9. State leadership, district leadership, analyst, and light operations workspace presets.
10. Loading, empty, stale, partial, forbidden, validation, conflict, and safe-error behavior.

### 3.2 Deliberately defer

- arbitrary SQL, arbitrary joins, custom JavaScript, calculated formulas, and user-defined database access;
- scheduled exports and email delivery;
- pixel-perfect free-form dashboard canvases;
- a separate mobile application or offline synchronization;
- live CCTV/social/CAD ingestion;
- QuickML natural-language report creation and conversational Copilot;
- global enterprise administration beyond content ownership, sharing, and role defaults.

These deferrals keep the slice functional and safe without closing the production architecture.

## 4. User Experience Architecture

### 4.1 Global shell

The Command Navy shell contains:

- product and active unit scope;
- application navigation;
- dashboard switcher;
- global period/scope filters;
- data freshness and synthetic-data status;
- persistent Alert Centre with unread/assigned/escalated counts;
- account and access context.

The shell never displays theatrical greetings or generated executive prose by default.

### 4.2 Applications

- **Dashboards:** personal, shared, role, and global dashboards.
- **Reports:** report library and practical report builder.
- **Crime Command:** leadership intelligence brief and district comparison.
- **Hotspots & Geography:** incident, hotspot, risk, station, and pattern layers.
- **Patterns:** cross-district Pattern Fusion list and evidence detail.
- **Networks:** repeat identity and co-accused evidence graph.
- **Trends & Anomalies:** recent/baseline comparison and anomaly explanation.
- **Alerts & Actions:** complete alert inbox, assignment, escalation, notes, conclusion, outcome, and audit history.

Navigation visibility follows permission and purpose. Hiding navigation is not the authorization boundary; every API remains server-scoped.

### 4.3 Role defaults

- **State Leadership:** statewide pattern, district comparison, hotspot/risk, significant anomaly, and action-status reports.
- **District/Division Leadership:** station comparison, district hotspots, local anomaly queue, ageing/ownership, and outcome reports.
- **Crime Analyst:** prioritized alerts, pattern evidence, unresolved identity, network, anomaly, and data-quality reports.
- **Station/Investigator Operations:** active local alerts, assigned work, ageing, evidence-verification, and outcome reports.

The defaults are ordinary administrator-owned dashboards. A user may copy or override the landing preference without altering the role template.

## 5. Reporting Model

### 5.1 Semantic sources

The report builder does not expose Catalyst tables or ZCQL. It operates on a server-owned semantic registry whose first sources are:

- intelligence brief metrics;
- patterns;
- hotspots;
- anomalies;
- area risk;
- district context;
- alerts and workflow status.

Each source defines permitted dimensions, measures, filters, visualizations, drilldown route, classification, and maximum result size. The registry reuses the existing governed read services; it does not create a second analytics implementation.

### 5.2 Report definition

A report stores configuration, not result rows:

- report ID, name, description, owner and version;
- semantic source key;
- dimensions, measures, aggregation and sorting;
- bounded filters and observation period;
- visualization type and safe display options;
- drilldown route;
- visibility, sharing metadata and timestamps.

Every execution validates the definition against the current semantic source, resolves the caller's access profile, applies geographic/evidence scope, enforces limits, and returns the standard governed envelope.

### 5.3 Dashboard definition

A dashboard stores:

- dashboard ID, name, description, owner and version;
- visibility: personal, shared, role-default, or global;
- optional role-default assignment;
- ordered grid items referencing saved reports;
- each item's bounded column, row, width and height;
- optional shared dashboard filters;
- sharing metadata and timestamps.

Updating one saved report updates every dashboard that references it. Deleting a report is blocked while dashboards reference it unless the owner first removes those references.

## 6. Persistent Data

Add five Catalyst Data Store tables using the existing `CFG_*` configuration boundary:

1. `CFG_ReportDefinition`
2. `CFG_Dashboard`
3. `CFG_DashboardItem`
4. `CFG_ContentShare`
5. `CFG_UserPreference`

Add two workflow tables because notes and escalation are first-class accountable actions rather than dashboard metadata:

6. `WF_AlertNote`
7. `WF_Escalation`

Every table uses an application-owned unique ID, Catalyst ownership references, optimistic version, timestamps, and a synthetic-development marker where applicable. Dashboard items reference reports and dashboards through Catalyst Foreign Keys. Content sharing records use exactly one target type: user, role, or unit; unsupported identity-provider groups are not invented for the MVP.

Role-default assignment is administrator-only. Global publication is administrator-only. Ownership transfer and administrative override create audit events. Personal and shared report execution still uses the viewer's scope, never the owner's scope.

## 7. API Design

Reporting endpoints are added as a separate route module inside the existing `crime_intelligence_api` Function; no third Function or second authentication system is introduced.

### Workspace and catalogue

- `GET /v1/workspace` — caller access context, effective landing dashboard, available dashboards, semantic-source catalogue, and alert summary.
- `GET /v1/report-sources` — governed report field/measure/filter definitions.

### Reports

- `GET /v1/reports`
- `POST /v1/reports`
- `GET /v1/reports/{reportId}`
- `PATCH /v1/reports/{reportId}`
- `DELETE /v1/reports/{reportId}`
- `POST /v1/reports/{reportId}/execute`

### Dashboards

- `GET /v1/dashboards`
- `POST /v1/dashboards`
- `GET /v1/dashboards/{dashboardId}`
- `PATCH /v1/dashboards/{dashboardId}`
- `DELETE /v1/dashboards/{dashboardId}`
- `PUT /v1/dashboards/{dashboardId}/items`
- `PUT /v1/dashboards/{dashboardId}/sharing`
- `PUT /v1/dashboards/{dashboardId}/role-default`
- `PUT /v1/preferences/landing-dashboard`

### Alerts

- `GET /v1/alerts` — scoped inbox with status, assignment, severity, type and period filters.
- `GET /v1/alerts/{alertId}` — explanation, evidence summary, notes, ownership and history; personal evidence remains field-scoped.
- `POST /v1/alerts/{alertId}/notes` — append a classified note without changing the original finding.
- `POST /v1/alerts/{alertId}/escalate` — assign the alert to an authorized parent/higher unit with reason, priority and expected version.
- Existing four workflow writes remain unchanged.

All mutations require expected version and idempotency key. Creation and update payloads are schema-validated. Conflict, forbidden, not-found, validation, limit, and internal failure responses use stable safe codes.

## 8. Alert Centre

The Alert Centre is a shared frontend feature and a governed backend projection.

### List projection

- alert type, severity, confidence and status;
- affected authorized unit/area;
- observation period and age;
- assignment/escalation state;
- acknowledged and workflow state;
- synthetic label, quality and method version.

### Detail discovery

1. What was detected?
2. What baseline or comparison was used?
3. Which evidence families contributed?
4. Which authorized cases, locations, people or aggregates support it?
5. What is missing or unreliable?
6. Which method/version produced it?
7. What review or action is recommended?
8. Who owns it and what has happened?

Notes are append-only workflow artifacts with author, time, scope and classification. Escalation creates a dedicated workflow artifact plus the authorized higher-unit assignment; it is not a visual badge. Original analytical findings remain immutable.

## 9. Frontend Structure

Create one `web/` workspace:

```text
web/
  src/
    app/                 shell, routes, session, runtime config
    api/                 typed fetch client and governed envelopes
    features/
      alerts/
      dashboards/
      reports/
      leadership/
      district/
      analyst/
      operations/
      hotspots/
      patterns/
      networks/
    components/          shared accessible primitives only
    styles/              Command Navy tokens and layout
```

Use React, React Router and native CSS. Add a chart or map dependency only when a working challenge view requires it; do not introduce a general component framework or global state library. Server state remains in route/feature loaders with explicit loading and error states.

## 10. Security

- Catalyst Authentication remains the identity source.
- The server resolves role, designation, unit hierarchy, permissions and assignment.
- Report definitions cannot name a raw table, raw column, ZCQL fragment, URL, script or HTML.
- Semantic-source compilation uses fixed server-owned field mappings and parameterized values.
- Viewer scope always controls execution and drilldown.
- Owners may edit/share their own content; edit permission can be shared explicitly.
- Only administrators publish global content or set role defaults.
- Sensitive evidence, cross-district details and direct identifiers retain existing disclosure rules.
- Report/dashboard reads and writes, sharing changes, role defaults, alert evidence access and workflow actions are auditable.

## 11. Reliability and Performance

- Report executions require bounded periods and maximum row/group limits.
- Precomputed intelligence sources are queried instead of scanning raw FIR tables.
- Dashboard widgets load independently so one failure does not blank the entire workspace.
- The API supports cancellation-safe requests and stable pagination.
- Optimistic versions prevent lost dashboard/report updates.
- Failed saves preserve the last persisted dashboard; the UI keeps the unsaved draft and offers retry.
- Missing/deleted report references render a recoverable dashboard item error for owners and are omitted for viewers.

## 12. Testing and Acceptance

### Backend

- schema tests for five `CFG_*` and two `WF_*` tables and Foreign Keys;
- semantic-source allowlist and definition-validation tests;
- authorization tests for personal/shared/role/global content;
- viewer-scope tests proving shared reports do not leak owner data;
- ownership, sharing, role-default and optimistic-conflict tests;
- alert list/detail disclosure tests;
- safe error, idempotency, pagination and audit tests.

### Frontend

- production build and route tests;
- role-default and personal landing resolution;
- report create/preview/save/share/add-to-dashboard journey;
- dashboard reorder/resize/save/reload journey;
- global Alert Centre availability across routes;
- alert evidence and workflow journey;
- loading, empty, partial, stale, forbidden, conflict and error states;
- keyboard navigation, focus behavior and accessible names.

### Jury acceptance journey

1. Sign in as a scoped leadership persona and open the administrator-defined role dashboard.
2. Observe a real persisted Pattern Fusion alert in the global Alert Centre.
3. Drill through explanation, map, timeline, network and contributing evidence.
4. Assign/escalate it, add a note, submit an analyst conclusion and record an outcome.
5. Build a district anomaly report, preview it, save it and add it to a personal dashboard.
6. Share the dashboard with another authorized persona and show that their narrower scope changes the result without changing the report definition.
7. Show the analysis version, synthetic label, data quality and audit history.

The feature is not accepted if results are hard-coded, if sharing bypasses viewer authorization, if alerts lack evidence, or if the browser journey cannot complete against persisted data.

## 13. Delivery Order

1. Add configuration schema, contracts and tests.
2. Add report semantic registry, repositories, services and APIs.
3. Add dashboard ownership, sharing, defaults and APIs.
4. Add alert inbox/detail projection while preserving existing workflow commands.
5. Build React shell and typed API client.
6. Build report and dashboard journeys.
7. Build role workspaces and Alert Centre.
8. Integrate existing hotspot/pattern/network/anomaly/risk views.
9. Run full correctness, security, accessibility and challenge-alignment gates.
10. Deploy the verified SPA and backend changes to Catalyst Development only after explicit deployment approval.
