# Modern AI-Assisted Report Builder Design

## Goal

Modernize KSP ACE report authoring into a Catalyst-styled split workspace with a large persistent preview, safe editing of compatible dashboard reports, and governed natural-language configuration using Zoho Catalyst QuickML GLM-4.7-Flash.

The change must preserve existing reports. It must not migrate, rewrite, or replace a report merely because a user opens it in the builder.

## Selected Experience

The builder uses the approved split-workspace layout:

- A compact left authoring rail contains Data, Visualization, Configure, Filters, Style, and Ask GLM controls.
- A dominant right canvas displays the report preview throughout authoring.
- The header contains the editable report title, save state, Save, and Run actions.
- The visual language follows modern Catalyst UI: white surfaces, Catalyst blue and navy, restrained orange accents, slim borders, compact controls, and generous preview space.
- The layout adapts to smaller laptops by narrowing or collapsing the rail and to mobile by stacking authoring above preview.

New and existing compatible reports share the same workspace. A new report starts with an unsaved draft. An existing report is reconstructed from its persisted definition.

## Dashboard-to-Builder Flow

Dashboard actions labelled Open report or Edit report route to `/reports/:reportId` and open the report builder in edit mode.

The builder loads:

- the persisted report and version;
- its governed definition;
- the authorized source catalog; and
- the latest available execution output when the API exposes one.

The builder uses the existing production report renderers. A successfully executed report must therefore render consistently in both the builder and its dashboard surface.

## Existing and Legacy Report Safety

Opening a report is read-only with respect to persistence. No migration or update occurs during load.

A report is directly editable only when its persisted definition can be represented by the modern builder without semantic loss. Compatibility includes its governed source, dimensions, measures, filters, sorting, limit, visualization type, and any required map view.

When a report contains unsupported or legacy semantics:

- its existing output remains available;
- the builder explains that it cannot safely reproduce the report exactly;
- the primary authoring option is Create editable copy;
- creating the copy starts a new draft based on the compatible subset; and
- the original report remains unchanged.

Only an explicit Save or Run can persist a compatible existing report. Updates use the existing expected-version contract so concurrent changes surface as conflicts instead of being overwritten.

## Draft and Preview Behavior

The builder maintains one client-side draft definition. Manual edits and accepted GLM proposals update only this draft.

- Unsaved changes are visibly marked.
- Editing invalidates the displayed result and marks it stale.
- Refresh preview validates and executes the temporary draft without persisting it.
- Save validates and persists the draft without executing it.
- Run validates, persists, executes, and displays the resulting output.

If temporary draft execution cannot be supported safely by the reporting API, the preview control must clearly explain that Save and Run are required; it must not silently create a report as a preview side effect.

## GLM-4.7-Flash Assistance

### User Flow

Ask GLM accepts a natural-language request such as “Show FIR count by incident hour for the last 24 hours as a line chart.” GLM returns a proposed report configuration and a concise explanation.

The proposal is displayed as a reviewable change set. The user must explicitly Apply it to the local draft. Applying does not persist the report. Save or Run remains mandatory.

### Server-Side Adapter

QuickML access is server-side. Model endpoints and credentials must not be exposed to the React client.

The adapter receives:

- the user question;
- the current draft, when present;
- authorized report-source schemas for the current identity;
- allowed field types and aggregation capabilities;
- allowed operators and visualization types; and
- an explicit structured-output contract.

The adapter requests strict JSON containing only supported report-definition fields: source key, dimensions, measures, filters, sort, visualization, limit, and explanation. It must not send report result rows, personally identifiable records, or broader source data to the model merely to build a definition.

### Validation Boundary

GLM output is untrusted input. Before returning a proposal to the browser, the server validates it using the same governed rules as manual report creation:

- the source is authorized for the current identity;
- every field exists in that source;
- dimensions and aggregations are allowed for their field definitions;
- filters use supported operators and correctly typed values;
- visualization type is supported by the selected source;
- map reports reference an authorized saved map view;
- limit and sort values satisfy report constraints; and
- no unsupported keys or executable content are accepted.

Invalid output returns a safe, actionable validation error and never changes the current draft. The adapter may make one bounded repair request to GLM using validation errors; repeated failure ends with a manual-editing fallback.

If QuickML is unavailable, manual authoring remains fully usable and the builder displays a non-blocking service error.

## Components and Responsibilities

### Report Builder Workspace

Owns draft state, compatibility state, dirty/stale state, loading, save, preview, and run coordination. It composes the header, authoring rail, preview canvas, and compatibility notice.

### Authoring Rail

Provides focused sections for source selection, visualization, configuration, filters, and presentation. It reuses existing governed fields and makes advanced controls progressively discoverable without reintroducing a five-page wizard.

### GLM Assistant

Collects the natural-language question, requests a server proposal, presents the explanation and field-level changes, and applies an accepted proposal to the local draft.

### Preview Canvas

Uses the existing `ReportPreview` and renderer family. It distinguishes empty, loading, fresh, stale, unsupported, and failed states while preserving as much canvas space as possible.

### Compatibility Classifier

Classifies a loaded persisted definition as exactly editable or legacy/unsupported. It must be deterministic and independently tested. It never mutates the report.

### QuickML Report Proposal Service

Builds the constrained model request, calls the configured GLM-4.7-Flash endpoint, parses structured output, validates it against identity-authorized sources, optionally performs one repair attempt, and emits an auditable proposal result.

## API Shape

A dedicated authenticated endpoint accepts a report-authoring question and optional current draft. The server derives authorized schemas from the authenticated identity rather than trusting source metadata submitted by the client.

The response contains either:

- a validated proposed definition plus a plain-language explanation and change summary; or
- a typed failure describing unavailable service, invalid proposal, authorization failure, or unsupported request.

A draft-execution endpoint may be added for Refresh preview. It accepts a report definition, validates it with the normal reporting policy, executes it without persistence, and returns the normal report execution envelope. It must not create hidden report records.

Exact Catalyst QuickML request and authentication details are isolated behind the adapter so deployment-specific endpoint configuration does not leak into the UI or reporting domain.

## Error Handling

- Loading failure keeps the workspace shell visible and provides retry/navigation actions.
- Version conflict preserves the local draft and asks the user to reload or create a copy.
- Unsupported legacy definitions never become destructive partial edits.
- GLM timeout, malformed JSON, invented fields, authorization violations, and exhausted repair attempts produce typed non-blocking errors.
- Preview failure does not discard draft changes.
- Save or Run failure leaves the draft intact and clearly reports that persistence did not complete.

## Accessibility and Responsive Behavior

- All controls have programmatic labels and keyboard-visible focus.
- Rail sections, GLM proposal changes, status messages, and preview states use semantic regions and live-status behavior where appropriate.
- Color is not the only indicator for dirty, stale, success, warning, or failure states.
- Desktop prioritizes the preview canvas; smaller laptops use a narrower collapsible rail; mobile stacks authoring and preview without horizontal overflow.

## Verification

Automated tests cover:

- Open report and Edit report routing to the correct builder report ID;
- reconstruction and saving of compatible existing reports;
- load-without-write behavior;
- unsupported legacy report classification and Create editable copy;
- preservation of the original report when a copy is created;
- dirty and stale preview states;
- draft execution without persistence;
- Save versus Run semantics;
- expected-version conflicts;
- GLM structured proposal parsing and validation;
- rejection of hallucinated or unauthorized sources, fields, filters, and visualizations;
- QuickML timeout, malformed output, repair limits, and manual fallback; and
- existing report renderer compatibility.

Browser verification covers the complete dashboard-to-editor path, manual editing, GLM proposal review, preview, Save, and Run at desktop, smaller-laptop, and mobile viewports.

## Non-Goals

- Reproducing unsupported legacy report semantics through approximation.
- Automatically migrating or overwriting existing reports.
- Allowing GLM to save, run, or publish without explicit user action.
- Sending raw report records or sensitive police data to GLM for configuration generation.
- Replacing existing governed reporting validation or visualization renderers.
