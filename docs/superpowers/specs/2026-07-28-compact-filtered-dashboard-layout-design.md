# Compact Filtered Dashboard Layout Design

## Goal

When successful zero-row reports are hidden from a dashboard, move the remaining visible reports into the earliest available grid spaces so the removed reports do not leave holes.

## Scope

The behavior applies only to normal dashboard view mode in `CommandCenterDashboardCanvas`, which is shared by Command Center and governed persona dashboards. It does not change standalone report pages, saved dashboard definitions, report execution, or edit mode.

## Layout behavior

- Start with the already-filtered visible report list.
- Preserve every report's configured width and height.
- Process reports in their existing visual order: row, then column, then original list order.
- Place each report in the first available 12-column grid position, scanning rows from top to bottom and columns from left to right.
- Never overlap reports or exceed the 12-column boundary.
- Compact both horizontal and vertical gaps created by filtered reports.
- Do not stretch a report solely because adjacent reports were removed.

For example, if an empty report occupied the upper-right slot and a valid report was below it, the valid report moves into that upper-right slot when it fits. If only one half-width report remains, it moves to the upper-left and retains its half width.

## Isolation

Compaction is a derived render-time layout. It must not mutate dashboard items, stage edits, or persist new coordinates. Edit mode continues to render every configured report at its saved position so users can rearrange or remove it.

The existing filtering contract remains unchanged:

- Hide only items whose status is `ready` and whose data is an empty array.
- Keep non-empty rows containing `0`, `false`, or empty strings.
- Keep loading, error, malformed, and unknown item shapes visible.

## Failure behavior

The layout helper is fail-open. Items with invalid dimensions keep their existing placement rather than being discarded. Structurally empty dashboards and configured dashboards whose reports are all filtered retain their existing distinct empty states.

## Testing

Automated tests will prove that:

- a lower valid report fills a gap left by a hidden report;
- multiple visible reports pack without overlap within 12 columns;
- card widths and heights are preserved;
- zero-valued and error reports remain visible and participate in compaction;
- edit mode retains the original saved coordinates;
- input dashboard items are not mutated.

The shared dashboard regression suite and full frontend suite must pass before a Development-only deployment. Production remains unchanged unless separately authorized.
