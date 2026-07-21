# Product Design System

## Direction: Command Navy

The interface should feel like a trusted analytical instrument: calm, authoritative, evidence-first, and suitable for long operational sessions. Use dark navy for navigation and framing, light surfaces for analytical work, blue for information, saffron for attention, and red only for urgent or destructive states.

## Design Principles

1. **Evidence before decoration:** every headline number leads to its period, method, quality, and evidence.
2. **Attention has meaning:** color indicates operational state, not visual variety.
3. **Role before feature:** each user opens on the decisions appropriate to their scope.
4. **Overview to proof:** preserve context while drilling from Karnataka to a case or graph edge.
5. **Uncertainty stays visible:** confidence, missingness, synthetic status, and limitations are never hidden.
6. **Dense but calm:** support professional analysis without dashboard clutter.

## Tokens

| Token | Value | Use |
|---|---|---|
| `navy-950` | `#071A2B` | application frame, command-centre background |
| `navy-900` | `#0B2742` | navigation and header |
| `blue-700` | `#155E9B` | primary data emphasis |
| `blue-500` | `#2583C5` | links, selection, map information |
| `saffron-600` | `#C76A00` | attention and elevated review |
| `red-700` | `#B42318` | urgent, destructive, failed |
| `green-700` | `#277A4B` | verified, completed, improving |
| `surface` | `#FFFFFF` | analytical panels |
| `canvas` | `#F3F6F9` | desktop workspace |
| `border` | `#D6DEE7` | dividers and controls |
| `text` | `#172B3A` | primary content |
| `muted` | `#5E7080` | secondary content |

Never rely on color alone. Pair state colors with labels, icons, shapes, or patterns. Map palettes must remain distinguishable for common color-vision deficiencies.

## Typography and Shape

- Primary family: `Inter`, with system sans-serif fallback.
- Kannada fallback: `Noto Sans Kannada`.
- Use tabular numerals for counts, dates, percentages, and scores.
- Page title: 28/34px, 650 weight; section title: 20/28px, 650; body: 14/21px; metadata: 12/18px.
- Use an 8px spacing system, 8px control radius, 12px panel radius, and restrained shadows.
- Dense tables may use 12–13px text but never below 12px.
- Minimum control height and touch target: 44px.

## Global Shell

- Navy left navigation shows product, authorized role, active unit scope, and core destinations.
- Top bar shows period, scope, data freshness, synthetic badge, search, notifications, and account.
- Main canvas uses a responsive 12-column grid with a maximum readable width for desktop and fluid analytical workspaces.
- A persistent context strip keeps selected period, district/station, analysis version, and filters visible.
- Evidence opens in a side drawer on wide screens and a full-screen sheet on smaller devices.

## Role Experiences

### Command Centre wallboard

- Dark navy large-screen canvas with high-contrast statewide map, verified urgent alerts, active patterns, freshness, and operational status.
- Optimized for glance distance; no personal evidence or complex editing.
- CCTV, public/social signals, news, and major-event feeds are labelled future inputs until implemented and governed.

### State leadership desktop

- Opens on a State Intelligence Brief, not a crowded dashboard.
- First row: what changed, affected districts, confidence, data quality, and action status.
- Main area: statewide hotspot/risk map, emerging cross-district patterns, district comparison, trend/anomaly summary.
- Every executive sentence or metric opens its evidence and limitations.

### City/district leadership desktop

- Opens on District Intelligence Pulse.
- Shows station comparison, hotspot evolution, category changes, ageing alerts, assignments, and outcome progress.
- Supports acknowledge, assign, prioritize, and monitor actions within authorized scope.

### Station/SHO desktop

- Opens on local active alerts and cases, ageing bands, overdue actions, and station hotspot/trend context.
- Keeps operational actions simple: acknowledge, inspect evidence, assign/verify, and record status/outcome.
- Does not expose statewide personal evidence.

### Analyst workstation

- Three-part layout: prioritized queue, synchronized analytical canvas, evidence/conclusion panel.
- Canvas switches among map, timeline, network, cases, component contribution, and district context without losing selection.
- Network edges state their evidence type and source; similarity is never shown as guilt.
- Analyst conclusion requires structured finding, confidence, limitations, evidence selection, and recommendation.

### Investigator tablet

- Responsive web view, not a separate native app.
- One-column task list with large controls, case/link verification, evidence preview, acknowledgement, notes, and outcome update.
- Offline operation and device-native capabilities are deferred.

## Analytical Components

### KPI and finding cards

- Show label, value, change, comparison window, quality/confidence, and freshness.
- Use a sentence such as “12 above 28-day baseline” rather than unexplained arrows.
- Cards must be actionable or evidence-linked; decorative totals are removed.

### Maps

- Use distinct switchable layers for incidents, hotspots, area risk, stations, and pattern links.
- Always show legend, observation period, method/version, completeness, and active filters.
- Clusters disclose contributing cases; risk cells disclose component contributions.
- Saffron means attention/review; red is reserved for confirmed urgent workflow state, not a high model score alone.

### Charts

- Prefer annotated lines for trends, bands for expected range, bars for district/station comparison, and contribution bars for explainability.
- Label axes, units, baseline, and missing periods. Avoid 3D charts, gauges, and decorative pies.
- Tooltips repeat values in accessible text; essential information cannot depend on hover.

### Network graph

- Different shapes identify case, resolved person, appearance, unit, legal, and location nodes.
- Edge style conveys evidence type and verification status.
- Provide a searchable table/path explanation as an accessible alternative.
- Centrality is navigation assistance, never dangerousness.

### Alerts and workflow

- Alert header shows status, severity, confidence, scope, age, assignee, method version, and synthetic label.
- Evidence, limitations, timeline, assignment, conclusion, outcome, and audit are distinct sections.
- Destructive or irreversible actions require confirmation and reason.

## Interaction States

- **Loading:** skeleton matching final geometry; do not show invented values.
- **Empty:** explain whether there is no data, no finding, or no authorized evidence.
- **Partial/stale:** show last successful run, missing source, and refresh status.
- **Low confidence:** keep the signal visible but subdued with the reason.
- **Forbidden:** preserve navigation context and explain that scope is restricted without revealing hidden evidence.
- **Error:** show a stable safe code, recovery action, and support/audit reference; never expose SDK details.
- **Success:** confirm the persisted action and updated version, not merely the button click.

## Responsive Breakpoints

- `≥1440px`: full leadership/analyst layout and evidence drawer.
- `1024–1439px`: compact navigation and two-column analytical layout.
- `768–1023px`: tablet shell, collapsible filters, full-screen evidence sheet.
- `<768px`: operational task flow only; complex network and state-comparison views provide summarized alternatives.

## Accessibility

- Meet WCAG 2.1 AA contrast for text and meaningful graphics.
- Full keyboard navigation, visible 2px focus ring, logical tab order, skip link, and focus restoration after drawers/dialogs.
- Use semantic headings, landmarks, tables, buttons, and live regions.
- Charts and maps include text summaries and data-table alternatives.
- Respect reduced motion; transitions are under 200ms and never required to understand state.
- Do not encode urgency through animation alone.

## Content Language

Use precise, cautious phrases: “potentially related,” “above baseline,” “requires verification,” and “area requiring review.” Avoid “criminal prediction,” “dangerous person,” “guilty network,” or causal claims unsupported by evidence.
