# Persona Dashboard Workspaces Design

## Outcome

Extend the existing Dashboards area for District Leadership, Crime Analyst, and Police Station users without changing persona access or replacing their existing homepages. Each persona receives a role-appropriate dashboard experience built from the platform's governed, editable reports and shared Catalyst UI dashboard primitives.

## Current Boundaries

- `DistrictLeadershipDashboard.jsx` remains the District Leadership homepage.
- `CrimeAnalystDashboard.jsx` remains the Crime Analyst homepage.
- `StationOperationsShell.jsx` remains the existing Police Station homepage and is not reused as the `/dashboards/:dashboardId` surface.
- District Leadership and Crime Analyst currently open dashboards through the generic `DashboardPage` and `DashboardWorkspace` path.
- Existing persona selection, authentication, authorization, home routing, report library, and Report Builder behavior remain unchanged.

## Selected Architecture

- Add `DistrictDashboardWorkspace.jsx` as a thin District Leadership dashboard composition.
- Add `AnalystDashboardWorkspace.jsx` as a thin Crime Analyst dashboard composition.
- Add `PoliceStationDashboardWorkspace.jsx` as a new Police Station dashboard composition for the existing `STATION_OPERATIONS` role.
- Keep `StationOperationsShell.jsx` unchanged as the Police Station homepage.
- Reuse `CommandCenterDashboardCanvas`, `CommandCenterAddReportDrawer`, `useCommandCenterDashboard`, report renderers, and existing dashboard persistence contracts.
- Keep persona-specific composition, labels, report filtering, and presentation in the corresponding persona file instead of placing all role behavior in one monolithic module.
- Select the appropriate dashboard workspace at the existing `/dashboards/:dashboardId` route using the already-authorized workspace role.

## Persona Experiences

### District Leadership

The District workspace prioritizes district trends, subordinate-station comparison, crime-category mix, case lifecycle, and district geospatial evidence. All results execute within the viewer's authorized district scope.

### Crime Analyst

The Analyst workspace prioritizes anomalies, temporal patterns, hotspot concentration, network evidence, and evidence tables. It preserves limitations and human-review messaging and does not present analytical signals as proof.

### Police Station

The new Police Station dashboard workspace prioritizes case workload, ageing, active alerts, crime mix, lifecycle, incident-hour patterns, and the open-case register. It uses station-authorized saved reports and the shared dashboard editing flow. The existing Station Operations homepage retains its period controls, station-scoped filtering, case navigation, private-dashboard cloning, and bootstrap behavior without modification.

## Report and Dashboard Behavior

- Persona dashboards contain persisted governed reports rather than duplicated or static charts.
- Users retain the current ability to create and edit compatible reports in Report Builder.
- Dashboard edit mode allows authorized users to add, remove, move, and resize report placements, then save or cancel staged changes.
- Opening or editing a report preserves the active persona in the governed URL.
- Adding a report uses the existing authorized report list and persona-specific source filtering.
- Report execution remains viewer-scoped, and one failed report does not prevent successful sibling tiles from rendering.
- Dashboard deletion retains the existing confirmation and preservation message: deleting a dashboard does not delete its reports.

## Catalyst UI Consistency

- Reuse platform tokens, typography, buttons, menus, drawers, empty states, status treatments, report surfaces, and dashboard grid behavior.
- Persona differences come from information hierarchy, labels, supported report sources, and presentation variants rather than separate visual systems.
- Keep the established white, navy, Catalyst blue, restrained orange, slim-border visual language.
- Preserve keyboard focus, semantic regions, accessible labels, responsive grid behavior, and reduced-motion support already provided by shared components.

## Data and Interaction Flow

1. Existing authentication and workspace resolution determine the authorized persona and scope.
2. Dashboard routes load only dashboards visible to that identity.
3. The role-aware route selects the new District, Analyst, or Police Station dashboard composition.
4. The shared dashboard controller loads the selected dashboard and executes its report placements.
5. Persona-specific predicates limit addable reports to authorized, relevant source families.
6. Edit actions stage placement changes locally; Cancel restores persisted state and Save writes normalized placements through the existing endpoint.
7. Report links open the existing Report Builder with persona context intact.

## Error and Empty States

- Keep the persona workspace shell and title visible during dashboard loading.
- Show a clear empty state when no authorized dashboard is configured.
- Keep successful report tiles visible when another execution fails.
- Preserve staged layout changes after a save failure and display the failure inline.
- Reject unavailable or unauthorized dashboard IDs without falling back to another persona's dashboard.
- Preserve the existing Police Station homepage setup and retry states outside the new dashboard-detail route.

## Verification

- Route tests prove District Leadership and Crime Analyst use their specialized dashboard workspaces.
- Route tests prove Police Station dashboard details use `PoliceStationDashboardWorkspace` while the persona homepage continues to use `StationOperationsShell`.
- Regression tests prove State Leadership, Command Centre, Investigator, administrator, and auditor behavior is unchanged.
- Component tests cover persona-specific labels and report-source filtering.
- Interaction tests cover add report, remove, move, resize, cancel, save, report opening/editing, and dashboard deletion.
- Failure tests cover isolated report execution errors, unavailable dashboards, and save failures.
- Focused web tests and a production build verify the implementation.
- Browser checks cover desktop and mobile layouts for all three personas and confirm the established Catalyst UI remains consistent.

## Baseline Compatibility Prerequisite

- Restore the shared dashboard canvas contract used by `StationOperationsShell`: selection callbacks, placement class hooks, preview metadata control, and optional removal behavior.
- Preserve the modern Command Centre edit/open/remove controls while restoring those backward-compatible props.
- Update the Persona Directory regression assertion from five to four visible personas because Regional Leadership was intentionally removed.
- Update the App Shell geographic-scope assertion to the current safe fallback label when only `scopeUnitId` is available.
- These repairs must pass their existing tests before any new persona dashboard production component is added.

## Out of Scope

- Creating new personas or changing persona access.
- Changing existing persona homepages.
- Replacing Report Builder or changing report semantics.
- Modifying backend authorization or scope rules.
- Redesigning State Leadership, Command Centre, Investigator, administrator, or auditor experiences.
- Rewriting the three persona experiences in one file.
