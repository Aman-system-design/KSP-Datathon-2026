# Report Builder Slim Intelligence Bar Design

## Goal

Modernize the existing five-step report builder without changing report definitions, report APIs, routing, authorization, persistence, or dashboard behavior. The selected experience is Option A: a slim Ask Intelligence bar above a substantially larger, persistent report preview.

This is a UI-only change. It does not integrate QuickML, create OAuth credentials, alter existing reports, or deploy anything.

## Approved Layout

The current report header remains the authority for navigation, title, status, Save, and Run. The existing Data, Type, Configure, Style, and Review steps remain available and keep their current behavior.

Below the step navigation, the builder becomes a two-column workspace:

- A compact authoring panel on the left shows the controls for the active step.
- A dominant preview workspace on the right contains the slim Ask Intelligence bar followed by the largest practical report preview.
- The preview remains visible while the user moves through Data, Type, Configure, and Style instead of appearing only on Review.
- Review emphasizes the same preview and summary without introducing a different renderer or execution path.

The visual language follows the existing Catalyst-style application shell: white surfaces, navy text, restrained blue interaction states, thin neutral borders, compact radii, and minimal shadow. The intelligence bar is a single horizontal control, not a permanent guidance card.

## Ask Intelligence Bar

The bar contains a small intelligence icon, the prompt “What do you want to see?”, and an Ask button. It sits directly above the preview so it consumes minimal vertical space.

QuickML integration is explicitly deferred. To avoid a fake or destructive control:

- the prompt can be entered locally;
- Ask never calls an API, changes the draft, saves, runs, or mutates a report;
- submitting a non-empty prompt expands a compact informational response stating that Intelligence setup is not enabled and that the report was not changed; and
- dismissing or editing the prompt collapses that response.

This preserves the approved visual location and interaction shape while making the deferred state honest and testable.

## Preview Behavior

The right canvas reuses the existing `ReportPreview` component and current renderer family. No chart types or data behavior are added in this change.

- After a successful Run, the existing output appears in the persistent preview.
- Before a run, the preview shows a neutral empty state explaining that Run generates the output.
- Changing report controls continues to clear stale output using the current invalidation behavior.
- Map reports continue to use the existing governed map preview and map-authoring flow.
- The preview does not save, execute, or synthesize data by itself.

## Existing Report Safety

Opening `/reports/:reportId` continues to load the persisted report into the existing builder state. Load remains read-only. Save continues to use the existing versioned PATCH request; Run continues to save and execute through the existing endpoints.

No report is migrated, rewritten, copied, or updated merely because the modernized builder is opened. Existing dashboard report cards and report routes are outside this change.

## Responsive Behavior

- Desktop: approximately 32% authoring panel and 68% preview workspace, with the preview receiving remaining width and height.
- Smaller laptops: the authoring panel narrows while the preview remains usable; step navigation may scroll horizontally.
- Mobile: authoring stacks above the intelligence bar and preview, with no horizontal overflow.

Primary actions remain visible through the existing header and footer. Keyboard focus styles and programmatic labels remain intact.

## Component Boundaries

- `ReportBuilder.jsx` continues to own report state, loading, invalidation, Save, and Run.
- A small `ReportIntelligenceBar.jsx` owns only local prompt and deferred-status UI. It receives no API client and no draft mutation callback.
- Existing step components and `ReportPreview` are reused without changing their data contracts.
- `app.css` owns the two-column workspace, slim bar, preview canvas sizing, and responsive stacking.

## Verification

Focused component tests must prove:

- the intelligence bar renders above the persistent preview;
- empty prompts cannot be submitted;
- a submitted prompt displays the honest deferred-state message and performs no API call or report mutation;
- the preview is present before Review;
- existing Save, Run, report editing, boolean filters, and governed map flows still pass; and
- the layout stacks without horizontal overflow at the existing mobile breakpoint.

Browser verification compares the implementation with the approved Option A mockup at desktop and narrow-laptop widths, then exercises Data through Review, Save, Run, existing-report load, and the deferred Ask response.

## Non-Goals

- QuickML or GLM authentication and inference.
- New report sources, chart types, filters, or backend endpoints.
- Automatic draft generation or proposal application.
- Dashboard redesign or report migration.
- Catalyst deployment.
