# Three Governed Persona Dashboards

## Objective

Provision three distinct, editable dashboards—District Intelligence Dashboard, Crime Analyst Dashboard, and Police Station Dashboard—alongside the existing Command Centre and State Crime Intelligence dashboards. All five dashboards are visible and openable from every authorized persona. Dashboard composition stays fixed; report execution is always restricted to the active viewer's governed scope.

## Architecture

Create a shared template-provisioning engine and three focused template definitions. The engine owns idempotency, report reuse, dashboard creation, placement reconciliation, and workspace refresh. Each template independently owns its name, description, governed report definitions, layout, and stable bootstrap key.

Provision missing templates after an authenticated workspace is available. Create one editable owned dashboard per template for the signed-in user and reuse it across personas. Reuse reports only when their canonical definitions match. Never overwrite a dashboard after the user has customized it, and never duplicate a completed template during retries or concurrent loads.

The Dashboard Library continues to list every dashboard visible to the user. Opening a dashboard renders the composition stored on that dashboard without persona-based placement filtering. Existing authorization and viewer-scope enforcement remain responsible for limiting report results.

## Dashboard Definitions

### District Intelligence Dashboard

The district dashboard provides an authorized district operational view:

- Monthly FIR trend
- Police-station workload concentration
- Crime-category mix
- Case lifecycle
- District hotspot/geospatial evidence
- Case-ageing distribution

Its layout emphasizes the trend and map, with supporting concentration, mix, lifecycle, and ageing panels.

### Crime Analyst Dashboard

The analyst dashboard supports evidence exploration rather than command monitoring:

- Temporal incident pattern
- Hotspot analysis
- Major-offence comparison
- Change or anomaly indicator
- Case-status evidence
- Detailed analytical results table

The interface retains the human-review warning. Analytical signals are evidence for review, not proof or automated conclusions.

### Police Station Dashboard

The station dashboard reuses the existing station semantic sources and proven report definitions:

- Open cases
- Cases older than 60 days
- New cases in the active period
- Active alerts
- Case ageing
- Case lifecycle
- Crime category
- 24-hour incident pattern
- Open-case register

The top row contains operational counters, followed by ageing, lifecycle, category, incident-pattern, and register views.

## Editing and Navigation

All three dashboards use the existing dashboard editor: add governed report, edit report, remove placement, move, resize, save, cancel, present, and delete. Add-report choices are governed by report visibility, not by the persona currently opening the dashboard. Report links preserve the active persona and return destination.

The three dashboards remain separate records with separate placements. They do not swap their reports based on the current persona. A District dashboard opened from Station Operations remains the District dashboard, but every report result is station-viewer scoped.

## Failure Handling

Provisioning is retry-safe and reconciles successful remote writes after network ambiguity. A failed template must not block existing dashboards from loading. The UI reports provisioning failure without replacing existing dashboard data. Completed or user-customized dashboards are not silently reset.

## Compatibility

- Preserve existing Command Centre and State Crime Intelligence dashboards.
- Preserve existing custom dashboards, reports, landing preferences, and editor behavior.
- Do not deploy or alter Catalyst Functions unless backend changes are explicitly required by implementation and pass the full verification gate.
- Retire route-level persona report filtering because it changes stored dashboard composition and caused the station dashboard to appear empty.

## Verification

Automated tests cover each template's unique report definitions and placements, idempotent retries, concurrent provisioning, user-customization preservation, five-dashboard library visibility, cross-persona opening, viewer-scoped execution, editor controls, and existing persona regressions.

Before release, run the full web test suite, production build, bundle-budget check, relevant backend tests if touched, and browser verification on the deployed Catalyst URL. Browser verification must open each of the three named dashboards—not State Crime Intelligence—and confirm its distinct reports and non-destructive edit mode.
