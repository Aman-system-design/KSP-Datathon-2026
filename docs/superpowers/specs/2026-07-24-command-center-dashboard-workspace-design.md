# Command Centre Dashboard Workspace Design

## Purpose

The Command Centre is the statewide presentation and exploration layer for KSP's governed crime-intelligence platform. It is not a fixed incident console. It lets authorized users compose reusable analytical reports into multiple dashboards, select a default dashboard, and adapt the same workspace to state, regional, or district scope.

The first implementation focuses on the Command Centre workspace itself. A full-width Report Builder is the connected report-editing destination, but building or redesigning that builder is outside this implementation scope.

## Product Direction

The experience combines three sources of truth:

- the existing KSP application shell, Catalyst design tokens, components, governed APIs, and synthetic data;
- Zoho Analytics-style dashboard and report workspace mechanics; and
- KSP command-room identity, Karnataka geography, police terminology, and jurisdiction-aware intelligence.

The interface must look native to the existing application. It must not introduce a separate mockup design language, copy ServiceNow branding, or display invented operational facts as if they were live data.

## User and Operating Mode

The primary user is a control-room or intelligence operator monitoring statewide conditions. Leadership also uses the same workspace for concise oversight and presentation.

The default is **Analytical mode**, designed for six to eight substantive reports. **Command-wall mode** increases information density for presentation displays without changing the dashboard definition. Light appearance remains the default; dark appearance is a separately designed command-wall presentation, not a simple color inversion.

## Information Architecture

### Reports

A report is a governed, reusable analytical object. It owns its query, visualization, filters, formatting, freshness metadata, and drill-down behavior. The same report may be placed in multiple dashboards without duplication.

Dashboard placement owns only presentation metadata: position, width, height, tab, and dashboard-specific display overrides. Resizing or moving a report does not change the underlying report.

### Dashboards

A dashboard is a named collection of report placements organized into one or more tabs. Dashboards may be system-provided, user-owned, or shared with the user. Authorized users can create dashboards from a blank canvas or a system template and choose a default dashboard.

### Command Centre

Opening Command Centre loads the user's authorized default dashboard. If no default is available, the workspace presents a purposeful empty state with actions to open the dashboard library or create a dashboard, subject to authorization.

## Dashboard Discovery

The existing Dashboard button in the left rail becomes the discovery entry point. It opens a panel over the current canvas rather than navigating immediately or turning the dashboard title into a dropdown.

The panel contains:

- search;
- recent dashboards;
- dashboards owned by the user;
- dashboards shared with the user;
- system dashboards and templates when authorized; and
- an **Open all dashboards** action leading to the complete dashboard library.

Selecting a dashboard replaces the current canvas in place and closes the panel. The current dashboard name remains visible in a compact workspace toolbar but is not itself a picker.

## Dashboard Tabs

A dashboard may contain multiple tabs, each with its own free canvas and report placements. Tabs do not occupy permanent top-level space. A compact collapsible tab control in the workspace toolbar exposes the tab list, current tab, tab creation, and tab management actions. The control closes after selection.

## View Mode

View mode is the default and removes editing chrome. It provides:

- the dashboard name and scope;
- current tab control;
- global time and jurisdiction filters supported by the dashboard;
- freshness and live-status metadata;
- Edit Dashboard for authorized users;
- presentation-mode entry; and
- functional report interactions such as filtering, tooltips, drill-down, refresh, and open-full-report.

The page must use balanced information density. No single report is forced to occupy most of the canvas; report size is determined by the saved dashboard layout.

## Edit Mode and Free Canvas

Edit Dashboard switches the current workspace into an explicit editing state. The canvas supports free report positioning and arbitrary resizing rather than fixed layout templates. Alignment guides and optional snapping may assist placement but must not restrict report dimensions to predefined slots.

In edit mode:

- hover and keyboard focus reveal report controls;
- reports can be moved and resized;
- controls include Edit report, display options, duplicate placement, refresh, and remove from dashboard;
- a configuration surface supports adding reports, text, images, tabs, and dashboard properties;
- changes are locally staged until Save;
- Cancel restores the last saved dashboard definition; and
- unsaved changes require confirmation before dashboard or route changes.

**Edit report** opens the same full-width Report Builder used to create reports. It must preserve a return target containing the dashboard, tab, and placement so the user returns to the same context. The builder follows the approved full-space workflow—Data, Visualization, Configure, Style—but its implementation is a separate project.

## Initial System Dashboard

The initial **State Crime Intelligence Overview** is a system dashboard assembled only from governed report definitions and available data. Its recommended report set is:

1. statewide crime pulse and change from an approved baseline;
2. interactive hotspot and cluster map using Karnataka geography;
3. crime trend with seasonal or expected-baseline comparison;
4. crime-category composition and movement;
5. district comparison and emerging-risk movement;
6. AI-detected patterns and anomalies with confidence and evidence;
7. priority alert stream with severity, jurisdiction, and freshness; and
8. predictive watchlist where an approved predictive output exists.

Unavailable data must produce an honest empty or unavailable state. The UI must never fabricate a metric, confidence score, district result, or live status. Alerts on the dashboard are a prioritized report; the left-rail Alerts destination remains the complete alert workspace.

## Authentic Visual Design

The Command Centre reuses the real application typography, spacing scale, colors, iconography, focus states, chart components, map components, and accessibility patterns. Reports should read as analytical surfaces rather than a collection of decorative cards.

Every report surface contains the context necessary to interpret it:

- report name;
- jurisdiction and time scope when not inherited globally;
- data freshness;
- visualization or result;
- comparison or baseline where applicable;
- AI confidence and evidence when applicable; and
- drill-down or full-report affordance.

Color communicates semantics—severity, change, confidence, selection, and map scale—and is never the only carrier of meaning.

## Authorization and Scope

The backend remains authoritative for dashboard, report, data-source, persona, and jurisdiction access. The client renders only resources returned as authorized. State, regional, and district Command Centres use the same workspace with scope constrained by the current governed persona and jurisdiction.

Create, edit, share, set-default, and presentation capabilities are permission-gated independently. Hidden dashboards and reports must not be discoverable through search, identifiers, client state, or error messages.

## State and Data Flow

1. The router resolves the governed Command Centre persona.
2. The workspace loads authorized dashboard summaries and the default dashboard identifier.
3. The selected dashboard loads its definition, tabs, placements, global filters, and referenced report summaries.
4. Report data requests use the governed identity, persona, jurisdiction, filters, and time scope.
5. Dashboard discovery changes the selected dashboard without changing persona or release query parameters.
6. Edit mode stages placement changes and saves a versioned dashboard definition.
7. A successful save refreshes the active definition; a conflict prompts reload or explicit reconciliation rather than silent overwrite.

## Error, Empty, and Loading States

- Dashboard metadata and individual reports load independently so one report failure does not blank the workspace.
- A report error exposes a safe retry and reference code without leaking query or authorization details.
- Empty results distinguish **no matching data** from **not configured**, **not authorized**, and **temporarily unavailable**.
- Deleted or revoked reports retain a clearly identified unavailable placement in edit mode so an owner can replace or remove it.
- The last successfully loaded dashboard may remain visible during a recoverable refresh failure, marked stale.

## Accessibility and Display Behavior

- Dashboard discovery, tab selection, report actions, and editing are fully keyboard operable.
- Move and resize operations have keyboard alternatives and accessible announcements.
- Focus is restored to the invoking control when panels close.
- View mode supports standard desktop widths; command-wall mode targets large displays.
- Narrow screens prioritize viewing and drill-down. Complex free-canvas editing may require a supported desktop width and must explain that constraint rather than silently breaking.
- Reduced-motion preferences disable nonessential transitions.

## Testing and Acceptance

The implementation is accepted when automated and browser checks demonstrate that:

- the authorized default dashboard opens directly;
- the left-rail Dashboard button opens recent, owned, shared, and system sections using authorized data;
- Open all dashboards reaches the dashboard library;
- selecting a dashboard loads it in place;
- the collapsible tab control switches tabs and does not consume permanent navigation space;
- view mode contains no editing chrome;
- authorized users can enter and leave edit mode;
- report placements can be moved and resized to arbitrary saved dimensions;
- cancel discards staged layout changes and save persists them;
- report controls are available on hover, focus, and keyboard interaction;
- Edit report preserves a return target to the same dashboard context;
- Analytical and Command-wall modes render the same reports at their intended density;
- light and dark appearances remain usable and accessible;
- report failures remain isolated;
- no unauthorized dashboard, report, or jurisdiction appears; and
- no invented metric is rendered when governed data is absent.

## Initial Implementation Boundary

The first real in-app prototype covers:

- dashboard workspace toolbar;
- default dashboard loading;
- left-rail dashboard discovery panel;
- collapsible dashboard tabs;
- authentic governed report rendering using existing components and data;
- view and edit modes;
- free placement and resizing with staged save/cancel behavior; and
- Analytical and Command-wall presentation density.

The complete dashboard library, dashboard sharing administration, and full Report Builder implementation are follow-on projects. The Command Centre may link to existing routes or explicit not-yet-available states for those capabilities until their dedicated designs are implemented.
