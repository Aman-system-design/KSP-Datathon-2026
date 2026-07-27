# Governed Report Builder Chart Catalogue Design

## Objective

Expand the modern report builder so users can discover every approved visualization, select governed Data Store-backed sources, and use the existing Karnataka district map without changing or migrating any existing report or dashboard definition.

## Safety boundary

- Existing saved reports, dashboard placements, report IDs, definitions, and execution contracts remain unchanged.
- The builder continues to load sources only from `GET /v1/report-sources`; it never enumerates Catalyst Data Store tables directly.
- Source and field authorization remains server-owned and viewer-scoped.
- New builder validation prevents incompatible definitions from being saved or run.
- No deployment, secret, authentication, utilities, or dashboard routing changes are part of this feature.

## Governed source catalogue

The Data step presents the existing semantic report sources as approved Data Store tables. Each option shows its user-facing label and a small governed-source descriptor. No raw table name is accepted from the browser, and no free-form table query is introduced.

The server response remains the authority for fields and currently approved visualizations. The UI may show the complete chart catalogue for discovery, but it must distinguish compatible choices from choices that require additional data or server approval.

## Visualization catalogue

The Type step displays seven choices:

1. Table
2. KPI Number
3. Bar
4. Line
5. Pie
6. Funnel
7. Karnataka Map

Each choice uses its own icon and concise compatibility message. A chart is immediately compatible only when the selected source advertises that visualization and provides the required field shapes:

- Table: any governed source.
- KPI Number: at least one numeric measure.
- Bar, Line, Pie, Funnel: a grouping dimension and numeric measure.
- Karnataka Map: a server-approved geographic source and the existing governed map configuration.

All choices remain visible. An incompatible choice may be selected for discovery, but Save, Run, and forward navigation remain disabled until the requirements are satisfied. The UI explains the missing requirement rather than allowing a backend rejection.

## Karnataka map reuse

The map option reuses the current report map flow and Command Center-compatible Karnataka geography renderer. It does not create a second boundary dataset or map implementation. Authorized geographic sources continue to use governed saved map views and server-produced map execution data.

The label shown in the catalogue is “Karnataka Map.” Existing definitions continue to store the unchanged visualization type `map`, preserving compatibility.

## Layout and scrolling

The desktop builder remains a two-column workspace with compact authoring controls and a larger preview. The outer builder, authoring pane, and preview pane must not create horizontal scrollbars. Type cards use a responsive grid that fits the available authoring width.

On smaller screens, the workspace stacks vertically. The page owns vertical scrolling; nested authoring and preview panes do not compete with independent side scrollbars. A table result may scroll inside its result surface only when its columns genuinely exceed the canvas.

## Intelligence bar

The slim Ask Intelligence bar remains local and non-destructive. Until a governed server integration is enabled, it displays the existing honest availability message and never changes or saves a report.

## Error handling

- Missing compatibility requirements are presented inline beside the chart catalogue.
- Save and Run are disabled for incomplete or incompatible new definitions.
- Existing definitions with legacy or unavailable visualization types retain the existing unsupported-state behavior; they are not rewritten.
- Map loading and authorization errors continue through the existing map preview states.

## Testing

- Catalogue tests cover all seven visible visualization choices and distinct icons/labels.
- Compatibility tests cover source-advertised and non-advertised chart types.
- Regression tests prove existing report payloads and edit flows are unchanged.
- Map tests prove `Karnataka Map` persists as `visualization.type: 'map'` and uses the existing map flow.
- Layout tests prevent outer horizontal overflow at desktop, tablet, and mobile breakpoints.
- Full web tests and the production build must pass before integration.

## Acceptance criteria

- Users can see all seven chart choices without horizontal scrolling.
- Governed sources are clearly presented as approved Data Store-backed sources.
- Incompatible charts cannot create or execute broken reports.
- Geographic sources can use the existing Karnataka map workflow.
- Existing reports and dashboards require no migration and remain byte-for-byte unchanged unless a user explicitly edits and saves one.
