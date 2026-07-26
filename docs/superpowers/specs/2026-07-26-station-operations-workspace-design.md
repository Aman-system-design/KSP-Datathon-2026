# Station Operations Workspace Design

## Objective

Deliver a premium, interactive `STATION_OPERATIONS` workspace for a specific authorized police station. The workspace must help station personnel act on open and ageing cases, understand local crime patterns, and move from summary charts into full case detail. Its reports remain editable through the same governed dashboard model used elsewhere in ACE.

## MVP boundary

This is an operational analytics workspace, not a replacement case-management system. It reads the existing synthetic KSP dataset, derives station-scoped case metrics, and links to a read-only case-detail experience. It does not support FIR filing, evidence mutation, investigation notes, or workflow changes.

No metric may be hard-coded solely for presentation. Empty or unavailable data is shown honestly.

## Experience

The station workspace opens directly at `/?persona=STATION_OPERATIONS` and prioritizes daily operations:

1. A compact workspace header identifies Station Operations and the current station without exposing backend authorization terminology.
2. An operational summary shows open cases, overdue cases, cases added in the current period, and active local alerts.
3. An ageing report groups open cases into clear buckets such as `0–7`, `8–30`, `31–60`, and `60+` days.
4. Interactive crime-pattern reports show local category distribution and time-of-day trend.
5. A station case table shows the filtered open-case workload.
6. Selecting an ageing bucket, category, status, or chart segment filters the related table and displays a visible filter state.
7. Selecting a case navigates to `/cases/:caseId` while preserving the persona query.
8. The case-detail page shows governed case facts, lifecycle state, age, crime classification, incident time, and station context. It is read-only.

The normal view is presentation-quality and avoids editor chrome. An explicit Edit action enables inline dashboard editing using the existing add, remove, rearrange, resize, save, and cancel interaction model.

## Visual direction

Reuse the ACE platform shell and Catalyst-inspired design language: true white surfaces, navy typography, restrained blue accent, thin borders, generous whitespace, compact controls, and subtle motion. Avoid a marketing hero, excessive cards, decorative badges, gradients, and dense explanatory copy.

The first viewport should have one clear operational hierarchy: header, summary strip, ageing visualization, and open-case table preview. Crime-pattern analysis continues below. Hover, selected, focus, loading, and reduced-motion states are required.

## Architecture

### Station operations shell

Create a focused station-operations feature that composes the existing dashboard controller and report surfaces rather than copying Command Centre implementation. The router selects this shell only when the effective role is `STATION_OPERATIONS` and the route is the station home/dashboard surface.

### Governed case source

Add a station-case semantic report source backed by repository reads from the canonical synthetic case tables. Every read is filtered by `access.authorizedUnitIds` and defaults to `access.scopeUnitId`. The client never supplies an unrestricted station scope.

The projected report fields include only the fields required by this MVP:

- case identifier and display number;
- lifecycle status;
- incident and registration timestamps;
- derived age in days and ageing bucket;
- crime major and minor classification;
- station/unit identifier and display name;
- record count for aggregation.

The same source supports number, table, bar, line, pie/doughnut, and funnel reports where compatible. Report definitions, executions, dashboard placements, and edits continue through the existing reporting APIs.

### Case detail

Add a read-only case resource and page. The backend returns a case only when its unit is within the current viewer's authorized unit set; otherwise it returns the same not-found behavior used for inaccessible governed content. The page must not expose raw source columns beyond the approved client projection.

### Default station dashboard

Provide a role-default station dashboard definition with reusable governed reports for:

- open case count;
- overdue/60+ day case count;
- new cases in the selected period;
- active local alert count;
- open-case ageing distribution;
- case lifecycle distribution;
- crime category distribution;
- incident-hour pattern;
- open case table.

The default layout is usable immediately. User-owned dashboards remain editable and can use the same report library. Station Operations therefore gains Reports navigation instead of the current role-specific exclusion.

## Data and interaction flow

1. Workspace bootstrap returns the effective station role, station scope metadata, visible reports, and dashboards.
2. The station shell loads the selected or role-default dashboard.
3. Report executions resolve through the viewer-scoped case and alert sources.
4. Chart selection writes a local dashboard filter and re-executes or filters compatible report data without changing the saved definition.
5. A case-table row opens the governed case-detail resource.
6. Edit mode stages layout changes locally; Save persists through the existing dashboard-items endpoint, while Cancel restores the last persisted layout.

## Failure behavior

- A failed report renders an isolated widget error; sibling reports remain usable.
- A missing role-default dashboard provides an honest empty state and a path to create a dashboard.
- Missing case data shows an empty workload state, not zero-valued invented metrics.
- An inaccessible or missing case returns a generic not-found view.
- Partial station metadata falls back to `Station Operations` without exposing internal IDs as primary UI copy.

## Verification

Automated tests cover:

- station-only router selection and navigation;
- case-source projection and station-scope enforcement;
- ageing bucket derivation at boundary values;
- report aggregation and filtering;
- chart selection updating the case table;
- governed case-detail authorization;
- edit, save, and cancel behavior;
- isolated widget failures and honest empty states.

Browser verification covers desktop and narrow viewports, keyboard focus, chart and table interactions, case-detail navigation, inline editing, reduced motion, and visual consistency with the existing ACE/Catalyst-inspired shell.

## Acceptance criteria

- Station Operations opens as a distinct, premium operational workspace.
- All visible metrics are calculated from the station-scoped synthetic dataset.
- Open and ageing cases, local crime patterns, alerts, and the case table are functional.
- Charts are interactive and visibly filter related station data.
- Every case row opens a full read-only case-detail page.
- Reports and dashboard layout are editable using the existing governed platform model.
- Users cannot read cases outside their authorized station scope.
- No backend authorization wording or raw internal scope presentation appears in the primary UI.
