# State Leadership Home Consolidation Design

## Outcome

State Leadership has one intelligence dashboard. The current Intelligence-style dashboard becomes the persona homepage, the duplicate Intelligence navigation item disappears, and direct State Leadership visits to `/intelligence` redirect to `/`. Other personas retain their current homepages, navigation, and Intelligence routes.

## Experience

- Home uses the State Intelligence Brief layout shown in the approved second reference image.
- The dashboard is composed from governed saved reports rather than static illustrations.
- Pie, bar, line, table, and map reports retain the existing report renderer interactions, including pointer and keyboard selection where supported.
- Authorized editors can enter dashboard edit mode, add or remove reports, move or resize placements, cancel staged changes, and save the shared layout.
- Each report exposes an Edit report action in edit mode. It opens the existing Report Builder and preserves a return target for the State Leadership homepage.
- View-only State Leadership users see the same dashboard without editing controls.

## Routing and Navigation

- Remove only the State Leadership `Intelligence` navigation entry.
- Keep State Leadership `Home`, `Utilities`, `Alerts`, `Reports`, and `Dashboards` entries unchanged.
- When the authorized workspace role is `STATE_LEADERSHIP`, `/intelligence` redirects to `/` while preserving the persona query string.
- `/intelligence` continues to render the existing intelligence workspace for every other authorized persona.
- Do not change Command Centre, District Leadership, Crime Analyst, Station Operations, administrator, or auditor route behavior.

## Component Boundaries

- `HomePage` remains the role-aware homepage boundary and renders the State Leadership dashboard only for `STATE_LEADERSHIP`.
- `StateLeadershipDashboard` owns the State Leadership heading, filters, edit bar, dashboard loading/error states, and report picker.
- Existing command-center dashboard primitives provide governed report execution, placement editing, persistence, and report surfaces without importing Command Centre branding or navigation.
- The shared `ReportPreview` renderers provide chart interactions. No static duplicate chart implementation is introduced.
- The router performs the State Leadership-only legacy redirect before rendering `IntelligenceWorkspacePage`.

## Data and Editing Flow

1. Workspace authorization resolves.
2. Home selects the State Leadership landing dashboard.
3. Dashboard placements load and their reports execute concurrently.
4. Successful reports render independently; an individual failure remains isolated to its tile.
5. Dashboard edit mode stages layout changes locally.
6. Cancel restores the persisted placement list.
7. Save writes normalized placements through the existing dashboard items endpoint.
8. Edit report opens `/reports/:reportId` with the State Leadership persona and homepage return context.

## Error and Empty States

- Keep the State Leadership heading visible while the dashboard loads.
- Show an explicit loading status instead of a blank canvas.
- Preserve successful report tiles when another report fails.
- Keep staged edits after a save failure and expose the failure inline.
- Show an actionable empty dashboard state when no landing dashboard or reports are configured.

## Verification

- Navigation tests prove State Leadership has no Intelligence item and all other persona navigation remains unchanged.
- Router tests prove State Leadership `/intelligence` redirects to Home while another persona still renders the Intelligence route.
- Homepage tests prove State Leadership renders the governed dashboard and other personas retain their current home components.
- Dashboard tests cover chart interaction, edit authorization, add/remove/move/resize, cancel/save, and Edit report navigation.
- A focused web test run and production build verify the change without persona regressions.

## Out of Scope

- Removing Intelligence from other personas.
- Replacing or redesigning the shared Report Builder.
- Introducing personal State Leadership dashboard copies.
- Changing backend authorization or dashboard ownership rules.
