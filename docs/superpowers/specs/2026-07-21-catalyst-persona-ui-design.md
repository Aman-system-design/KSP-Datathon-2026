# Catalyst-Style Persona UI Design

**Status:** Founder approved on July 21, 2026

**Product:** KSP Crime Decision Intelligence Platform

**Scope:** React/Slate application shell and role workspaces; no backend contract expansion

## Outcome

The web client must feel like a durable government operations platform rather than a collection of presentation pages. All users work inside one stable Catalyst-inspired application shell. Authentication, permissions and unit scope determine the visible modules, navigation, data and actions. A persona changes the workspace, not the visual language.

The interface continues to render governed API results. It never creates demo metrics, risk values, alerts or evidence to make a screen look complete.

## Selected Direction

Use a Catalyst-inspired operational shell without copying Zoho branding or reproducing Catalyst pixel-for-pixel:

1. A white global header contains the configured KSP identity, search, current scope, data freshness, alerts, help and account controls.
2. A narrow navy module rail provides stable access to Home, Intelligence, Alerts, Maps, Networks, Reports and Administration when authorized.
3. A light contextual sidebar lists the selected module's role-permitted screens and saved workspaces.
4. A neutral grey canvas contains dense white operational panels, tables, maps and evidence views.
5. Navigation, filters and selected evidence persist while the user drills into details.

Rejected directions:

- A literal Catalyst clone would inherit a vendor administration hierarchy that does not match policing work and would incorrectly imply Zoho ownership of the product.
- Separate persona websites would duplicate navigation, fragment the product and create inconsistent authorization behavior.
- A dark cinematic command-centre theme would make everyday analytical work resemble a pitch webpage.

## Organization Identity

- Use `ksp-logo.webp` for sign-in, formal workspace headers, exports and organization configuration previews.
- Use `Seal_of_Karnataka.svg.webp` as the compact tenant mark in the module rail and as an optional low-opacity report watermark.
- Store both as web assets with meaningful alternative text. Never render the seal as a repeated decorative background.
- Product wording is `KSP Crime Decision Intelligence Platform`; the tenant label is `Karnataka State Police`.
- Future jurisdictions replace these assets and labels through organization configuration without changing component code.

## Global Shell

### Global header

- Left: compact KSP identity and product name.
- Centre: global search entry point. The MVP may expose the control as unavailable until a governed search API exists; it must not search client-cached sensitive data.
- Right: authorized geographic scope, analysis freshness, alert count, help and account menu.
- The synthetic-data status remains continuously visible and cannot be dismissed.

### Module rail

- Width stays compact and uses labelled SVG icons with tooltips; no emoji.
- Module availability comes from workspace permissions.
- The active module uses a clear selected state that does not rely on colour alone.
- Command Centre presentation mode opens outside the normal shell and exposes aggregate, presentation-safe information only.

### Contextual navigation

- Shows the current persona/workspace, unit scope and the selected module's destinations.
- Supports collapse on medium screens and becomes a modal navigation sheet on small screens.
- It never lists a destination the viewer cannot open.

### Workspace canvas

- Page header contains title, purpose, observation period, unit scope, freshness and primary action.
- A persistent context bar contains active time, geography, category, model/run version and filters.
- Evidence opens in a right drawer on wide screens and a full-screen sheet on narrow screens.
- Loading, empty, partial, stale, restricted and error states preserve page geometry and disclose no sensitive implementation details.

## Persona Workspaces

### State Leadership — full MVP

Default route: State Intelligence Brief.

- Starts with a concise evidence-grounded brief and an Attention Queue, not large decorative KPI cards.
- Shows affected jurisdictions, cross-district patterns, statewide hotspot/risk context, significant anomaly changes and response status.
- Every finding opens its evidence, confidence, limitations, method version and observation period.
- Permitted actions remain acknowledge, request verification, assign, escalate, monitor, note and review outcome.

### Regional, Commissionerate, District or Division Leadership — full/adaptive MVP

Default route: Jurisdiction Intelligence Pulse.

- Uses the configured unit tree, never hard-coded hierarchy depth.
- Shows station/subordinate-unit comparison, hotspot evolution, category change, ageing alerts, assignments and data-quality effects.
- Provides an explainable Attention Queue rather than an unexplained unit ranking.
- Regional and commissionerate behavior is the same component composition with different authorized scope and labels.

### Crime Analyst — full MVP

Default route: Analyst Workbench.

- Three working regions: prioritized queue, synchronized analytical canvas and evidence/conclusion panel.
- Analytical views switch among map, timeline, network, cases, component contribution, district context and data quality without losing selection.
- Original model output stays immutable. Working hypothesis and structured analyst conclusion remain separate.
- The screen distinguishes system signal, source record, unverified relationship, analyst finding, officer report and data-quality warning.

### Station Command and Investigator — light working MVP

Default route: Operational Intelligence.

- Station command sees local alerts, station hotspot/trend context, ageing work, assignments and data-quality issues.
- Investigators see assigned verification tasks, case context, authorized related evidence, notes and submission state.
- Responsive layout prioritizes one task at a time with 44-pixel minimum controls.
- Neither experience receives unrestricted district or statewide evidence.

### Platform Administrator and Auditor — governance proof

Default route: Governance Console.

- Administrator sees platform health, data ingestion, rejected records, job history, active analytical versions, role/unit mappings and non-secret configuration.
- Auditor sees read-only access events, alert lifecycle, model/run versions, decisions, evidence references, exports and configuration changes.
- The administrator does not automatically receive case evidence. Audit records are append-only.
- An admin-only `Persona Workspaces` directory lists each workspace, configured default route, scope type and an `Open workspace` link for monitoring and the jury demonstration. It does not create a second authorization or impersonation system.

### Command Centre — presentation mode

- Separate full-screen read-only route with high-contrast aggregate map, verified urgent alerts, active patterns, freshness and operational status.
- No personal evidence, report building, analyst editing or investigation controls.
- CCTV, social/public signals and major-event feeds remain visibly labelled future integrations until governed and implemented.

## Component Boundaries

- `AppShell`: global header, module rail, contextual navigation, responsive frame and synthetic banner.
- `workspace-navigation`: pure role/permission-to-navigation configuration; the UI still relies on server authorization for data access.
- `WorkspaceHeader` and `ContextBar`: consistent page metadata and filters.
- `StatusBadge`, `DataState`, `EvidenceDrawer` and `OperationalTable`: shared operational primitives.
- Persona feature modules compose those primitives and existing governed intelligence features; they do not duplicate API access logic.
- Existing `createApiClient` remains the single client boundary.

No new UI framework or icon dependency is required for this slice. Use existing React, React Router, Leaflet and CSS. Small line icons are local accessible SVG components.

## Data and Error Behavior

1. Load `/v1/workspace` before exposing role navigation.
2. Render only routes returned or permitted by the resolved workspace.
3. Persona screens request existing governed endpoints; unavailable capabilities render an honest unavailable/partial state.
4. A failed widget does not erase other completed workspace results.
5. Errors show a stable safe message and request ID when available; SDK errors, stacks and evidence payloads remain hidden.
6. Synthetic status, run version, freshness, confidence and limitations remain attached to analytical results through drilldown.

## Responsive and Accessibility Standard

- Desktop at 1440 pixels and above shows the full rail, contextual navigation and evidence drawer.
- Laptop at 1024–1439 pixels keeps the rail and collapses contextual navigation when necessary.
- Tablet at 768–1023 pixels uses compact navigation and full-screen evidence sheets.
- Below 768 pixels, only operational task flows remain primary; complex maps and networks provide summaries and table alternatives.
- Meet WCAG 2.1 AA contrast, logical landmarks/headings, keyboard navigation, visible focus, reduced-motion preference and non-colour state indicators.
- Tables retain headers and numeric alignment. Maps and charts provide textual/table alternatives.

## Visual Standard

- White global header, navy rail, light contextual navigation, `#F3F6F9` workspace canvas and white analytical surfaces.
- Use blue for selected/informational states, saffron for attention requiring review, red for confirmed urgent or destructive states and green for verified/completed states.
- Use restrained 6–10 pixel radii and minimal shadows. Do not use glass effects, neon colour, decorative gradients, giant numerals, animated backgrounds or floating marketing cards.
- Typography uses Inter/Segoe UI/system sans with Noto Sans Kannada fallback and tabular numerals for operational values.
- Dense screens use spacing and hierarchy, not tiny text; body text never drops below 12 pixels.

## Verification and Acceptance

Automated component tests must prove:

- role-specific navigation appears and unauthorized navigation does not;
- State Leadership is the default demo workspace;
- the admin Persona Workspaces directory exposes all configured workspace links;
- Command Centre route omits sensitive and editing controls;
- synthetic, freshness, unit scope and alert status remain visible;
- loading, empty, partial and error states render safely;
- existing report, dashboard, alert, hotspot and network behaviors do not regress.

Browser verification must cover 1440, 1024, 768 and 375 pixel widths, keyboard focus order, route navigation, evidence drilldown, overflow and use of the supplied KSP assets.

The challenge-alignment review must classify this as an enabling visualization change. It passes only if all Challenge 02 analytical proof remains sourced from governed APIs and the UI preserves evidence, explainability, human review, audit, synthetic labels and geographic authorization.

## Delivery Boundary

This slice changes the frontend presentation and role composition only. It does not:

- introduce fake data or new analytical claims;
- expand backend permissions or APIs;
- implement production impersonation;
- integrate deferred CCTV/social/major-event feeds;
- alter Catalyst Data Store schemas;
- deploy to Catalyst Development or Production without a separate reviewed deployment action.
