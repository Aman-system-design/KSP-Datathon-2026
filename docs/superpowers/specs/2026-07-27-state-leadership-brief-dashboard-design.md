# State Leadership Brief Dashboard Design

## Objective

Make the `STATE_LEADERSHIP` home route a dedicated, editable State Intelligence Brief that visually matches the approved Image 1 reference. The existing Command Center "State Crime Intelligence" dashboard remains unchanged and must not be reused as the State Leadership default.

## Scope

### Included

- Create a distinct governed dashboard named `State Leadership Brief` with `STATE_LEADERSHIP` as its default role.
- Make this dashboard the State Leadership landing dashboard.
- Preserve the Catalyst application shell and the reference layout's decision-brief hierarchy.
- Provide the verified-run status card, statewide filters, and responsive report grid.
- Seed the initial dashboard with:
  1. Crime category composition.
  2. District crime volume and movement.
  3. 24-hour crime occurrence curve.
  4. Crime-mix divergence from the state baseline.
  5. Leadership intervention queue.
- Reuse the existing governed dashboard editing system for adding, removing, moving, and resizing reports.
- Add a three-dot dashboard menu containing `Edit dashboard`, `Add report`, and `Manage dashboards`.
- Keep report execution, authorization, and persistence behind existing APIs.
- Stack report cards on tablet and mobile without losing editing controls or keyboard accessibility.

### Excluded

- Changes to the Command Center dashboard, landing route, or navigation.
- Hard-coded replacement data in the production State Leadership dashboard.
- Changes to other personas, Catalyst authentication, Functions unrelated to dashboard provisioning, Data Store schemas, Jobs, or Production resources.

## Architecture

### Dashboard identity and provisioning

State Leadership receives its own stable system-default dashboard identity. Workspace bootstrap selects it only for the `STATE_LEADERSHIP` role. Provisioning is idempotent: if the dashboard and reports already exist, bootstrap reuses them; otherwise it creates the missing governed definitions and placements without duplicating records.

The Command Center's `State Crime Intelligence` dashboard is addressed by its existing identity and remains independent. Selection must use dashboard identity/default-role metadata rather than display-name coincidence.

### Presentation

`StateLeadershipDashboard` continues to use the shared dashboard controller and persistence API, but supplies State Leadership-specific view chrome:

- Statewide decision intelligence kicker.
- `State Intelligence Brief` heading.
- Current executive summary.
- `Data as of / Latest verified run` status card.
- Statewide scope, time range, and crime-category filters.
- Catalyst-style report cards with restrained borders, compact labels, navy typography, blue/teal chart accents, and clear accessible legends.

View mode follows the approved Image 1 composition. Edit mode exposes the existing dashboard canvas interactions without changing view-mode information hierarchy.

### Dashboard actions

A keyboard-accessible three-dot menu is the single view-mode action entry point:

- `Edit dashboard` starts layout editing when authorized.
- `Add report` starts editing and opens the governed report picker.
- `Manage dashboards` navigates to the State Leadership dashboard library while preserving the persona query.

Unauthorized viewers receive a view-only dashboard and do not see mutation actions.

### Reports and data flow

Each initial card is a governed report definition executed in the current viewer's authorized scope. Dashboard bootstrap returns the State Leadership landing dashboard and available dashboard summaries. The client loads its placements, executes each referenced report through the existing report API, and contains individual report failures so successful intelligence remains visible.

Edits remain staged locally until Save. Save persists the complete placement set through the existing dashboard-items endpoint. Cancel restores the last server state. Add/remove/move/resize operations never mutate the Command Center dashboard.

## Responsive behavior

- Desktop: two-column decision-brief layout matching Image 1, with report-specific spans where appropriate.
- Tablet: responsive two-column or single-column layout based on available width; controls remain at least 44 pixels high.
- Mobile: single-column report stack, non-clipped legends, full-width action menu, and no horizontal page scrolling.
- Edit handles and menus remain keyboard reachable with visible focus states.

## Error handling

- Dashboard bootstrap failure displays a bounded State Leadership error with retry behavior.
- A failed report renders an isolated report error while other cards remain available.
- Save failure preserves staged edits and exposes a safe retry message.
- Missing default content produces an honest empty dashboard with `Add report` for authorized editors; it never falls back to the Command Center dashboard.

## Testing and acceptance

### Automated

- Workspace services return the dedicated State Leadership dashboard and never the Command Center dashboard.
- Idempotent provisioning does not create duplicate dashboards, reports, or placements.
- State Leadership renders the reference heading, status card, filters, initial report titles, and three-dot menu.
- Edit, add, remove, move, resize, save, cancel, and manage-dashboard navigation retain existing behavior.
- Ordinary viewers remain view-only.
- Report failures are isolated.
- Responsive CSS contracts prevent horizontal overflow and preserve usable controls.

### Live acceptance

At `https://ace.onslate.in/?persona=STATE_LEADERSHIP`:

1. The homepage visually matches Image 1's hierarchy rather than Image 2's map-first Command Center composition.
2. The State Leadership dashboard identity is distinct from Command Center.
3. The three-dot menu exposes the authorized dashboard actions.
4. Adding, moving, resizing, removing, saving, and reloading preserve the State Leadership layout.
5. Desktop and mobile render without clipping, framework overlays, blank screens, or relevant console errors.

## Deployment boundary

Deploy only components actually changed by implementation. Do not mutate Production resources. If dashboard provisioning requires a Development Function update, deploy only the reviewed API Function and Slate client after focused tests, full relevant verification, artifact inspection, and live authenticated smoke testing.
