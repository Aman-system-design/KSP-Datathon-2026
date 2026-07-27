# Dashboard Deletion and Catalyst Library Modernization

## Goal

Allow users to delete any dashboard visible in the MVP dashboard library while preserving every underlying report. Modernize the library using the approved “Refined library” direction without changing its core navigation model.

## User experience

The dashboard library retains its familiar card grid, Catalyst blue-and-white identity, search field, and primary “New dashboard” action. The page receives clearer type hierarchy, more deliberate spacing, softer borders and shadows, and refined card anatomy.

Every visible dashboard card includes an overflow menu. Selecting **Delete dashboard** opens a confirmation dialog that names the dashboard and explicitly states that reports used by it remain available. The dialog has **Cancel** and **Delete dashboard** actions. Cancel closes the dialog without a request. Confirm disables repeated submission while deletion is in progress.

After a successful deletion, the dialog closes, the card is removed from the library, and an accessible success notice is shown. If deletion fails, the dashboard remains visible and the dialog shows an actionable error with retry and cancel available.

## Authorization and scope

For this MVP, every dashboard returned as visible to the current user may be deleted, including owned, shared, and system/default dashboards. The backend still requires the dashboard to be visible to that user; unknown or unauthorized identifiers return the existing not-found behavior.

This broad deletion policy is intentionally limited to the MVP and can later be narrowed using relationship or action-based permissions without changing the confirmation interaction.

## Deletion semantics

`DELETE /v1/dashboards/{dashboardId}` removes only dashboard-owned records:

- the dashboard record;
- dashboard widget/item placements;
- dashboard shares;
- references from user landing-dashboard preferences.

Report definitions and report data are independent resources and must not be deleted. Reports previously placed on a deleted dashboard remain discoverable and executable through the Reports library.

The response remains `{ deleted: true }`. Deleting an unavailable dashboard produces the existing governed error response.

## Frontend structure

The command-center dashboard library owns the local deletion interaction state: selected dashboard, menu state, confirmation state, pending status, error, and success notice. The router supplies the existing API client and refresh/navigation callbacks as needed. Reusable dialog and menu primitives already present in the application are preferred; otherwise, small accessible feature-local components will be introduced.

The confirmation dialog uses proper dialog semantics, an accessible name, keyboard focus management, Escape/cancel behavior, and focus restoration to the invoking card menu control.

## Error handling

- Cancel and Escape perform no mutation.
- Double submission is prevented while the request is pending.
- A failed request leaves the dashboard in place and keeps the confirmation context available.
- A dashboard deleted successfully is removed locally without requiring a full-page reload.
- If the deleted dashboard was selected or configured as a landing dashboard, the UI returns to the library and the backend preference reference is cleared.

## Testing

Frontend tests will prove that the overflow menu opens, cancellation performs no request, confirmation calls the correct DELETE endpoint, success removes only the dashboard card, failure retains it and reports an error, and the dialog communicates report preservation.

Backend tests will prove that a visible dashboard can be deleted under the MVP policy, inaccessible dashboards remain protected, dashboard-owned items/shares/preferences are cleaned up, and referenced reports remain intact after deletion.

Visual verification will cover the approved desktop library composition, modal state, interaction states, and a mobile-sized viewport. Build, focused tests, and the relevant regression suite must pass before completion.

## Out of scope

- Deleting reports from the dashboard flow.
- Bulk dashboard deletion.
- Undo or trash retention.
- Typed-name confirmation.
- New dashboard analytics, activity metrics, sorting, or filtering beyond the existing search behavior.
