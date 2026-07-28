# Hide Empty Dashboard Reports Design

## Goal

Keep persona and Command Center dashboards focused by omitting report cards whose governed execution succeeded but returned zero rows. A report containing one or more rows remains visible even when a legitimate value inside a row is zero.

## Scope

Apply the rule at the shared `CommandCenterDashboardCanvas` used by Command Center and governed persona dashboards. Do not delete reports, dashboard placements, saved definitions, or execution results. Do not change standalone report pages, the report builder, report library, alerts, utilities, or non-dashboard empty states.

## Display Rules

- In normal dashboard view, hide an item only when `status === 'ready'`, `data` is an array, and `data.length === 0`.
- Keep successful non-empty items visible, including rows containing values such as `0`, `false`, or an empty string.
- Keep loading, unavailable, malformed, and execution-error items visible so operational failures are not concealed.
- In dashboard edit mode, keep every saved or staged placement visible, including successful empty reports, so an authorized editor can remove, replace, move, or resize it.
- When a configured dashboard has reports but every visible-mode item is a successful empty result, render one dashboard-level message: `No reports currently have matching records.` Do not show report-library creation actions because the dashboard is configured rather than structurally empty.
- Preserve the existing `This dashboard has no reports yet.` state and its creation actions only when the active tab truly has no configured placements.

## Architecture

Add a small exported predicate beside `CommandCenterDashboardCanvas` that identifies successful empty report items. The canvas derives `displayItems` from the active-tab items: edit mode uses all items, while normal mode filters successful empty items. Rendering and placement layout continue to use the existing report-surface component and saved placement metadata.

This keeps the rule at the composition boundary where execution status and rows are already available. It avoids mutating backend dashboards and avoids coupling behavior to the rendered text `No matching records`.

## Error Handling

Filtering is deliberately fail-open for unknown shapes: if status or row data is absent, the card remains visible. Only the exact successful-empty contract is suppressed. This prevents schema drift or failed executions from silently disappearing.

## Testing

Extend `CommandCenterDashboardCanvas.test.jsx` to cover:

1. A successful zero-row item is absent in normal view.
2. A successful row containing a numeric zero remains visible.
3. An execution-error item remains visible.
4. Empty reports remain visible while editing.
5. A configured all-empty dashboard shows the dashboard-level empty-result message without report-creation actions.
6. A structurally empty dashboard retains the existing creation state.

Run the focused canvas and persona-dashboard tests, then the broader frontend suite and production build. Verify the live Development dashboard after deployment; Production remains untouched unless separately authorized.
