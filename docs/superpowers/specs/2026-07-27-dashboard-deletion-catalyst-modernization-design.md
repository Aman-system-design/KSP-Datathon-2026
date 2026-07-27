# Dashboard Deletion and Catalyst Library Modernization

## Goal

Allow users in every MVP persona to delete any visible dashboard while preserving every underlying report. Modernize the shared library using the approved “Refined library” direction without changing its core navigation model.

## User experience

Every persona, including Station Operations, uses the same shared dashboard library. The library retains its familiar card grid, Catalyst blue-and-white identity, search field, and primary “New dashboard” action. The page receives clearer type hierarchy, more deliberate spacing, softer borders and shadows, and refined card anatomy.

Every visible dashboard card includes an overflow menu. Selecting **Delete dashboard** opens a confirmation dialog that names the dashboard and explicitly states that reports used by it remain available. The dialog has **Cancel** and **Delete dashboard** actions. Cancel closes the dialog without a request. Confirm disables repeated submission while deletion is in progress.

Direct dashboard views expose the same deletion action through their dashboard options menu. Successful deletion from a direct view returns the user to the shared library with the current governed persona query preserved.

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

A shared dashboard library component owns the local deletion interaction state: selected dashboard, menu state, confirmation state, pending status, error, and success notice. All persona routes render this component with the same API and governed navigation callbacks. Station Operations keeps its dedicated operational dashboard canvas for direct work but uses the shared library at `/dashboards`; it no longer substitutes the operational canvas for that library route.

Reusable dashboard deletion dialog and menu behavior is shared between library cards and direct dashboard options so all personas receive the same wording, pending state, and error handling. The router supplies the existing API client and persona-preserving navigation callbacks.

The confirmation dialog uses proper dialog semantics, an accessible name, keyboard focus management, Escape/cancel behavior, and focus restoration to the invoking card menu control.

## Error handling

- Cancel and Escape perform no mutation.
- Double submission is prevented while the request is pending.
- A failed request leaves the dashboard in place and keeps the confirmation context available.
- A dashboard deleted successfully is removed locally without requiring a full-page reload.
- If the deleted dashboard was selected or configured as a landing dashboard, the UI returns to the library and the backend preference reference is cleared.

## Testing

Frontend tests will prove that the overflow menu opens, cancellation performs no request, confirmation calls the correct DELETE endpoint, success removes only the dashboard card, failure retains it and reports an error, and the dialog communicates report preservation.

Routing tests will prove that Command Center, leadership, analyst, presenter, administrator, auditor, and Station Operations personas reach the shared library and preserve their governed persona query. Direct-view tests will prove successful deletion returns to that library.

Backend tests will prove that a visible dashboard can be deleted under the MVP policy, inaccessible dashboards remain protected, dashboard-owned items/shares/preferences are cleaned up, and referenced reports remain intact after deletion.

Visual verification will cover the approved desktop library composition, modal state, interaction states, and a mobile-sized viewport. Build, focused tests, and the relevant regression suite must pass before completion.

## Out of scope

- Deleting reports from the dashboard flow.
- Bulk dashboard deletion.
- Undo or trash retention.
- Typed-name confirmation.
- New dashboard analytics, activity metrics, sorting, or filtering beyond the existing search behavior.
