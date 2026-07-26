# State Leadership Shared Dashboard Design

## Outcome

Replace the hard-coded State Leadership brief with the platform's real governed dashboard and report system. The State Leadership landing page becomes a shared role dashboard whose saved composition is visible to all authorized State Leadership users and editable by its authorized owner or a global-content administrator.

## Confirmed product decisions

- Use the existing dashboard/report engine rather than extending the static `LeadershipView` widgets.
- Use one shared State Leadership role dashboard for the MVP, not per-user copies.
- Keep the secondary workspace sidebar permanently collapsed on State Leadership routes. The primary module rail remains available.
- Use a compact, Catalyst-inspired header with organization identity, Notifications, Settings, and Account only.
- Do not show global Search, Deploy to Production, Support, or the separate “Data as of” card.
- Keep the leadership title and filters above the dashboard canvas.
- Reports are interactive in normal view.
- Dashboard edit mode supports add, remove, move, and resize, with resize as the minimum required editing capability.
- “Edit report” opens the existing full Report Builder. The dashboard editor does not duplicate report-definition editing.

## Current-state findings and root causes

### Static reports

`LeadershipView.jsx` renders hard-coded arrays and CSS/SVG illustrations. Its category chart is a CSS conic gradient and cannot expose selection, keyboard focus, tooltips, or report details. By contrast, the existing `ReportPreview` renderers already provide governed data execution and interactive pie, bar, line, table, map, funnel, and risk visualizations.

### Expanded sidebar

`AppShell.jsx` initializes `contextCollapsed` to `false`, so the context panel is expanded on every fresh mount. State Leadership needs a route/role-specific shell rule that keeps this panel collapsed and does not expose an expansion toggle.

### Blank first load

The current home route waits on workspace authorization and then makes four additional intelligence requests before rendering `LeadershipView`. The intended dashboard experience also needs a dashboard definition request followed by report executions. The design must render shell and loading states throughout this sequence rather than allowing a visually empty content region. Individual report failures must remain isolated within their tiles.

## Experience design

### Normal view

The fixed shell has three horizontal regions:

1. Compact platform header with Karnataka State Police identity on the left and Notifications, Settings, and Account on the right.
2. Primary module rail plus a permanently collapsed 24–38 px context strip.
3. State Leadership workspace filling the remaining width.

The workspace header contains “State Intelligence Brief,” a short shared-dashboard/freshness line, the three existing leadership filters, and one `Edit dashboard` action when the viewer may edit. The standalone freshness card is removed.

The dashboard canvas renders the shared role-default dashboard through `ReportPreview`. Pie/doughnut segments and legends are clickable and keyboard accessible; selected values and percentages are displayed by the existing renderer. Other report types retain their renderer-specific interactions.

### Edit mode

Entering edit mode exposes:

- `Add report` to open the authorized saved-report drawer.
- Placement controls for moving and resizing each report.
- `Remove` for deleting a report placement from the dashboard.
- `Edit report` to open `/reports/:reportId` with a governed return location.
- `Cancel` to restore the last persisted layout.
- `Save changes` to replace the shared dashboard placements.

The interface labels the dashboard as a shared role default and states that saved changes affect all State Leadership viewers. Only the owner or a user with the existing global-content management permission receives edit controls. Other authorized State Leadership users receive the same dashboard in view-only mode.

## Architecture

Create a State Leadership dashboard workspace that composes existing dashboard primitives rather than routing the persona into the Command Centre shell. Reuse or extract the following capabilities:

- Dashboard definition loading and per-report execution from `useCommandCenterDashboard`.
- Placement normalization and layout persistence.
- `ReportPreview` and existing interactive renderers.
- Authorized report picker and Report Builder routes.
- Per-tile error presentation.

State Leadership retains `AppShell`, its own leadership header/filter region, and State Leadership navigation semantics. Command Centre branding, rail destinations, presentation mode, dashboard library chrome, search, deployment, and support controls are not imported.

The shared default dashboard is selected from `workspace.landingDashboard` or the available dashboard whose `defaultRole`/relationship identifies the State Leadership role default. The implementation must not auto-create or overwrite the dashboard on ordinary page load. Seed/bootstrap creation remains an explicit authorized setup action.

## Data and state flow

1. Workspace authorization resolves.
2. The application shell renders immediately.
3. State Leadership selects the shared landing dashboard ID.
4. The dashboard definition loads.
5. Placed reports execute concurrently with `Promise.allSettled`.
6. Successful report results render as they are normalized; failed results become isolated error tiles.
7. Edit mode stages placement mutations locally.
8. Cancel restores persisted placements.
9. Save sends the normalized placement list to `PUT /v1/dashboards/{dashboardId}/items` and exits edit mode only after success.
10. Report Builder navigation preserves a return target to the State Leadership dashboard.

## Loading and error behavior

- The shell and leadership heading never disappear during data loading.
- A visible dashboard skeleton/status occupies the canvas until the dashboard definition is available.
- Missing dashboard configuration produces an actionable empty state rather than a blank screen.
- One failed report does not hide successful reports.
- A dashboard-definition failure displays a retry action in the canvas.
- Save failures retain staged edits, keep edit mode open, and display an inline error.
- Stale previously rendered dashboard content may remain visible during a refresh, with a non-blocking refresh indicator.

## Responsive behavior

- Desktop preserves the collapsed context strip and 12-column report canvas.
- Tablet reduces header spacing and collapses filters into wrapping controls.
- Mobile hides the context strip completely, keeps the primary module rail/navigation accessible through the existing responsive pattern, and stacks report tiles without horizontal page overflow.
- Edit controls remain keyboard reachable and do not cover report titles or chart interaction targets.

## Accessibility

- Keep semantic buttons and links for all actions.
- Preserve `ReportPreview` keyboard selection behavior for chart marks and legends.
- Announce loading, save, error, and selected-chart states through existing live-region patterns.
- Provide visible focus states and accessible names for move, resize, remove, edit, notification, settings, and account actions.
- Respect reduced-motion preferences.

## Verification strategy

### Automated tests

- State Leadership mounts with the context sidebar locked collapsed.
- Header excludes Search, Deploy to Production, and Support, and includes Notifications, Settings, and Account.
- Shell and loading state are visible before dashboard/report requests complete.
- Shared landing dashboard loads without a refresh.
- Pie/doughnut interaction updates selected-category details.
- Entering edit mode, resizing, cancelling, and saving behave correctly.
- Adding and removing placements updates staged state and the save payload.
- Edit-report navigation opens the existing Report Builder with a return target.
- View-only users do not receive edit controls.
- One failed report leaves other report tiles visible.
- Save failure preserves staged edits and exposes an error.

### Browser verification

Verify the first navigation from persona selection without manually refreshing. Exercise chart mouse and keyboard selection, enter edit mode, resize a report, add/remove a report, cancel, save, open Report Builder, and return. Check desktop plus a mobile-sized viewport and compare the final render with the approved visual-companion mockup.

## Out of scope for this MVP

- Personal dashboard copies.
- Concurrent multi-user editing or conflict-resolution UI beyond existing API errors.
- Inline editing of report dimensions, measures, filters, or visualization definitions.
- New deployment, support, or global-search controls.
- Drag-and-drop if the existing accessible placement controls deliver move/resize reliably; pointer dragging may follow later.
